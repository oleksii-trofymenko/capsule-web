import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelsStatus } from '../../api/client';
import { en } from '../../strings/en';

export interface ChatSettings {
  toolsEnabled: boolean;
  systemPrompt: string;
}

interface Props {
  open: boolean;
  email: string;
  settings: ChatSettings;
  defaultPrompt: string | null;
  loadModels: () => Promise<ModelsStatus>;
  onChange: (settings: ChatSettings) => void;
  onClose: () => void;
  onSignOut: () => void;
}

export function SettingsSheet(props: Props) {
  const { open, email, settings, defaultPrompt, loadModels, onChange, onClose, onSignOut } = props;
  const t = en.settings;
  const dialog = useRef<HTMLDialogElement>(null);
  const [models, setModels] = useState<ModelsStatus | null>(null);
  const [modelsError, setModelsError] = useState(false);

  const refresh = useCallback(() => {
    setModelsError(false);
    loadModels().then(setModels, () => setModelsError(true));
  }, [loadModels]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      refresh();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, refresh]);

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby="settings-title" onClose={onClose}>
      <header className="sheet-head">
        <h2 id="settings-title">{t.title}</h2>
        <button className="button" type="button" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>

      <section>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.toolsEnabled}
            onChange={(e) => onChange({ ...settings, toolsEnabled: e.target.checked })}
          />
          <span>{t.tools}</span>
        </label>
        <p className="hint">{t.toolsHint}</p>
      </section>

      <section>
        <label className="field">
          <span>{t.systemPrompt}</span>
          <textarea
            rows={6}
            maxLength={4000}
            value={settings.systemPrompt}
            onChange={(e) => onChange({ ...settings, systemPrompt: e.target.value })}
          />
        </label>
        <p className="hint">{t.systemPromptHint}</p>
        {settings.systemPrompt.trim() !== '' && (
          <button className="link" type="button" onClick={() => onChange({ ...settings, systemPrompt: '' })}>
            {t.resetPrompt}
          </button>
        )}
        {defaultPrompt && settings.systemPrompt.trim() === '' && (
          <details className="default-prompt">
            <summary>{t.defaultPromptLabel}</summary>
            <p>{defaultPrompt}</p>
          </details>
        )}
      </section>

      <section>
        <div className="sheet-row">
          <h3>{t.models}</h3>
          <button className="link" type="button" onClick={refresh}>
            {t.refresh}
          </button>
        </div>
        {modelsError && <p className="form-error">{t.modelsError}</p>}
        {models && (
          <>
            <table className="routes">
              <tbody>
                {Object.entries(models.routes).map(([task, route]) => (
                  <tr key={task}>
                    <th scope="row">{task}</th>
                    <td>{route.model}</td>
                    <td>{route.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="providers">
              {Object.entries(models.providers).map(([name, health]) => (
                <li key={name} className={health.ok ? 'up' : 'down'}>
                  {name}: {health.ok ? t.providerUp : t.providerDown}
                  {health.detail ? ` (${health.detail})` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="sheet-foot">
        <p className="hint">{t.signedInAs(email)}</p>
        <button className="button" type="button" onClick={onSignOut}>
          {t.signOut}
        </button>
      </section>
    </dialog>
  );
}
