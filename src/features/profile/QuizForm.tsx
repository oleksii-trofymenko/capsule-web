import { useState, type FormEvent } from 'react';
import type { ProfileAnswers, Quiz } from '../../api/client';
import { en } from '../../strings/en';

type Size = { system: string; value: string } | null;
type Part = 'top' | 'bottom' | 'shoes';

/** Answers as the form edits them. Option ids come from the API, so they are plain strings here. */
interface Draft {
  sizes: Record<Part, Size>;
  single: Record<string, string>;
  multi: Record<string, string[]>;
}

/** Single questions with a "skip" option start on it, so only the required ones need a pick. */
const skipped = (quiz: Quiz) =>
  Object.fromEntries(
    quiz.questions.flatMap((q) =>
      q.type === 'single' && q.options.some((o) => o.id === 'skip') ? [[q.id, 'skip']] : [],
    ),
  );

const fromProfile = (quiz: Quiz, answers: ProfileAnswers | null): Draft => ({
  sizes: answers?.sizes ?? { top: null, bottom: null, shoes: null },
  single: {
    ...skipped(quiz),
    ...(answers && {
      fit: answers.fit,
      lifestyle: answers.lifestyle,
      ...(answers.colourTemperature && { colourTemperature: answers.colourTemperature }),
      ...(answers.colourContrast && { colourContrast: answers.colourContrast }),
      ...(answers.height && { height: answers.height }),
    }),
  },
  multi: answers
    ? {
        directions: answers.directions,
        favouriteColours: answers.favouriteColours,
        avoidColours: answers.avoidColours,
        neverWear: answers.neverWear,
        frame: answers.frame ?? [],
        playUp: answers.playUp ?? [],
      }
    : {},
});

/** The API checks every answer; the form only makes them complete enough to send. */
const toAnswers = (d: Draft) =>
  ({
    sizes: d.sizes,
    fit: d.single.fit,
    lifestyle: d.single.lifestyle,
    directions: d.multi.directions ?? [],
    favouriteColours: d.multi.favouriteColours ?? [],
    avoidColours: d.multi.avoidColours ?? [],
    neverWear: d.multi.neverWear ?? [],
    colourTemperature: d.single.colourTemperature,
    colourContrast: d.single.colourContrast,
    height: d.single.height,
    frame: d.multi.frame ?? [],
    playUp: d.multi.playUp ?? [],
  }) as ProfileAnswers;

interface Props {
  quiz: Quiz;
  current: ProfileAnswers | null;
  saving: boolean;
  error: string | null;
  onSave: (answers: ProfileAnswers) => void;
  onCancel?: () => void;
}

/** The two-minute style quiz, rendered from the questions the API serves. */
export function QuizForm({ quiz, current, saving, error, onSave, onCancel }: Props) {
  const t = en.profile;
  const [draft, setDraft] = useState(() => fromProfile(quiz, current));
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const singles = quiz.questions.filter((q) => q.type === 'single');
    if (singles.some((q) => !draft.single[q.id])) return setProblem(t.pickOne);
    const directions = draft.multi.directions?.length ?? 0;
    if (directions < 1 || directions > 3) return setProblem(t.pickDirection);
    setProblem(null);
    onSave(toAnswers(draft));
  }

  return (
    <form className="quiz" onSubmit={submit}>
      <h1 className="screen-title">{quiz.title}</h1>
      <p className="hint">{quiz.intro}</p>

      {quiz.questions.map((q) => {
        if (q.type === 'sizes') {
          return (
            <fieldset key={q.id} className="question">
              <legend>{q.question}</legend>
              <p className="hint">{q.hint}</p>
              {q.parts.map((part) => {
                const id = part.id as Part;
                const size = draft.sizes[id];
                const setSize = (next: Size) =>
                  setDraft((d) => ({ ...d, sizes: { ...d.sizes, [id]: next } }));
                return (
                  <div key={id} className="size-row">
                    <label className="field">
                      <span>{part.label}</span>
                      <select
                        value={size?.system ?? ''}
                        onChange={(e) =>
                          setSize(
                            e.target.value ? { system: e.target.value, value: size?.value ?? '' } : null,
                          )
                        }
                      >
                        <option value="">{t.skip}</option>
                        {q.systems.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {size && (
                      <label className="field">
                        <span>{`${part.label}: ${t.sizeValue}`}</span>
                        <input
                          required
                          maxLength={10}
                          value={size.value}
                          onChange={(e) => setSize({ ...size, value: e.target.value })}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </fieldset>
          );
        }

        if (q.type === 'single') {
          return (
            <fieldset key={q.id} className="question">
              <legend>{q.question}</legend>
              {q.options.map((o) => (
                <label key={o.id} className="choice">
                  <input
                    type="radio"
                    name={q.id}
                    checked={draft.single[q.id] === o.id}
                    onChange={() => setDraft((d) => ({ ...d, single: { ...d.single, [q.id]: o.id } }))}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
          );
        }

        const chosen = draft.multi[q.id] ?? [];
        return (
          <fieldset key={q.id} className="question">
            <legend>{q.question}</legend>
            <p className="hint">{q.hint ?? t.chooseUpTo(q.max)}</p>
            {q.options.map((o) => {
              const on = chosen.includes(o.id);
              return (
                <label key={o.id} className="choice">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && chosen.length >= q.max}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        multi: {
                          ...d.multi,
                          [q.id]: on ? chosen.filter((x) => x !== o.id) : [...chosen, o.id],
                        },
                      }))
                    }
                  />
                  {o.label}
                </label>
              );
            })}
          </fieldset>
        );
      })}

      {(problem ?? error) && (
        <p className="form-error" role="alert">
          {problem ?? error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
