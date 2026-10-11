// Zoom で共有するときの手順（コントロール画面の「Zoom で共有」）。10/16 は Zoom で行う。
import { Monitor } from 'lucide-react';
import { useDisplayStatus } from '../stage/heartbeat';

export function DisplayIndicator({ onHelp }: { onHelp: () => void }) {
  const beat = useDisplayStatus();
  let cls = 'is-ok';
  let text = '';
  let title = '';
  if (!beat) {
    cls = 'is-bad';
    text = '未接続';
    title = '表示画面が開いていません';
  } else if (!beat.visible) {
    cls = 'is-bad';
    text = '隠れている';
    title = '表示画面が最小化されているか、別のデスクトップにあります。前に出してください';
  } else if (beat.fps < 20) {
    cls = 'is-warn';
    text = `${beat.fps}fps`;
    title = '表示画面の描画が遅い';
  } else {
    const wide = Math.abs(beat.width / beat.height - 16 / 9) < 0.03;
    text = `${beat.fps}fps`;
    title = `表示画面は描けています（${beat.width}×${beat.height}${wide ? '' : '、16:9 ではないので黒い帯が入る'}）`;
  }
  return (
    <button className={`c-display ${cls}`} onClick={onHelp} title={title} aria-label={`表示画面: ${title}`}>
      <Monitor size={15} aria-hidden />
      <span className="c-display__dot" />
      {text}
    </button>
  );
}

export function ZoomGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel panel--guide" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <h2>Zoom で共有する</h2>
          <button onClick={onClose}>閉じる</button>
        </div>
        <ol className="guide">
          <li>
            <b>2つの窓を開く。</b>ターミナルで <code>npm run show</code>。表示画面とコントロール画面が、Zoom の共有に向いた設定の Chrome で開く（隠れても描くのを止めない、音の自動再生を止めない）
          </li>
          <li>
            <b>カメラを始める。</b>「カメラ・ワイプ」で外付けのカメラを選び、2人を映して「登録する」。Zoom 本体のビデオは<b>オフ</b>にする（顔はワイプで送る。Zoom が同じカメラを使っても動くが、2人の顔が二重に映る）
          </li>
          <li>
            <b>Zoom で「共有」→「ウィンドウ」のタブ</b>から、表示画面の窓（題が授業の名前の窓）を選ぶ。画面全体ではなく窓を選ぶと、コントロール画面は生徒に見えない
          </li>
          <li>
            共有の画面の下で<b>「ビデオクリップに最適化」をオン</b>にする（ワイプの顔と切り替えがなめらかになる。字は大きいので粗くならない）
          </li>
          <li>
            音楽を流すときは<b>「音声を共有」をオン</b>。Zoom はPCの音をまとめて送るので、鳴らす窓はどちらでもよい。スピーカーから鳴らすとマイクが拾うので、イヤホンで聞くか音量を下げる
          </li>
          <li>
            表示画面は<b>最小化しない・別のデスクトップに移さない</b>。この画面の上の帯が緑なら、表示画面は描けている。赤・黄になったら表示画面を前に出す
          </li>
          <li>
            表示画面の窓は 16:9 にすると、生徒側に黒い帯が出ない（上の帯に大きさが出る）。外付けのモニターがあれば、表示画面をそちらに置いて <code>F</code> で全画面にしてもよい
          </li>
          <li>
            <b>予行で必ず、別の端末から Zoom に入って</b>生徒側の見え方（字の大きさ、ワイプのなめらかさ、3秒提示の長さ、音）を確かめる
          </li>
        </ol>
        <p className="hint">Meet で使うときは「タブを共有」ではなく「ウィンドウ」を選ぶ。音を送るなら、Meet では表示画面を「タブ」で共有して「タブの音声を共有」をオンにし、音楽の「鳴らす窓」を表示画面にする。</p>
      </div>
    </div>
  );
}
