import type { ProfileView } from '../../api/client';
import { en } from '../../strings/en';

/** What the person said about the outfits the stylist suggested. */
export function FeedbackSummary({ feedback }: { feedback: ProfileView['feedback'] }) {
  const t = en.profile;
  return (
    <section className="profile-block" aria-labelledby="feedback-title">
      <h2 id="feedback-title">{t.feedbackTitle}</h2>
      <p>{t.feedbackCounts(feedback.liked, feedback.disliked, feedback.worn)}</p>
      {feedback.recent.length === 0 ? (
        <p className="hint">{t.noFeedback}</p>
      ) : (
        <ul className="feedback-list">
          {feedback.recent.map((f) => (
            <li key={f.outfitId} className="feedback-item">
              <p className="feedback-head">
                <strong>{f.occasion ?? t.anyOccasion}</strong>
                {f.rating && <span className="tag">{t.rating[f.rating]}</span>}
                {f.worn && <span className="tag">{t.wornTag}</span>}
              </p>
              <p className="hint">{f.items.join(', ')}</p>
              {f.note && <p className="feedback-note">{f.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
