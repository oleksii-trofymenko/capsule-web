import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type OutfitFeedback } from '../../api/client';
import { en } from '../../strings/en';
import { useAuthedCall } from '../auth/SessionContext';
import { profileKey } from '../profile/queries';
import { wardrobeKey } from '../wardrobe/queries';
import type { OutfitEvent } from './stylist-state';

/** A suggested outfit: its pieces with their photos, what is missing, and the person's feedback. */
export function OutfitCard({ outfit }: { outfit: OutfitEvent }) {
  const t = en.outfit;
  const call = useAuthedCall();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  // Photos come from the wardrobe the person already loaded; no extra requests.
  const wardrobe = useQuery({
    queryKey: wardrobeKey,
    queryFn: () => call((token) => api.wardrobe(token)),
  });
  const photoOf = new Map(wardrobe.data?.items.map((i) => [i.id, i.photoUrl]) ?? []);

  const rate = useMutation({
    mutationFn: (feedback: OutfitFeedback) =>
      call((token) => api.rateOutfit(token, outfit.id ?? '', feedback)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  });
  const rated = rate.data;

  return (
    <article className="outfit-card" aria-label={t.title}>
      <ul className="outfit-items">
        {outfit.items.map((item) => {
          const photo = photoOf.get(item.id);
          return (
            <li key={item.id} className="outfit-item">
              {photo ? (
                <img src={photo} alt={item.name} className="outfit-photo" />
              ) : (
                <span className="outfit-photo outfit-photo-none" aria-hidden="true">
                  {item.name.charAt(0)}
                </span>
              )}
              <span>{item.name}</span>
            </li>
          );
        })}
      </ul>

      {outfit.missing && (
        <p className="hint">
          {t.missing} {outfit.missing}
        </p>
      )}
      {outfit.removed.map((r) => (
        <p key={r.name} className="hint">
          {t.removed(r.name, r.reason)}
        </p>
      ))}

      {outfit.id && (
        <div className="outfit-feedback" role="group" aria-label={t.feedbackLabel}>
          <div className="outfit-buttons">
            {(['like', 'dislike'] as const).map((rating) => {
              const on = rated?.rating === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  className="button"
                  aria-pressed={on}
                  disabled={rate.isPending}
                  onClick={() => rate.mutate({ rating: on ? null : rating })}
                >
                  {t[rating]}
                </button>
              );
            })}
            <button
              type="button"
              className="button"
              aria-pressed={rated?.worn ?? false}
              disabled={rate.isPending}
              onClick={() => rate.mutate({ worn: !(rated?.worn ?? false) })}
            >
              {t.worn}
            </button>
          </div>
          <label className="field">
            <span>{t.note}</span>
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            type="button"
            className="button"
            disabled={rate.isPending || note.trim() === ''}
            onClick={() => rate.mutate({ note: note.trim() })}
          >
            {t.saveNote}
          </button>
          {rate.isSuccess && (
            <p className="hint" role="status">
              {t.saved}
            </p>
          )}
          {rate.isError && (
            <p className="form-error" role="alert">
              {t.saveFailed}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
