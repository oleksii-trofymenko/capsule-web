import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { en } from '../../strings/en';

interface Props {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, onSend, onStop }: Props) {
  const t = en.chat;
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  function send() {
    const value = text.trim();
    if (!value || streaming) return;
    onSend(value);
    setText('');
    field.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line. Ignored while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form className="composer" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="composer-input">
        {t.composerLabel}
      </label>
      <textarea
        id="composer-input"
        ref={field}
        rows={1}
        maxLength={8000}
        placeholder={t.composerPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {streaming ? (
        <button className="button" type="button" onClick={onStop}>
          {t.stop}
        </button>
      ) : (
        <button className="button primary" type="submit" disabled={!text.trim()}>
          {t.send}
        </button>
      )}
    </form>
  );
}
