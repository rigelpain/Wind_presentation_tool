// 本番用: 組み立てて、手元のサーバーで出し、表示画面とコントロール画面を Chrome で開く。
//   npm run show                     … 組み立てて開く
//   npm run show -- --lesson=parts   … 授業を選ぶ
//   npm run show -- --no-build       … 組み立てを飛ばす（前に組み立てたものを使う）
//   npm run show -- --no-open        … サーバーだけ立てる
//
// Zoom のウィンドウ共有に向けて、Chrome を専用のプロフィールと次の設定で開く。
// - 窓が隠れても描くのを止めない（止めると、共有の絵が止まる）
// - 音の自動再生を止めない（音楽を流すとき、窓をクリックしなくても鳴る）
// - アプリの窓（アドレスバーなし）で開く（共有の絵に余計なものが入らない）
// ネットにはつながない。サーバーはこのPCの中だけ（localhost）。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { preview } from 'vite';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const port = Number(args.port ?? 4173);
const lesson = typeof args.lesson === 'string' ? `?lesson=${encodeURIComponent(args.lesson)}` : '';

if (!args['no-build']) {
  console.log('組み立てています…');
  const r = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

let server;
try {
  server = await preview({ preview: { port, strictPort: true, host: '127.0.0.1' } });
} catch (e) {
  console.error(`ポート ${port} が使われています。前に開いた npm run show が動いていれば、それを使うか止めてください。`);
  console.error(String(e?.message ?? e));
  process.exit(1);
}
const base = `http://localhost:${port}/${lesson}`;
console.log(`\n表示画面:       ${base}`);
console.log(`コントロール画面: ${base}#/control\n`);

if (!args['no-open']) {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(chrome)) {
    console.log('Google Chrome が見つからないので、既定のブラウザで開きます（隠れると描くのを止めることがあります）。');
    spawn('open', [base]);
    setTimeout(() => spawn('open', [`${base}#/control`]), 800);
  } else {
    const profile = join(homedir(), 'Library', 'Application Support', 'WindPresentationTool', 'chrome-profile');
    mkdirSync(profile, { recursive: true });
    const flags = [
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--autoplay-policy=no-user-gesture-required',
    ];
    const open = (url, size, pos) =>
      spawn(chrome, [...flags, `--app=${url}`, `--window-size=${size}`, `--window-position=${pos}`], { detached: true, stdio: 'ignore' }).unref();
    open(base, '1600,900', '0,0');
    setTimeout(() => open(`${base}#/control`, '1440,900', '80,80'), 1500);
    console.log('Chrome で2つの窓を開きました。Zoom では「共有」→「ウィンドウ」で表示画面の窓を選んでください。');
  }
}

console.log('止めるときは Ctrl+C。');
const stop = () => {
  server.httpServer.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
