import { reactive } from 'vue';
import { MATERIAL_ORDER } from './defs';
import type { DayPart } from './audio';
import type { BuildId, MaterialId, ToolId, VisitorId } from './defs';
import type { MessageKey, Params } from '../i18n';

export type EventKind = 'weather' | 'time' | 'garden' | 'visitor' | 'info';

export interface Message {
  key: MessageKey;
  params?: Params;
}

export interface GameEvent extends Message {
  id: number;
  kind: EventKind;
}

export interface HoverHint {
  x: number;
  y: number;
  title: string;
  detail: string;
  bad: boolean;
}

export type Slot = { kind: 'tool'; id: ToolId } | { kind: 'build'; id: BuildId };

export interface Flash extends Message {
  id: number;
  icon: string;
  big: boolean;
}

export type MenuView = 'main' | 'save' | 'load' | 'settings';

export const HOTBAR_SIZE = 9;

export function emptyInventory () {
  return Object.fromEntries(MATERIAL_ORDER.map(id => [id, 0])) as Record<MaterialId, number>;
}

export const ui = reactive({
  screen: 'title' as 'title' | 'play',
  panel: null as 'workshop' | 'journal' | null,
  mode: 'play' as 'play' | 'build' | 'remove',
  buildSel: null as BuildId | null,
  inv: emptyInventory(),
  tools: {} as Partial<Record<ToolId, boolean>>,
  hotbar: new Array<Slot | null>(HOTBAR_SIZE).fill(null),
  sel: 0,
  slotLabel: { id: 0, key: 'slot.empty' as MessageKey, params: undefined as Params | undefined },
  menu: null as MenuView | null,
  gained: {} as Partial<Record<MaterialId, number>>,
  flashes: [] as Flash[],
  day: 1,
  phase: 'morning' as DayPart,
  rain: 'rain' as 'drizzle' | 'rain' | 'downpour',
  events: [] as GameEvent[],
  journal: {} as Partial<Record<VisitorId, boolean>>,
  present: [] as VisitorId[],
  hint: null as HoverHint | null,
  muted: false,
  hasSave: false,
  touch: false
});

let nextId = 1;
const EVENT_LIFETIME_MS = 9000;
const FLASH_LIFETIME_MS = 1600;
const MAX_EVENTS = 4;
const MAX_FLASHES = 3;

function sameParams (a?: Params, b?: Params) {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function pushEvent (kind: EventKind, key: MessageKey, params?: Params) {
  if (ui.events.some(e => e.key === key && sameParams(e.params, params))) {
    return;
  }

  const id = nextId++;

  ui.events.unshift({ id, kind, key, params });

  if (ui.events.length > MAX_EVENTS) {
    ui.events.pop();
  }

  setTimeout(() => {
    const at = ui.events.findIndex(e => e.id === id);

    if (at >= 0) {
      ui.events.splice(at, 1);
    }
  }, EVENT_LIFETIME_MS);
}

export function pushFlash (icon: string, key: MessageKey, params: Params, big = false) {
  const id = nextId++;

  ui.flashes.push({ id, icon, key, params, big });

  if (ui.flashes.length > MAX_FLASHES) {
    ui.flashes.shift();
  }

  setTimeout(() => {
    const at = ui.flashes.findIndex(f => f.id === id);

    if (at >= 0) {
      ui.flashes.splice(at, 1);
    }
  }, FLASH_LIFETIME_MS);
}

export function markGained (id: MaterialId) {
  ui.gained[id] = performance.now();
}

export function showSlotLabel (key: MessageKey, params?: Params) {
  ui.slotLabel = { id: nextId++, key, params };
}
