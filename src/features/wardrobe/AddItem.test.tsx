import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Photo, WardrobeItem } from '../../api/client';
import { json, mockApi, type Call } from '../../test/fake-api';
import { renderSignedIn } from '../../test/render-signed-in';
import { WardrobeScreen } from './WardrobeScreen';

const PHOTO_ID = 'photo-1';
const suggested = {
  name: 'Navy wool blazer',
  category: 'outerwear' as const,
  colour: 'navy',
  formality: 'formal' as const,
  seasons: ['autumn' as const, 'winter' as const],
};

const photo = (over: Partial<Photo>): Photo => ({
  id: PHOTO_ID,
  status: 'uploaded',
  contentType: 'image/jpeg',
  size: 4,
  createdAt: '2026-11-17T10:00:00.000Z',
  uploadedAt: '2026-11-17T10:00:01.000Z',
  tagStatus: 'pending',
  suggestedTags: null,
  ...over,
});

const saved = (body: unknown): WardrobeItem => ({
  ...(body as Pick<WardrobeItem, 'name' | 'category' | 'colour' | 'formality' | 'seasons'>),
  id: 'item-1',
  size: null,
  photoId: PHOTO_ID,
  photoUrl: 'http://storage.test/photos/photo-1?view',
  createdAt: '2026-11-17T10:00:02.000Z',
  updatedAt: '2026-11-17T10:00:02.000Z',
});

/** The API and storage, as the browser sees them during an upload. */
function routes(over: { tagged?: Photo; storageStatus?: number } = {}) {
  let items: WardrobeItem[] = [];
  return mockApi({
    'GET /v1/wardrobe/items': () => json({ items }),
    'POST /v1/photos': () =>
      json(
        {
          photo: photo({ status: 'pending', uploadedAt: null }),
          upload: {
            url: `http://storage.test/photos/${PHOTO_ID}?X-Amz-Signature=x`,
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            expiresAt: '2026-11-17T10:05:00.000Z',
          },
        },
        201,
      ),
    [`PUT /photos/${PHOTO_ID}`]: () => new Response(null, { status: over.storageStatus ?? 200 }),
    [`POST /v1/photos/${PHOTO_ID}/complete`]: () => json(photo({})),
    [`GET /v1/photos/${PHOTO_ID}`]: () =>
      json(over.tagged ?? photo({ tagStatus: 'tagged', suggestedTags: suggested })),
    'POST /v1/wardrobe/items': ({ body }: Call) => {
      const item = saved(body);
      items = [item];
      return json(item, 201);
    },
  });
}

const jpeg = () => new File(['jpeg'], 'blazer.jpg', { type: 'image/jpeg' });

async function choosePhoto(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.click(await screen.findByRole('button', { name: 'Add an item' }));
  await user.upload(screen.getByLabelText('Take or choose a photo'), file);
  return user;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('Adding an item', () => {
  it('uploads straight to storage, fills the form from the suggested tags, and saves the corrected item', async () => {
    const calls = routes();
    renderSignedIn(<WardrobeScreen />);
    const user = await choosePhoto(jpeg());

    expect(
      await screen.findByText('Here is what Capsule sees. Correct anything that is off.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The photo you chose' })).toHaveAttribute('src', 'blob:preview');
    expect(screen.getByLabelText('Name')).toHaveValue('Navy wool blazer');
    expect(screen.getByLabelText('Type')).toHaveValue('outerwear');
    expect(screen.getByLabelText('Winter')).toBeChecked();

    await user.clear(screen.getByLabelText('Main colour'));
    await user.type(screen.getByLabelText('Main colour'), 'charcoal');
    await user.click(screen.getByRole('button', { name: 'Save to wardrobe' }));

    expect(await screen.findByRole('img', { name: 'Navy wool blazer' })).toBeInTheDocument();
    const create = calls.find((c) => c.method === 'POST' && c.path === '/v1/wardrobe/items');
    expect(create?.body).toEqual({ ...suggested, colour: 'charcoal', size: null, photoId: PHOTO_ID });
    // The file went to storage, with no API token attached.
    const upload = calls.find((c) => c.method === 'PUT');
    expect(upload?.path).toBe(`/photos/${PHOTO_ID}`);
    expect(upload?.authorization).toBeNull();
  });

  it.each([
    [
      'a file that is not a photo',
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
      'That file is not a photo',
    ],
    [
      'a photo over 20 MB',
      Object.defineProperty(jpeg(), 'size', { value: 21 * 1024 * 1024 }),
      'That photo is over 20 MB',
    ],
  ])('refuses %s before uploading anything', async (_name, file, message) => {
    const calls = routes();
    renderSignedIn(<WardrobeScreen />);
    await choosePhoto(file);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(calls.filter((c) => c.path !== '/v1/wardrobe/items')).toEqual([]);
  });

  it('lets the person fill in the details when tagging fails', async () => {
    routes({ tagged: photo({ tagStatus: 'failed' }) });
    renderSignedIn(<WardrobeScreen />);
    await choosePhoto(jpeg());

    expect(
      await screen.findByText('Capsule could not read this photo. Fill in the details yourself.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save to wardrobe' })).toBeEnabled();
  });

  it('says so when the upload fails, and lets the person pick again', async () => {
    routes({ storageStatus: 403 });
    renderSignedIn(<WardrobeScreen />);
    await choosePhoto(jpeg());

    expect(await screen.findByRole('alert')).toHaveTextContent('The photo could not be uploaded.');
    expect(screen.getByLabelText('Take or choose a photo')).toBeInTheDocument();
  });

  it('asks for at least one season before saving', async () => {
    const calls = routes({ tagged: photo({ tagStatus: 'failed' }) });
    renderSignedIn(<WardrobeScreen />);
    const user = await choosePhoto(jpeg());

    await user.type(await screen.findByLabelText('Name'), 'Grey scarf');
    await user.type(screen.getByLabelText('Main colour'), 'grey');
    await user.click(screen.getByRole('button', { name: 'Save to wardrobe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick at least one season.');
    expect(calls.some((c) => c.path === '/v1/wardrobe/items' && c.method === 'POST')).toBe(false);
  });
});
