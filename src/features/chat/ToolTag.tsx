import { en } from '../../strings/en';
import type { Part } from './chat-state';

function pretty(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** One tool call, shown as a swing tag tied to the seam. Opens to show what was sent and returned. */
export function ToolTag({ part }: { part: Extract<Part, { kind: 'tool' }> }) {
  const t = en.chat;
  const args =
    part.args && Object.keys(part.args as object).length > 0 ? JSON.stringify(part.args, null, 2) : null;
  const status =
    part.status === 'running'
      ? t.toolRunning
      : part.status === 'failed'
        ? t.toolFailed
        : `${part.ms ?? 0} ms`;

  return (
    <details className={`tag tag-${part.status}`}>
      <summary>
        <span className="tag-hole" aria-hidden="true" />
        <span className="tag-name">{part.name}</span>
        <span className="tag-status">{status}</span>
      </summary>
      <div className="tag-body">
        <h4>{t.toolArgs}</h4>
        <pre>{args ?? t.noArgs}</pre>
        {part.result !== undefined && (
          <>
            <h4>{t.toolResult}</h4>
            <pre>{pretty(part.result)}</pre>
          </>
        )}
      </div>
    </details>
  );
}
