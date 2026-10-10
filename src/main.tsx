import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore } from './engine/store';
import { pickLesson } from './lessons';
import { Presenter } from './presenter/Presenter';
import { registerScenes } from './scenes';
import { Stage } from './stage/Stage';
import './styles.css';

registerScenes();
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
  if (hash.startsWith('#/presenter')) {
    document.title = `発表者 — ${lesson.title}`;
    return <Presenter lesson={lesson} />;
  }
  document.title = lesson.title;
  return <Stage lesson={lesson} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
