import { useState, type ReactNode } from 'react';
import { en } from '../../strings/en';
import { WardrobeScreen } from '../wardrobe/WardrobeScreen';

type Tab = 'wardrobe' | 'fittingRoom';

interface Props {
  email: string;
  onSignOut: () => void;
  /** The developer test chat; null in production builds. */
  fittingRoom: ReactNode;
}

/**
 * The signed-in app: a header, the current screen, and tabs along the bottom
 * where a thumb reaches them. Tabs live in state: there are no deep links yet.
 */
export function AppShell({ email, onSignOut, fittingRoom }: Props) {
  const t = en.shell;
  const [tab, setTab] = useState<Tab>('wardrobe');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'wardrobe', label: t.tabs.wardrobe },
    ...(fittingRoom ? [{ id: 'fittingRoom' as const, label: t.tabs.fittingRoom }] : []),
  ];

  return (
    <div className="shell">
      <header className="shell-head">
        <span className="shell-brand">{en.appName}</span>
        <span className="shell-user">{email}</span>
        <button type="button" className="button" onClick={onSignOut}>
          {t.signOut}
        </button>
      </header>

      <main className="shell-main">
        {tab === 'wardrobe' && <WardrobeScreen />}
        {tab === 'fittingRoom' && fittingRoom}
      </main>

      <nav className="shell-tabs" aria-label={t.tabsLabel}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="shell-tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
