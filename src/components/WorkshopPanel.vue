<template>
  <aside
    class="panel workshop"
    :aria-label="t('ws.title')"
  >
    <header class="head">
      <div>
        <h2>{{ t('ws.title') }}</h2>
        <p class="sub">
          {{ activeCat.hint }}
        </p>
      </div>
      <button
        class="btn"
        @click="ui.panel = null"
      >
        {{ t('ws.close') }} <kbd>E</kbd>
      </button>
    </header>

    <div class="layout">
      <nav
        class="cats"
        :aria-label="t('ws.title')"
      >
        <button
          v-for="cat in cats"
          :key="cat.id"
          class="cat"
          :class="{ 'is-on': activeTab === cat.id }"
          @click="openTab(cat.id)"
        >
          <img
            class="pixel"
            :src="cat.icon"
            alt=""
          >
          <span class="cat-name">{{ cat.name }}</span>
          <span
            v-if="readyCount(cat.id)"
            class="badge"
          >{{ readyCount(cat.id) }}</span>
        </button>
      </nav>

      <section
        class="catalog"
        :aria-label="activeCat.name"
      >
        <button
          v-for="entry in entries"
          :key="entryKey(entry)"
          class="tile"
          :class="{
            'is-sel': selectedKey === entryKey(entry),
            'is-ready': isReady(entry),
            'is-done': isOwnedTool(entry)
          }"
          @click="selectedKey = entryKey(entry)"
          @dblclick="primary(entry)"
        >
          <img
            class="pixel"
            :src="entryIcon(entry)"
            alt=""
          >
          <span class="tile-name">{{ entryName(entry) }}</span>
          <span
            v-if="isOwnedTool(entry)"
            class="mark done"
          >{{ t('ws.owned') }}</span>
          <span
            v-else-if="isReady(entry)"
            class="mark ready"
          >{{ t('ws.ready') }}</span>
        </button>
      </section>
    </div>

    <footer
      v-if="selected"
      class="detail"
    >
      <img
        class="pixel big-icon"
        :src="entryIcon(selected)"
        alt=""
      >
      <div class="info">
        <h3>
          {{ entryName(selected) }}
          <span
            v-if="selected.kind === 'material'"
            class="yield"
          >{{ t('ws.perCraft', { n: selected.recipe.n }) }}</span>
        </h3>
        <p
          v-if="entryNote(selected)"
          class="note"
        >
          {{ entryNote(selected) }}
        </p>
        <CostLine
          v-if="!isOwnedTool(selected)"
          :cost="entryCost(selected)"
        />
        <p
          v-if="missing(selected)"
          class="missing"
        >
          {{ t('ws.missing', { what: missing(selected) }) }}
        </p>
      </div>
      <div class="do">
        <template v-if="selected.kind === 'material'">
          <button
            class="btn is-primary"
            :disabled="!isReady(selected)"
            @click="gameRef?.craft(selected.recipe, 1)"
          >
            {{ t('ws.make') }}
          </button>
          <div class="row">
            <button
              class="btn small"
              :disabled="maxTimes(selected) < 5"
              @click="gameRef?.craft(selected.recipe, 5)"
            >
              ×5
            </button>
            <button
              class="btn small"
              :disabled="maxTimes(selected) < 2"
              @click="gameRef?.craft(selected.recipe, maxTimes(selected))"
            >
              {{ t('ws.makeAll', { n: maxTimes(selected) }) }}
            </button>
          </div>
        </template>
        <button
          v-else-if="selected.kind === 'tool'"
          class="btn is-primary"
          :disabled="isOwnedTool(selected) || !isReady(selected)"
          @click="gameRef?.craftTool(selected.id)"
        >
          {{ isOwnedTool(selected) ? t('ws.alreadyOwned') : t('ws.make') }}
        </button>
        <button
          v-else
          class="btn is-primary"
          @click="gameRef?.selectBuild(selected.id)"
        >
          {{ t('ws.build') }}
        </button>
      </div>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CostLine from './CostLine.vue';
import { buildIconUrl, materialIconUrl, toolIconUrl } from '../game/art';
import { BUILDS, BUILD_CATS, BUILD_ORDER, RECIPES, TOOLS, TOOL_ORDER, VISITORS, VISITOR_ORDER } from '../game/defs';
import { gameRef } from '../game/instance';
import { ui } from '../game/ui';
import { buildName, buildNote, catName, matName, recipeUse, t, toolName, toolNote, visitorName } from '../i18n';
import type { BuildCat, BuildId, Cost, MaterialId, Recipe, ToolId } from '../game/defs';

type TabId = 'tools' | 'craft' | BuildCat;

type Entry =
  | { kind: 'tool'; id: ToolId }
  | { kind: 'material'; recipe: Recipe }
  | { kind: 'build'; id: BuildId };

interface Cat {
  id: TabId;
  name: string;
  icon: string;
  hint: string;
}
const CAT_ICONS: Record<BuildCat, BuildId> = {
  floor: 'woodFloor',
  wall: 'woodWall',
  furniture: 'bed',
  garden: 'gardenBed',
  light: 'lantern',
  decor: 'flowerPot'
};

const activeTab = ref<TabId>(TOOL_ORDER.every(id => ui.tools[id]) ? 'craft' : 'tools');
const selectedKey = ref('');

const cats = computed<Cat[]>(() => [
  { id: 'tools', name: t('cat.tools'), icon: toolIconUrl('axe'), hint: t('cat.tools.hint') },
  { id: 'craft', name: t('cat.craft'), icon: materialIconUrl('planks'), hint: t('cat.craft.hint') },
  ...BUILD_CATS.map(id => ({ id, name: catName(id), icon: buildIconUrl(CAT_ICONS[id]), hint: t('cat.build.hint') }))
]);
const activeCat = computed(() => cats.value.find(c => c.id === activeTab.value) ?? cats.value[0]);
const entries = computed(() => entriesFor(activeTab.value));
const selected = computed(() => entries.value.find(e => entryKey(e) === selectedKey.value) ?? null);

function entriesFor (tab: TabId): Entry[] {
  if (tab === 'tools') {
    return TOOL_ORDER.map(id => ({ kind: 'tool', id }));
  }

  if (tab === 'craft') {
    return RECIPES.map(recipe => ({ kind: 'material', recipe }));
  }

  return BUILD_ORDER.filter(id => BUILDS[id].cat === tab).map(id => ({ kind: 'build', id }));
}

function entryKey (e: Entry) {
  return e.kind === 'material' ? `m:${e.recipe.out}` : `${e.kind}:${e.id}`;
}

function entryIcon (e: Entry) {
  if (e.kind === 'tool') {
    return toolIconUrl(e.id);
  }

  return e.kind === 'material' ? materialIconUrl(e.recipe.out) : buildIconUrl(e.id);
}

function entryName (e: Entry) {
  if (e.kind === 'tool') {
    return toolName(e.id);
  }

  return e.kind === 'material' ? matName(e.recipe.out) : buildName(e.id);
}

function entryCost (e: Entry): Cost {
  if (e.kind === 'tool') {
    return TOOLS[e.id].cost;
  }

  return e.kind === 'material' ? e.recipe.cost : BUILDS[e.id].cost;
}

function entryNote (e: Entry) {
  if (e.kind === 'tool') {
    return toolNote(e.id);
  }

  if (e.kind === 'material') {
    return t('ws.neededFor', { what: recipeUse(e.recipe.out) });
  }

  const fans = VISITOR_ORDER.filter(v => VISITORS[v].likes.includes(e.id));
  const likes = fans.length ? t('ws.likedBy', { who: fans.map(v => ui.journal[v] ? visitorName(v) : '???').join(', ') }) : '';

  return [buildNote(e.id), likes].filter(Boolean).join('. ');
}

function affordable (cost: Cost) {
  return Object.entries(cost).every(([id, n]) => ui.inv[id as MaterialId] >= (n ?? 0));
}

function isOwnedTool (e: Entry) {
  return e.kind === 'tool' && !!ui.tools[e.id];
}

function isReady (e: Entry) {
  return !isOwnedTool(e) && affordable(entryCost(e));
}

function missing (e: Entry) {
  if (isOwnedTool(e)) {
    return '';
  }

  return Object.entries(entryCost(e))
    .filter(([id, n]) => ui.inv[id as MaterialId] < (n ?? 0))
    .map(([id, n]) => `${matName(id as MaterialId)} ${(n ?? 0) - ui.inv[id as MaterialId]}`)
    .join(', ');
}

function maxTimes (e: Entry) {
  return e.kind === 'material' ? gameRef.value?.craftableTimes(e.recipe) ?? 0 : 0;
}

function readyCount (tab: TabId) {
  return entriesFor(tab).filter(isReady).length;
}

function openTab (tab: TabId) {
  activeTab.value = tab;
}

function primary (e: Entry) {
  if (e.kind === 'build') {
    gameRef.value?.selectBuild(e.id);
  } else if (e.kind === 'tool') {
    gameRef.value?.craftTool(e.id);
  } else {
    gameRef.value?.craft(e.recipe, 1);
  }
}

watch(entries, list => {
  const keep = list.some(e => entryKey(e) === selectedKey.value);

  if (!keep) {
    const first = list.find(isReady) ?? list[0];
    selectedKey.value = first ? entryKey(first) : '';
  }
}, { immediate: true });
</script>

<style scoped>
.workshop {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 110px);
  width: min(780px, calc(100vw - 24px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 16px;
  z-index: 5;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 900;
  color: var(--walnut-deep);
}

.sub {
  margin: 2px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-soft);
}

.layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.cats {
  display: grid;
  align-content: start;
  gap: 2px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 2px;
}

.cat {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 16px;
  font-weight: 800;
  text-align: left;
  min-width: 0;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
}

.cat img { width: 30px; height: 30px; }
.cat:hover { background: var(--paper-deep); }

.cat.is-on {
  background: #fff;
  border-color: var(--walnut);
  box-shadow: 0 2px 0 var(--walnut-deep);
}

.badge {
  min-width: 22px;
  padding: 0 6px;
  font-size: 13px;
  font-weight: 900;
  line-height: 20px;
  text-align: center;
  color: #fff;
  background: var(--leaf);
  border-radius: 10px;
}

.catalog {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  grid-auto-rows: min-content;
  gap: 8px;
  overflow-y: auto;
  padding: 4px;
  background: var(--paper-deep);
  border-radius: 10px;
  box-shadow: inset 0 2px 0 rgba(78, 56, 38, .12);
}

.tile {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 10px 6px 8px;
  background: #fbf5e7;
  border: 3px solid #e2d3b3;
  border-radius: 10px;
  transition: transform .1s ease, border-color .1s ease;
}

.tile img { width: 52px; height: 52px; }
.tile:hover { transform: translateY(-2px); border-color: #c9b48c; }
.tile.is-sel { border-color: var(--lantern); background: #fff; box-shadow: 0 0 0 2px #fff0c8; }
.tile:not(.is-ready):not(.is-done) img { opacity: .55; filter: saturate(.6); }

.tile-name {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
}

.mark {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 900;
  line-height: 18px;
  border-radius: 9px;
}

.mark.ready { color: #fff; background: var(--leaf); }
.mark.done { color: var(--leaf-deep); background: #e3efd8; }

.detail {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #fff9ec;
  border: 2px solid #e2d3b3;
  border-radius: 10px;
}

.big-icon { width: 72px; height: 72px; }
.info { display: grid; gap: 4px; min-width: 0; }

h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}

.yield { font-size: 14px; color: var(--ink-soft); }

.note {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-soft);
}

.missing {
  margin: 0;
  font-size: 14px;
  color: var(--rose);
}

.do {
  display: grid;
  gap: 6px;
  justify-items: stretch;
}

.do .btn { justify-content: center; min-width: 130px; min-height: 44px; font-size: 17px; }
.do .row { display: flex; gap: 6px; }
.do .small { min-width: 0; min-height: 34px; font-size: 14px; flex: 1; padding: 4px 8px; }

@media (max-width: 640px) {
  .layout { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .cats { display: flex; overflow-x: auto; }
  .cat { grid-template-columns: 26px auto; }
  .cat-name, .badge { display: none; }
  .detail { grid-template-columns: 48px minmax(0, 1fr); }
  .big-icon { width: 48px; height: 48px; }
  .do { grid-column: 1 / -1; }
}
</style>
