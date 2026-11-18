import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef } from 'react';
import { streamStylist } from '../../api/stylist';
import { memoryKey } from '../profile/queries';
import { en } from '../../strings/en';
import { Composer } from '../chat/Composer';
import { useAuthedCall } from '../auth/SessionContext';
import { OutfitCard } from './OutfitCard';
import { initialStylistState, stylistReducer, toMessages } from './stylist-state';

const newId = () => crypto.randomUUID();

/** Ask the stylist; outfits arrive as cards to rate, the reply streams in. */
export function StylistScreen() {
  const t = en.stylist;
  const call = useAuthedCall();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(stylistReducer, initialStylistState);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const last = state.turns.at(-1);
  const streaming = last?.role === 'stylist' && last.status === 'streaming';

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [state.turns]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const messages = [...toMessages(state.turns, 29), { role: 'user' as const, content: text }];
    dispatch({ type: 'ask', userId: newId(), stylistId: newId(), text });
    const controller = new AbortController();
    abort.current = controller;
    try {
      await call((token) =>
        streamStylist(
          { messages },
          { token, signal: controller.signal, onEvent: (event) => dispatch({ type: 'event', event }) },
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      dispatch({ type: 'failed', message: t.failed });
    } finally {
      // The stylist may have remembered something the person said.
      void queryClient.invalidateQueries({ queryKey: memoryKey });
    }
  }

  function stop() {
    abort.current?.abort();
    dispatch({ type: 'stopped' });
  }

  return (
    <section className="screen stylist" aria-labelledby="stylist-title">
      <h1 id="stylist-title" className="screen-title">
        {t.title}
      </h1>

      {state.turns.length === 0 && (
        <div className="status">
          <p className="status-title">{t.emptyTitle}</p>
          <p>{t.emptyBody}</p>
          <ul className="samples">
            {t.samples.map((s) => (
              <li key={s}>
                <button type="button" className="button" onClick={() => void send(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="stylist-turns">
        {state.turns.map((turn) =>
          turn.role === 'user' ? (
            <li key={turn.id} className="turn turn-user">
              <span className="visually-hidden">{t.you}: </span>
              {turn.text}
            </li>
          ) : (
            <li key={turn.id} className="turn turn-stylist">
              <span className="visually-hidden">{t.capsule}: </span>
              {turn.status === 'streaming' && (
                <p className="hint" role="status">
                  {(turn.step && t.steps[turn.step]) ?? t.working}
                </p>
              )}
              {turn.outfit && turn.outfit.items.length > 0 && <OutfitCard outfit={turn.outfit} />}
              {turn.text && <p className="turn-text">{turn.text}</p>}
              {turn.status === 'stopped' && <p className="hint">{t.stopped}</p>}
              {turn.status === 'error' && (
                <p className="form-error" role="alert">
                  {turn.error}
                </p>
              )}
            </li>
          ),
        )}
      </ol>
      <div ref={bottom} />

      <Composer streaming={streaming} onSend={(text) => void send(text)} onStop={stop} />
    </section>
  );
}
