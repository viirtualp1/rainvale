<template>
  <div class="title-screen">
    <div class="panel card">
      <div class="langs">
        <button
          v-for="lang in LOCALES"
          :key="lang.id"
          class="lang"
          :class="{ 'is-on': settings.locale === lang.id }"
          @click="settings.locale = lang.id"
        >
          {{ lang.name }}
        </button>
      </div>
      <p class="kicker">
        {{ t('game.subtitle') }}
      </p>
      <h1>Rainvale</h1>
      <p>{{ t('game.intro') }}</p>
      <dl class="keys">
        <dt>WASD</dt><dd>{{ t('key.walk') }}</dd>
        <dt>LMB</dt><dd>{{ t('key.click') }}</dd>
        <dt>Space</dt><dd>{{ t('key.space') }}</dd>
        <dt>E</dt><dd>{{ t('key.workshop') }}</dd>
        <dt>1–9</dt><dd>{{ t('key.slots') }}</dd>
        <dt>X</dt><dd>{{ t('key.remove') }}</dd>
        <dt>J</dt><dd>{{ t('key.journal') }}</dd>
        <dt>M</dt><dd>{{ t('key.mute') }}</dd>
        <dt>Esc</dt><dd>{{ t('key.menu') }}</dd>
      </dl>
      <div class="row">
        <button
          v-if="ui.hasSave"
          class="btn is-primary"
          @click="gameRef?.continueGame()"
        >
          {{ t('title.continue') }}
        </button>
        <button
          class="btn"
          :class="{ 'is-primary': !ui.hasSave }"
          @click="startNew"
        >
          {{ confirmNew ? t('title.sure') : ui.hasSave ? t('title.new') : t('title.start') }}
        </button>
        <button
          class="btn"
          @click="ui.menu = 'load'"
        >
          {{ t('title.load') }}
        </button>
        <button
          class="btn"
          @click="ui.menu = 'settings'"
        >
          {{ t('title.settings') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { gameRef } from '../game/instance';
import { LOCALES, settings } from '../game/settings';
import { ui } from '../game/ui';
import { t } from '../i18n';

const confirmNew = ref(false);

function startNew () {
  if (ui.hasSave && !confirmNew.value) {
    confirmNew.value = true;

    return;
  }

  gameRef.value?.newWorld();
}
</script>

<style scoped>
.title-screen {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(26, 34, 54, .35);
  z-index: 10;
  overflow-y: auto;
}

.card {
  width: min(540px, 100%);
  padding: 22px 26px;
  display: grid;
  gap: 12px;
}

.langs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.lang {
  padding: 3px 10px;
  font-size: 14px;
  font-weight: 800;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  color: var(--ink-soft);
}

.lang:hover { color: var(--ink); }
.lang.is-on { color: var(--ink); background: var(--paper-deep); border-color: var(--walnut); }

.kicker {
  margin: 0;
  font-size: 15px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--leaf-deep);
}

h1 {
  margin: 0;
  font-size: clamp(40px, 9vw, 60px);
  line-height: 1;
  color: var(--walnut-deep);
  text-shadow: 3px 3px 0 #e8c88a;
}

p { margin: 0; font-size: 16px; line-height: 1.5; }

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 14px;
  margin: 0;
  font-size: 14px;
}

dt { color: var(--lantern); font-weight: 900; }
dd { margin: 0; color: var(--ink); }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
