<template>
  <div
    v-if="ui.hint && ui.screen === 'play'"
    class="hint"
    :style="{ left: `${ui.hint.x}px`, top: `${ui.hint.y}px` }"
  >
    <b>{{ ui.hint.title }}</b>
    <span
      v-if="ui.hint.detail"
      :class="{ bad: ui.hint.bad }"
    >{{ ui.hint.detail }}</span>
  </div>
</template>

<script setup lang="ts">
import { ui } from '../game/ui';
</script>

<style scoped>
.hint {
  position: fixed;
  transform: translate(16px, 10px);
  display: grid;
  gap: 1px;
  padding: 5px 10px;
  font-size: 15px;
  background: rgba(247, 238, 219, .95);
  border: 2px solid var(--walnut);
  border-radius: 6px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 4;
}

span { color: var(--ink-soft); }
.bad { color: var(--rose); }
</style>
