<template>
  <span class="cost">
    <span
      v-for="[id, n] in entries"
      :key="id"
      class="chip"
      :class="{ 'is-short': ui.inv[id] < n }"
    >
      <img
        class="pixel"
        :src="materialIconUrl(id)"
        :alt="matName(id)"
      >
      {{ ui.inv[id] }}/{{ n }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { materialIconUrl } from '../game/art';
import { matName } from '../i18n';
import { ui } from '../game/ui';
import type { Cost, MaterialId } from '../game/defs';

const props = defineProps<{
  cost: Cost;
}>();

const entries = computed(() => Object.entries(props.cost).map(([id, n]) => [id as MaterialId, n ?? 0] as const));
</script>

<style scoped>
.cost {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--leaf-deep);
}

.chip.is-short { color: var(--rose); }
.chip img { width: 22px; height: 22px; }
</style>
