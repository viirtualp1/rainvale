import { materialIconUrl, toolIconUrl } from './art';
import type { Facing } from './art';
import { Sound } from './audio';
import type { DayPart } from './audio';
import { BUILDS, NATURE, TOOLS, VISITORS, VISITOR_ORDER } from './defs';
import type { BuildId, Cost, MaterialId, Recipe, ToolId, VisitorId } from './defs';
import { renderGame } from './render';
import { settings } from './settings';
import { buildName, cropName, matName, natureGives, natureName, t, toolName, toolNeed, visitorLikes, visitorName } from '../i18n';
import { HOTBAR_SIZE, emptyInventory, markGained, pushEvent, pushFlash, showSlotLabel, ui } from './ui';
import type { Slot } from './ui';
import { clamp, lerp } from './util';
import { GROUND, H, TS, W, World, buildThing, natureThing } from './world';
import type { SavedWorld, Thing } from './world';

export const CYCLE = 300;
const SAVE_KEY = 'rainvale.save.v1';
const SLOT_KEY = 'rainvale.slot.';
export const SAVE_SLOTS = [1, 2, 3] as const;
export type SlotId = 'auto' | typeof SAVE_SLOTS[number];

export interface SlotMeta {
  day: number;
  part: DayPart;
  met: number;
  savedAt: number;
}
const REACH = 22;
const PLAYER_SPEED = 72;
const MAX_VISITORS = 5;

export interface Player {
  x: number;
  y: number;
  face: 1 | -1;
  dir: Facing;
  anim: number;
  moving: boolean;
  path: number[];
  goal: number | null;
  work: number;
  stepTimer: number;
  tool: ToolId | null;
}

export interface Visitor {
  id: VisitorId;
  x: number;
  y: number;
  path: number[];
  home: number;
  state: 'arrive' | 'stay' | 'leave';
  t: number;
  wait: number;
  anim: number;
  face: 1 | -1;
  alpha: number;
  moving: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  c: string;
  size: number;
  kind: 'dot' | 'ripple' | 'glow';
}

export interface Popup {
  mat: MaterialId;
  n: number;
  x: number;
  y: number;
  t: number;
}

export interface Drop {
  x: number;
  y: number;
  vy: number;
  len: number;
  endY: number;
}

export interface Light {
  x: number;
  y: number;
  r: number;
  i: number;
  warm: boolean;
}

interface SaveData {
  v: 1;
  world: SavedWorld;
  player: { x: number; y: number };
  inv: Record<MaterialId, number>;
  time: number;
  journal: Partial<Record<VisitorId, boolean>>;
  tools?: Partial<Record<ToolId, boolean>>;
  hotbar?: (Slot | null)[];
  sel?: number;
  savedAt?: number;
}

export function slotTitle (slot: SlotId) {
  return slot === 'auto' ? t('slots.auto') : t('slots.slot', { n: slot });
}

export function dayPartOf (p: number): DayPart {
  return p < .22 ? 'morning' : p < .5 ? 'day' : p < .68 ? 'evening' : 'night';
}

export function ambientOf (p: number) {
  if (p < .06) {
    return lerp(7, 12, p / .06);
  }

  if (p < .22) {
    return lerp(12, 15, (p - .06) / .16);
  }

  if (p < .5) {
    return 15;
  }

  if (p < .68) {
    return lerp(15, 6.5, (p - .5) / .18);
  }

  if (p < .94) {
    return 6;
  }

  return lerp(6, 7, (p - .94) / .06);
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly world = new World();
  readonly sound = new Sound();
  bufW = 360;
  bufH = 220;
  scale = 3;
  pixelRatio = 1;
  cam = { x: 0, y: 0 };
  player: Player = this.freshPlayer();
  visitors: Visitor[] = [];
  parts: Particle[] = [];
  popups: Popup[] = [];
  drops: Drop[] = [];
  lights: Light[] = [];
  time = CYCLE * .1;
  amb = 15;
  rain = .7;
  keys = { left: 0, right: 0, up: 0, down: 0, act: 0 };
  mouse = { x: 0, y: 0, seen: false, down: false, lastTile: -1 };
  private rainTarget = .7;
  private rainTimer = 40;
  private visitTimer = 8;
  private respawnTimer = 6;
  private hintTimer = 0;
  private saveTimer = 0;
  private uiTimer = 0;
  private raf = 0;
  private last = 0;
  private phase: DayPart = 'morning';
  private snapCamera = true;

  constructor (canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D is not available');
    }

    this.canvas = canvas;
    this.ctx = ctx;
  }

  start () {
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onPageHide);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    const saved = this.readSave();

    ui.hasSave = !!saved;

    if (!saved || !this.load(saved)) {
      this.world.generate((Math.random() * 1e9) | 0);
    }

    this.phase = dayPartOf(this.phaseValue());
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy () {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pagehide', this.onPageHide);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('wheel', this.onWheel);

    if (ui.screen === 'play') {
      this.save();
    }
  }

  continueGame () {
    this.sound.init();
    ui.screen = 'play';
    this.snapCamera = true;
    pushEvent('weather', 'ev.continue');
  }

  newWorld () {
    this.sound.init();
    this.world.generate((Math.random() * 1e9) | 0);
    this.player = this.freshPlayer();
    this.visitors = [];
    this.time = CYCLE * .04;
    this.phase = dayPartOf(this.phaseValue());
    ui.inv = emptyInventory();
    ui.tools = {};
    ui.hotbar = new Array<Slot | null>(HOTBAR_SIZE).fill(null);
    ui.sel = 0;
    ui.journal = {};
    ui.present = [];
    ui.screen = 'play';
    this.snapCamera = true;
    this.save();
    pushEvent('weather', 'ev.newMorning');
    pushEvent('info', 'ev.startHint');
  }

  phaseValue () {
    return (this.time % CYCLE) / CYCLE;
  }

  canAfford (cost: Cost) {
    return Object.entries(cost).every(([id, n]) => ui.inv[id as MaterialId] >= (n ?? 0));
  }

  craft (recipe: Recipe, times = 1) {
    let made = 0;

    while (made < times && this.canAfford(recipe.cost)) {
      this.pay(recipe.cost);
      made++;
    }

    if (!made) {
      return;
    }

    ui.inv[recipe.out] += recipe.n * made;
    markGained(recipe.out);
    pushFlash(materialIconUrl(recipe.out), 'flash.gain', { n: recipe.n * made, name: matName(recipe.out) });
    this.sound.play('craft');
  }

  craftableTimes (recipe: Recipe) {
    return Math.min(...Object.entries(recipe.cost).map(([id, n]) => Math.floor(ui.inv[id as MaterialId] / (n ?? 1))));
  }

  craftTool (id: ToolId) {
    const def = TOOLS[id];

    if (ui.tools[id] || !this.canAfford(def.cost)) {
      return;
    }

    this.pay(def.cost);
    ui.tools[id] = true;

    const slot = this.placeInHotbar({ kind: 'tool', id });

    pushFlash(toolIconUrl(id), 'flash.newTool', { name: toolName(id) }, true);
    this.sound.play('tool');

    if (slot >= 0) {
      this.selectSlot(slot);
    }
  }

  private placeInHotbar (slot: Slot) {
    const same = ui.hotbar.findIndex(s => s?.kind === slot.kind && s.id === slot.id);

    if (same >= 0) {
      return same;
    }

    let at = ui.hotbar.findIndex(s => !s);

    if (at < 0) {
      at = ui.hotbar.map(s => s?.kind).lastIndexOf('build');
    }

    if (at >= 0) {
      ui.hotbar[at] = slot;
    }

    return at;
  }

  selectSlot (index: number) {
    const slot = ui.hotbar[index];

    ui.sel = index;
    this.sound.play('select');

    if (slot?.kind === 'build') {
      ui.buildSel = slot.id;
      ui.mode = 'build';
      showSlotLabel(`build.${slot.id}`);

      return;
    }

    if (ui.mode === 'build') {
      this.setMode('play');
    }

    showSlotLabel(slot ? `tool.${slot.id}` : 'slot.empty');
  }

  selectBuild (id: BuildId) {
    const at = this.placeInHotbar({ kind: 'build', id });

    ui.panel = null;

    if (at >= 0) {
      this.selectSlot(at);
    } else {
      ui.buildSel = id;
      ui.mode = 'build';
    }
  }

  heldTool () {
    const slot = ui.hotbar[ui.sel];

    return slot?.kind === 'tool' ? slot.id : null;
  }

  private equip (tool: ToolId) {
    const at = ui.hotbar.findIndex(s => s?.kind === 'tool' && s.id === tool);

    if (at >= 0 && at !== ui.sel) {
      ui.sel = at;
      showSlotLabel(`tool.${tool}`);
    }
  }

  setMode (mode: 'play' | 'build' | 'remove') {
    ui.mode = mode;

    if (mode !== 'build') {
      ui.buildSel = null;
    }
  }

  toggleMute () {
    ui.muted = !ui.muted;
    this.sound.init();
    this.sound.setMuted(ui.muted);
  }

  tileWalkable (x: number, y: number) {
    return !this.world.solid(x, y);
  }

  thingAt (i: number) {
    return this.world.things[i];
  }

  private freshPlayer (): Player {
    return { x: W / 2 * TS + 8, y: H / 2 * TS + 12, face: 1, dir: 'down', anim: 0, moving: false, path: [], goal: null, work: 0, stepTimer: 0, tool: null };
  }

  private readonly resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Draw at full device resolution: sprites stay chunky, but movement steps in screen pixels instead of art pixels.
    this.pixelRatio = window.devicePixelRatio || 1;
    this.scale = Math.max(2, Math.round(Math.max(w, h) / 360));
    this.bufW = w / this.scale;
    this.bufH = h / this.scale;
    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.drops = [];
  };

  private readonly frame = (now: number) => {
    const dt = Math.min(.05, this.last ? (now - this.last) / 1000 : 0);

    this.last = now;
    this.update(dt, ui.screen === 'play' && !ui.menu);
    renderGame(this, now / 1000);
    this.raf = requestAnimationFrame(this.frame);
  };

  update (dt: number, playing: boolean) {
    this.updateWeather(dt);
    this.updateParticles(dt);

    if (playing) {
      this.time += dt;
      this.updatePhase();
      this.updatePlayer(dt);
      this.updateVisitors(dt);
      this.updateWorld(dt);
      this.updateHint(dt);

      this.saveTimer += dt;

      if (this.saveTimer > 10) {
        this.saveTimer = 0;
        this.save();
      }
    }

    this.amb = ambientOf(this.phaseValue());
    this.updateCamera(dt);
    this.sound.setVolumes(settings);
    this.sound.update(dt, this.rain, dayPartOf(this.phaseValue()));

    this.uiTimer -= dt;

    if (this.uiTimer <= 0) {
      this.uiTimer = .25;
      ui.day = Math.floor(this.time / CYCLE) + 1;
      ui.phase = dayPartOf(this.phaseValue());
      ui.rain = this.rain > .85 ? 'downpour' : this.rain < .45 ? 'drizzle' : 'rain';
    }
  }

  private updateCamera (dt: number) {
    const maxX = W * TS - this.bufW;
    const maxY = H * TS - this.bufH;
    const tx = maxX > 0 ? clamp(this.player.x - this.bufW / 2, 0, maxX) : maxX / 2;
    const ty = maxY > 0 ? clamp(this.player.y - 10 - this.bufH / 2, 0, maxY) : maxY / 2;

    if (this.snapCamera) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.snapCamera = false;

      return;
    }

    const k = 1 - Math.exp(-dt * 9);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  private updatePhase () {
    const phase = dayPartOf(this.phaseValue());

    if (phase === this.phase) {
      return;
    }

    this.phase = phase;
    this.sound.play('event');

    if (phase === 'morning') {
      pushEvent('time', 'ev.morning', { day: Math.floor(this.time / CYCLE) + 1 });
    } else if (phase === 'day') {
      pushEvent('time', 'ev.day');
    } else if (phase === 'evening') {
      const hasLight = this.world.things.some(t => t?.kind === 'build' && !!BUILDS[t.id].light);
      pushEvent('time', hasLight ? 'ev.eveningLit' : 'ev.eveningDark');
    } else {
      pushEvent('time', 'ev.night');
    }
  }

  private updateWeather (dt: number) {
    this.rainTimer -= dt;

    if (this.rainTimer <= 0) {
      const before = this.rainTarget;

      this.rainTimer = 45 + Math.random() * 60;
      this.rainTarget = .3 + Math.random() * .7;

      if (ui.screen === 'play' && this.rainTarget > .85 && before <= .85) {
        pushEvent('weather', 'ev.rainUp');
      } else if (ui.screen === 'play' && this.rainTarget < .45 && before >= .45) {
        pushEvent('weather', 'ev.rainDown');
      }
    }

    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * .3);

    const want = Math.round(this.bufW * this.bufH / 700 * (.4 + this.rain));

    while (this.drops.length < want) {
      this.drops.push(this.newDrop(true));
    }

    if (this.drops.length > want) {
      this.drops.length = want;
    }

    for (const d of this.drops) {
      d.y += d.vy * dt;
      d.x -= d.vy * .18 * dt;

      if (d.y >= d.endY) {
        this.splash(this.cam.x + d.x, this.cam.y + d.y);
        Object.assign(d, this.newDrop(false));
      }
    }
  }

  private newDrop (anywhere: boolean): Drop {
    const vy = 230 + Math.random() * 90;

    return {
      x: Math.random() * (this.bufW + 40),
      y: anywhere ? Math.random() * this.bufH : -10 - Math.random() * 30,
      vy,
      len: 4 + Math.random() * 3,
      endY: Math.random() * (this.bufH + 10)
    };
  }

  private splash (wx: number, wy: number) {
    const tx = Math.floor(wx / TS);
    const ty = Math.floor(wy / TS);

    if (!this.world.inside(tx, ty)) {
      return;
    }

    const i = this.world.idx(tx, ty);
    const onWater = this.world.ground[i] === GROUND.water && this.world.floors[i] !== 'bridge';

    if (onWater || (this.world.puddleAt(tx, ty) && Math.random() < .6)) {
      this.parts.push({ x: wx, y: wy, vx: 0, vy: 0, g: 0, life: .55, max: .55, c: '#cfe8ef', size: 1, kind: 'ripple' });

      return;
    }

    if (Math.random() < .5) {
      for (let k = 0; k < 2; k++) {
        this.parts.push({ x: wx, y: wy, vx: (Math.random() - .5) * 30, vy: -20 - Math.random() * 20, g: 200, life: .18, max: .18, c: '#d8ecf5', size: 1, kind: 'dot' });
      }
    }
  }

  private updateParticles (dt: number) {
    for (const p of this.parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    this.parts = this.parts.filter(p => p.life > 0);

    if (this.parts.length > 700) {
      this.parts.splice(0, this.parts.length - 700);
    }

    for (const p of this.popups) {
      p.t += dt;
    }

    this.popups = this.popups.filter(p => p.t < 1.1);

    if (this.amb < 10 && Math.random() < dt * 4) {
      this.spawnFirefly();
    }
  }

  private spawnFirefly () {
    const near = this.lights.length && Math.random() < .7 ? this.lights[Math.floor(Math.random() * this.lights.length)] : null;
    const x = near ? near.x + (Math.random() - .5) * near.r * 1.4 : this.cam.x + Math.random() * this.bufW;
    const y = near ? near.y + (Math.random() - .5) * near.r : this.cam.y + Math.random() * this.bufH;

    this.parts.push({ x, y, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, g: 0, life: 4 + Math.random() * 3, max: 6, c: '#e8ff9a', size: 1, kind: 'glow' });
  }

  private updatePlayer (dt: number) {
    const p = this.player;
    let mx = this.keys.right - this.keys.left;
    let my = this.keys.down - this.keys.up;

    if (mx || my) {
      p.path = [];
      p.goal = null;
      p.work = 0;
    }

    if (!mx && !my && p.goal === null && this.keys.act) {
      this.targetNearest();
    }

    if (!mx && !my && p.goal !== null) {
      const gx = (p.goal % W) * TS + 8;
      const gy = Math.floor(p.goal / W) * TS + 10;

      if (Math.hypot(gx - p.x, gy - p.y) <= REACH) {
        p.path = [];
        this.faceTowards(gx - p.x, gy - p.y);
        this.workOn(p.goal, dt);
      }
    }

    if (!mx && !my && p.path.length) {
      const next = p.path[0];
      const nx = (next % W) * TS + 8;
      const ny = Math.floor(next / W) * TS + 11;
      const dx = nx - p.x;
      const dy = ny - p.y;
      const d = Math.hypot(dx, dy);

      if (d < 2) {
        p.path.shift();
      } else {
        mx = dx / d;
        my = dy / d;
      }
    }

    const len = Math.hypot(mx, my);
    p.moving = len > 0;

    if (!p.moving) {
      p.anim = 0;

      return;
    }

    mx /= len;
    my /= len;
    this.faceTowards(mx, my);

    const step = PLAYER_SPEED * dt;
    const nx = p.x + mx * step;
    const ny = p.y + my * step;
    let movedX = false;
    let movedY = false;

    if (mx && !this.feetBlocked(nx, p.y)) {
      p.x = nx;
      movedX = true;
    }

    if (my && !this.feetBlocked(p.x, ny)) {
      p.y = ny;
      movedY = true;
    }

    if (my && !movedY && !movedX) {
      this.slideAround('x', Math.sign(my), step);
    } else if (mx && !movedX && !movedY) {
      this.slideAround('y', Math.sign(mx), step);
    }

    p.anim += dt;
    p.stepTimer -= dt;

    if (p.stepTimer <= 0) {
      p.stepTimer = .32;
      this.sound.play('step');
    }
  }

  // Corner correction: when a wall edge blocks the way but an opening (a door, a gap) is a few pixels to the side, ease toward it.
  private slideAround (axis: 'x' | 'y', dir: number, step: number) {
    const p = this.player;
    const reach = 8;

    for (let o = 1; o <= reach; o++) {
      for (const sign of [-1, 1]) {
        const ox = axis === 'x' ? sign * o : 0;
        const oy = axis === 'y' ? sign * o : 0;
        const fx = axis === 'y' ? dir * 2 : 0;
        const fy = axis === 'x' ? dir * 2 : 0;

        if (this.feetBlocked(p.x + ox, p.y + oy) || this.feetBlocked(p.x + ox + fx, p.y + oy + fy)) {
          continue;
        }

        const shift = Math.min(step, o) * sign;

        if (axis === 'x') {
          p.x += shift;
        } else {
          p.y += shift;
        }

        return;
      }
    }
  }

  private faceTowards (dx: number, dy: number) {
    const p = this.player;

    // Any sideways component keeps the side view, so diagonal walking never flips between sprites.
    if (Math.abs(dx) > .2) {
      p.dir = 'side';
      p.face = dx < 0 ? -1 : 1;
    } else if (Math.abs(dy) > .2) {
      p.dir = dy < 0 ? 'up' : 'down';
    }
  }

  private feetBlocked (x: number, y: number) {
    const x0 = Math.floor((x - 4) / TS);
    const x1 = Math.floor((x + 4) / TS);
    const y0 = Math.floor((y - 5) / TS);
    const y1 = Math.floor((y - .01) / TS);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.world.solid(tx, ty)) {
          return true;
        }
      }
    }

    return false;
  }

  playerTile () {
    return this.world.idx(Math.floor(this.player.x / TS), Math.floor((this.player.y - 2) / TS));
  }

  findPath (from: number, isGoal: (i: number) => boolean, passable: (x: number, y: number) => boolean, maxNodes = 5000): number[] | null {
    if (isGoal(from)) {
      return [];
    }

    const prev = new Int32Array(W * H).fill(-1);
    const queue = [from];
    prev[from] = from;

    for (let head = 0; head < queue.length && head < maxNodes; head++) {
      const i = queue[head];
      const x = i % W;
      const y = Math.floor(i / W);

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;

        if (!this.world.inside(nx, ny)) {
          continue;
        }

        const n = this.world.idx(nx, ny);

        if (prev[n] !== -1 || !passable(nx, ny)) {
          continue;
        }

        prev[n] = i;

        if (isGoal(n)) {
          const path = [n];
          let cur = i;

          while (cur !== from) {
            path.unshift(cur);
            cur = prev[cur];
          }

          return path;
        }

        queue.push(n);
      }
    }

    return null;
  }

  private adjacentGoal (target: number) {
    const tx = target % W;
    const ty = Math.floor(target / W);

    return (i: number) => i === target || Math.abs(i % W - tx) + Math.abs(Math.floor(i / W) - ty) === 1;
  }

  private goTo (target: number, interact: boolean) {
    const p = this.player;
    const path = this.findPath(this.playerTile(), interact ? this.adjacentGoal(target) : i => i === target, (x, y) => this.tileWalkable(x, y));

    p.goal = interact ? target : null;
    p.work = 0;
    p.path = path ?? [];
  }

  private targetNearest () {
    const p = this.player;
    const ptx = Math.floor(p.x / TS);
    const pty = Math.floor(p.y / TS);
    let best = -1;
    let bestD = 1e9;

    for (let y = pty - 5; y <= pty + 5; y++) {
      for (let x = ptx - 5; x <= ptx + 5; x++) {
        if (!this.world.inside(x, y)) {
          continue;
        }

        const i = this.world.idx(x, y);

        if (!this.interactable(i) || !this.canWork(i)) {
          continue;
        }

        const d = Math.hypot(x * TS + 8 - p.x, y * TS + 10 - p.y);

        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }

    if (best >= 0) {
      this.goTo(best, true);
    }
  }

  interactable (i: number) {
    const t = this.world.things[i];

    if (!t) {
      return false;
    }

    return t.kind === 'nature' ? t.ripe : t.id === 'gardenBed';
  }

  private canWork (i: number) {
    const t = this.world.things[i];

    if (t?.kind !== 'nature') {
      return true;
    }

    const tool = NATURE[t.id].tool;

    return !tool || !!ui.tools[tool];
  }

  private workOn (i: number, dt: number) {
    const p = this.player;
    const t = this.world.things[i];

    if (!t || !this.interactable(i)) {
      p.goal = null;

      return;
    }

    if (t.kind === 'build') {
      this.gardenInteract(i);
      p.goal = null;

      return;
    }

    const def = NATURE[t.id];

    if (def.tool && !ui.tools[def.tool]) {
      pushEvent('info', 'ev.needTool', { tool: toolNeed(def.tool) });
      p.goal = null;

      return;
    }

    p.tool = def.tool;

    if (def.tool) {
      this.equip(def.tool);
    }

    const before = Math.floor(p.work / .25);

    p.work += dt;

    if (Math.floor(p.work / .25) !== before || p.work <= dt) {
      t.shake = .15;
      this.sound.play(def.sound);
      this.chips(i, def.sound === 'stone' ? ['#c4c2bd', '#8c8a85'] : def.sound === 'chop' ? ['#68aa58', '#a8743f'] : ['#86c262', '#f4f0e4']);
    }

    if (p.work >= def.work) {
      this.harvest(i);
      p.work = 0;
      p.goal = null;
    }
  }

  private chips (i: number, colors: string[]) {
    const x = (i % W) * TS + 8;
    const y = Math.floor(i / W) * TS + 6;

    for (let k = 0; k < 4; k++) {
      this.parts.push({ x, y, vx: (Math.random() - .5) * 70, vy: -30 - Math.random() * 50, g: 220, life: .45, max: .45, c: colors[k % colors.length], size: 2, kind: 'dot' });
    }
  }

  private gain (mat: MaterialId, n: number, x: number, y: number) {
    ui.inv[mat] += n;
    markGained(mat);
    this.popups.push({ mat, n, x, y: y - 14 - this.popups.filter(pp => pp.t < .3).length * 9, t: 0 });
  }

  private harvest (i: number) {
    const t = this.world.things[i];

    if (!t || t.kind !== 'nature') {
      return;
    }

    const def = NATURE[t.id];
    const x = (i % W) * TS + 8;
    const y = Math.floor(i / W) * TS + 8;

    for (const [mat, n, chance] of def.drops) {
      if (chance === undefined || Math.random() < chance) {
        this.gain(mat, n, x, y);
      }
    }

    if (def.after) {
      this.world.things[i] = natureThing(def.after);
    } else if (def.regrow) {
      t.ripe = false;
      t.t = def.regrow;
    } else {
      this.world.things[i] = null;
    }

    this.sound.play('pick');
  }

  private gardenInteract (i: number) {
    const t = this.world.things[i];

    if (!t || t.kind !== 'build') {
      return;
    }

    const x = (i % W) * TS + 8;
    const y = Math.floor(i / W) * TS + 8;

    if (!t.crop) {
      if (ui.inv.seeds < 1) {
        pushEvent('garden', 'ev.needSeeds');

        return;
      }

      ui.inv.seeds -= 1;
      t.crop = Math.random() < .6 ? 'carrot' : 'pumpkin';
      t.stage = 0;
      t.t = 0;
      this.sound.play('plant');

      return;
    }

    if (t.stage < 3) {
      pushEvent('garden', 'ev.growing', { crop: cropName(t.crop), n: t.stage + 1 });

      return;
    }

    this.gain(t.crop, t.crop === 'carrot' ? 2 : 1, x, y);

    if (Math.random() < .6) {
      this.gain('seeds', 1, x, y);
    }

    t.crop = null;
    t.stage = 0;
    this.sound.play('harvest');
  }

  private updateWorld (dt: number) {
    const things = this.world.things;

    for (let i = 0; i < things.length; i++) {
      const t = things[i];

      if (!t) {
        continue;
      }

      t.shake = Math.max(0, t.shake - dt);

      if (t.kind === 'nature') {
        if (!t.ripe) {
          t.t -= dt;
          t.ripe = t.t <= 0;
        } else if (t.id === 'stump') {
          t.t += dt;

          if (t.t > 240) {
            things[i] = natureThing('tree');
          }
        }

        continue;
      }

      if (t.id === 'gardenBed' && t.crop && t.stage < 3) {
        t.t += dt * (.7 + this.rain * .5);
        const stage = Math.min(3, Math.floor(t.t / 25));

        if (stage === 3) {
          pushEvent('garden', 'ev.ripe', { crop: cropName(t.crop) });
          this.sound.play('event');
        }

        t.stage = stage;
      } else if (t.id === 'sapling') {
        t.t += dt;

        if (t.t > 120) {
          things[i] = natureThing('tree');
          pushEvent('garden', 'ev.sapling');
        }
      }
    }

    this.respawnTimer -= dt;

    if (this.respawnTimer <= 0) {
      this.respawnTimer = 4;
      this.respawnNature();
    }
  }

  private respawnNature () {
    const x = 1 + Math.floor(Math.random() * (W - 2));
    const y = 1 + Math.floor(Math.random() * (H - 2));
    const i = this.world.idx(x, y);
    const g = this.world.ground[i];
    const inView = x * TS > this.cam.x - 32 && x * TS < this.cam.x + this.bufW + 32 && y * TS > this.cam.y - 32 && y * TS < this.cam.y + this.bufH + 48;

    if (inView || g === GROUND.water || this.world.things[i] || this.world.floors[i]) {
      return;
    }

    const roll = Math.random();
    const id = g === GROUND.meadow ? (roll < .6 ? 'flower' : 'tallgrass') : roll < .3 ? 'tallgrass' : roll < .5 ? 'flower' : roll < .65 ? 'mushroom' : roll < .8 ? 'rock' : null;

    if (id) {
      this.world.things[i] = natureThing(id);
    }
  }

  private updateVisitors (dt: number) {
    this.visitTimer -= dt;

    if (this.visitTimer <= 0) {
      this.visitTimer = 16 + Math.random() * 14;
      this.trySpawnVisitor();
    }

    for (const v of this.visitors) {
      const def = VISITORS[v.id];

      v.anim += dt;
      v.alpha = v.state === 'leave' && !v.path.length ? v.alpha - dt * .8 : Math.min(1, v.alpha + dt * .8);
      v.moving = false;

      if (v.path.length && def.speed) {
        const next = v.path[0];
        const nx = (next % W) * TS + 8;
        const ny = Math.floor(next / W) * TS + 11;
        const dx = nx - v.x;
        const dy = ny - v.y;
        const d = Math.hypot(dx, dy);
        const step = def.speed * dt;

        v.moving = true;

        if (Math.abs(dx) > .5) {
          v.face = dx < 0 ? -1 : 1;
        }

        if (d <= step) {
          v.x = nx;
          v.y = ny;
          v.path.shift();
        } else {
          v.x += dx / d * step;
          v.y += dy / d * step;
        }

        continue;
      }

      if (v.state === 'arrive') {
        v.state = 'stay';
        v.t = 110 + Math.random() * 90;
      }

      if (v.state !== 'stay') {
        continue;
      }

      v.t -= dt;

      if (v.t <= 0) {
        v.state = 'leave';
        v.path = def.perch ? [] : this.wanderPath(v, 9) ?? [];
        continue;
      }

      v.wait -= dt;

      if (v.wait <= 0 && !def.perch) {
        v.wait = 3 + Math.random() * 6;
        v.path = this.wanderPath(v, 3) ?? [];
      }
    }

    this.visitors = this.visitors.filter(v => v.alpha > 0 || v.state !== 'leave');
    ui.present = this.visitors.map(v => v.id);
  }

  private visitorPassable (id: VisitorId) {
    const swims = !!VISITORS[id].swims;

    return (x: number, y: number) => {
      if (!this.world.inside(x, y)) {
        return false;
      }

      if (swims && this.world.isWater(x, y) && !this.world.things[this.world.idx(x, y)]) {
        return true;
      }

      return !this.world.solid(x, y);
    };
  }

  private wanderPath (v: Visitor, radius: number) {
    const hx = v.home % W;
    const hy = Math.floor(v.home / W);
    const passable = this.visitorPassable(v.id);

    for (let k = 0; k < 8; k++) {
      const x = hx + Math.round((Math.random() * 2 - 1) * radius);
      const y = hy + Math.round((Math.random() * 2 - 1) * radius);

      if (!passable(x, y)) {
        continue;
      }

      const target = this.world.idx(x, y);
      const from = this.world.idx(Math.floor(v.x / TS), Math.floor((v.y - 2) / TS));
      const path = this.findPath(from, i => i === target, passable, 1500);

      if (path) {
        return path;
      }
    }

    return null;
  }

  private trySpawnVisitor () {
    if (this.visitors.length >= MAX_VISITORS) {
      return;
    }

    const present = new Set(this.visitors.map(v => v.id));
    const options: { id: VisitorId; homes: number[] }[] = [];

    for (const id of VISITOR_ORDER) {
      if (present.has(id)) {
        continue;
      }

      const likes = VISITORS[id].likes;
      const homes: number[] = [];

      this.world.things.forEach((t, i) => {
        if (t?.kind === 'build' && likes.includes(t.id)) {
          homes.push(i);
        }
      });

      this.world.floors.forEach((f, i) => {
        if (f && likes.includes(f)) {
          homes.push(i);
        }
      });

      if (homes.length) {
        options.push({ id, homes });
      }
    }

    if (!options.length) {
      return;
    }

    const fresh = options.filter(o => !ui.journal[o.id]);
    const pool = fresh.length && Math.random() < .7 ? fresh : options;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    const home = choice.homes[Math.floor(Math.random() * choice.homes.length)];
    const visitor = this.spawnVisitor(choice.id, home);

    if (!visitor) {
      return;
    }

    this.visitors.push(visitor);
    this.sound.play('visitor');

    if (!ui.journal[choice.id]) {
      ui.journal[choice.id] = true;
      pushEvent('visitor', 'ev.newGuest', { name: visitorName(choice.id), likes: visitorLikes(choice.id) });
    } else {
      pushEvent('visitor', `visitor.${choice.id}.arrive`);
    }
  }

  private spawnVisitor (id: VisitorId, home: number): Visitor | null {
    const def = VISITORS[id];
    const hx = home % W;
    const hy = Math.floor(home / W);
    const base: Visitor = { id, x: hx * TS + 8, y: hy * TS + 11, path: [], home, state: 'arrive', t: 0, wait: 2, anim: Math.random() * 3, face: 1, alpha: 0, moving: false };

    if (def.perch) {
      return { ...base, state: 'stay', t: 90 + Math.random() * 90 };
    }

    const passable = this.visitorPassable(id);
    const homeOk = passable(hx, hy);
    const isGoal = homeOk ? (i: number) => i === home : this.adjacentGoal(home);

    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2;
      const d = 7 + Math.random() * 5;
      const x = Math.round(hx + Math.cos(a) * d);
      const y = Math.round(hy + Math.sin(a) * d);

      if (!passable(x, y)) {
        continue;
      }

      const path = this.findPath(this.world.idx(x, y), isGoal, passable, 3000);

      if (path) {
        return { ...base, x: x * TS + 8, y: y * TS + 11, path };
      }
    }

    return null;
  }

  placeError (id: BuildId, tx: number, ty: number) {
    if (!this.world.inside(tx, ty)) {
      return t('err.edge');
    }

    const def = BUILDS[id];
    const i = this.world.idx(tx, ty);
    const water = this.world.ground[i] === GROUND.water;
    const thing = this.world.things[i];

    if (!this.canAfford(def.cost)) {
      return t('err.cost');
    }

    if (def.layer === 'floor') {
      if (def.water && !water) {
        return t('err.bridgeOnly');
      }

      if (!def.water && water) {
        return t('err.needBridge');
      }

      if (this.world.floors[i]) {
        return t('err.hasFloor');
      }

      if (thing?.kind === 'nature') {
        return t('err.blocked', { name: natureName(thing.id) });
      }

      return null;
    }

    if (water && this.world.floors[i] !== 'bridge') {
      return t('err.water');
    }

    if (thing) {
      return thing.kind === 'nature' ? t('err.blocked', { name: natureName(thing.id) }) : t('err.taken');
    }

    if (def.solid && this.occupied(tx, ty)) {
      return t('err.someone');
    }

    return null;
  }

  private occupied (tx: number, ty: number) {
    const inTile = (x: number, y: number) => Math.abs(x - (tx * TS + 8)) < 12 && y > ty * TS && y < ty * TS + 21;

    return inTile(this.player.x, this.player.y) || this.visitors.some(v => inTile(v.x, v.y));
  }

  tryPlace (tx: number, ty: number) {
    const id = ui.buildSel;

    if (!id || this.placeError(id, tx, ty)) {
      return;
    }

    const def = BUILDS[id];
    const i = this.world.idx(tx, ty);

    this.pay(def.cost);

    if (def.layer === 'floor') {
      this.world.floors[i] = id;
    } else {
      this.world.things[i] = buildThing(id);
    }

    this.puff(tx, ty, ['#f4f0e4', '#d8ecf5']);
    this.sound.play('place');
  }

  removable (tx: number, ty: number) {
    if (!this.world.inside(tx, ty)) {
      return null;
    }

    const i = this.world.idx(tx, ty);
    const thing = this.world.things[i];

    if (thing?.kind === 'build') {
      return thing.id;
    }

    if (!thing && this.world.floors[i]) {
      return this.world.floors[i];
    }

    return null;
  }

  tryRemove (tx: number, ty: number) {
    const id = this.removable(tx, ty);

    if (!id) {
      return;
    }

    const i = this.world.idx(tx, ty);

    if (id === 'bridge' && this.playerTile() === i) {
      pushEvent('info', 'ev.offBridge');

      return;
    }

    if (BUILDS[id].layer === 'floor') {
      this.world.floors[i] = null;
    } else {
      this.world.things[i] = null;
    }

    for (const [mat, n] of Object.entries(BUILDS[id].cost)) {
      this.gain(mat as MaterialId, n ?? 0, tx * TS + 8, ty * TS + 8);
    }

    this.puff(tx, ty, ['#c99258', '#f4f0e4']);
    this.sound.play('remove');
  }

  private puff (tx: number, ty: number, colors: string[]) {
    for (let k = 0; k < 8; k++) {
      this.parts.push({ x: tx * TS + 8 + (Math.random() - .5) * 12, y: ty * TS + 10, vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 30, g: 40, life: .5, max: .5, c: colors[k % colors.length], size: 2, kind: 'dot' });
    }
  }

  private pay (cost: Cost) {
    for (const [id, n] of Object.entries(cost)) {
      ui.inv[id as MaterialId] -= n ?? 0;
    }
  }

  pickThing (wx: number, wy: number) {
    const tx = Math.floor(wx / TS);
    const ty = Math.floor(wy / TS);

    for (let dy = 2; dy >= 0; dy--) {
      const y = ty + dy;

      if (!this.world.inside(tx, y)) {
        continue;
      }

      const i = this.world.idx(tx, y);
      const t = this.world.things[i];

      if (!t) {
        continue;
      }

      if (dy === 0) {
        return i;
      }

      const tall = t.kind === 'nature' && (t.id === 'tree' || t.id === 'pine');

      if (tall && Math.abs(wx - (tx * TS + 8)) < 12) {
        return i;
      }
    }

    return -1;
  }

  private updateHint (dt: number) {
    this.hintTimer -= dt;

    if (this.hintTimer > 0) {
      return;
    }

    this.hintTimer = .12;

    if (!this.mouse.seen || ui.panel || ui.menu || !settings.hints) {
      ui.hint = null;

      return;
    }

    const wx = this.mouse.x + this.cam.x;
    const wy = this.mouse.y + this.cam.y;
    const tx = Math.floor(wx / TS);
    const ty = Math.floor(wy / TS);
    const sx = this.mouse.x * this.scale;
    const sy = this.mouse.y * this.scale;

    if (ui.mode === 'build' && ui.buildSel) {
      const error = this.placeError(ui.buildSel, tx, ty);
      ui.hint = { x: sx, y: sy, title: buildName(ui.buildSel), detail: error ?? t('hint.place'), bad: !!error };

      return;
    }

    if (ui.mode === 'remove') {
      const id = this.removable(tx, ty);
      ui.hint = id ? { x: sx, y: sy, title: t('hint.remove', { name: buildName(id) }), detail: t('hint.removeDetail'), bad: false } : null;

      return;
    }

    const i = this.pickThing(wx, wy);
    ui.hint = i >= 0 ? this.describe(this.world.things[i], sx, sy) : null;
  }

  private describe (thing: Thing | null, x: number, y: number) {
    if (!thing) {
      return null;
    }

    if (thing.kind === 'nature') {
      return { x, y, title: natureName(thing.id), detail: thing.ripe ? t('hint.gives', { what: natureGives(thing.id) }) : t('hint.regrowing'), bad: false };
    }

    if (thing.id === 'gardenBed') {
      const crop = thing.crop ? cropName(thing.crop) : '';
      const detail = !thing.crop
        ? t('hint.bedEmpty')
        : thing.stage < 3 ? t('ev.growing', { crop, n: thing.stage + 1 }) : t('hint.bedRipe', { crop });

      return { x, y, title: buildName('gardenBed'), detail, bad: false };
    }

    if (thing.id === 'sapling') {
      return { x, y, title: buildName('sapling'), detail: t('hint.sapling', { n: Math.max(1, Math.ceil((120 - thing.t) / 60)) }), bad: false };
    }

    return { x, y, title: buildName(thing.id), detail: '', bad: false };
  }

  private snapshot (): SaveData {
    return {
      v: 1,
      world: this.world.serialize(),
      player: { x: this.player.x, y: this.player.y },
      inv: { ...ui.inv },
      time: this.time,
      journal: { ...ui.journal },
      tools: { ...ui.tools },
      hotbar: ui.hotbar.map(s => s && { ...s }),
      sel: ui.sel,
      savedAt: Date.now()
    };
  }

  private slotKey (slot: SlotId) {
    return slot === 'auto' ? SAVE_KEY : `${SLOT_KEY}${slot}`;
  }

  private write (slot: SlotId, data: SaveData) {
    try {
      localStorage.setItem(this.slotKey(slot), JSON.stringify(data));

      return true;
    } catch (error) {
      console.warn('Could not save the game', error);

      return false;
    }
  }

  save () {
    if (this.write('auto', this.snapshot())) {
      ui.hasSave = true;
    }
  }

  saveToSlot (slot: typeof SAVE_SLOTS[number]) {
    const data = this.snapshot();

    if (!this.write(slot, data)) {
      return;
    }

    this.write('auto', data);
    ui.hasSave = true;
    this.sound.play('craft');
    pushEvent('info', 'ev.saved', { n: slot });
  }

  loadSlot (slot: SlotId) {
    const data = this.readSave(slot);

    if (!data || !this.load(data)) {
      return;
    }

    this.visitors = [];
    this.parts = [];
    this.popups = [];
    this.phase = dayPartOf(this.phaseValue());
    this.snapCamera = true;
    this.setMode('play');
    this.save();
    ui.menu = null;
    ui.panel = null;
    ui.screen = 'play';
    this.sound.init();
    if (slot === 'auto') {
      pushEvent('info', 'ev.loadedAuto');
    } else {
      pushEvent('info', 'ev.loaded', { n: slot });
    }
  }

  deleteSlot (slot: SlotId) {
    try {
      localStorage.removeItem(this.slotKey(slot));
    } catch (error) {
      console.warn('Could not delete the save', error);
    }
  }

  slotMeta (slot: SlotId): SlotMeta | null {
    const data = this.readSave(slot);

    if (!data) {
      return null;
    }

    return {
      day: Math.floor(data.time / CYCLE) + 1,
      part: dayPartOf((data.time % CYCLE) / CYCLE),
      met: Object.values(data.journal ?? {}).filter(Boolean).length,
      savedAt: data.savedAt ?? 0
    };
  }

  toTitle () {
    this.save();
    ui.menu = null;
    ui.panel = null;
    this.setMode('play');
    ui.screen = 'title';
  }

  private readSave (slot: SlotId = 'auto'): SaveData | null {
    try {
      const raw = localStorage.getItem(this.slotKey(slot));
      const data: unknown = raw ? JSON.parse(raw) : null;

      return data && typeof data === 'object' && 'v' in data && data.v === 1 ? data as SaveData : null;
    } catch (error) {
      console.warn('Could not read the save', error);

      return null;
    }
  }

  private load (data: SaveData) {
    try {
      this.world.load(data.world);
      this.player = { ...this.freshPlayer(), ...data.player };
      ui.inv = { ...emptyInventory(), ...data.inv };
      ui.journal = data.journal ?? {};
      ui.tools = data.tools ?? {};
      ui.hotbar = data.hotbar?.length === HOTBAR_SIZE ? data.hotbar : new Array<Slot | null>(HOTBAR_SIZE).fill(null);
      ui.sel = data.sel ?? 0;
      this.time = data.time;

      return true;
    } catch (error) {
      console.warn('Save is broken, starting a new world', error);

      return false;
    }
  }

  private setMouse (e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();

    this.mouse.x = (e.clientX - rect.left) / this.scale;
    this.mouse.y = (e.clientY - rect.top) / this.scale;
  }

  private mouseTile () {
    return {
      tx: Math.floor((this.mouse.x + this.cam.x) / TS),
      ty: Math.floor((this.mouse.y + this.cam.y) / TS)
    };
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.setMouse(e);
    this.sound.init();

    if (ui.screen !== 'play' || ui.menu) {
      return;
    }

    ui.touch = e.pointerType === 'touch';
    this.mouse.seen = e.pointerType !== 'touch';

    if (e.button === 2) {
      this.setMode('play');

      return;
    }

    ui.panel = null;
    this.mouse.down = true;
    this.canvas.setPointerCapture(e.pointerId);

    const { tx, ty } = this.mouseTile();
    this.mouse.lastTile = this.world.idx(tx, ty);

    if (ui.mode === 'build') {
      this.tryPlace(tx, ty);

      return;
    }

    if (ui.mode === 'remove') {
      this.tryRemove(tx, ty);

      return;
    }

    const i = this.pickThing(this.mouse.x + this.cam.x, this.mouse.y + this.cam.y);

    if (i >= 0 && this.interactable(i)) {
      this.goTo(i, true);
    } else if (this.world.inside(tx, ty) && this.tileWalkable(tx, ty)) {
      this.goTo(this.world.idx(tx, ty), false);
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    this.setMouse(e);

    if (e.pointerType !== 'touch') {
      this.mouse.seen = true;
    }

    if (!this.mouse.down || ui.mode === 'play') {
      return;
    }

    const { tx, ty } = this.mouseTile();
    const i = this.world.idx(tx, ty);

    if (i === this.mouse.lastTile) {
      return;
    }

    this.mouse.lastTile = i;

    if (ui.mode === 'build') {
      this.tryPlace(tx, ty);
    } else {
      this.tryRemove(tx, ty);
    }
  };

  private readonly onPointerUp = () => {
    this.mouse.down = false;
  };

  private readonly onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      this.onEscape();

      return;
    }

    if (ui.screen !== 'play' || ui.menu) {
      return;
    }

    const map: Record<string, keyof Game['keys']> = {
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', Space: 'act'
    };
    const key = map[e.code];

    if (key) {
      e.preventDefault();
      this.keys[key] = 1;

      return;
    }

    if (e.repeat) {
      return;
    }

    const digit = /^Digit([1-9])$/.exec(e.code);

    if (digit) {
      this.selectSlot(Number(digit[1]) - 1);

      return;
    }

    if (e.code === 'KeyE') {
      ui.panel = ui.panel === 'workshop' ? null : 'workshop';
    } else if (e.code === 'KeyM') {
      this.toggleMute();
    } else if (e.code === 'KeyJ') {
      ui.panel = ui.panel === 'journal' ? null : 'journal';
    } else if (e.code === 'KeyX') {
      this.setMode(ui.mode === 'remove' ? 'play' : 'remove');
    }
  };

  private onEscape () {
    if (ui.menu) {
      ui.menu = ui.menu === 'main' || ui.screen === 'title' ? null : 'main';

      return;
    }

    if (ui.screen !== 'play') {
      return;
    }

    if (ui.panel) {
      ui.panel = null;
    } else if (ui.mode !== 'play') {
      this.setMode('play');
    } else {
      this.keys = { left: 0, right: 0, up: 0, down: 0, act: 0 };
      ui.menu = 'main';
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const map: Record<string, keyof Game['keys']> = {
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', Space: 'act'
    };
    const key = map[e.code];

    if (key) {
      this.keys[key] = 0;
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (ui.screen !== 'play' || ui.menu || Math.abs(e.deltaY) < 4) {
      return;
    }

    this.selectSlot((ui.sel + (e.deltaY > 0 ? 1 : HOTBAR_SIZE - 1)) % HOTBAR_SIZE);
  };

  private readonly onBlur = () => {
    this.keys = { left: 0, right: 0, up: 0, down: 0, act: 0 };
    this.mouse.down = false;
  };

  private readonly onPageHide = () => {
    if (ui.screen === 'play') {
      this.save();
    }
  };
}
