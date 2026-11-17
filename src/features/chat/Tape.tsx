import { en } from '../../strings/en';
import type { AssistantTurn } from './chat-state';

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** Total time drawn as a tailor's tape: one tick per second, a notch where the first word arrived. */
export function Tape({ turn }: { turn: AssistantTurn }) {
  const stats = turn.stats;
  if (!stats) return null;
  const t = en.chat;
  // 28px per second, so answers can be compared by eye; very long ones are capped by the container.
  const width = Math.max(28, Math.round((stats.ms / 1000) * 28));
  const notch = stats.firstTokenMs === null ? null : (stats.firstTokenMs / Math.max(stats.ms, 1)) * 100;

  const facts = [
    stats.firstTokenMs !== null && `${t.firstWord} ${seconds(stats.firstTokenMs)}`,
    `${t.total} ${seconds(stats.ms)}`,
    t.modelCalls(stats.modelCalls),
    stats.inputTokens !== null &&
      stats.outputTokens !== null &&
      t.tokens(stats.inputTokens, stats.outputTokens),
  ].filter(Boolean) as string[];

  const context = [
    turn.model && t.answeredBy(turn.model),
    turn.toolsOffered?.length === 0 && t.toolsOff,
    turn.usedCustomPrompt && t.customPrompt,
  ].filter(Boolean) as string[];

  return (
    <footer className="measure">
      <div className="tape" style={{ width }} aria-hidden="true">
        {notch !== null && <span className="tape-notch" style={{ left: `${notch}%` }} />}
      </div>
      <ul className="facts">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {context.length > 0 && <p className="context">{context.join(', ')}</p>}
    </footer>
  );
}
