export type Rng = () => number;

export function rng (seed: number): Rng {
  let s = seed | 0;

  return function next () {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;

    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function hash2 (x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return (h >>> 0) / 4294967296;
}

export function lerp (a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp (v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

export function noise2 (x: number, y: number, s: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const top = lerp(hash2(ix, iy, s), hash2(ix + 1, iy, s), ux);
  const bottom = lerp(hash2(ix, iy + 1, s), hash2(ix + 1, iy + 1, s), ux);

  return lerp(top, bottom, uy);
}

export function fbm (x: number, y: number, s: number) {
  return noise2(x, y, s) * .65 + noise2(x * 2.3, y * 2.3, s + 9) * .35;
}

export function pickOne<T> (r: Rng, list: readonly T[]) {
  return list[Math.floor(r() * list.length)];
}

export function makeCanvas (w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;

  return c;
}

export function ctx2d (c: HTMLCanvasElement) {
  const g = c.getContext('2d');

  if (!g) {
    throw new Error('Canvas 2D is not available');
  }

  g.imageSmoothingEnabled = false;

  return g;
}
