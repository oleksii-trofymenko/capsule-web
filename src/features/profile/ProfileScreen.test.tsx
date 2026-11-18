import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfileAnswers, ProfileView, Quiz } from '../../api/client';
import { json, mockApi, type Call } from '../../test/fake-api';
import { renderSignedIn } from '../../test/render-signed-in';
import { ProfileScreen } from './ProfileScreen';

const quiz: Quiz = {
  title: 'Your style in two minutes',
  intro: 'A few quick questions.',
  questions: [
    {
      id: 'sizes',
      type: 'sizes',
      question: 'What sizes do you usually wear?',
      hint: 'Skip any you are not sure of.',
      parts: [
        { id: 'top', label: 'Tops' },
        { id: 'bottom', label: 'Bottoms' },
        { id: 'shoes', label: 'Shoes' },
      ],
      systems: [
        { id: 'UK', label: 'UK' },
        { id: 'INT', label: 'Letter (XS to XXL)' },
      ],
    },
    {
      id: 'fit',
      type: 'single',
      question: 'How do you like clothes to fit?',
      options: [
        { id: 'regular', label: 'Regular' },
        { id: 'relaxed', label: 'Relaxed and roomy' },
      ],
    },
    {
      id: 'directions',
      type: 'multi',
      question: 'Which styles feel most like you?',
      hint: 'Pick up to three.',
      max: 3,
      options: [
        { id: 'classic', label: 'Classic' },
        { id: 'minimal', label: 'Minimal' },
      ],
    },
    {
      id: 'favouriteColours',
      type: 'multi',
      question: 'Which colours do you love wearing?',
      hint: null,
      max: 2,
      options: [
        { id: 'neutrals', label: 'Neutrals' },
        { id: 'blues', label: 'Blues and navy' },
      ],
    },
    {
      id: 'avoidColours',
      type: 'multi',
      question: 'Any colours you would rather avoid?',
      hint: 'Leave empty if none.',
      max: 2,
      options: [
        { id: 'neutrals', label: 'Neutrals' },
        { id: 'blues', label: 'Blues and navy' },
      ],
    },
    {
      id: 'lifestyle',
      type: 'single',
      question: 'What does most of your week look like?',
      options: [
        { id: 'office', label: 'A formal workplace' },
        { id: 'mixed', label: 'A real mix' },
      ],
    },
    {
      id: 'neverWear',
      type: 'multi',
      question: 'Anything you never wear?',
      hint: 'Leave empty if none.',
      max: 1,
      options: [{ id: 'heels', label: 'Heels' }],
    },
  ],
};

const answers = {
  sizes: { top: { system: 'INT', value: 'M' }, bottom: null, shoes: null },
  fit: 'relaxed',
  directions: ['classic'],
  favouriteColours: ['blues'],
  avoidColours: [],
  lifestyle: 'mixed',
  neverWear: [],
} as ProfileAnswers;

const noFeedback: ProfileView['feedback'] = { liked: 0, disliked: 0, worn: 0, recent: [] };

function api(view: ProfileView, saveStatus = 200) {
  let current = view;
  return mockApi({
    'GET /v1/profile/quiz': () => json(quiz),
    'GET /v1/profile': () => json(current),
    'PUT /v1/profile': ({ body }: Call) => {
      if (saveStatus !== 200) return json({ message: ['directions: too many'] }, saveStatus);
      current = {
        profile: { ...(body as ProfileAnswers), updatedAt: '2026-11-17T12:00:00.000Z' },
        feedback: noFeedback,
      };
      return json(current);
    },
  });
}

describe('ProfileScreen', () => {
  it('asks the quiz first, sends the answers in the API shape, then shows them in words', async () => {
    const calls = api({ profile: null, feedback: noFeedback });
    renderSignedIn(<ProfileScreen />);
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Your style in two minutes' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Tops'), 'INT');
    await user.type(screen.getByLabelText('Tops: Size'), 'M');
    await user.click(screen.getByLabelText('Relaxed and roomy'));
    await user.click(screen.getByLabelText('Classic'));
    await user.click(
      within(screen.getByRole('group', { name: 'Which colours do you love wearing?' })).getByLabelText(
        'Blues and navy',
      ),
    );
    await user.click(screen.getByLabelText('A real mix'));
    await user.click(screen.getByRole('button', { name: 'Save my answers' }));

    expect(await screen.findByRole('heading', { name: 'Your style' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual(answers);
    expect(screen.getByText('Tops: Letter (XS to XXL) M')).toBeInTheDocument();
    expect(screen.getByText('Relaxed and roomy')).toBeInTheDocument();
    expect(screen.getByText('Rate an outfit from the stylist and it will show here.')).toBeInTheDocument();
  });

  it('shows the answers and the feedback, and lets the person retake the quiz', async () => {
    api({
      profile: { ...answers, updatedAt: '2026-11-17T12:00:00.000Z' },
      feedback: {
        liked: 1,
        disliked: 0,
        worn: 1,
        recent: [
          {
            outfitId: '44444444-4444-4444-8444-444444444444',
            occasion: 'First date',
            items: ['Navy merino crew-neck jumper', 'Beige chinos'],
            rating: 'like',
            worn: true,
            note: 'Felt great',
            feedbackAt: '2026-11-17T20:00:00.000Z',
          },
        ],
      },
    });
    renderSignedIn(<ProfileScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText('Liked 1 · Disliked 0 · Worn 1')).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('First date')).toBeInTheDocument();
    expect(within(item).getByText('Liked')).toBeInTheDocument();
    expect(within(item).getByText('Worn')).toBeInTheDocument();
    expect(within(item).getByText('Felt great')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retake the quiz' }));
    expect(screen.getByLabelText('Relaxed and roomy')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Your style' })).toBeInTheDocument();
  });

  it('asks for the missing answers before sending anything', async () => {
    const calls = api({ profile: null, feedback: noFeedback });
    renderSignedIn(<ProfileScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Save my answers' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose one answer for every single-choice question.',
    );
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('says so when the API refuses the answers', async () => {
    api({ profile: null, feedback: noFeedback }, 400);
    renderSignedIn(<ProfileScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Regular'));
    await user.click(screen.getByLabelText('Minimal'));
    await user.click(screen.getByLabelText('A formal workplace'));
    await user.click(screen.getByRole('button', { name: 'Save my answers' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your answers could not be saved.');
  });

  it('shows an error with a way to try again', async () => {
    mockApi({
      'GET /v1/profile/quiz': () => json(quiz),
      'GET /v1/profile': () => json({ message: 'boom' }, 500),
    });
    renderSignedIn(<ProfileScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your profile could not be loaded.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
