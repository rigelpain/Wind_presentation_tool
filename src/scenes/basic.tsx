// 基本の場面: 題、文字（大事な言葉だけ大きく）、画像・動画。
// 部品の作り方の見本でもある。step は「場面の中の段階」。99 のように数を超えて渡されたら最後の段階として描く。
import { Fragment, type ReactNode } from 'react';
import type { SceneKind, SceneViewProps } from '../engine/registry';
import type { EffectKind } from '../engine/types';
import { photoStyle, usePhotos } from '../media/photos';

/** `**言葉**` を大きな強調にする。改行は \n */
export function rich(text: string): ReactNode {
  return text.split('\n').map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <em key={i} className="em">
            {part.slice(2, -2)}
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </Fragment>
  ));
}

export function countEmphasis(text: string | undefined): EffectKind[] {
  const n = text?.match(/\*\*[^*]+\*\*/g)?.length ?? 0;
  return Array.from({ length: n }, () => 'emphasis' as const);
}

// ---- 題 ----
interface TitleProps {
  title: string;
  subtitle?: string;
  kicker?: string;
}

function TitleView({ props }: SceneViewProps<TitleProps>) {
  return (
    <div className="scene scene--title">
      {props.kicker && <div className="kicker">{props.kicker}</div>}
      <h1 className="title">{rich(props.title)}</h1>
      {props.subtitle && <p className="subtitle">{rich(props.subtitle)}</p>}
    </div>
  );
}

export const TitleScene: SceneKind<TitleProps> = {
  component: TitleView,
  steps: (p) => [[...countEmphasis(p.title), ...countEmphasis(p.subtitle)]],
};

// ---- 文字 ----
interface TextProps {
  heading?: string;
  lines: string[];
  /** true なら1行ずつ出す（→で次の行） */
  build?: boolean;
  align?: 'left' | 'center';
  size?: 'm' | 'l' | 'xl';
}

function TextView({ props, step }: SceneViewProps<TextProps>) {
  const shown = props.build ? Math.min(step + 1, props.lines.length) : props.lines.length;
  return (
    <div className={`scene scene--text align-${props.align ?? 'left'} size-${props.size ?? 'l'}`}>
      {props.heading && <h2 className="heading">{rich(props.heading)}</h2>}
      <div className="lines">
        {props.lines.map((l, i) => (
          <p key={i} className={`line ${i < shown ? 'line--on' : 'line--off'}`}>
            {rich(l)}
          </p>
        ))}
      </div>
    </div>
  );
}

export const TextScene: SceneKind<TextProps> = {
  component: TextView,
  steps: (p) => {
    if (!p.build) return [[...countEmphasis(p.heading), ...p.lines.flatMap(countEmphasis)]];
    return p.lines.map((l, i) => (i === 0 ? [...countEmphasis(p.heading), ...countEmphasis(l)] : countEmphasis(l)));
  },
};

// ---- 画像・動画 ----
interface MediaItem {
  /** public/ からのパス（例: private/campus-1.jpg）。slot を使うときは省く */
  src?: string;
  /** 写真の読み込み（U）で入れた写真の枠の名前 */
  slot?: string;
  caption?: string;
  fit?: 'contain' | 'cover';
}

interface MediaProps {
  heading?: string;
  /** 1枚ずつ → で切り替える */
  items: MediaItem[];
  /** 動画の音を出す（既定は無音） */
  audio?: boolean;
}

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

export function MediaView({ item, audio }: { item: MediaItem; audio?: boolean }) {
  const photos = usePhotos();
  const photo = item.slot ? photos[item.slot] : undefined;
  const src = photo?.url ?? (item.src ? `${import.meta.env.BASE_URL}${item.src.replace(/^\//, '')}` : undefined);
  if (!src) return <div className="media__empty">{item.slot ? `写真「${item.slot}」がまだありません（U で読み込む）` : '素材がありません'}</div>;
  const style = { objectFit: item.fit ?? 'contain', ...(photo ? photoStyle(photo) : {}) } as const;
  if (!photo && isVideo(src)) return <video className="media__el" src={src} style={style} autoPlay loop muted={!audio} playsInline />;
  return <img className="media__el" src={src} style={style} alt={item.caption ?? ''} />;
}

function MediaSceneView({ props, step }: SceneViewProps<MediaProps>) {
  const i = Math.min(step, props.items.length - 1);
  return (
    <div className="scene scene--media">
      {props.heading && <h2 className="heading heading--over">{rich(props.heading)}</h2>}
      <div className="media__stack">
        {props.items.map((item, k) => (
          <div key={k} className={`media__frame ${k === i ? 'is-on' : ''}`}>
            {Math.abs(k - i) <= 1 && <MediaView item={item} audio={props.audio} />}
          </div>
        ))}
      </div>
      {props.items[i]?.caption && <div className="caption">{rich(props.items[i].caption!)}</div>}
    </div>
  );
}

export const MediaScene: SceneKind<MediaProps> = {
  component: MediaSceneView,
  steps: (p) => p.items.map((it, i) => (i === 0 ? [...countEmphasis(p.heading), ...countEmphasis(it.caption)] : countEmphasis(it.caption))),
};
