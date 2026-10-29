import { shallowRef } from 'vue';
import type { Game } from './game';

export const gameRef = shallowRef<Game | null>(null);
