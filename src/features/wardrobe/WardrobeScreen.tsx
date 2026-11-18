import { useQuery } from '@tanstack/react-query';
import { api, isNetworkError } from '../../api/client';
import { en } from '../../strings/en';
import { useAuthedCall } from '../auth/SessionContext';
import { WardrobeCard } from './WardrobeCard';

export const wardrobeKey = ['wardrobe'] as const;

/** Everything the person owns, as a grid of photos. */
export function WardrobeScreen() {
  const t = en.wardrobe;
  const call = useAuthedCall();
  const wardrobe = useQuery({
    queryKey: wardrobeKey,
    queryFn: () => call((token) => api.wardrobe(token)),
  });

  return (
    <section className="screen" aria-labelledby="wardrobe-title">
      <h1 id="wardrobe-title" className="screen-title">
        {t.title}
      </h1>

      {wardrobe.isPending && <p className="status">{t.loading}</p>}

      {wardrobe.isError && (
        <div className="status" role="alert">
          <p>{isNetworkError(wardrobe.error) ? en.errors.network : t.loadFailed}</p>
          <button type="button" className="button" onClick={() => void wardrobe.refetch()}>
            {en.common.retry}
          </button>
        </div>
      )}

      {wardrobe.isSuccess && wardrobe.data.items.length === 0 && (
        <div className="status">
          <p className="status-title">{t.emptyTitle}</p>
          <p>{t.emptyBody}</p>
        </div>
      )}

      {wardrobe.isSuccess && wardrobe.data.items.length > 0 && (
        <ul className="wardrobe-grid" aria-label={t.gridLabel}>
          {wardrobe.data.items.map((item) => (
            <li key={item.id}>
              <WardrobeCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
