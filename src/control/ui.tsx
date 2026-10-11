// コントロール画面の共通の部品。文字を減らし、アイコンと形で分かるようにする。
// - 見出しは「アイコン＋2〜6字」
// - 説明は「？」を押したときだけ出す（いつも出しておかない）
// - 選ぶものは、ボタンを並べた切り替え（Segmented）か、色の丸（Swatches）
import { CircleHelp, RotateCcw, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import './ui.css';

export function Section({ icon: Icon, title, help, children, aside }: { icon: LucideIcon; title: string; help?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="ui-section">
      <header className="ui-section__head">
        <Icon size={16} aria-hidden />
        <h3>{title}</h3>
        <span className="ui-section__aside">{aside}</span>
        {help && (
          <button className={`ui-help ${open ? 'is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="説明" title="説明">
            <CircleHelp size={15} />
          </button>
        )}
      </header>
      {help && open && <div className="ui-section__help">{help}</div>}
      <div className="ui-section__body">{children}</div>
    </section>
  );
}

/** 1行の設定。左にアイコンと短い名前、右に操作 */
export function Row({ icon: Icon, label, children, title }: { icon?: LucideIcon; label: string; children: ReactNode; title?: string }) {
  return (
    <div className="ui-row" title={title}>
      <span className="ui-row__label">
        {Icon && <Icon size={15} aria-hidden />}
        {label}
      </span>
      <span className="ui-row__control">{children}</span>
    </div>
  );
}

export interface SegOption<T extends string | number> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  /** マウスを乗せたときの説明 */
  title?: string;
}

/** ボタンを並べた切り替え（1つだけ選ぶ） */
export function Segmented<T extends string | number>({ options, value, onChange, wrap }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; wrap?: boolean }) {
  return (
    <span className={`ui-seg ${wrap ? 'ui-seg--wrap' : ''}`} role="radiogroup">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} title={o.title ?? o.label} onClick={() => onChange(o.value)}>
            {Icon && <Icon size={15} aria-hidden />}
            {o.label && <span>{o.label}</span>}
          </button>
        );
      })}
    </span>
  );
}

/** スライダーと値。reset を渡すと「標準」に戻すボタンが付く */
export function Slider({ min, max, step, value, onChange, format, reset, disabled, label }: { min: number; max: number; step: number | 'any'; value: number; onChange: (v: number) => void; format?: (v: number) => string; reset?: number; disabled?: boolean; label?: string }) {
  return (
    <span className="ui-slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ui-slider__value">{format ? format(value) : value}</span>
      {reset !== undefined && (
        <button className="ui-icon" title="標準に戻す" aria-label="標準に戻す" disabled={disabled || value === reset} onClick={() => onChange(reset)}>
          <RotateCcw size={13} />
        </button>
      )}
    </span>
  );
}

/** 入り切りのスイッチ */
export function Toggle({ checked, onChange, label, disabled, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; ariaLabel?: string }) {
  return (
    <label className={`ui-toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" aria-label={ariaLabel} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-toggle__track" aria-hidden>
        <span className="ui-toggle__thumb" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

/** アイコンのボタン。label は横に出す短い字（省くとアイコンだけ。title は必ず付ける） */
export function IconButton({ icon: Icon, label, title, onClick, active, variant, disabled, size = 16 }: { icon: LucideIcon; label?: string; title: string; onClick: () => void; active?: boolean; variant?: 'primary' | 'danger'; disabled?: boolean; size?: number }) {
  return (
    <button className={`ui-btn ${label ? '' : 'ui-btn--icon'} ${active ? 'is-on' : ''} ${variant ? `ui-btn--${variant}` : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      <Icon size={size} aria-hidden />
      {label && <span>{label}</span>}
    </button>
  );
}

/** 色の丸。value と同じ色に印。custom なら最後に色を選ぶ欄 */
export function Swatches({ colors, value, onChange, custom = true }: { colors: { name: string; value: string }[]; value: string; onChange: (v: string) => void; custom?: boolean }) {
  const cur = value.toUpperCase();
  return (
    <span className="ui-swatches" role="radiogroup">
      {colors.map((c) => (
        <button
          key={c.value}
          role="radio"
          aria-checked={cur === c.value.toUpperCase()}
          aria-label={c.name}
          title={c.name}
          className={`ui-swatch ${cur === c.value.toUpperCase() ? 'is-on' : ''} ${c.value === 'none' ? 'ui-swatch--none' : ''}`}
          style={c.value === 'none' ? undefined : { background: c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
      {custom && (
        <input
          type="color"
          className="ui-swatch-custom"
          title="ほかの色"
          aria-label="ほかの色"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#141414'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      )}
    </span>
  );
}

/** 小さな状態の印（緑・黄・赤・灰） */
export function Status({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'idle'; children: ReactNode }) {
  return (
    <span className={`ui-status ui-status--${tone}`}>
      <span className="ui-status__dot" aria-hidden />
      {children}
    </span>
  );
}
