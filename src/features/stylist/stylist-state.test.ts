import { initialStylistState, stylistReducer, toMessages, type StylistState } from './stylist-state';

const asked = stylistReducer(initialStylistState, {
  type: 'ask',
  userId: 'u1',
  stylistId: 's1',
  text: 'Wedding?',
});

describe('stylistReducer', () => {
  it('follows the steps, keeps the outfit, appends text and finishes', () => {
    const outfit = {
      type: 'outfit' as const,
      id: 'o1',
      occasion: 'wedding-guest',
      items: [{ id: 'i1', name: 'Navy wool blazer' }],
      removed: [],
      missing: null,
    };
    let state = stylistReducer(asked, { type: 'event', event: { type: 'step', step: 'compose' } });
    expect(state.turns[1]).toMatchObject({ step: 'compose', status: 'streaming' });
    state = stylistReducer(state, { type: 'event', event: outfit });
    state = stylistReducer(state, { type: 'event', event: { type: 'token', text: 'Navy ' } });
    state = stylistReducer(state, { type: 'event', event: { type: 'token', text: 'blazer.' } });
    state = stylistReducer(state, {
      type: 'event',
      event: { type: 'done', ms: 1000, firstTokenMs: 800, consulted: ['wardrobe'] },
    });
    expect(state.turns[1]).toMatchObject({ outfit, text: 'Navy blazer.', step: null, status: 'done' });
  });

  it('records an error from the stream or from the request', () => {
    const fromStream = stylistReducer(asked, { type: 'event', event: { type: 'error', message: 'Busy.' } });
    expect(fromStream.turns[1]).toMatchObject({ status: 'error', error: 'Busy.' });
    const fromRequest = stylistReducer(asked, { type: 'failed', message: 'Offline.' });
    expect(fromRequest.turns[1]).toMatchObject({ status: 'error', error: 'Offline.' });
  });
});

describe('toMessages', () => {
  const state: StylistState = {
    turns: [
      { id: '1', role: 'user', text: 'First' },
      { id: '2', role: 'stylist', text: 'Reply', step: null, outfit: null, status: 'done', error: null },
      { id: '3', role: 'user', text: 'Second' },
      { id: '4', role: 'stylist', text: '', step: null, outfit: null, status: 'error', error: 'x' },
    ],
  };

  it('sends turns with text, as the API names them', () => {
    expect(toMessages(state.turns)).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply' },
      { role: 'user', content: 'Second' },
    ]);
  });

  it('keeps the latest turns and never starts with the stylist', () => {
    expect(toMessages(state.turns, 2)).toEqual([{ role: 'user', content: 'Second' }]);
  });
});
