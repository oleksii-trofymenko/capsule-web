import { en } from '../../strings/en';
import type { Turn } from './chat-state';
import { Tape } from './Tape';
import { ToolTag } from './ToolTag';

export function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <article className="turn turn-user">
        <p>{turn.text}</p>
      </article>
    );
  }

  const t = en.chat;
  const waiting = turn.status === 'streaming' && turn.parts.length === 0;

  return (
    <article className="turn turn-stylist" aria-busy={turn.status === 'streaming'}>
      {waiting && <p className="waiting">{t.thinking}</p>}

      {turn.parts.map((part, index) =>
        part.kind === 'text' ? (
          // Model output is rendered as plain text, never as HTML.
          <p key={index} className="answer">
            {part.text}
            {turn.status === 'streaming' && index === turn.parts.length - 1 && (
              <span className="needle" aria-hidden="true" />
            )}
          </p>
        ) : (
          <ToolTag key={part.id} part={part} />
        ),
      )}

      {turn.status === 'stopped' && <p className="waiting">{t.stopped}</p>}
      {turn.status === 'error' && (
        <p className="turn-error" role="alert">
          {turn.error}
        </p>
      )}
      {turn.status === 'done' && <Tape turn={turn} />}
    </article>
  );
}
