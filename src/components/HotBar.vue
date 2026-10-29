<template>
  <section class="hotbar-wrap">
    <div
      v-if="ui.mode === 'build' && ui.buildSel"
      class="panel mode-note"
    >
      <span>{{ t('bar.building') }} <b>{{ buildName(ui.buildSel) }}</b></span>
      <CostLine :cost="BUILDS[ui.buildSel].cost" />
      <span class="muted">{{ ui.touch ? t('bar.buildHintTouch') : t('bar.buildHint') }}</span>
    </div>
    <div
      v-else-if="ui.mode === 'remove'"
      class="panel mode-note"
    >
      <span>{{ t('bar.removeHint') }}</span>
    </div>

    <Transition
      name="label"
      mode="out-in"
    >
      <div
        v-if="labelVisible"
        :key="ui.slotLabel.id"
        class="slot-label"
      >
        {{ t(ui.slotLabel.key, ui.slotLabel.params) }}
      </div>
    </Transition>

    <div
      class="hotbar"
      role="toolbar"
      :aria-label="t('key.slots')"
    >
      <button
        v-for="(slot, index) in ui.hotbar"
        :key="index"
        class="slot"
        :class="{ 'is-sel': ui.sel === index, 'is-new': isNew(slot) }"
        :aria-label="slotName(slot) || t('bar.slot', { n: index + 1 })"
        :title="slotName(slot)"
        @click="gameRef?.selectSlot(index)"
      >
        <span class="key">{{ index + 1 }}</span>
        <img
          v-if="slot"
          class="pixel"
          :src="slotIcon(slot)"
          alt=""
        >
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import CostLine from './CostLine.vue';
import { buildIconUrl, toolIconUrl } from '../game/art';
import { BUILDS } from '../game/defs';
import { gameRef } from '../game/instance';
import { ui } from '../game/ui';
import type { Slot } from '../game/ui';
import { buildName, t, toolName } from '../i18n';

const LABEL_MS = 1400;
const NEW_MS = 2400;
let labelTimer: ReturnType<typeof setTimeout> | null = null;

const labelVisible = ref(false);
const freshTools = ref<string[]>([]);

function slotIcon (slot: Slot) {
  return slot.kind === 'tool' ? toolIconUrl(slot.id) : buildIconUrl(slot.id);
}

function slotName (slot: Slot | null) {
  if (!slot) {
    return '';
  }

  return slot.kind === 'tool' ? toolName(slot.id) : buildName(slot.id);
}

function isNew (slot: Slot | null) {
  return slot?.kind === 'tool' && freshTools.value.includes(slot.id);
}

watch(() => ui.slotLabel.id, () => {
  labelVisible.value = true;

  if (labelTimer) {
    clearTimeout(labelTimer);
  }

  labelTimer = setTimeout(() => {
    labelVisible.value = false;
  }, LABEL_MS);
});

watch(() => ({ ...ui.tools }), (now, before) => {
  const added = Object.keys(now).filter(id => now[id as keyof typeof now] && !before[id as keyof typeof before]);

  if (!added.length) {
    return;
  }

  freshTools.value = [...freshTools.value, ...added];
  setTimeout(() => {
    freshTools.value = freshTools.value.filter(id => !added.includes(id));
  }, NEW_MS);
});

onBeforeUnmount(() => {
  if (labelTimer) {
    clearTimeout(labelTimer);
  }
});
</script>

<style scoped>
.hotbar-wrap {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 8px;
  pointer-events: none;
  max-width: calc(100vw - 24px);
}

.hotbar {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: rgba(78, 56, 38, .88);
  border: 3px solid var(--walnut-deep);
  border-radius: 12px;
  box-shadow: 0 4px 0 #2f2218, 0 10px 24px rgba(10, 20, 40, .35);
  pointer-events: auto;
}

.slot {
  position: relative;
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  padding: 0;
  background: #f1e4c6;
  border: 3px solid #c9b48c;
  border-radius: 8px;
  box-shadow: inset 0 -3px 0 #dccaa2;
  transition: transform .1s ease;
}

.slot:hover { background: #fff3d8; }
.slot img { width: 40px; height: 40px; }

.slot.is-sel {
  border-color: var(--lantern);
  background: #fff6e0;
  transform: translateY(-4px);
  box-shadow: 0 0 0 2px #fff3c4, inset 0 -3px 0 #f0d8a8;
}

.slot.is-new { animation: glow 1.2s ease-in-out 2; }

.key {
  position: absolute;
  left: 4px;
  top: 1px;
  font-family: var(--pixel);
  font-size: 12px;
  color: var(--ink-soft);
}

.slot-label {
  padding: 3px 12px;
  font-size: 16px;
  font-weight: 800;
  color: #fff8e8;
  background: rgba(46, 34, 24, .78);
  border-radius: 8px;
}

.mode-note {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  font-size: 16px;
  flex-wrap: wrap;
  justify-content: center;
  pointer-events: auto;
}

.muted { color: var(--ink-soft); font-size: 15px; }

.label-enter-active, .label-leave-active { transition: opacity .2s ease, transform .2s ease; }
.label-enter-from, .label-leave-to { opacity: 0; transform: translateY(6px); }

@keyframes glow {
  50% { box-shadow: 0 0 0 4px #ffe08a, 0 0 18px 6px rgba(255, 220, 120, .8); transform: translateY(-6px) scale(1.06); }
}

@media (max-width: 640px) {
  .slot { width: 38px; height: 38px; border-width: 2px; }
  .slot img { width: 28px; height: 28px; }
  .key { font-size: 10px; left: 2px; top: 0; }
}
</style>
