import type { WardrobeItem } from '../../api/client';
import { en } from '../../strings/en';

/** One item: its photo (or its initial when there is none), name and short description. */
export function WardrobeCard({ item }: { item: WardrobeItem }) {
  const t = en.wardrobe;
  return (
    <article className="wardrobe-card">
      {item.photoUrl ? (
        <img className="wardrobe-photo" src={item.photoUrl} alt={item.name} loading="lazy" />
      ) : (
        <div className="wardrobe-photo wardrobe-photo-none" aria-hidden="true">
          {item.name.charAt(0)}
        </div>
      )}
      <h2 className="wardrobe-name">{item.name}</h2>
      <p className="wardrobe-meta">
        {t.categories[item.category]} · {item.colour}
      </p>
    </article>
  );
}
