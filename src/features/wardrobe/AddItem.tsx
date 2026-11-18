import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, uploadPhoto, type NewPhoto } from '../../api/client';
import { en } from '../../strings/en';
import { useAuthedCall } from '../auth/SessionContext';
import { ItemForm, type ItemFields } from './ItemForm';
import { wardrobeKey } from './queries';

const PHOTO_TYPES: NewPhoto['contentType'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
/** The API's limit, checked here first so the person hears about it before uploading. */
const MAX_BYTES = 20 * 1024 * 1024;
const POLL_MS = 1500;

const isPhotoType = (type: string): type is NewPhoto['contentType'] =>
  (PHOTO_TYPES as string[]).includes(type);

const BLANK: ItemFields = { name: '', category: 'top', colour: '', formality: 'casual', seasons: [] };

/** Photograph a piece, let the vision model suggest its details, correct them, save. */
export function AddItem({ onDone }: { onDone: () => void }) {
  const t = en.addItem;
  const call = useAuthedCall();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Tagging runs on the server after upload; ask until it has finished.
  const photo = useQuery({
    queryKey: ['photo', photoId],
    queryFn: () => call((token) => api.photo(token, photoId ?? '')),
    enabled: photoId !== null,
    refetchInterval: (query) => (query.state.data?.tagStatus === 'pending' ? POLL_MS : false),
  });

  const save = useMutation({
    mutationFn: (fields: ItemFields) =>
      call((token) => api.createItem(token, { ...fields, size: null, photoId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wardrobeKey });
      onDone();
    },
  });

  async function pick(file: File) {
    setProblem(null);
    const contentType = file.type;
    if (!isPhotoType(contentType)) return setProblem(t.wrongType);
    if (file.size > MAX_BYTES) return setProblem(t.tooBig);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const started = await call((token) => api.startUpload(token, { contentType, size: file.size }));
      await uploadPhoto(started.upload, file);
      await call((token) => api.completeUpload(token, started.photo.id));
      setPhotoId(started.photo.id);
    } catch {
      setPreview(null);
      setProblem(t.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  const tagging = photoId !== null && (photo.isPending || photo.data?.tagStatus === 'pending');
  const ready = photoId !== null && !tagging;
  const suggested = photo.data?.suggestedTags ?? null;

  return (
    <section className="screen" aria-labelledby="add-item-title">
      <h1 id="add-item-title" className="screen-title">
        {t.title}
      </h1>

      {preview && <img className="add-preview" src={preview} alt={t.previewAlt} />}

      {!preview && !uploading && (
        <div className="add-pick">
          <label className="button primary file-button">
            {t.pick}
            <input
              type="file"
              accept={PHOTO_TYPES.join(',')}
              capture="environment"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void pick(file);
              }}
            />
          </label>
          <p className="hint">{t.pickHint}</p>
        </div>
      )}

      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}

      {uploading && (
        <p className="status" role="status">
          {t.uploading}
        </p>
      )}
      {tagging && (
        <p className="status" role="status">
          {t.tagging}
        </p>
      )}

      {ready && (
        <>
          <p className="status" role="status">
            {suggested ? t.tagged : t.tagFailed}
          </p>
          <ItemForm
            key={photoId}
            initial={suggested ?? BLANK}
            saving={save.isPending}
            error={save.isError ? t.saveFailed : null}
            onSave={(fields) => save.mutate(fields)}
            onCancel={onDone}
          />
        </>
      )}

      {!ready && (
        <button type="button" className="button" onClick={onDone}>
          {t.cancel}
        </button>
      )}
    </section>
  );
}
