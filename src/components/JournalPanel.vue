<template>
  <aside
    class="panel journal"
    :aria-label="t('jr.title')"
  >
    <header class="head">
      <h2>{{ t('jr.title') }}</h2>
      <button
        class="btn"
        @click="ui.panel = null"
      >
        {{ t('ws.close') }} <kbd>J</kbd>
      </button>
    </header>
    <p class="lead">
      {{ t('jr.lead') }}
    </p>
    <ul class="list">
      <li
        v-for="id in VISITOR_ORDER"
        :key="id"
        class="guest"
        :class="{ 'is-unknown': !ui.journal[id] }"
      >
        <img
          class="pixel"
          :src="visitorIconUrl(id)"
          alt=""
        >
        <div>
          <h3>
            {{ ui.journal[id] ? visitorName(id) : '???' }}
            <span
              v-if="ui.present.includes(id)"
              class="here"
            >{{ t('jr.here') }}</span>
          </h3>
          <p>{{ t('jr.likes', { what: visitorLikes(id) }) }}</p>
        </div>
      </li>
    </ul>
    <p class="count">
      {{ t('jr.count', { a: met, b: VISITOR_ORDER.length }) }}
    </p>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { visitorIconUrl } from '../game/art';
import { VISITOR_ORDER } from '../game/defs';
import { ui } from '../game/ui';
import { t, visitorLikes, visitorName } from '../i18n';

const met = computed(() => VISITOR_ORDER.filter(id => ui.journal[id]).length);
</script>

<style scoped>
.journal {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  width: min(480px, calc(100vw - 24px));
  max-height: calc(100vh - 190px);
  overflow-y: auto;
  padding: 14px;
  display: grid;
  gap: 10px;
  z-index: 5;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 { margin: 0; font-size: 26px; font-weight: 900; color: var(--walnut-deep); }
.lead { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink-soft); }

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.guest {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 10px;
  align-items: center;
  padding: 6px 10px;
  background: var(--paper-deep);
  border-radius: 8px;
}

.guest img { width: 36px; height: auto; }
.guest.is-unknown img { filter: brightness(0) opacity(.35); }
h3 { margin: 0; font-size: 18px; font-weight: 800; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.guest p { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink-soft); }
.here { font-size: 12px; color: var(--leaf-deep); font-weight: 500; }
.count { margin: 0; font-size: 14px; color: var(--walnut); }
</style>
