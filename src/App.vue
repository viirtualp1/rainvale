<template>
  <GameCanvas />
  <div
    class="ui-layer"
    :style="{ zoom: settings.uiScale }"
  >
    <template v-if="ui.screen === 'play'">
      <HudCorner />
      <ResourcePanel />
      <HotBar />
      <ActionBlock />
      <GainFlash />
      <WorkshopPanel v-if="ui.panel === 'workshop'" />
      <JournalPanel v-if="ui.panel === 'journal'" />
    </template>
    <TitleScreen v-else />
    <GameMenu v-if="ui.menu" />
  </div>
  <HoverHint v-if="ui.screen === 'play' && !ui.menu" />
</template>

<script setup lang="ts">
import ActionBlock from './components/ActionBlock.vue';
import GainFlash from './components/GainFlash.vue';
import GameCanvas from './components/GameCanvas.vue';
import GameMenu from './components/GameMenu.vue';
import HotBar from './components/HotBar.vue';
import HoverHint from './components/HoverHint.vue';
import HudCorner from './components/HudCorner.vue';
import JournalPanel from './components/JournalPanel.vue';
import ResourcePanel from './components/ResourcePanel.vue';
import TitleScreen from './components/TitleScreen.vue';
import WorkshopPanel from './components/WorkshopPanel.vue';
import { settings } from './game/settings';
import { ui } from './game/ui';
</script>
