import { BUILDS, NATURE } from './defs';
import type { BuildId, CropId, NatureId } from './defs';
import { fbm, hash2, rng } from './util';
import type { Rng } from './util';

export const W = 96;
export const H = 96;
export const TS = 16;

export const GROUND = { grass: 0, meadow: 1, dirt: 2, sand: 3, water: 4 } as const;

export interface NatureThing {
  kind: 'nature';
  id: NatureId;
  v: number;
  ripe: boolean;
  t: number;
  shake: number;
}

export interface BuildThing {
  kind: 'build';
  id: BuildId;
  v: number;
  t: number;
  shake: number;
  crop: CropId | null;
  stage: number;
}

export type Thing = NatureThing | BuildThing;

type SavedThing = [number, 'nature' | 'build', string, number, number, number, CropId | null, number];

export interface SavedWorld {
  seed: number;
  ground: string;
  floors: [number, BuildId][];
  things: SavedThing[];
}

export function natureThing (id: NatureId, r: Rng = Math.random): NatureThing {
  return { kind: 'nature', id, v: Math.floor(r() * 8), ripe: true, t: 0, shake: 0 };
}

export function buildThing (id: BuildId): BuildThing {
  return { kind: 'build', id, v: 0, t: 0, shake: 0, crop: null, stage: 0 };
}

export class World {
  seed = 0;
  ground = new Uint8Array(W * H);
  floors: (BuildId | null)[] = new Array(W * H).fill(null);
  things: (Thing | null)[] = new Array(W * H).fill(null);

  idx (x: number, y: number) {
    return y * W + x;
  }

  inside (x: number, y: number) {
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  isWater (x: number, y: number) {
    return !this.inside(x, y) || this.ground[this.idx(x, y)] === GROUND.water;
  }

  solid (x: number, y: number) {
    if (!this.inside(x, y)) {
      return true;
    }

    const i = this.idx(x, y);

    if (this.ground[i] === GROUND.water && this.floors[i] !== 'bridge') {
      return true;
    }

    const thing = this.things[i];

    if (!thing) {
      return false;
    }

    return thing.kind === 'nature' ? NATURE[thing.id].solid : BUILDS[thing.id].solid;
  }

  generate (seed: number) {
    const r = rng(seed);
    const c = W / 2;

    this.seed = seed;
    this.floors.fill(null);
    this.things.fill(null);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const edge = Math.max(Math.abs(x - c), Math.abs(y - c)) / c;
        const e = fbm(x / 16, y / 16, seed) - Math.max(0, edge - .8) * 3;
        const m = fbm(x / 10 + 40, y / 10, seed + 1);
        const nearSpawn = Math.hypot(x - c, y - c) < 7;
        let g: number = GROUND.grass;

        if (e < .3 && !nearSpawn) {
          g = GROUND.water;
        } else if (e < .34 && !nearSpawn) {
          g = GROUND.sand;
        } else if (m > .62) {
          g = GROUND.meadow;
        } else if (m < .28) {
          g = GROUND.dirt;
        }

        this.ground[this.idx(x, y)] = g;
      }
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const id = this.pickNature(x, y, r);

        if (id && Math.hypot(x - c, y - c) > 3) {
          this.things[this.idx(x, y)] = natureThing(id, r);
        }
      }
    }

    const starter: [NatureId, number][] = [['twig', 6], ['pebble', 5], ['tallgrass', 2]];

    for (const [id, count] of starter) {
      for (let placed = 0, tries = 0; placed < count && tries < 80; tries++) {
        const a = r() * Math.PI * 2;
        const d = 2 + r() * 3.5;
        const x = Math.round(c + Math.cos(a) * d);
        const y = Math.round(c + Math.sin(a) * d);
        const i = this.idx(x, y);

        if (!this.things[i] && this.ground[i] !== GROUND.water && (x !== c || y !== c)) {
          this.things[i] = natureThing(id, r);
          placed++;
        }
      }
    }

    this.things[this.idx(c + 2, c - 1)] = buildThing('campfire');
    this.things[this.idx(c + 2, c - 3)] = buildThing('bench');
    this.things[this.idx(c - 2, c + 2)] = natureThing('flower', r);
    this.things[this.idx(c - 3, c + 1)] = natureThing('tallgrass', r);
  }

  private pickNature (x: number, y: number, r: Rng): NatureId | null {
    const g = this.ground[this.idx(x, y)];

    if (g === GROUND.water) {
      return null;
    }

    const roll = r();
    const forest = fbm(x / 12 + 90, y / 12, this.seed + 2);
    const nearWater = this.isWater(x + 1, y) || this.isWater(x - 1, y) || this.isWater(x, y + 1) || this.isWater(x, y - 1);

    if (nearWater) {
      return roll < .3 ? 'reeds' : null;
    }

    const trees = Math.max(0, forest - .5) * .9;

    if (roll < trees) {
      return r() < .35 ? 'pine' : 'tree';
    }

    const rest = (roll - trees) / (1 - trees);

    if (g === GROUND.meadow) {
      return rest < .16 ? 'flower' : rest < .24 ? 'tallgrass' : rest < .26 ? 'bush' : null;
    }

    if (g === GROUND.dirt) {
      return rest < .05 ? 'rock' : rest < .07 ? 'tallgrass' : rest < .1 ? 'pebble' : null;
    }

    if (forest > .45 && rest < .04) {
      return 'twig';
    }

    if (g === GROUND.sand) {
      return rest < .03 ? 'rock' : null;
    }

    if (rest < .03) {
      return 'flower';
    }

    if (rest < .07) {
      return 'tallgrass';
    }

    if (rest < .09) {
      return 'bush';
    }

    if (rest < .105) {
      return 'rock';
    }

    if (rest < .12 && forest > .45) {
      return 'mushroom';
    }

    if (rest < .135) {
      return r() < .5 ? 'twig' : 'pebble';
    }

    return null;
  }

  puddleAt (x: number, y: number) {
    const g = this.ground[this.idx(x, y)];

    return (g === GROUND.grass || g === GROUND.dirt) && hash2(x, y, 77) < .045 && !this.things[this.idx(x, y)] && !this.floors[this.idx(x, y)];
  }

  serialize (): SavedWorld {
    const floors: [number, BuildId][] = [];
    const things: SavedThing[] = [];

    this.floors.forEach((f, i) => {
      if (f) {
        floors.push([i, f]);
      }
    });

    this.things.forEach((t, i) => {
      if (!t) {
        return;
      }

      things.push(t.kind === 'nature'
        ? [i, 'nature', t.id, t.v, t.ripe ? 1 : 0, Math.round(t.t), null, 0]
        : [i, 'build', t.id, t.v, 1, Math.round(t.t), t.crop, t.stage]);
    });

    return { seed: this.seed, ground: btoa(String.fromCharCode(...this.ground)), floors, things };
  }

  load (data: SavedWorld) {
    const raw = atob(data.ground);

    this.seed = data.seed;
    this.ground = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    this.floors.fill(null);
    this.things.fill(null);

    for (const [i, f] of data.floors) {
      this.floors[i] = f;
    }

    for (const [i, kind, id, v, ripe, t, crop, stage] of data.things) {
      this.things[i] = kind === 'nature'
        ? { kind, id: id as NatureId, v, ripe: ripe === 1, t, shake: 0 }
        : { kind, id: id as BuildId, v, t, shake: 0, crop, stage };
    }
  }
}
