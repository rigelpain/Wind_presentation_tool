// 写真の読み込み（U）。作業員が仕上げる（指示書: docs/briefs/）。
export function PhotoTray({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <h2>写真の読み込み</h2>
          <button onClick={onClose}>閉じる（U）</button>
        </div>
      </div>
    </div>
  );
}
