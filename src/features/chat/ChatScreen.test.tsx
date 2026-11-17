import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatEvent } from '../../api/chat';
import { json, mockApi, sse, tokens } from '../../test/fake-api';
import { ChatScreen } from './ChatScreen';

const session = { email: 'ana@example.com', tokens };

const start: ChatEvent = {
  type: 'start',
  provider: 'ollama',
  model: 'gemma4:12b',
  tools: ['get_today', 'search_wardrobe', 'get_dress_code'],
  systemPrompt: 'You are Capsule, a personal stylist.',
};
const done: ChatEvent = {
  type: 'done',
  ms: 4200,
  firstTokenMs: 800,
  modelCalls: 2,
  inputTokens: 312,
  outputTokens: 41,
};

function renderChat() {
  const props = { session, onTokens: vi.fn(), onSessionEnded: vi.fn(), onSignOut: vi.fn() };
  render(<ChatScreen {...props} />);
  return props;
}

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText('Message the stylist'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('ChatScreen', () => {
  it('shows the answer, the tool call with what it sent and returned, and the timings', async () => {
    const calls = mockApi({
      'POST /v1/playground/chat': () =>
        sse([
          start,
          { type: 'tool_call', id: 'c1', name: 'get_dress_code', args: { occasion: 'wedding guest' } },
          {
            type: 'tool_result',
            id: 'c1',
            name: 'get_dress_code',
            ok: true,
            result: '{"found":true,"rules":["Do not wear white"]}',
            ms: 3,
          },
          { type: 'token', text: 'Wear the navy blazer. ' },
          { type: 'token', text: 'Avoid white.' },
          done,
        ]),
    });
    renderChat();

    await ask('What do I wear to a wedding?');

    expect(await screen.findByText('Wear the navy blazer. Avoid white.')).toBeInTheDocument();
    expect(screen.getByText('What do I wear to a wedding?')).toBeInTheDocument();

    expect(calls[0]).toMatchObject({
      authorization: 'Bearer access-1',
      body: { messages: [{ role: 'user', content: 'What do I wear to a wedding?' }], tools: true },
    });
    expect(calls[0].body).not.toHaveProperty('systemPrompt');

    const tag = screen.getByText('get_dress_code').closest('details')!;
    expect(within(tag).getByText('3 ms')).toBeInTheDocument();
    expect(within(tag).getByText(/"occasion": "wedding guest"/)).toBeInTheDocument();
    expect(within(tag).getByText(/Do not wear white/)).toBeInTheDocument();

    expect(screen.getByText('first word 0.8 s')).toBeInTheDocument();
    expect(screen.getByText('total 4.2 s')).toBeInTheDocument();
    expect(screen.getByText('2 model calls')).toBeInTheDocument();
    expect(screen.getByText('312 tokens in, 41 out')).toBeInTheDocument();
    expect(screen.getByText('Answered by gemma4:12b')).toBeInTheDocument();
  });

  it('sends earlier turns with the next question', async () => {
    let n = 0;
    const calls = mockApi({
      'POST /v1/playground/chat': () =>
        sse([start, { type: 'token', text: n++ === 0 ? 'Daytime or evening?' : 'Then the blazer.' }, done]),
    });
    renderChat();

    await ask('I have a wedding.');
    await screen.findByText('Daytime or evening?');
    await ask('Evening.');
    await screen.findByText('Then the blazer.');

    expect((calls[1].body as { messages: unknown }).messages).toEqual([
      { role: 'user', content: 'I have a wedding.' },
      { role: 'assistant', content: 'Daytime or evening?' },
      { role: 'user', content: 'Evening.' },
    ]);
  });

  it('applies the settings: tools off and a custom system prompt', async () => {
    const calls = mockApi({
      'POST /v1/playground/chat': () => sse([{ ...start, tools: [] }, { type: 'token', text: 'Ok.' }, done]),
      'GET /v1/models': () =>
        json({
          routes: {
            vision: { provider: 'ollama', model: 'gemma4:12b' },
            reasoning: { provider: 'ollama', model: 'gemma4:12b' },
            embedding: { provider: 'ollama', model: 'nomic-embed-text' },
          },
          providers: { ollama: { ok: false, detail: 'unreachable' } },
        }),
    });
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('ollama: not reachable (unreachable)')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Let the model use tools'));
    await userEvent.type(screen.getByLabelText('System prompt'), 'Answer in one word.');
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }));

    await ask('Hello');
    await screen.findByText('Ok.');

    const chat = calls.find((c) => c.path === '/v1/playground/chat')!;
    expect(chat.body).toMatchObject({ tools: false, systemPrompt: 'Answer in one word.' });
    expect(screen.getByText('Answered by gemma4:12b, tools off, custom system prompt')).toBeInTheDocument();
  });

  it('shows an error the model reported mid-stream', async () => {
    mockApi({
      'POST /v1/playground/chat': () =>
        sse([start, { type: 'error', message: 'model "gemma4:12b" not found, try pulling it first' }]),
    });
    renderChat();
    await ask('Hello');
    expect(await screen.findByRole('alert')).toHaveTextContent('model "gemma4:12b" not found');
  });

  it('refreshes an expired access token once and retries', async () => {
    const calls = mockApi({
      'POST /v1/playground/chat': (call) =>
        call.authorization === 'Bearer access-2'
          ? sse([start, { type: 'token', text: 'Hello again.' }, done])
          : json({ message: 'Unauthorized' }, 401),
      'POST /v1/auth/refresh': () => json({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' }),
    });
    const props = renderChat();

    await ask('Hello');

    expect(await screen.findByText('Hello again.')).toBeInTheDocument();
    expect(calls.map((c) => c.path)).toEqual([
      '/v1/playground/chat',
      '/v1/auth/refresh',
      '/v1/playground/chat',
    ]);
    expect(props.onTokens).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-2' }));
  });

  it('ends the session when the refresh token is rejected too', async () => {
    mockApi({
      'POST /v1/playground/chat': () => json({ message: 'Unauthorized' }, 401),
      'POST /v1/auth/refresh': () => json({ message: 'Invalid refresh token' }, 401),
    });
    const props = renderChat();
    await ask('Hello');
    await vi.waitFor(() => expect(props.onSessionEnded).toHaveBeenCalled());
  });

  it('starts a conversation from a sample question and can clear it', async () => {
    mockApi({
      'POST /v1/playground/chat': () => sse([start, { type: 'token', text: 'Three pairs.' }, done]),
    });
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: 'Which shoes do I own?' }));
    expect(await screen.findByText('Three pairs.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(screen.queryByText('Three pairs.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ask the stylist something' })).toBeInTheDocument();
  });
});
