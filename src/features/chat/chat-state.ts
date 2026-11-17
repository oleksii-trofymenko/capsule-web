import type { ChatEvent } from '../../api/chat';

export type Part =
  | { kind: 'text'; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      args: unknown;
      status: 'running' | 'ok' | 'failed';
      result?: string;
      ms?: number;
    };

export interface AssistantTurn {
  role: 'assistant';
  id: string;
  status: 'streaming' | 'done' | 'stopped' | 'error';
  parts: Part[];
  model?: string;
  toolsOffered?: string[];
  usedCustomPrompt: boolean;
  stats?: Extract<ChatEvent, { type: 'done' }>;
  error?: string;
}

export interface UserTurn {
  role: 'user';
  id: string;
  text: string;
}

export type Turn = UserTurn | AssistantTurn;

export interface ChatState {
  turns: Turn[];
  /** The system prompt the API reported using last; shown in settings as the default. */
  lastSystemPrompt: string | null;
}

export type ChatAction =
  | { type: 'ask'; userId: string; assistantId: string; text: string; usedCustomPrompt: boolean }
  | { type: 'event'; event: ChatEvent }
  | { type: 'stopped' }
  | { type: 'failed'; message: string }
  | { type: 'clear' };

export const initialChatState: ChatState = { turns: [], lastSystemPrompt: null };

function updateLast(state: ChatState, change: (turn: AssistantTurn) => AssistantTurn): ChatState {
  const last = state.turns.at(-1);
  if (!last || last.role !== 'assistant') return state;
  return { ...state, turns: [...state.turns.slice(0, -1), change(last)] };
}

function applyEvent(turn: AssistantTurn, event: ChatEvent): AssistantTurn {
  switch (event.type) {
    case 'start':
      return { ...turn, model: event.model, toolsOffered: event.tools };
    case 'token': {
      const last = turn.parts.at(-1);
      // Text between tool calls stays in its own part, so the order of events is preserved.
      if (last?.kind === 'text') {
        return {
          ...turn,
          parts: [...turn.parts.slice(0, -1), { kind: 'text', text: last.text + event.text }],
        };
      }
      return { ...turn, parts: [...turn.parts, { kind: 'text', text: event.text }] };
    }
    case 'tool_call':
      return {
        ...turn,
        parts: [
          ...turn.parts,
          { kind: 'tool', id: event.id, name: event.name, args: event.args, status: 'running' },
        ],
      };
    case 'tool_result':
      return {
        ...turn,
        parts: turn.parts.map((part) =>
          part.kind === 'tool' && part.id === event.id
            ? { ...part, status: event.ok ? 'ok' : 'failed', result: event.result, ms: event.ms }
            : part,
        ),
      };
    case 'done':
      return { ...turn, status: 'done', stats: event };
    case 'error':
      return { ...turn, status: 'error', error: event.message };
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ask':
      return {
        ...state,
        turns: [
          ...state.turns,
          { role: 'user', id: action.userId, text: action.text },
          {
            role: 'assistant',
            id: action.assistantId,
            status: 'streaming',
            parts: [],
            usedCustomPrompt: action.usedCustomPrompt,
          },
        ],
      };
    case 'event': {
      const next = updateLast(state, (turn) => applyEvent(turn, action.event));
      return action.event.type === 'start' ? { ...next, lastSystemPrompt: action.event.systemPrompt } : next;
    }
    case 'stopped':
      return updateLast(state, (turn) =>
        turn.status === 'streaming' ? { ...turn, status: 'stopped' } : turn,
      );
    case 'failed':
      return updateLast(state, (turn) => ({ ...turn, status: 'error', error: action.message }));
    case 'clear':
      return { ...state, turns: [] };
  }
}

/** The conversation as the API expects it: text only, and no empty or failed answers. */
export function toApiMessages(turns: Turn[]): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text });
      continue;
    }
    const text = turn.parts
      .map((p) => (p.kind === 'text' ? p.text : ''))
      .join('')
      .trim();
    if (text && turn.status !== 'error') {
      messages.push({ role: 'assistant', content: text });
    } else {
      // Drop the question too, so the API never sees two user messages in a row.
      if (messages.at(-1)?.role === 'user') messages.pop();
    }
  }
  return messages;
}
