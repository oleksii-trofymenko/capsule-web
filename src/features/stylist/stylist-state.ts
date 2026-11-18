import type { StylistEvent } from '../../api/stylist';

export type OutfitEvent = Extract<StylistEvent, { type: 'outfit' }>;

export type StylistTurn =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'stylist';
      text: string;
      /** The graph step in progress, while streaming. */
      step: string | null;
      outfit: OutfitEvent | null;
      status: 'streaming' | 'done' | 'error' | 'stopped';
      error: string | null;
    };

export interface StylistState {
  turns: StylistTurn[];
}

export type StylistAction =
  | { type: 'ask'; userId: string; stylistId: string; text: string }
  | { type: 'event'; event: StylistEvent }
  | { type: 'failed'; message: string }
  | { type: 'stopped' };

export const initialStylistState: StylistState = { turns: [] };

/** Applies a change to the stylist turn being streamed, which is always the last one. */
function updateLast(
  state: StylistState,
  change: (turn: Extract<StylistTurn, { role: 'stylist' }>) => StylistTurn,
) {
  const last = state.turns.at(-1);
  if (last?.role !== 'stylist') return state;
  return { turns: [...state.turns.slice(0, -1), change(last)] };
}

export function stylistReducer(state: StylistState, action: StylistAction): StylistState {
  switch (action.type) {
    case 'ask':
      return {
        turns: [
          ...state.turns,
          { id: action.userId, role: 'user', text: action.text },
          {
            id: action.stylistId,
            role: 'stylist',
            text: '',
            step: null,
            outfit: null,
            status: 'streaming',
            error: null,
          },
        ],
      };
    case 'event': {
      const e = action.event;
      return updateLast(state, (turn) => {
        switch (e.type) {
          case 'step':
            return { ...turn, step: e.step };
          case 'outfit':
            return { ...turn, outfit: e };
          case 'token':
            return { ...turn, text: turn.text + e.text };
          case 'done':
            return { ...turn, step: null, status: 'done' };
          case 'error':
            return { ...turn, step: null, status: 'error', error: e.message };
        }
      });
    }
    case 'failed':
      return updateLast(state, (turn) => ({ ...turn, step: null, status: 'error', error: action.message }));
    case 'stopped':
      return updateLast(state, (turn) => ({ ...turn, step: null, status: 'stopped' }));
  }
}

/** The conversation as the API takes it: the latest turns with text, ending with the person's message. */
export function toMessages(turns: StylistTurn[], limit = 30) {
  const messages = turns
    .filter((t) => t.text.trim() !== '')
    .map((t) => ({ role: t.role === 'user' ? ('user' as const) : ('assistant' as const), content: t.text }))
    .slice(-limit);
  while (messages[0]?.role === 'assistant') messages.shift();
  return messages;
}
