import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, isNetworkError, type ProfileAnswers, type ProfileView, type Quiz } from '../../api/client';
import { en } from '../../strings/en';
import { useAuthedCall } from '../auth/SessionContext';
import { FeedbackSummary } from './FeedbackSummary';
import { MemoryNotes } from './MemoryNotes';
import { profileKey } from './queries';
import { QuizForm } from './QuizForm';

/** Each answer in words, using the labels the API's quiz gives its options. */
function describe(
  quiz: Quiz,
  answers: NonNullable<ProfileView['profile']>,
): { question: string; answer: string }[] {
  const t = en.profile;
  return quiz.questions.map((q) => {
    if (q.type === 'sizes') {
      const parts = q.parts.flatMap((p) => {
        const size = answers.sizes[p.id as keyof ProfileAnswers['sizes']];
        const system = q.systems.find((s) => s.id === size?.system)?.label;
        return size ? [`${p.label}: ${system ?? size.system} ${size.value}`] : [];
      });
      return { question: q.question, answer: parts.join(' · ') || t.notAnswered };
    }
    const picked: string[] = q.type === 'single' ? [answers[q.id]] : answers[q.id];
    const labels = q.options.filter((o) => picked.includes(o.id)).map((o) => o.label);
    return { question: q.question, answer: labels.join(', ') || t.none };
  });
}

/** The person's style profile: the quiz before onboarding, then their answers and feedback. */
export function ProfileScreen() {
  const t = en.profile;
  const call = useAuthedCall();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const profile = useQuery({ queryKey: profileKey, queryFn: () => call((token) => api.profile(token)) });
  const quiz = useQuery({ queryKey: ['quiz'], queryFn: () => call((token) => api.quiz(token)) });
  const save = useMutation({
    mutationFn: (answers: ProfileAnswers) => call((token) => api.saveProfile(token, answers)),
    onSuccess: (saved) => {
      queryClient.setQueryData(profileKey, saved);
      setEditing(false);
    },
  });

  if (profile.isPending || quiz.isPending) {
    return <p className="status">{t.loading}</p>;
  }
  if (profile.isError || quiz.isError) {
    const networkDown = isNetworkError(profile.error) || isNetworkError(quiz.error);
    return (
      <div className="status" role="alert">
        <p>{networkDown ? en.errors.network : t.loadFailed}</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            void profile.refetch();
            void quiz.refetch();
          }}
        >
          {en.common.retry}
        </button>
      </div>
    );
  }

  const answers = profile.data.profile;
  if (!answers || editing) {
    return (
      <section className="screen">
        <QuizForm
          quiz={quiz.data}
          current={answers}
          saving={save.isPending}
          error={save.isError ? t.saveFailed : null}
          onSave={(next) => save.mutate(next)}
          onCancel={answers ? () => setEditing(false) : undefined}
        />
        {/* The stylist can be used before the quiz; what it remembers must still be visible. */}
        {!answers && <MemoryNotes />}
      </section>
    );
  }

  return (
    <section className="screen" aria-labelledby="profile-title">
      <div className="screen-head">
        <h1 id="profile-title" className="screen-title">
          {t.title}
        </h1>
        <button type="button" className="button" onClick={() => setEditing(true)}>
          {t.retake}
        </button>
      </div>
      <dl className="profile-block profile-answers">
        {describe(quiz.data, answers).map(({ question, answer }) => (
          <div key={question}>
            <dt>{question}</dt>
            <dd>{answer}</dd>
          </div>
        ))}
      </dl>
      <FeedbackSummary feedback={profile.data.feedback} />
      <MemoryNotes />
    </section>
  );
}
