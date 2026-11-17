import { useState, type FormEvent } from 'react';
import type { NewItem } from '../../api/client';
import { en } from '../../strings/en';

export type ItemFields = Pick<NewItem, 'name' | 'category' | 'colour' | 'formality' | 'seasons'>;

interface Props {
  initial: ItemFields;
  saving: boolean;
  error: string | null;
  onSave: (fields: ItemFields) => void;
  onCancel: () => void;
}

const keys = <K extends string>(labels: Record<K, string>) => Object.keys(labels) as K[];

/** The details of one item, prefilled with what the vision model suggested. */
export function ItemForm({ initial, saving, error, onSave, onCancel }: Props) {
  const t = en.addItem;
  const w = en.wardrobe;
  const [fields, setFields] = useState(initial);
  const [seasonsMissing, setSeasonsMissing] = useState(false);
  const set = <K extends keyof ItemFields>(key: K, value: ItemFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (fields.seasons.length === 0) {
      setSeasonsMissing(true);
      return;
    }
    onSave({ ...fields, name: fields.name.trim(), colour: fields.colour.trim() });
  }

  return (
    <form className="item-form" onSubmit={submit}>
      <label className="field">
        <span>{t.name}</span>
        <input required maxLength={120} value={fields.name} onChange={(e) => set('name', e.target.value)} />
      </label>

      <label className="field">
        <span>{t.category}</span>
        <select
          value={fields.category}
          onChange={(e) => set('category', e.target.value as ItemFields['category'])}
        >
          {keys(w.categories).map((c) => (
            <option key={c} value={c}>
              {w.categories[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t.colour}</span>
        <input
          required
          maxLength={40}
          value={fields.colour}
          onChange={(e) => set('colour', e.target.value)}
        />
      </label>

      <label className="field">
        <span>{t.formality}</span>
        <select
          value={fields.formality}
          onChange={(e) => set('formality', e.target.value as ItemFields['formality'])}
        >
          {keys(w.formalities).map((f) => (
            <option key={f} value={f}>
              {w.formalities[f]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="field choices" aria-describedby={seasonsMissing ? 'seasons-error' : undefined}>
        <legend>{t.seasons}</legend>
        {keys(w.seasons).map((s) => (
          <label key={s} className="choice">
            <input
              type="checkbox"
              checked={fields.seasons.includes(s)}
              onChange={(e) => {
                setSeasonsMissing(false);
                set(
                  'seasons',
                  e.target.checked ? [...fields.seasons, s] : fields.seasons.filter((x) => x !== s),
                );
              }}
            />
            {w.seasons[s]}
          </label>
        ))}
      </fieldset>
      {seasonsMissing && (
        <p id="seasons-error" className="form-error" role="alert">
          {t.seasonsRequired}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
