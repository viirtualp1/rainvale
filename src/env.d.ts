/// <reference types="vite/client" />

interface Window {
  rainvale?: import('./game/game').Game;
  rainvaleUi?: typeof import('./game/ui').ui;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}
