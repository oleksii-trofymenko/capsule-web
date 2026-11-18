import { expect, test } from '@playwright/test';

/**
 * The thin path on a phone: sign up, answer the style quiz, photograph a piece,
 * let the vision model tag it, ask the stylist for an outfit, rate it, and see
 * the feedback in the profile. Asserts what appears, never the model's wording.
 */
test('the whole loop works in a phone browser', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = 'an-e2e-password-1';
  const api = 'http://localhost:3100/v1';

  // Sign up.
  await page.goto('/');
  await page.getByRole('button', { name: 'No account yet? Create one' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your wardrobe' })).toBeVisible();

  // Answer the quiz.
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByLabel('Regular').check();
  await page.getByLabel('Classic').check();
  await page.getByLabel('A real mix').check();
  await page.getByRole('button', { name: 'Save my answers' }).click();
  await expect(page.getByRole('heading', { name: 'Your style' })).toBeVisible();

  // Photograph a piece: upload, wait for the vision model, correct and save.
  await page.getByRole('button', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Add an item' }).click();
  await page.getByLabel('Take or choose a photo').setInputFiles('e2e/fixtures/navy-tshirt.jpg');
  await expect(page.getByRole('button', { name: 'Save to wardrobe' })).toBeVisible();
  const name = page.getByLabel('Name');
  if ((await name.inputValue()) === '') await name.fill('Navy t-shirt');
  if ((await page.getByLabel('Main colour').inputValue()) === '') {
    await page.getByLabel('Main colour').fill('navy');
  }
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  if (!(await Promise.all(seasons.map((s) => page.getByLabel(s).isChecked()))).some(Boolean)) {
    await page.getByLabel('Autumn').check();
  }
  await page.getByRole('button', { name: 'Save to wardrobe' }).click();
  const grid = page.getByRole('list', { name: 'Your clothes' });
  await expect(grid.getByRole('img')).toHaveCount(1);

  // Two more pieces through the API, so the stylist has an outfit to build.
  const login = await request.post(`${api}/auth/login`, { data: { email, password } });
  const { accessToken } = (await login.json()) as { accessToken: string };
  for (const item of [
    { name: 'Beige chinos', category: 'bottom', colour: 'beige', formality: 'smart' },
    { name: 'Brown leather brogues', category: 'shoes', colour: 'brown', formality: 'smart' },
  ]) {
    const res = await request.post(`${api}/wardrobe/items`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { ...item, seasons: ['autumn', 'winter'] },
    });
    expect(res.status()).toBe(201);
  }

  // Ask the stylist and rate the outfit.
  await page.getByRole('button', { name: 'Stylist' }).click();
  await page.getByLabel('Message the stylist').fill('Put together an office outfit for Monday.');
  await page.getByRole('button', { name: 'Send' }).click();
  const card = page.getByRole('article', { name: 'Your outfit' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('listitem').first()).toBeVisible();
  await card.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Like', exact: true, pressed: true })).toBeVisible();

  // The feedback shows in the profile.
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByText(/^Liked 1 · Disliked 0/)).toBeVisible();
  await expect(page.getByText('Office')).toBeVisible();

  // A dislike told to the stylist is remembered, shown, and can be forgotten.
  await page.getByRole('button', { name: 'Stylist' }).click();
  await page.getByLabel('Message the stylist').fill('By the way, I never wear yellow.');
  await page.getByRole('button', { name: 'Send' }).click();
  // The note is saved while the reply streams; wait for it before opening the profile.
  await expect
    .poll(async () => {
      const res = await request.get(`${api}/memory`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const { notes } = (await res.json()) as { notes: { text: string }[] };
      return notes.map((n) => n.text).join(' ');
    })
    .toMatch(/yellow/i);
  await page.getByRole('button', { name: 'Profile' }).click();
  const memory = page.getByRole('region', { name: 'What Capsule knows about you' });
  await expect(memory.getByText(/yellow/i)).toBeVisible();
  await memory.getByRole('button', { name: /^Forget ".*yellow.*"$/i }).click();
  await expect(memory.getByText(/yellow/i)).toHaveCount(0);
});
