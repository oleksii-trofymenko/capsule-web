import type { ChatEvent } from '../../api/chat';
import {
  chatReducer,
  initialChatState,
  toApiMessages,
  type AssistantTurn,
  type ChatState,
} from './chat-state';

const ask = (state: ChatState, text: string, n: number) =>
  chatReducer(state, { type: 'ask', userId: `u${n}`, assistantId: `a${n}`, text, usedCustomPrompt: false });

const feed = (state: ChatState, events: ChatEvent[]) =>
  events.reduce((s, event) => chatReducer(s, { type: 'event', event }), state);

const lastTurn = (state: ChatState) => state.turns.at(-1) as AssistantTurn;

const done: ChatEvent = {
  type: 'done',
  ms: 4200,
  firstTokenMs: 800,
  modelCalls: 2,
  inputTokens: 300,
  outputTokens: 40,
};

describe('chat reducer', () => {
  it('adds the question and an empty streaming answer', () => {
    const state = ask(initialChatState, 'Hello', 1);
    expect(state.turns).toMatchObject([
      { role: 'user', text: 'Hello' },
      { role: 'assistant', status: 'streaming', parts: [] },
    ]);
  });

  it('keeps text and tool calls in the order they happened', () => {
    const state = feed(ask(initialChatState, 'Wedding?', 1), [
      {
        type: 'start',
        provider: 'ollama',
        model: 'gemma4:12b',
        tools: ['get_dress_code'],
        systemPrompt: 'P',
      },
      { type: 'token', text: 'Let me ' },
      { type: 'token', text: 'check.' },
      { type: 'tool_call', id: 'c1', name: 'get_dress_code', args: { occasion: 'wedding guest' } },
      { type: 'tool_result', id: 'c1', name: 'get_dress_code', ok: true, result: '{"found":true}', ms: 3 },
      { type: 'token', text: 'Avoid white.' },
      done,
    ]);

    const turn = lastTurn(state);
    expect(turn.parts).toEqual([
      { kind: 'text', text: 'Let me check.' },
      {
        kind: 'tool',
        id: 'c1',
        name: 'get_dress_code',
        args: { occasion: 'wedding guest' },
        status: 'ok',
        result: '{"found":true}',
        ms: 3,
      },
      { kind: 'text', text: 'Avoid white.' },
    ]);
    expect(turn).toMatchObject({ status: 'done', model: 'gemma4:12b', stats: { ms: 4200 } });
    expect(state.lastSystemPrompt).toBe('P');
  });

  it('marks a failed tool and matches results to calls by id', () => {
    const state = feed(ask(initialChatState, 'Q', 1), [
      { type: 'tool_call', id: 'a', name: 'get_today', args: {} },
      { type: 'tool_call', id: 'b', name: 'search_wardrobe', args: { category: 'hats' } },
      { type: 'tool_result', id: 'b', name: 'search_wardrobe', ok: false, result: 'Tool failed: bad', ms: 1 },
    ]);
    expect(lastTurn(state).parts).toMatchObject([
      { id: 'a', status: 'running' },
      { id: 'b', status: 'failed', result: 'Tool failed: bad' },
    ]);
  });

  it('records a stream error on the answer', () => {
    const state = feed(ask(initialChatState, 'Q', 1), [{ type: 'error', message: 'model not found' }]);
    expect(lastTurn(state)).toMatchObject({ status: 'error', error: 'model not found' });
  });

  it('"stopped" only affects an answer that is still streaming', () => {
    const streaming = ask(initialChatState, 'Q', 1);
    expect(lastTurn(chatReducer(streaming, { type: 'stopped' })).status).toBe('stopped');

    const finished = feed(streaming, [done]);
    expect(lastTurn(chatReducer(finished, { type: 'stopped' })).status).toBe('done');
  });

  it('clears the conversation but remembers the default prompt', () => {
    const state = feed(ask(initialChatState, 'Q', 1), [
      { type: 'start', provider: 'ollama', model: 'm', tools: [], systemPrompt: 'P' },
    ]);
    expect(chatReducer(state, { type: 'clear' })).toEqual({ turns: [], lastSystemPrompt: 'P' });
  });
});

describe('toApiMessages', () => {
  it('sends text only, leaving tool calls out', () => {
    const state = feed(ask(initialChatState, 'Wedding?', 1), [
      { type: 'tool_call', id: 'c1', name: 'get_dress_code', args: {} },
      { type: 'tool_result', id: 'c1', name: 'get_dress_code', ok: true, result: '{}', ms: 1 },
      { type: 'token', text: ' Avoid white. ' },
      done,
    ]);
    expect(toApiMessages(state.turns)).toEqual([
      { role: 'user', content: 'Wedding?' },
      { role: 'assistant', content: 'Avoid white.' },
    ]);
  });

  it('drops a question whose answer failed or was empty, so roles keep alternating', () => {
    let state = feed(ask(initialChatState, 'First', 1), [{ type: 'token', text: 'One.' }, done]);
    state = feed(ask(state, 'Second', 2), [{ type: 'error', message: 'boom' }]);
    state = chatReducer(ask(state, 'Third', 3), { type: 'stopped' });
    expect(toApiMessages(state.turns)).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'One.' },
    ]);
  });

  it('keeps a stopped answer that already has text', () => {
    let state = feed(ask(initialChatState, 'Q', 1), [{ type: 'token', text: 'Partial' }]);
    state = chatReducer(state, { type: 'stopped' });
    expect(toApiMessages(state.turns)).toEqual([
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'Partial' },
    ]);
  });
});
