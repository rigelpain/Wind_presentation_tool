// スライドの中身の入力欄。schema.ts の Field から組み立てる。
import { ImagePlus, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { putAsset, usePhotos } from '../media/photos';
import { Toggle } from '../control/ui';
import { getPath, setPath, type Field } from './schema';

type Props = Record<string, unknown>;

function ImagePick({ slot, onChange }: { slot: string | undefined; onChange: (slot: string | undefined) => void }) {
  const photos = usePhotos();
  const input = useRef<HTMLInputElement>(null);
  const photo = slot ? photos[slot] : undefined;
  const pick = async (f: File | undefined) => {
    if (!f || !(f.type.startsWith('image/') || f.type.startsWith('video/'))) return;
    onChange(await putAsset(f));
  };
  return (
    <div
      className="ed-image"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void pick(e.dataTransfer.files[0]);
      }}
    >
      {photo ? (
        photo.blob.type.startsWith('video/') ? <video src={photo.url} muted /> : <img src={photo.url} alt="" />
      ) : (
        <span className="ed-image__empty">画像をドロップ</span>
      )}
      <span className="ed-image__actions">
        <button title="画像を選ぶ" aria-label="画像を選ぶ" onClick={() => input.current?.click()}>
          <ImagePlus size={15} />
        </button>
        {slot && (
          <button title="画像を外す" aria-label="画像を外す" onClick={() => onChange(undefined)}>
            <X size={15} />
          </button>
        )}
      </span>
      <input ref={input} type="file" accept="image/*,video/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

function ImagesField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const items = (Array.isArray(value) ? value : []) as { slot?: string; src?: string; caption?: string }[];
  const set = (i: number, patch: Partial<(typeof items)[number]>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  return (
    <div className="ed-images">
      {items.map((it, i) => (
        <div key={i} className="ed-images__item">
          <span className="ed-images__num">{i + 1}</span>
          <ImagePick slot={it.slot} onChange={(slot) => set(i, { slot, src: undefined })} />
          <input type="text" placeholder="説明（なくてよい）" value={it.caption ?? ''} onChange={(e) => set(i, { caption: e.target.value })} />
          <button className="ed-icon" title="この画像を外す" aria-label="この画像を外す" disabled={items.length <= 1} onClick={() => onChange(items.filter((_, k) => k !== i))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="ed-add" onClick={() => onChange([...items, { caption: '' }])}>
        <ImagePlus size={15} /> 画像を足す
      </button>
    </div>
  );
}

function secondsText(v: unknown): string {
  const n = Number(v) || 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function parseSeconds(t: string): number | null {
  const m = /^(\d+)(?::(\d{1,2}))?$/.exec(t.trim());
  if (!m) return null;
  return m[2] === undefined ? Number(m[1]) * 60 : Number(m[1]) * 60 + Number(m[2]);
}

export function FieldInput({ field, props, onChange }: { field: Field; props: Props; onChange: (next: Props) => void }) {
  const value = getPath(props, field.key);
  const set = (v: unknown) => onChange(setPath(props, field.key, v));
  let control;
  switch (field.type) {
    case 'text':
      control = <input type="text" value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
      break;
    case 'textarea':
      control = <textarea rows={3} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
      break;
    case 'lines': {
      const arr = Array.isArray(value) ? value : [];
      const lines = field.linesAs ? arr.map((o) => String((o as Record<string, unknown>)?.[field.linesAs!] ?? '')) : arr.map(String);
      control = (
        <textarea
          rows={Math.max(3, lines.length + 1)}
          value={lines.join('\n')}
          placeholder={field.placeholder}
          onChange={(e) => {
            const next = e.target.value.split('\n');
            set(field.linesAs ? next.map((l) => ({ [field.linesAs!]: l })) : next);
          }}
        />
      );
      break;
    }
    case 'select':
      control = (
        <select value={value === undefined ? '' : String(value)} onChange={(e) => set(field.numeric ? Number(e.target.value) : e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'toggle':
      control = <Toggle checked={!!value} onChange={(v) => set(v)} ariaLabel={field.label} />;
      break;
    case 'seconds':
      control = (
        <input
          type="text"
          inputMode="numeric"
          defaultValue={secondsText(value)}
          key={String(value)}
          placeholder="4:00"
          onBlur={(e) => {
            const n = parseSeconds(e.target.value);
            if (n !== null && n > 0) set(n);
            else e.target.value = secondsText(value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      );
      break;
    case 'image':
      control = <ImagePick slot={typeof value === 'string' ? value : undefined} onChange={(slot) => set(slot)} />;
      break;
    case 'images':
      control = <ImagesField value={value} onChange={set} />;
      break;
  }
  return (
    <label className={`ed-field ed-field--${field.type}`}>
      <span className="ed-field__label">{field.label}</span>
      {control}
      {field.hint && <small className="ed-field__hint">{field.hint}</small>}
    </label>
  );
}
