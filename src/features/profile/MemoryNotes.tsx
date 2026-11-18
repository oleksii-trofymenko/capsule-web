import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import { en } from '../../strings/en';
import { useAuthedCall } from '../auth/SessionContext';
import { memoryKey } from './queries';

/** What the stylist remembers from conversations, each note removable, or all at once. */
export function MemoryNotes() {
  const t = en.memory;
  const call = useAuthedCall();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const memory = useQuery({ queryKey: memoryKey, queryFn: () => call((token) => api.memory(token)) });
  const forget = useMutation({
    mutationFn: (id: string | null) =>
      call((token) => (id ? api.forgetNote(token, id) : api.forgetAll(token))),
    onSuccess: () => {
      setConfirming(false);
      return queryClient.invalidateQueries({ queryKey: memoryKey });
    },
  });

  return (
    <section className="profile-block" aria-labelledby="memory-title">
      <h2 id="memory-title">{t.title}</h2>
      <p className="hint">{t.intro}</p>
      {memory.isPending && <p className="status">{t.loading}</p>}
      {memory.isError && (
        <div role="alert">
          <p>{t.loadFailed}</p>
          <button type="button" className="button" onClick={() => void memory.refetch()}>
            {en.common.retry}
          </button>
        </div>
      )}
      {memory.isSuccess && memory.data.notes.length === 0 && <p className="hint">{t.empty}</p>}
      {memory.isSuccess && memory.data.notes.length > 0 && (
        <>
          <ul className="feedback-list">
            {memory.data.notes.map((note) => (
              <li key={note.id} className="feedback-item note-item">
                <span className="tag">{t.kinds[note.kind]}</span>
                <span className="note-text">{note.text}</span>
                <button
                  type="button"
                  className="button"
                  aria-label={t.forget(note.text)}
                  disabled={forget.isPending}
                  onClick={() => forget.mutate(note.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {confirming ? (
            <div role="group" aria-label={t.confirmAll}>
              <p>{t.confirmAll}</p>
              <button
                type="button"
                className="button"
                disabled={forget.isPending}
                onClick={() => forget.mutate(null)}
              >
                {t.confirmYes}
              </button>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                {t.keep}
              </button>
            </div>
          ) : (
            <button type="button" className="button" onClick={() => setConfirming(true)}>
              {t.forgetAll}
            </button>
          )}
        </>
      )}
      {forget.isError && <p role="alert">{t.forgetFailed}</p>}
    </section>
  );
}
