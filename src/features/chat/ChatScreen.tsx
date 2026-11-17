import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { streamChat } from '../../api/chat';
import { ApiError, api, isNetworkError, type Tokens } from '../../api/client';
import { en } from '../../strings/en';
import { SessionEndedError, withSession, type Session } from '../auth/session';
import { chatReducer, initialChatState, toApiMessages } from './chat-state';
import { Composer } from './Composer';
import { SettingsSheet, type ChatSettings } from './SettingsSheet';
import { TurnView } from './TurnView';

interface Props {
  session: Session;
  onTokens: (tokens: Tokens) => void;
  onSessionEnded: () => void;
  onSignOut: () => void;
}

let nextId = 0;
const newId = () => `t${++nextId}`;

export function ChatScreen({ session, onTokens, onSessionEnded, onSignOut }: Props) {
  const t = en.chat;
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [settings, setSettings] = useState<ChatSettings>({ toolsEnabled: true, systemPrompt: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const last = state.turns.at(-1);
  const streaming = last?.role === 'assistant' && last.status === 'streaming';

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [state.turns]);

  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const customPrompt = settings.systemPrompt.trim();
    // The API accepts 40 messages; keep the most recent ones and end with the new question.
    const messages = [...toApiMessages(state.turns), { role: 'user' as const, content: text }].slice(-39);
    if (messages[0]?.role === 'assistant') messages.shift();

    dispatch({
      type: 'ask',
      userId: newId(),
      assistantId: newId(),
      text,
      usedCustomPrompt: customPrompt !== '',
    });

    const controller = new AbortController();
    abort.current = controller;
    try {
      await withSession(session, onTokens, (token) =>
        streamChat(
          { messages, tools: settings.toolsEnabled, ...(customPrompt ? { systemPrompt: customPrompt } : {}) },
          { token, signal: controller.signal, onEvent: (event) => dispatch({ type: 'event', event }) },
        ),
      );
      // A stream that closes without "done" or "error" was cut off.
      dispatch({ type: 'stopped' });
    } catch (error) {
      if (controller.signal.aborted) dispatch({ type: 'stopped' });
      else if (error instanceof SessionEndedError) onSessionEnded();
      else if (isNetworkError(error)) dispatch({ type: 'failed', message: en.errors.network });
      else if (error instanceof ApiError && error.status === 429)
        dispatch({ type: 'failed', message: en.errors.tooManyRequests });
      else
        dispatch({ type: 'failed', message: error instanceof ApiError ? error.message : en.errors.generic });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  }

  const loadModels = useCallback(
    () => withSession(session, onTokens, (token) => api.models(token)),
    [session, onTokens],
  );

  return (
    <div className="room">
      <header className="bar">
        <h1>{en.chat.title}</h1>
        <div className="bar-actions">
          <button
            className="link"
            type="button"
            onClick={() => dispatch({ type: 'clear' })}
            disabled={streaming || state.turns.length === 0}
          >
            {t.clear}
          </button>
          <button className="button" type="button" onClick={() => setSettingsOpen(true)}>
            {t.settings}
          </button>
        </div>
      </header>

      <main className="thread" aria-live="polite">
        {state.turns.length === 0 ? (
          <section className="empty">
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyBody}</p>
            <ul>
              {t.samples.map((sample) => (
                <li key={sample}>
                  <button type="button" className="sample" onClick={() => void send(sample)}>
                    {sample}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="seam">
            {state.turns.map((turn) => (
              <TurnView key={turn.id} turn={turn} />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </main>

      <Composer
        streaming={streaming}
        onSend={(text) => void send(text)}
        onStop={() => abort.current?.abort()}
      />

      <SettingsSheet
        open={settingsOpen}
        email={session.email}
        settings={settings}
        defaultPrompt={state.lastSystemPrompt}
        loadModels={loadModels}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        onSignOut={onSignOut}
      />
    </div>
  );
}
