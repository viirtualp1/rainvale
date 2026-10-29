<template>
  <aside
    class="panel resources"
    :aria-label="t('cat.craft')"
  >
    <p
      v-if="!owned.length"
      class="empty"
    >
      {{ t('res.empty') }}
    </p>
    <ul
      v-else
      class="list"
    >
      <li
        v-for="id in owned"
        :key="`${id}-${ui.gained[id] ?? 0}`"
        class="item"
        :class="{ 'is-fresh': isFresh(id) }"
      >
        <img
          class="pixel"
          :src="materialIconUrl(id)"
          alt=""
        >
        <span class="name">{{ matName(id) }}</span>
        <b class="count">{{ ui.inv[id] }}</b>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { materialIconUrl } from '../game/art';
import { MATERIAL_ORDER } from '../game/defs';
import { ui } from '../game/ui';
import { matName, t } from '../i18n';
import type { MaterialId } from '../game/defs';

const FRESH_MS = 900;

const owned = computed(() => MATERIAL_ORDER.filter(id => ui.inv[id] > 0));

function isFresh (id: MaterialId) {
  const at = ui.gained[id];

  return !!at && performance.now() - at < FRESH_MS;
}
</script>

<style scoped>
.resources {
  position: fixed;
  right: max(12px, env(safe-area-inset-right, 0px));
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  padding: 8px 10px;
  max-width: min(320px, calc(100vw - 24px));
  pointer-events: none;
}

.empty {
  margin: 0;
  font-size: 15px;
  color: var(--ink-soft);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 14px;
}

.item {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  min-width: 0;
}

.item img { width: 26px; height: 26px; }
.name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.count {
  font-family: var(--pixel);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  color: var(--walnut-deep);
}

.is-fresh { animation: bump .6s ease-out; }
.is-fresh .count { color: var(--leaf-deep); }

@keyframes bump {
  0% { transform: scale(1); }
  30% { transform: scale(1.18); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
  .list { grid-template-columns: 1fr; }
  .name { display: none; }
  .item { grid-template-columns: 22px auto; }
  .item img { width: 22px; height: 22px; }
}
</style>
