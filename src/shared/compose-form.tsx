import { useId } from 'react';
import { UploadField } from './upload-field.tsx';
import './compose-form.css';

export function ComposeForm({
  prompt,
  onPromptChange,
  onSubmit,
  inputLabel,
  placeholder,
  submitLabel,
  message,
}: {
  readonly prompt: string;
  readonly onPromptChange: (prompt: string) => void;
  readonly onSubmit: () => void;
  readonly inputLabel: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly message: string;
}) {
  const id = useId();
  return (
    <form
      className="panel compose"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id}>{inputLabel}</label>
      <textarea
        id={id}
        required
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
      />
      <UploadField />
      <div>
        <button className="button" type="submit" disabled={!prompt.trim()}>
          {submitLabel}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
