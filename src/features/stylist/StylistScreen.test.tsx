import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Memory, WardrobeItem } from '../../api/client';
import type { StylistEvent } from '../../api/stylist';
import { json, mockApi, sse, type Call } from '../../test/fake-api';
import { renderSignedIn } from '../../test/render-signed-in';
import { MemoryNotes } from '../profile/MemoryNotes';
import { StylistScreen } from './StylistScreen';

const blazer: WardrobeItem = {
  id: 'item-blazer',
  name: 'Navy wool blazer',
  category: 'outerwear',
  colour: 'navy',
  formality: 'formal',
  seasons: ['autumn'],
  size: null,
  photoId: 'photo-1',
  photoUrl: 'http://storage.test/photos/photo-1?view',
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
};

const outfitReply: StylistEvent[] = [
  { type: 'step', step: 'load-context' },
  { type: 'step', step: 'compose' },
  {
    type: 'outfit',
    id: 'outfit-1',
    occasion: 'wedding-guest',
    items: [
      { id: 'item-blazer', name: 'Navy wool blazer' },
      { id: 'item-trousers', name: 'Charcoal wool trousers' },
    ],
    removed: [{ name: 'White leather trainers', reason: 'No trainers.' }],
    missing: null,
  },
  { type: 'token', text: 'The blazer and trousers ' },
  { type: 'token', text: 'keep it formal.' },
  { type: 'done', ms: 1200, firstTokenMs: 900, consulted: ['wardrobe', 'date', 'dress-code'] },
];

function api(reply: StylistEvent[] = outfitReply) {
  return mockApi({
    'GET /v1/wardrobe/items': () => json({ items: [blazer] }),
    'POST /v1/stylist/chat': () => sse(reply),
    'PATCH /v1/outfits/outfit-1/feedback': ({ body }: Call) =>
      json({
        id: 'outfit-1',
        occasionId: 'wedding-guest',
        items: [],
        createdAt: '2026-11-17T10:00:00.000Z',
        rating: null,
        worn: false,
        note: null,
        feedbackAt: '2026-11-17T10:01:00.000Z',
        ...(body as object),
      }),
  });
}

describe('StylistScreen', () => {
  it('streams an outfit card with wardrobe photos and the reply, from a sample question', async () => {
    const calls = api();
    renderSignedIn(<StylistScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'What should I wear to a wedding on Saturday?' }));

    const card = await screen.findByRole('article', { name: 'Your outfit' });
    expect(await within(card).findByRole('img', { name: 'Navy wool blazer' })).toHaveAttribute(
      'src',
      'http://storage.test/photos/photo-1?view',
    );
    expect(within(card).getByText('Charcoal wool trousers')).toBeInTheDocument();
    expect(within(card).getByText('Left out White leather trainers: No trainers.')).toBeInTheDocument();
    expect(screen.getByText('The blazer and trousers keep it formal.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/stylist/chat')?.body).toEqual({
      messages: [{ role: 'user', content: 'What should I wear to a wedding on Saturday?' }],
    });
  });

  it('refreshes what Capsule remembers once a reply has finished', async () => {
    let chatted = false;
    mockApi({
      'GET /v1/wardrobe/items': () => json({ items: [blazer] }),
      'GET /v1/memory': () =>
        json({
          notes: chatted
            ? [{ id: 'note-1', kind: 'dislike', text: 'yellow', createdAt: '2026-11-18T10:00:00.000Z' }]
            : [],
        } satisfies Memory),
      'POST /v1/stylist/chat': () => {
        chatted = true;
        return sse(outfitReply);
      },
    });
    renderSignedIn(
      <>
        <StylistScreen />
        <MemoryNotes />
      </>,
    );
    const user = userEvent.setup();
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Message the stylist'), 'I never wear yellow.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('yellow')).toBeInTheDocument();
  });

  it('records a like, clears it, and saves a note on the outfit', async () => {
    const calls = api();
    renderSignedIn(<StylistScreen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'What should I wear to a wedding on Saturday?' }));
    const card = await screen.findByRole('article', { name: 'Your outfit' });

    await user.click(within(card).getByRole('button', { name: 'Like' }));
    expect(await within(card).findByRole('button', { name: 'Like', pressed: true })).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Like' }));
    expect(await within(card).findByRole('button', { name: 'Like', pressed: false })).toBeInTheDocument();
    await user.type(within(card).getByLabelText('Note for Capsule'), 'Too warm for June');
    await user.click(within(card).getByRole('button', { name: 'Save note' }));
    expect(await within(card).findByText('Thanks, noted.')).toBeInTheDocument();

    const feedback = calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
    expect(feedback).toEqual([{ rating: 'like' }, { rating: null }, { note: 'Too warm for June' }]);
  });

  it('sends the earlier turns with a follow-up question', async () => {
    const calls = api([
      { type: 'token', text: 'Where are you heading?' },
      { type: 'done', ms: 100, firstTokenMs: 90, consulted: [] },
    ]);
    renderSignedIn(<StylistScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Message the stylist'), "I'm going out{Enter}");
    await screen.findByText('Where are you heading?');
    await user.type(screen.getByLabelText('Message the stylist'), 'Drinks with friends{Enter}');
    await screen.findByText('Drinks with friends');

    const chats = calls.filter((c) => c.path === '/v1/stylist/chat');
    expect(chats[1].body).toEqual({
      messages: [
        { role: 'user', content: "I'm going out" },
        { role: 'assistant', content: 'Where are you heading?' },
        { role: 'user', content: 'Drinks with friends' },
      ],
    });
  });

  it('shows an error the stylist reports', async () => {
    api([{ type: 'error', message: 'The stylist could not answer just now. Please try again.' }]);
    renderSignedIn(<StylistScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Message the stylist'), 'Office outfit?{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('The stylist could not answer just now.');
  });
});
