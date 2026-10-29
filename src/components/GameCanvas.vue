<template>
  <canvas
    ref="canvasEl"
    class="game-canvas"
    aria-label="Rainvale"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { Game } from '../game/game';
import { gameRef } from '../game/instance';
import { ui } from '../game/ui';

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvasEl');

onMounted(() => {
  if (!canvasEl.value) {
    return;
  }

  const game = new Game(canvasEl.value);
  game.start();
  gameRef.value = game;

  if (import.meta.env.DEV) {
    window.rainvale = game;
    window.rainvaleUi = ui;
  }
});

onBeforeUnmount(() => {
  gameRef.value?.destroy();
  gameRef.value = null;
});
</script>

<style scoped>
.game-canvas {
  position: fixed;
  left: 0;
  top: 0;
  image-rendering: pixelated;
  touch-action: none;
  cursor: pointer;
}
</style>
