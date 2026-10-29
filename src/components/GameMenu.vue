<template>
  <div
    class="menu-backdrop"
    @click.self="close"
  >
    <section
      class="panel menu"
      role="dialog"
      aria-modal="true"
      :aria-label="heading"
    >
      <header class="head">
        <h2>{{ heading }}</h2>
        <button
          v-if="ui.menu !== 'main'"
          class="btn"
          @click="back"
        >
          {{ t('menu.back') }} <kbd>Esc</kbd>
        </button>
      </header>

      <div
        v-if="ui.menu === 'main'"
        class="main"
      >
        <button
          class="btn is-primary wide"
          @click="ui.menu = null"
        >
          {{ t('menu.resume') }}
        </button>
        <button
          class="btn wide"
          @click="ui.menu = 'save'"
        >
          {{ t('menu.save') }}
        </button>
        <button
          class="btn wide"
          @click="ui.menu = 'load'"
        >
          {{ t('menu.load') }}
        </button>
        <button
          class="btn wide"
          @click="ui.menu = 'settings'"
        >
          {{ t('menu.settings') }}
        </button>
        <div
          v-if="confirm === 'new'"
          class="confirm"
        >
          <p>{{ t('menu.newSure') }}</p>
          <div class="row">
            <button
              class="btn is-danger is-on"
              @click="startNew"
            >
              {{ t('menu.confirm') }}
            </button>
            <button
              class="btn"
              @click="confirm = ''"
            >
              {{ t('menu.cancel') }}
            </button>
          </div>
        </div>
        <button
          v-else
          class="btn wide"
          @click="confirm = 'new'"
        >
          {{ t('menu.new') }}
        </button>
        <button
          class="btn wide"
          @click="gameRef?.toTitle()"
        >
          {{ t('menu.toTitle') }}
        </button>
      </div>

      <ul
        v-else-if="ui.menu === 'save' || ui.menu === 'load'"
        class="slots"
      >
        <li
          v-for="slot in visibleSlots"
          :key="slot"
          class="slot"
        >
          <div class="slot-info">
            <b>{{ slotTitle(slot) }}</b>
            <span v-if="metas[slot]">
              {{ t('slots.meta', { day: metas[slot]!.day, part: t(`part.${metas[slot]!.part}`), met: metas[slot]!.met }) }}
            </span>
            <span
              v-else
              class="muted"
            >{{ t('slots.empty') }}</span>
            <small v-if="metas[slot]?.savedAt">{{ formatDate(metas[slot]!.savedAt) }}</small>
          </div>
          <div class="slot-actions">
            <template v-if="ui.menu === 'save'">
              <button
                class="btn is-primary"
                @click="saveTo(slot)"
              >
                {{ confirm === `save-${slot}` ? t('slots.overwrite') : t('slots.saveHere') }}
              </button>
            </template>
            <template v-else>
              <button
                class="btn is-primary"
                :disabled="!metas[slot]"
                @click="gameRef?.loadSlot(slot)"
              >
                {{ t('slots.loadThis') }}
              </button>
              <button
                v-if="slot !== 'auto' && metas[slot]"
                class="btn is-danger"
                :class="{ 'is-on': confirm === `del-${slot}` }"
                @click="remove(slot)"
              >
                {{ confirm === `del-${slot}` ? t('slots.deleteSure') : t('slots.delete') }}
              </button>
            </template>
          </div>
        </li>
      </ul>

      <div
        v-else
        class="settings"
      >
        <fieldset>
          <legend>{{ t('set.language') }}</legend>
          <div class="segmented">
            <button
              v-for="lang in LOCALES"
              :key="lang.id"
              class="btn"
              :class="{ 'is-on': settings.locale === lang.id }"
              @click="settings.locale = lang.id"
            >
              {{ lang.name }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t('set.sound') }}</legend>
          <label
            v-for="channel in channels"
            :key="channel.id"
            class="slider"
            :for="`vol-${channel.id}`"
          >
            <span>{{ t(channel.label) }}</span>
            <input
              :id="`vol-${channel.id}`"
              v-model.number="settings[channel.id]"
              type="range"
              min="0"
              max="1"
              step="0.05"
            >
            <b>{{ Math.round(settings[channel.id] * 100) }}</b>
          </label>
        </fieldset>

        <fieldset>
          <legend>{{ t('set.view') }}</legend>
          <div class="line">
            <span>{{ t('set.uiScale') }}</span>
            <div class="segmented">
              <button
                v-for="(scale, i) in UI_SCALES"
                :key="scale"
                class="btn small"
                :class="{ 'is-on': settings.uiScale === scale }"
                @click="settings.uiScale = scale"
              >
                {{ t(SCALE_LABELS[i]) }}
              </button>
            </div>
          </div>
          <div class="line">
            <span>{{ t('set.fog') }}</span>
            <button
              class="btn small"
              :class="{ 'is-on': settings.fog }"
              @click="settings.fog = !settings.fog"
            >
              {{ settings.fog ? t('set.on') : t('set.off') }}
            </button>
          </div>
          <div class="line">
            <span>{{ t('set.hints') }}</span>
            <button
              class="btn small"
              :class="{ 'is-on': settings.hints }"
              @click="settings.hints = !settings.hints"
            >
              {{ settings.hints ? t('set.on') : t('set.off') }}
            </button>
          </div>
        </fieldset>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { SAVE_SLOTS, slotTitle } from '../game/game';
import { gameRef } from '../game/instance';
import { LOCALES, UI_SCALES, settings } from '../game/settings';
import { ui } from '../game/ui';
import { t } from '../i18n';
import type { SlotId, SlotMeta } from '../game/game';
import type { MessageKey } from '../i18n';

const SCALE_LABELS: MessageKey[] = ['set.uiSmall', 'set.uiNormal', 'set.uiLarge'];
const DATE_LOCALES: Record<string, string> = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN', th: 'th-TH' };

const channels: { id: 'master' | 'ambience' | 'music' | 'sfx'; label: MessageKey }[] = [
  { id: 'master', label: 'set.master' },
  { id: 'ambience', label: 'set.ambience' },
  { id: 'music', label: 'set.music' },
  { id: 'sfx', label: 'set.sfx' }
];

const confirm = ref('');
const version = ref(0);

const heading = computed(() => {
  switch (ui.menu) {
    case 'save': return t('slots.saveTitle');
    case 'load': return t('slots.loadTitle');
    case 'settings': return t('set.title');
    default: return t('menu.title');
  }
});

const visibleSlots = computed<SlotId[]>(() => ui.menu === 'load' ? ['auto', ...SAVE_SLOTS] : [...SAVE_SLOTS]);

const metas = computed(() => {
  void version.value;

  const all: Partial<Record<SlotId, SlotMeta | null>> = {};

  for (const slot of ['auto', ...SAVE_SLOTS] as SlotId[]) {
    all[slot] = gameRef.value?.slotMeta(slot) ?? null;
  }

  return all;
});

function formatDate (at: number) {
  return new Intl.DateTimeFormat(DATE_LOCALES[settings.locale], { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}

function close () {
  ui.menu = null;
}

function back () {
  confirm.value = '';
  ui.menu = ui.screen === 'title' ? null : 'main';
}

function saveTo (slot: SlotId) {
  if (slot === 'auto') {
    return;
  }

  if (metas.value[slot] && confirm.value !== `save-${slot}`) {
    confirm.value = `save-${slot}`;

    return;
  }

  gameRef.value?.saveToSlot(slot);
  confirm.value = '';
  version.value++;
}

function remove (slot: SlotId) {
  if (confirm.value !== `del-${slot}`) {
    confirm.value = `del-${slot}`;

    return;
  }

  gameRef.value?.deleteSlot(slot);
  confirm.value = '';
  version.value++;
}

function startNew () {
  confirm.value = '';
  ui.menu = null;
  gameRef.value?.newWorld();
}

watch(() => ui.menu, () => {
  confirm.value = '';
  version.value++;
});
</script>

<style scoped>
.menu-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(20, 26, 44, .45);
  z-index: 20;
  overflow-y: auto;
}

.menu {
  width: min(520px, 100%);
  padding: 18px 20px 20px;
  display: grid;
  gap: 14px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 900;
  color: var(--walnut-deep);
}

.main {
  display: grid;
  gap: 8px;
}

.wide {
  justify-content: center;
  min-height: 50px;
  font-size: 18px;
}

.confirm {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  background: #fbeee8;
  border: 2px solid var(--rose);
  border-radius: 8px;
}

.confirm p { margin: 0; font-size: 15px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }

.slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--paper-deep);
  border-radius: 10px;
  flex-wrap: wrap;
}

.slot-info {
  display: grid;
  gap: 2px;
  font-size: 15px;
  min-width: 0;
}

.slot-info b { font-size: 17px; }
.slot-info small { font-size: 13px; color: var(--ink-soft); }
.muted { color: var(--ink-soft); }
.slot-actions { display: flex; gap: 6px; }

.settings {
  display: grid;
  gap: 12px;
}

fieldset {
  margin: 0;
  padding: 10px 12px 12px;
  display: grid;
  gap: 8px;
  border: 2px solid #e2d3b3;
  border-radius: 10px;
}

legend {
  padding: 0 6px;
  font-size: 15px;
  font-weight: 900;
  color: var(--walnut);
}

.segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.small { padding: 5px 10px; font-size: 15px; }

.slider {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 2fr) 34px;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}

.slider input { accent-color: var(--leaf); width: 100%; }
.slider b { font-family: var(--pixel); text-align: right; font-variant-numeric: tabular-nums; }

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 15px;
  flex-wrap: wrap;
}
</style>
