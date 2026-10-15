import './upload-field.css';
import { useEffect, useId, useState } from 'react';

export function UploadField() {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="upload-field">
      <label htmlFor={id}>
        附加图片或文件 <span className="muted">（本地预览，最大 10 MB）</span>
      </label>
      <input
        id={id}
        type="file"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          if (selected && selected.size > 10 * 1024 * 1024) {
            setError('文件不能超过 10 MB');
            event.target.value = '';
            setFile(null);
            return;
          }
          setError('');
          setFile(selected);
        }}
      />
      {error && <p role="alert">{error}</p>}
      {file && (
        <div className="file-preview">
          {preview && <img src={preview} alt={`已选择：${file.name}`} />}
          <span>{file.name}</span>
        </div>
      )}
    </div>
  );
}
