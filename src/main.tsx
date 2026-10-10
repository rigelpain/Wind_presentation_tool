import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore } from './engine/store';
import { pickLesson } from './lessons';
import { Control } from './control/Control';
import { registerScenes } from './scenes';
import { Stage } from './stage/Stage';
import './styles.css';

registerScenes();

// 受け口の外にファイルを落としても、ブラウザがそのファイルを開いて画面が移らないようにする
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
const lesson = pickLesson();
createStore(lesson);

function useHash() {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener('hashchange', fn);
      return () => window.removeEventListener('hashchange', fn);
    },
    () => location.hash,
  );
}

function App() {
  const hash = useHash();
  // #/control（と前の名前 #/presenter）がコントロール画面。それ以外は表示画面
  if (hash.startsWith('#/control') || hash.startsWith('#/presenter')) {
    document.title = `コントロール — ${lesson.title}`;
    return <Control />;
  }
  document.title = lesson.title;
  return <Stage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
