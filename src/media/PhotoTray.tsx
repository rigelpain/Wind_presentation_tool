// 写真の読み込み（U）。作業員が仕上げる（指示書: docs/briefs/02）。
// 発表者が、担任のスマホから届いた写真を6チームの枠に入れる。生徒には見せない。
// 入れ方: パネルへのまとめてのドロップ（空き枠に順に）、枠の上へのドロップ（その枠に）、「ファイルを選ぶ」、⌘V（空き枠に）。
// 枠どうしのドラッグは入れ替え。保存は photos.ts（このブラウザの中だけ）。
import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import './PhotoTray.css';
import {
  clearAll,
  photoStyle,
  putPhoto,
  putPhotosInOrder,
  removePhoto,
  swapPhotos,
  teamSlot,
  updatePhoto,
  usePhotos,
  type PhotoView,
} from './photos';

const SLOTS = [1, 2, 3, 4, 5, 6].map(teamSlot);
const THUMB_ASPECT = 4 / 3;
const SLOT_MIME = 'application/x-wind-photo-slot';

const imagesOf = (list: FileList | File[] | null | undefined): File[] =>
  list ? Array.from(list).filter((f) => f.type.startsWith('image/')) : [];
const hasFiles = (dt: DataTransfer): boolean => Array.from(dt.types).includes('Files');
const numberOf = (slot: string): number => SLOTS.indexOf(slot) + 1;

/** 写真の箱。90度・270度は縦横が入れ替わるので、回す前の箱の縦横を入れ替えて、回したあとに枠いっぱいに入るようにする */
function photoBox(photo: PhotoView, aspect: number): CSSProperties {
  const quarter = photo.rotation % 180 !== 0;
  return {
    flex: 'none',
    width: quarter ? `${100 / aspect}%` : '100%',
    height: quarter ? `${100 * aspect}%` : '100%',
    objectFit: 'contain',
    ...photoStyle(photo),
  };
}

export function PhotoTray({ onClose }: { onClose: () => void }) {
  const photos = usePhotos();
  const [msg, setMsg] = useState('');
  const [fileDrag, setFileDrag] = useState(false);
  const [overSlot, setOverSlot] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(job: () => Promise<unknown>, done = '') {
    try {
      await job();
      setMsg(done);
    } catch (err) {
      setMsg(`うまくいきませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** 画像を空き枠に順に入れる（番号の小さい順） */
  async function addFiles(files: File[]) {
    if (files.length === 0) {
      setMsg('画像のファイルがありません（画像以外は入りません）');
      return;
    }
    const empty = SLOTS.filter((s) => !photos[s]).length;
    if (empty === 0) {
      setMsg('空いている枠がありません。枠の「消す」で空けてから入れてください');
      return;
    }
    const n = Math.min(files.length, empty);
    const left = files.length - n;
    await run(
      () => putPhotosInOrder(files.slice(0, n), SLOTS),
      `${n}枚入れました${left > 0 ? `（空き枠が足りず${left}枚は入りませんでした）` : ''}`,
    );
  }

  // ⌘V で貼り付けた画像を、空いている最初の枠に入れる（パネルを開いているあいだだけ）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
      const files = items
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length === 0) return;
      e.preventDefault();
      void addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // addFiles は photos を読むので、photos が変わったら登録し直す
  }, [photos]);

  const rotate = (slot: string) => {
    const p = photos[slot];
    if (p) void run(() => updatePhoto(slot, { rotation: (p.rotation + 90) % 360 }));
  };

  const shade = (slot: string, delta: number) => {
    const p = photos[slot];
    if (!p) return;
    const brightness = Math.min(2, Math.max(0.5, Math.round((p.brightness + delta) * 100) / 100));
    void run(() => updatePhoto(slot, { brightness }));
  };

  const removeSlot = (slot: string) => void run(() => removePhoto(slot), `チーム${numberOf(slot)}を消しました`);

  const clearEverything = () => {
    if (!window.confirm('6チームの写真を全部消します。よろしいですか？')) return;
    void run(() => clearAll(), '全部消しました');
  };

  return (
    <div
      className="panel-backdrop"
      onClick={onClose}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div
        className={`panel tray${fileDrag ? ' tray--drop' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          if (hasFiles(e.dataTransfer)) setFileDrag(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setFileDrag(false);
          if (hasFiles(e.dataTransfer)) void addFiles(imagesOf(e.dataTransfer.files));
        }}
      >
        <div className="panel__head">
          <h2>写真の読み込み</h2>
          <button onClick={onClose}>閉じる（U）</button>
        </div>
        <p className="tray__note">
          写真をまとめてドロップすると、チーム1から順に入ります。枠どうしはドラッグで入れ替えられます。⌘V で貼り付けると、空いている最初の枠に入ります。
        </p>
        <div className="tray__bar">
          <div className="tray__bar-left">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = imagesOf(e.target.files); // 先に取り出してから値を空にする
                e.target.value = '';
                void addFiles(files);
              }}
            />
            <button onClick={() => inputRef.current?.click()}>ファイルを選ぶ</button>
          </div>
          <button className="danger" onClick={clearEverything} disabled={Object.keys(photos).length === 0}>
            全部消す
          </button>
        </div>
        <div className="tray__msg" role="status">
          {msg}
        </div>
        <div className="tray__grid">
          {SLOTS.map((slot) => {
            const photo = photos[slot];
            const n = numberOf(slot);
            return (
              <div
                key={slot}
                className={`tray__slot${photo ? ' tray__slot--filled' : ''}${overSlot === slot ? ' tray__slot--over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = hasFiles(e.dataTransfer) ? 'copy' : 'move';
                  setOverSlot(slot);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverSlot(null);
                }}
                onDrop={(e: DragEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOverSlot(null);
                  setFileDrag(false);
                  const from = e.dataTransfer.getData(SLOT_MIME);
                  if (from) {
                    if (from !== slot) void run(() => swapPhotos(from, slot), `チーム${numberOf(from)}とチーム${n}を入れ替えました`);
                    return;
                  }
                  const file = imagesOf(e.dataTransfer.files)[0];
                  if (file) void run(() => putPhoto(slot, file), `チーム${n}に入れました`);
                  else if (hasFiles(e.dataTransfer)) setMsg('画像ではないので入りません');
                }}
              >
                <div className="tray__head">
                  <span className="tray__num">{n}</span>
                  <span className="tray__name">チーム{n}</span>
                </div>
                <div
                  className="tray__thumb"
                  draggable={!!photo}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(SLOT_MIME, slot);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  {photo ? (
                    <div className="tray__frame">
                      <img className="tray__img" src={photo.url} alt="" draggable={false} style={photoBox(photo, THUMB_ASPECT)} />
                    </div>
                  ) : (
                    <div className="tray__empty">
                      空き
                      <br />
                      ここにドロップ
                    </div>
                  )}
                </div>
                <div className="tray__btns">
                  <button onClick={() => rotate(slot)} disabled={!photo}>
                    回す
                  </button>
                  <button onClick={() => shade(slot, 0.15)} disabled={!photo || photo.brightness >= 2}>
                    明るく
                  </button>
                  <button onClick={() => shade(slot, -0.15)} disabled={!photo || photo.brightness <= 0.5}>
                    暗く
                  </button>
                  <button onClick={() => removeSlot(slot)} disabled={!photo}>
                    消す
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
