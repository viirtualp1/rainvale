<template>
  <TransitionGroup
    name="flash"
    tag="div"
    class="flashes"
    aria-live="polite"
  >
    <div
      v-for="flash in ui.flashes"
      :key="flash.id"
      class="flash"
      :class="{ 'is-big': flash.big }"
    >
      <span class="burst" />
      <img
        class="pixel"
        :src="flash.icon"
        alt=""
      >
      <span class="text">{{ t(flash.key, flash.params) }}</span>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { ui } from '../game/ui';
import { t } from '../i18n';
</script>

<style scoped>
.flashes {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 180px);
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 8;
}

.flash {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px 8px 10px;
  font-size: 18px;
  font-weight: 900;
  color: var(--ink);
  background: var(--paper);
  border: 3px solid var(--walnut);
  border-radius: 12px;
  box-shadow: 0 4px 0 var(--walnut-deep), 0 10px 24px rgba(10, 20, 40, .3);
  animation: pop .45s cubic-bezier(.2, 1.6, .4, 1);
}

.flash img {
  width: 44px;
  height: 44px;
  animation: spin-in .6s cubic-bezier(.2, 1.5, .4, 1);
}

.flash.is-big {
  padding: 12px 24px 12px 14px;
  font-size: 22px;
  background: #fff6dc;
  border-color: var(--lantern);
}

.flash.is-big img { width: 64px; height: 64px; }

.burst {
  position: absolute;
  left: 32px;
  top: 50%;
  width: 70px;
  height: 70px;
  margin: -35px 0 0 -35px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 226, 140, .9) 0%, rgba(255, 226, 140, 0) 70%);
  animation: burst .7s ease-out forwards;
  z-index: -1;
}

.flash-leave-active { transition: opacity .4s ease, transform .4s ease; }
.flash-leave-to { opacity: 0; transform: translate(40vw, -60vh) scale(.4); }

@keyframes pop {
  0% { transform: scale(.3) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes spin-in {
  0% { transform: rotate(-30deg) scale(.4); }
  100% { transform: rotate(0) scale(1); }
}

@keyframes burst {
  0% { transform: scale(.3); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
</style>
