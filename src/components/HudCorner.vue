<template>
  <section class="hud-corner">
    <div class="panel clock">
      <span class="day">{{ t('hud.day', { n: ui.day }) }}</span>
      <span class="sep">·</span>
      <span>{{ t(`part.${ui.phase}`) }}</span>
      <span class="sep">·</span>
      <span class="rain">{{ t(`rain.${ui.rain}`) }}</span>
    </div>
    <TransitionGroup
      name="event"
      tag="ul"
      class="events"
    >
      <li
        v-for="event in ui.events"
        :key="event.id"
        class="event"
        :class="`is-${event.kind}`"
      >
        <span class="dot" />
        {{ t(event.key, event.params) }}
      </li>
    </TransitionGroup>
  </section>
</template>

<script setup lang="ts">
import { ui } from '../game/ui';
import { t } from '../i18n';
</script>

<style scoped>
.hud-corner {
  position: fixed;
  left: calc(env(safe-area-inset-left, 0px) + 12px);
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  display: grid;
  gap: 6px;
  justify-items: start;
  pointer-events: none;
  max-width: min(380px, max(180px, calc(100vw - 360px)));
}

.clock {
  padding: 6px 14px;
  font-size: 18px;
  font-weight: 900;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.sep { color: var(--ink-soft); }
.rain { color: var(--rain); }

.events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 15px;
  line-height: 1.3;
  color: var(--ink);
  background: rgba(247, 238, 219, .92);
  border: 2px solid var(--walnut);
  border-radius: 8px;
  box-shadow: 0 2px 0 var(--walnut-deep);
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--ink-soft);
}

.is-weather .dot { background: var(--rain); }
.is-time .dot { background: var(--lantern); }
.is-garden .dot { background: var(--leaf); }
.is-visitor .dot { background: var(--rose); }

.event-enter-active, .event-leave-active { transition: opacity .35s ease, transform .35s ease; }
.event-enter-from { opacity: 0; transform: translateX(-12px); }
.event-leave-to { opacity: 0; }
</style>
