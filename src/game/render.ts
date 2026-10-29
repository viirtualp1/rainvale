import { ART, PAL } from './art';
import { BUILDS, VISITORS, WALLS } from './defs';
import type { BuildId } from './defs';
import type { Game, Light } from './game';
import { settings } from './settings';
import { ui } from './ui';
import { clamp, ctx2d, hash2, lerp, makeCanvas, rng } from './util';
import { GROUND, H, TS, W } from './world';
import type { BuildThing, Thing } from './world';

type Ctx = CanvasRenderingContext2D;
type Img = HTMLCanvasElement;

interface Drawable {
  y: number;
  draw: () => void;
}

interface Grade {
  p: number;
  mul: [number, number, number];
  haze: [number, number, number, number];
  rain: [number, number, number];
}

const LIGHT_CELL = 4;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DARK_ALPHA = Array.from({ length: 16 }, (_, q) => Math.round(Math.pow(1 - q / 15, 1.1) * .64 * 255));
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

const GRADES: Grade[] = [
  { p: 0, mul: [200, 192, 214], haze: [255, 186, 170, .10], rain: [225, 215, 235] },
  { p: .08, mul: [252, 230, 214], haze: [255, 214, 178, .13], rain: [240, 230, 225] },
  { p: .22, mul: [246, 246, 242], haze: [228, 234, 240, .05], rain: [214, 232, 246] },
  { p: .45, mul: [240, 245, 252], haze: [200, 216, 236, .07], rain: [214, 232, 246] },
  { p: .55, mul: [255, 224, 192], haze: [255, 172, 110, .12], rain: [255, 222, 196] },
  { p: .64, mul: [232, 178, 182], haze: [232, 116, 132, .13], rain: [250, 200, 210] },
  { p: .72, mul: [158, 170, 218], haze: [60, 80, 152, .10], rain: [176, 196, 236] },
  { p: .9, mul: [150, 160, 212], haze: [50, 70, 142, .10], rain: [170, 190, 232] },
  { p: 1, mul: [200, 192, 214], haze: [255, 186, 170, .10], rain: [225, 215, 235] }
];

const lightCanvas = makeCanvas(8, 8);
const lightCtx = ctx2d(lightCanvas);
const glowCanvas = makeCanvas(8, 8);
const glowCtx = ctx2d(glowCanvas);
let lightImg: ImageData | null = null;
let glowImg: ImageData | null = null;
const shadows = new Map<number, Img>();
const fogTexture = makeFog();
const fogPatches = Array.from({ length: 14 }, (_, i) => ({ x: hash2(i, 1, 4) * 900, y: hash2(i, 2, 4) * 600, speed: 3 + hash2(i, 3, 4) * 5 }));
let S = 3;

function snap (v: number) {
  return Math.round(v * S) / S;
}

function rect (g: Ctx, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(snap(x), snap(y), w, h);
}

function blit (g: Ctx, img: Img, x: number, y: number, w = img.width, h = img.height) {
  g.drawImage(img, snap(x), snap(y), w, h);
}

function makeFog () {
  const w = 48;
  const h = 16;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const r = rng(7);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = ((x + .5 - w / 2) / (w / 2)) ** 2 + ((y + .5 - h / 2) / (h / 2)) ** 2;
      const a = Math.max(0, 1 - d) * (.75 + r() * .25);

      if (a > .05) {
        g.fillStyle = `rgba(236,240,246,${(a * .55).toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  return c;
}

function gradeAt (p: number) {
  const next = GRADES.findIndex(k => k.p >= p);
  const b = GRADES[Math.max(1, next)];
  const a = GRADES[Math.max(0, next - 1)];
  const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
  const mix = (u: number[], v: number[]) => u.map((x, i) => lerp(x, v[i], t));

  return { mul: mix(a.mul, b.mul), haze: mix(a.haze, b.haze), rain: mix(a.rain, b.rain) };
}

function fogAmount (p: number) {
  if (p < .14) {
    return 1;
  }

  if (p < .24) {
    return 1 - (p - .14) / .1;
  }

  if (p > .9) {
    return (p - .9) / .1 * .6;
  }

  return 0;
}

function shadow (w: number) {
  let s = shadows.get(w);

  if (!s) {
    const h = Math.max(3, Math.round(w * .35));
    s = makeCanvas(w, h);
    const g = ctx2d(s);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (((x + .5 - w / 2) / (w / 2)) ** 2 + ((y + .5 - h / 2) / (h / 2)) ** 2 <= 1) {
          g.fillStyle = 'rgba(30,50,40,.28)';
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    shadows.set(w, s);
  }

  return s;
}

function digits (g: Ctx, text: string, x: number, y: number, c: string) {
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];

    if (ch === '+') {
      rect(g, x + k * 4, y + 2, 3, 1, c);
      rect(g, x + k * 4 + 1, y + 1, 1, 3, c);
      continue;
    }

    const d = DIGITS[Number(ch)];

    for (let b = 0; b < 15; b++) {
      if (d[b] === '1') {
        rect(g, x + k * 4 + (b % 3) + 1, y + Math.floor(b / 3) + 1, 1, 1, '#2f2a2d');
        rect(g, x + k * 4 + (b % 3), y + Math.floor(b / 3), 1, 1, c);
      }
    }
  }
}

function isWallLike (t: Thing | null | undefined) {
  return t?.kind === 'build' && WALLS.includes(t.id);
}

function fenceLike (t: Thing | null | undefined) {
  return t?.kind === 'build' && (t.id === 'fence' || t.id === 'gate');
}

function viewTiles (game: Game, cx: number, cy: number) {
  return {
    x0: Math.floor(cx / TS),
    y0: Math.floor(cy / TS),
    x1: Math.floor((cx + game.bufW) / TS),
    y1: Math.floor((cy + game.bufH) / TS)
  };
}

function drawGround (game: Game, g: Ctx, cx: number, cy: number, t: number) {
  const { world } = game;
  const { x0, y0, x1, y1 } = viewTiles(game, cx, cy);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const sx = tx * TS - cx;
      const sy = ty * TS - cy;

      if (!world.inside(tx, ty)) {
        blit(g, ART.ground[GROUND.water][0], sx, sy, 16.02, 16.02);
        continue;
      }

      const i = world.idx(tx, ty);
      const kind = world.ground[i];

      // A hair of overlap hides seams between tiles at fractional camera offsets.
      blit(g, ART.ground[kind][Math.floor(hash2(tx, ty, 3) * 3)], sx, sy, 16.02, 16.02);

      if (kind === GROUND.water) {
        const ph = (t * .8 + hash2(tx, ty, 9) * 4) % 4;

        if (ph < 1.5) {
          rect(g, sx + 3 + Math.floor(ph * 4), sy + 4 + (tx % 3) * 3, 4, 1, '#7cc0d6');
        }

        if (!world.isWater(tx, ty - 1)) {
          rect(g, sx, sy, 16, 2, '#2f6f8a');
          rect(g, sx, sy + 2 + Math.round(Math.sin(t * 2 + tx) * .6), 16, 1, PAL.foam);
        }

        if (!world.isWater(tx - 1, ty)) {
          rect(g, sx, sy, 1, 16, '#a8d4e0');
        }

        if (!world.isWater(tx + 1, ty)) {
          rect(g, sx + 15, sy, 1, 16, '#a8d4e0');
        }

        if (!world.isWater(tx, ty + 1)) {
          rect(g, sx, sy + 15, 16, 1, '#a8d4e0');
        }
      } else if (world.puddleAt(tx, ty)) {
        const px = sx + 3 + Math.floor(hash2(tx, ty, 5) * 4);
        const py = sy + 5 + Math.floor(hash2(tx, ty, 6) * 5);

        rect(g, px + 1, py, 8, 4, '#5f8f98');
        rect(g, px, py + 1, 10, 2, '#5f8f98');
        rect(g, px + 2, py + 1, 3, 1, '#a6d0da');
      }
    }
  }
}

function drawFloors (game: Game, g: Ctx, cx: number, cy: number) {
  const { world } = game;
  const { x0, y0, x1, y1 } = viewTiles(game, cx, cy);

  for (let ty = Math.max(0, y0); ty <= Math.min(H - 1, y1); ty++) {
    for (let tx = Math.max(0, x0); tx <= Math.min(W - 1, x1); tx++) {
      const i = world.idx(tx, ty);
      const floor = world.floors[i];
      const sx = tx * TS - cx;
      const sy = ty * TS - cy;

      if (floor) {
        blit(g, ART.builds[floor], sx, sy);
      }

      if (floor === 'bridge') {
        const rail = (x: number, y: number, w: number, h: number) => {
          rect(g, x - 1, y - 1, w + 2, h + 2, '#2f2a2d');
          rect(g, x, y, w, h, PAL.woodDark);
        };
        const open = (x: number, y: number) => world.isWater(x, y) && world.floors[world.idx(x, y)] !== 'bridge';

        if (open(tx, ty - 1)) {
          rail(sx, sy - 2, 16, 2);
        }

        if (open(tx, ty + 1)) {
          rail(sx, sy + 14, 16, 2);
        }

        if (open(tx - 1, ty)) {
          rail(sx, sy, 2, 16);
        }

        if (open(tx + 1, ty)) {
          rail(sx + 14, sy, 2, 16);
        }
      }

      const thing = world.things[i];

      if (thing?.kind === 'build' && thing.id === 'rug') {
        const s = ART.builds.rug;
        blit(g, s, sx + 8 - s.width / 2, sy + TS - s.height + 1);
      }
    }
  }
}

function drawFence (game: Game, g: Ctx, tx: number, ty: number, sx: number, sy: number, gate: boolean) {
  const { world } = game;
  const near = (dx: number, dy: number) => world.inside(tx + dx, ty + dy) && fenceLike(world.things[world.idx(tx + dx, ty + dy)]);
  const board = (x: number, y: number, w: number, h: number, c: string) => {
    rect(g, x - 1, y - 1, w + 2, h + 2, '#2f2a2d');
    rect(g, x, y, w, h, c);
  };

  if (near(-1, 0)) {
    board(sx, sy + 5, 8, 2, gate ? PAL.woodLight : PAL.wood);
    board(sx, sy + 10, 8, 2, gate ? PAL.woodLight : PAL.wood);
  }

  if (near(1, 0)) {
    board(sx + 8, sy + 5, 8, 2, gate ? PAL.woodLight : PAL.wood);
    board(sx + 8, sy + 10, 8, 2, gate ? PAL.woodLight : PAL.wood);
  }

  if (near(0, -1)) {
    board(sx + 7, sy - 2, 2, 10, PAL.wood);
  }

  if (gate) {
    board(sx + 3, sy + 4, 10, 2, PAL.woodLight);
    board(sx + 3, sy + 9, 10, 2, PAL.woodLight);
    board(sx + 1, sy + 1, 2, 13, PAL.woodDark);
    board(sx + 13, sy + 1, 2, 13, PAL.woodDark);

    return;
  }

  board(sx + 6, sy, 4, 14, PAL.wood);
  rect(g, sx + 6, sy, 1, 14, PAL.woodLight);
  rect(g, sx + 6, sy, 4, 1, PAL.woodLight);
}

function drawWall (game: Game, g: Ctx, t: BuildThing, tx: number, ty: number, sx: number, sy: number) {
  const { world } = game;
  const at = (dx: number, dy: number) => world.inside(tx + dx, ty + dy) ? world.things[world.idx(tx + dx, ty + dy)] : null;
  const capped = isWallLike(at(0, 1)) && t.id !== 'door';
  const sprite = capped ? ART.caps[t.id as 'woodWall' | 'brickWall'] : ART.builds[t.id];
  const top = sy - 8;

  blit(g, sprite, sx, top, 16.02, 24);

  if (!isWallLike(at(-1, 0))) {
    rect(g, sx, top, 1, 24, '#2f2a2d');
  }

  if (!isWallLike(at(1, 0))) {
    rect(g, sx + 15, top, 1, 24, '#2f2a2d');
  }

  if (!isWallLike(at(0, -1))) {
    rect(g, sx, top, 16, 1, '#2f2a2d');
  }

  if (!capped) {
    rect(g, sx, sy + 15, 16, 1, '#2f2a2d');
  }
}

function drawThing (game: Game, g: Ctx, t: Thing, i: number, cx: number, cy: number, now: number) {
  const tx = i % W;
  const ty = Math.floor(i / W);
  const sx = tx * TS - cx;
  const sy = ty * TS - cy;
  const jiggle = t.shake > 0 ? Math.round(Math.sin(t.shake * 70)) : 0;

  if (t.kind === 'nature') {
    const set = ART.nature[t.id];
    const sprite = t.id === 'bush' || t.id === 'reeds' ? set[t.ripe ? 0 : 1] : set[t.v % set.length];
    const nudge = t.id === 'flower' || t.id === 'mushroom' || t.id === 'twig' || t.id === 'pebble' ? (t.v % 3) - 1 : 0;
    const x = sx + 8 - Math.floor(sprite.width / 2) + jiggle + nudge;
    const y = sy + TS - sprite.height + 1;
    const tall = t.id === 'tree' || t.id === 'pine';
    const p = game.player;
    const behind = tall && p.y < ty * TS + TS && p.y > ty * TS + TS - sprite.height && Math.abs(p.x - (tx * TS + 8)) < sprite.width / 2;

    if (tall || t.id === 'rock' || t.id === 'bush' || t.id === 'stump') {
      const sh = shadow(tall ? 20 : 14);
      blit(g, sh, sx + 8 - sh.width / 2, sy + 12);
    }

    g.globalAlpha = behind ? .55 : 1;
    blit(g, sprite, x, y);
    g.globalAlpha = 1;

    return;
  }

  if (t.id === 'rug') {
    return;
  }

  if (WALLS.includes(t.id)) {
    drawWall(game, g, t, tx, ty, sx, sy);

    return;
  }

  if (t.id === 'fence' || t.id === 'gate') {
    drawFence(game, g, tx, ty, sx, sy, t.id === 'gate');

    return;
  }

  const sprite = ART.builds[t.id];

  if (BUILDS[t.id].solid) {
    const sh = shadow(Math.min(18, sprite.width));
    blit(g, sh, sx + 8 - sh.width / 2, sy + 12);
  }

  blit(g, sprite, sx + 8 - Math.floor(sprite.width / 2) + jiggle, sy + TS - sprite.height + 1);

  if (t.id === 'gardenBed' && t.crop) {
    const crop = ART.crops[t.crop][t.stage];
    blit(g, crop, sx + 8 - crop.width / 2, sy + 13 - crop.height);
  }

  if (t.id === 'campfire') {
    for (let k = 0; k < 5; k++) {
      const fh = 4 + Math.abs(Math.sin(now * 9 + k * 1.7)) * 6 * (k === 0 || k === 4 ? .5 : 1);
      const fx = sx + 3 + k * 2;

      rect(g, fx, sy + 9 - fh, 2, Math.round(fh), '#ff8a3a');
      rect(g, fx, sy + 9 - fh * .6, 2, Math.round(fh * .6), '#ffc04a');

      if (k > 0 && k < 4) {
        rect(g, fx, sy + 9 - fh * .3, 2, Math.round(fh * .3), '#fff0b8');
      }
    }

    if (Math.random() < .05) {
      game.parts.push({ x: tx * TS + 8, y: ty * TS + 2, vx: (Math.random() - .5) * 10, vy: -20 - Math.random() * 20, g: -4, life: 1.2, max: 1.2, c: '#ffb04a', size: 1, kind: 'glow' });
    }
  }
}

function drawHeldTool (game: Game, g: Ctx, x: number, y: number, behind: boolean) {
  const p = game.player;
  const tool = game.heldTool();

  if (!tool || (p.dir === 'up') !== behind) {
    return;
  }

  const working = p.goal !== null && !p.path.length && p.work > 0;
  const swing = (p.work * 3.2) % 1;
  const pose = working ? (swing < .45 ? 0 : swing < .6 ? 1 : 2) : 1;
  const held = ART.held[tool];
  const sprite = held.frames[pose];
  const [gx, gy] = held.grips[pose];
  const flip = p.dir === 'side' ? p.face : p.dir === 'up' ? -1 : 1;
  const handX = p.dir === 'side' ? 3 * p.face : p.dir === 'up' ? -5 : 5;
  const bob = p.moving && Math.floor(p.anim * 8) % 2 === 0 ? 1 : 0;

  g.save();
  g.translate(snap(x + handX), snap(y - 6 - bob));
  g.scale(flip, 1);
  g.drawImage(sprite, -gx, -gy);
  g.restore();
}

function drawPlayer (game: Game, g: Ctx, cx: number, cy: number) {
  const p = game.player;
  const frames = ART.player[p.dir];
  const working = p.goal !== null && !p.path.length && p.work > 0;
  const walk = [1, 0, 2, 0][Math.floor(p.anim * 8) % 4];
  const sprite = frames[p.moving ? walk : working ? (Math.floor(p.work * 8) % 2 ? 1 : 0) : 0];
  const x = p.x - cx;
  const y = p.y - cy;
  const bob = p.moving && walk !== 0 ? 1 : 0;
  const sh = shadow(12);

  blit(g, sh, x - 6, y - 2);
  drawHeldTool(game, g, x, y, true);
  g.save();
  g.translate(snap(x), snap(y - sprite.height + 1 - bob));

  if (p.dir === 'side' && p.face < 0) {
    g.scale(-1, 1);
  }

  g.drawImage(sprite, -Math.floor(sprite.width / 2), 0);
  g.restore();
  drawHeldTool(game, g, x, y, false);
}

function drawVisitor (game: Game, g: Ctx, v: Game['visitors'][number], cx: number, cy: number) {
  const def = VISITORS[v.id];
  const frames = ART.visitors[v.id];
  const frame = v.moving ? Math.floor(v.anim * 6) % 2 : (def.perch && Math.floor(v.anim) % 4 === 0 ? 1 : 0);
  const sprite = frames[frame];
  const tx = Math.floor(v.x / TS);
  const ty = Math.floor((v.y - 2) / TS);
  const swimming = game.world.isWater(tx, ty) && game.world.floors[game.world.idx(tx, ty)] !== 'bridge';
  let x = v.x - cx;
  let y = v.y - cy;

  if (def.perch) {
    const home = game.world.things[v.home];
    const homeSprite = home?.kind === 'build' ? ART.builds[home.id] : null;

    x = (v.home % W) * TS + 8 - cx;
    y = Math.floor(v.home / W) * TS + TS + 1 - (homeSprite?.height ?? 16) + 3 - cy;
  } else if (!swimming) {
    blit(g, shadow(10), x - 5, y - 2);
  }

  g.save();
  g.globalAlpha = clamp(v.alpha, 0, 1);
  g.translate(snap(x), snap(y - sprite.height + 1 + (swimming ? 3 : 0)));

  if (v.face < 0) {
    g.scale(-1, 1);
  }

  if (swimming) {
    g.beginPath();
    g.rect(-sprite.width, 0, sprite.width * 2, sprite.height - 3);
    g.clip();
  }

  g.drawImage(sprite, -Math.floor(sprite.width / 2), 0);
  g.restore();

  if (swimming) {
    rect(g, x - 6, y - 1, 12, 1, 'rgba(207,232,239,.7)');
  }
}

function collectLights (game: Game, cx: number, cy: number) {
  const lights: Light[] = [];
  const { world } = game;
  const x0 = Math.max(0, Math.floor((cx - 90) / TS));
  const y0 = Math.max(0, Math.floor((cy - 90) / TS));
  const x1 = Math.min(W - 1, Math.floor((cx + game.bufW + 90) / TS));
  const y1 = Math.min(H - 1, Math.floor((cy + game.bufH + 90) / TS));
  const now = performance.now() / 1000;

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = world.things[world.idx(tx, ty)];

      if (t?.kind !== 'build') {
        continue;
      }

      const def = BUILDS[t.id].light;

      if (def) {
        const flicker = t.id === 'campfire' ? 1 + Math.sin(now * 11 + tx) * .04 : 1;
        lights.push({ x: tx * TS + 8, y: ty * TS + (t.id === 'lantern' ? -4 : 6), r: def.r * flicker, i: def.i, warm: def.warm });
      }
    }
  }

  lights.push({ x: game.player.x, y: game.player.y - 8, r: 30, i: 8.5, warm: true });

  return lights;
}

function drawLight (game: Game, g: Ctx, cx: number, cy: number) {
  const ox = Math.floor(cx / LIGHT_CELL) * LIGHT_CELL;
  const oy = Math.floor(cy / LIGHT_CELL) * LIGHT_CELL;
  const w = Math.ceil(game.bufW / LIGHT_CELL) + 2;
  const h = Math.ceil(game.bufH / LIGHT_CELL) + 2;

  if (!lightImg || !glowImg || lightImg.width !== w || lightImg.height !== h) {
    lightCanvas.width = glowCanvas.width = w;
    lightCanvas.height = glowCanvas.height = h;
    lightImg = lightCtx.createImageData(w, h);
    glowImg = glowCtx.createImageData(w, h);
  }

  const lights = game.lights;
  const ld = lightImg.data;
  const gd = glowImg.data;
  const amb = game.amb;
  const night = 1 - amb / 15;

  for (let j = 0; j < h; j++) {
    const wy = oy + j * LIGHT_CELL + LIGHT_CELL / 2;

    for (let i = 0; i < w; i++) {
      const wx = ox + i * LIGHT_CELL + LIGHT_CELL / 2;
      let l = amb;
      let warm = 0;
      let cool = 0;

      for (const L of lights) {
        const dx = wx - L.x;
        const dy = (wy - L.y) * 1.2;
        const d2 = dx * dx + dy * dy;

        if (d2 >= L.r * L.r) {
          continue;
        }

        const v = L.i * (1 - Math.sqrt(d2) / L.r);
        l = Math.max(l, v);

        if (L.warm) {
          warm = Math.max(warm, v);
        } else {
          cool = Math.max(cool, v);
        }
      }

      const dither = (BAYER[(j & 3) * 4 + (i & 3)] - 7.5) / 16 * .9;
      const q = clamp(Math.round(l + dither), 0, 15);
      const wq = clamp(Math.round(warm + dither), 0, 15) / 15;
      const cq = clamp(Math.round(cool + dither), 0, 15) / 15;
      const o = (j * w + i) * 4;
      const gw = wq * wq * .32 * (.2 + night) * 255;
      const gc = cq * cq * .3 * (.2 + night) * 255;

      ld[o] = 16;
      ld[o + 1] = 22;
      ld[o + 2] = 54;
      ld[o + 3] = DARK_ALPHA[q];
      gd[o] = gw + gc * .3;
      gd[o + 1] = gw * .55 + gc * .85;
      gd[o + 2] = gw * .18 + gc * .8;
      gd[o + 3] = 255;
    }
  }

  lightCtx.putImageData(lightImg, 0, 0);
  glowCtx.putImageData(glowImg, 0, 0);
  blit(g, lightCanvas, ox - cx, oy - cy, w * LIGHT_CELL, h * LIGHT_CELL);
  g.globalCompositeOperation = 'lighter';
  blit(g, glowCanvas, ox - cx, oy - cy, w * LIGHT_CELL, h * LIGHT_CELL);
  g.globalCompositeOperation = 'source-over';
}

function drawFog (game: Game, g: Ctx, amount: number, now: number) {
  if (amount <= 0) {
    return;
  }

  const fw = fogTexture.width * 4;
  const fh = fogTexture.height * 4;
  const spanX = game.bufW + fw;
  const spanY = game.bufH + fh;

  g.globalAlpha = amount * .38;

  for (const f of fogPatches) {
    const x = (((f.x + now * f.speed - game.cam.x * .85) % spanX) + spanX) % spanX - fw;
    const y = (((f.y - game.cam.y * .85) % spanY) + spanY) % spanY - fh;

    blit(g, fogTexture, x, y, fw, fh);
  }

  g.globalAlpha = 1;
}

function drawGhost (game: Game, g: Ctx, cx: number, cy: number, now: number) {
  if (!game.mouse.seen || ui.touch) {
    return;
  }

  const tx = Math.floor((game.mouse.x + cx) / TS);
  const ty = Math.floor((game.mouse.y + cy) / TS);
  const sx = tx * TS - cx;
  const sy = ty * TS - cy;

  g.lineWidth = 1 / S * 2;

  if (ui.mode === 'remove') {
    if (game.removable(tx, ty)) {
      g.strokeStyle = '#e8705a';
      g.strokeRect(snap(sx) + .5, snap(sy) + .5, 15, 15);
    }

    return;
  }

  if (ui.mode !== 'build' || !ui.buildSel) {
    return;
  }

  const id: BuildId = ui.buildSel;
  const bad = !!game.placeError(id, tx, ty);
  const sprite = ART.builds[id];
  const tall = WALLS.includes(id);

  g.globalAlpha = .55 + Math.sin(now * 5) * .1;
  blit(g, sprite, tall ? sx : sx + 8 - Math.floor(sprite.width / 2), tall ? sy - 8 : (BUILDS[id].layer === 'floor' ? sy : sy + TS - sprite.height + 1));
  g.globalAlpha = 1;
  rect(g, sx, sy, 16, 16, bad ? 'rgba(232,90,80,.28)' : 'rgba(250,245,220,.16)');
  g.strokeStyle = bad ? '#e8705a' : '#fff6d8';
  g.strokeRect(snap(sx) + .5, snap(sy) + .5, 15, 15);
}

export function renderGame (game: Game, now: number) {
  const g = game.ctx;

  S = game.scale * game.pixelRatio;
  g.setTransform(S, 0, 0, S, 0, 0);
  g.imageSmoothingEnabled = false;

  const cx = snap(game.cam.x);
  const cy = snap(game.cam.y);
  const { world } = game;
  const phase = game.phaseValue();
  const grade = gradeAt(phase);

  game.lights = collectLights(game, cx, cy);
  drawGround(game, g, cx, cy, now);
  drawFloors(game, g, cx, cy);

  const items: Drawable[] = [];
  const x0 = Math.max(0, Math.floor(cx / TS) - 1);
  const x1 = Math.min(W - 1, Math.floor((cx + game.bufW) / TS) + 1);
  const y0 = Math.max(0, Math.floor(cy / TS) - 1);
  const y1 = Math.min(H - 1, Math.floor((cy + game.bufH) / TS) + 3);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = world.idx(tx, ty);
      const t = world.things[i];

      if (t) {
        items.push({ y: ty * TS + TS - 1, draw: () => drawThing(game, g, t, i, cx, cy, now) });
      }
    }
  }

  for (const v of game.visitors) {
    items.push({ y: VISITORS[v.id].perch ? Math.floor(v.home / W) * TS + TS : v.y, draw: () => drawVisitor(game, g, v, cx, cy) });
  }

  items.push({ y: game.player.y, draw: () => drawPlayer(game, g, cx, cy) });
  items.sort((a, b) => a.y - b.y);

  for (const item of items) {
    item.draw();
  }

  for (const p of game.parts) {
    const a = clamp(p.life / p.max, 0, 1);

    if (p.kind === 'dot') {
      g.globalAlpha = Math.min(1, a * 1.5);
      rect(g, p.x - cx, p.y - cy, p.size, p.size, p.c);
    } else if (p.kind === 'ripple') {
      const r = 1 + (1 - a) * 4;
      g.globalAlpha = a * .8;
      rect(g, p.x - cx - r, p.y - cy, r * 2, 1, p.c);
      rect(g, p.x - cx - r * .6, p.y - cy - 1, r * 1.2, 1, p.c);
      rect(g, p.x - cx - r * .6, p.y - cy + 1, r * 1.2, 1, p.c);
    }
  }

  g.globalAlpha = 1;
  drawFog(game, g, settings.fog ? fogAmount(phase) : 0, now);

  const rainColor = `rgba(${grade.rain.map(Math.round).join(',')},.55)`;

  for (const d of game.drops) {
    const half = Math.ceil(d.len / 2);
    rect(g, d.x, d.y, 1, half, rainColor);
    rect(g, d.x - 1, d.y + half, 1, half, rainColor);
  }

  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${grade.mul.map(Math.round).join(',')})`;
  g.fillRect(0, 0, game.bufW, game.bufH);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgba(${grade.haze.slice(0, 3).map(Math.round).join(',')},${(grade.haze[3] + game.rain * .04).toFixed(3)})`;
  g.fillRect(0, 0, game.bufW, game.bufH);
  drawLight(game, g, cx, cy);

  g.globalCompositeOperation = 'lighter';

  for (const p of game.parts) {
    if (p.kind !== 'glow') {
      continue;
    }

    const blink = .5 + .5 * Math.sin(now * 4 + p.x);
    g.globalAlpha = clamp(p.life / p.max * 2, 0, 1) * blink;
    rect(g, p.x - cx, p.y - cy, 1, 1, p.c);
    rect(g, p.x - cx - 1, p.y - cy - 1, 3, 3, 'rgba(200,255,120,.18)');
    p.vx += (Math.random() - .5) * 3;
    p.vy += (Math.random() - .5) * 3;
  }

  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  drawGhost(game, g, cx, cy, now);

  const goal = game.player.goal;

  if (goal !== null && ui.mode === 'play') {
    const sx = (goal % W) * TS - cx;
    const sy = Math.floor(goal / W) * TS - cy;
    const pulse = Math.round(Math.sin(now * 6));

    for (const [x, y] of [[0, 0], [12, 0], [0, 12], [12, 12]]) {
      rect(g, sx + x + (x ? pulse : -pulse), sy + y + (y ? pulse : -pulse) + 2, 4, 1, '#fff6d8');
    }
  }

  for (const p of game.popups) {
    const a = 1 - Math.max(0, p.t - .7) / .4;
    const x = p.x - cx;
    const y = p.y - cy - p.t * 14;

    g.globalAlpha = a;
    blit(g, ART.icons[p.mat], x - 9, y - 6, 12, 12);
    digits(g, `+${p.n}`, x + 4, y - 3, '#fff6d8');
  }

  g.globalAlpha = 1;
}
