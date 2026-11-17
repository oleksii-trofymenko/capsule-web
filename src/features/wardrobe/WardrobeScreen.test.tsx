import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WardrobeItem } from '../../api/client';
import { json, mockApi } from '../../test/fake-api';
import { renderSignedIn } from '../../test/render-signed-in';
import { WardrobeScreen } from './WardrobeScreen';

const item = (over: Partial<WardrobeItem>): WardrobeItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Navy wool blazer',
  category: 'outerwear',
  colour: 'navy',
  formality: 'formal',
  seasons: ['autumn', 'winter'],
  size: null,
  photoId: null,
  photoUrl: null,
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
  ...over,
});

describe('WardrobeScreen', () => {
  it('shows each item with its photo, name and description, using the access token', async () => {
    const calls = mockApi({
      'GET /v1/wardrobe/items': () =>
        json({
          items: [
            item({
              photoId: '22222222-2222-4222-8222-222222222222',
              photoUrl: 'http://storage.test/photos/blazer.jpg',
            }),
            item({
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Beige chinos',
              category: 'bottom',
              colour: 'beige',
            }),
          ],
        }),
    });
    renderSignedIn(<WardrobeScreen />);

    const grid = await screen.findByRole('list', { name: 'Your clothes' });
    const cards = within(grid).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('img', { name: 'Navy wool blazer' })).toHaveAttribute(
      'src',
      'http://storage.test/photos/blazer.jpg',
    );
    expect(within(cards[0]).getByText('Outerwear · navy')).toBeInTheDocument();
    // An item without a photo shows no broken image.
    expect(within(cards[1]).queryByRole('img')).not.toBeInTheDocument();
    expect(within(cards[1]).getByRole('heading', { name: 'Beige chinos' })).toBeInTheDocument();
    expect(calls[0].authorization).toBe('Bearer access-1');
  });

  it('says so when the wardrobe is empty', async () => {
    mockApi({ 'GET /v1/wardrobe/items': () => json({ items: [] }) });
    renderSignedIn(<WardrobeScreen />);
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error with a way to try again', async () => {
    let fail = true;
    mockApi({
      'GET /v1/wardrobe/items': () => (fail ? json({ message: 'boom' }, 500) : json({ items: [item({})] })),
    });
    renderSignedIn(<WardrobeScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your wardrobe could not be loaded.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Navy wool blazer' })).toBeInTheDocument();
  });

  it('shows that it is loading', () => {
    mockApi({ 'GET /v1/wardrobe/items': () => new Promise<Response>(() => undefined) });
    renderSignedIn(<WardrobeScreen />);
    expect(screen.getByText('Loading your wardrobe…')).toBeInTheDocument();
  });
});
