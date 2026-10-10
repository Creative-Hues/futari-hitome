import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/zen-maru-gothic/500.css';
import '@fontsource/zen-maru-gothic/700.css';
import './styles/app.css';
import { App } from './app';
import { preventZoom } from './lib/noZoom';

// オフラインで動くよう service worker を登録(新しい版があれば自動で入れ替わる)
registerSW({ immediate: true });

// ダブルタップや2本指で画面が拡大されないようにする
preventZoom();

render(<App />, document.getElementById('app')!);
