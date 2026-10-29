<template>
  <nav
    class="panel actions"
    :aria-label="t('act.menu')"
  >
    <button
      class="btn big"
      :class="{ 'is-on': ui.panel === 'workshop' }"
      @click="togglePanel('workshop')"
    >
      {{ t('act.workshop') }} <kbd>E</kbd>
    </button>
    <button
      class="btn big is-danger"
      :class="{ 'is-on': ui.mode === 'remove' }"
      @click="gameRef?.setMode(ui.mode === 'remove' ? 'play' : 'remove')"
    >
      {{ t('act.remove') }} <kbd>X</kbd>
    </button>
    <button
      class="btn big"
      :class="{ 'is-on': ui.panel === 'journal' }"
      @click="togglePanel('journal')"
    >
      {{ t('act.guests') }} <kbd>J</kbd>
    </button>
    <button
      class="btn big"
      :aria-label="t('key.mute')"
      @click="gameRef?.toggleMute()"
    >
      {{ ui.muted ? t('act.soundOff') : t('act.soundOn') }} <kbd>M</kbd>
    </button>
    <button
      class="btn big wide-menu"
      @click="ui.menu = 'main'"
    >
      {{ t('act.menu') }} <kbd>Esc</kbd>
    </button>
    <button
      v-if="ui.touch"
      class="btn big is-primary wide"
      @pointerdown="setAct(1)"
      @pointerup="setAct(0)"
      @pointercancel="setAct(0)"
      @pointerleave="setAct(0)"
    >
      {{ t('act.gather') }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { gameRef } from '../game/instance';
import { ui } from '../game/ui';
import { t } from '../i18n';

function togglePanel (panel: 'workshop' | 'journal') {
  ui.panel = ui.panel === panel ? null : panel;
}

function setAct (value: number) {
  if (gameRef.value) {
    gameRef.value.keys.act = value;
  }
}
</script>

<style scoped>
.actions {
  position: fixed;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
}

.big {
  justify-content: space-between;
  min-width: 150px;
  min-height: 46px;
  font-size: 17px;
}

.wide { grid-column: 1 / -1; justify-content: center; }
.wide-menu { grid-column: 1 / -1; }

@media (max-width: 1240px) {
  .actions { bottom: calc(env(safe-area-inset-bottom, 0px) + 100px); }
}

@media (max-width: 640px) {
  .big { min-width: 0; min-height: 40px; font-size: 14px; }
  kbd { display: none; }
}
</style>
