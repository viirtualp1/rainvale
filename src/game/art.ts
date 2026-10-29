import { ctx2d, hash2, makeCanvas, pickOne, rng } from './util';
import type { Rng } from './util';
import type { BuildId, CropId, MaterialId, NatureId, ToolId, VisitorId } from './defs';

type G = CanvasRenderingContext2D;
type Sprite = HTMLCanvasElement;
export type Facing = 'down' | 'up' | 'side';

const OUTLINE = '#2f2a2d';

export const PAL = {
  wood: '#a8743f',
  woodDark: '#7d5230',
  woodLight: '#c99258',
  stone: '#a5a39e',
  stoneDark: '#7f7d79',
  stoneLight: '#c4c2bd',
  leaf: '#4d8f47',
  leafDark: '#3c7440',
  leafLight: '#68aa58',
  water: '#3f86a3',
  foam: '#cfe8ef',
  coat: '#f2c14e',
  coatShade: '#d9a23a'
};

function rect (g: G, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function blob (g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) {
        rect(g, cx + x, cy + y, 1, 1, c);
      }
    }
  }
}

export function outline (src: Sprite, color = OUTLINE) {
  const out = makeCanvas(src.width + 2, src.height + 2);
  const g = ctx2d(out);
  const silhouette = makeCanvas(src.width, src.height);
  const sg = ctx2d(silhouette);

  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, src.width, src.height);

  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
    g.drawImage(silhouette, dx, dy);
  }

  g.drawImage(src, 1, 1);

  return out;
}

function paint (w: number, h: number, fn: (g: G, r: Rng) => void, seed = 1, lined = true) {
  const c = makeCanvas(w, h);
  fn(ctx2d(c), rng(seed));

  return lined ? outline(c) : c;
}

const GROUND_PAL = [
  ['#4f8a49', '#56934d', '#5d9b52', '#64a257'],
  ['#5a964e', '#61a054', '#69a85a', '#5d9b52'],
  ['#8b6846', '#957150', '#9e7a57', '#a6835f'],
  ['#cdb886', '#d5c18f', '#dcc998', '#e3d2a2'],
  ['#3a7f9c', '#3f86a3', '#4790ad', '#4b96b2']
];

function groundTile (kind: number, v: number) {
  return paint(16, 16, (g, r) => {
    const pal = GROUND_PAL[kind];

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = hash2(x >> 1, y >> 1, kind * 13 + v) * .55 + r() * .45;
        rect(g, x, y, 1, 1, pal[Math.min(pal.length - 1, Math.floor(n * pal.length))]);
      }
    }

    if (kind <= 1) {
      for (let i = 0; i < 6; i++) {
        const x = r() * 15;
        const y = r() * 14;
        rect(g, x, y, 1, 2, '#74b062');
        rect(g, x + 1, y + 1, 1, 1, '#74b062');
      }
    }

    if (kind === 1) {
      for (let i = 0; i < 4; i++) {
        rect(g, r() * 15, r() * 15, 1, 1, pickOne(r, ['#f2d16b', '#f4f0e4', '#ec9ab3', '#9ec0f0']));
      }
    }

    if (kind === 2) {
      for (let i = 0; i < 4; i++) {
        rect(g, r() * 15, r() * 15, 2, 1, pickOne(r, ['#7a5a3c', '#b8946a']));
      }
    }

    if (kind === 3) {
      for (let i = 0; i < 5; i++) {
        rect(g, r() * 16, r() * 16, 1, 1, '#bfa978');
      }
    }

    if (kind === 4) {
      for (let i = 0; i < 2; i++) {
        rect(g, r() * 12, r() * 15, 3, 1, '#62a6bf');
      }
    }
  }, kind * 31 + v * 7 + 3, false);
}

function woodFloor () {
  return paint(16, 16, (g, r) => {
    for (let row = 0; row < 4; row++) {
      rect(g, 0, row * 4, 16, 4, pickOne(r, ['#b9824a', '#ae7943', '#c28b52']));
      rect(g, 0, row * 4, 16, 1, '#d09a60');
      rect(g, 0, row * 4 + 3, 16, 1, '#7d5230');
      rect(g, (row * 7 + 3) % 16, row * 4, 1, 3, '#8a5a34');
    }
  }, 11, false);
}

function stonePath () {
  return paint(16, 16, g => {
    for (const [x, y, w, h] of [[1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 5, 5], [7, 6, 8, 5], [2, 12, 6, 4], [9, 12, 6, 4]]) {
      rect(g, x, y, w, h, '#aba9a3');
      rect(g, x, y, w, 1, '#c8c6c0');
      rect(g, x, y + h - 1, w, 1, '#86847f');
    }
  }, 12, false);
}

function bridge () {
  return paint(16, 16, g => {
    for (let row = 0; row < 4; row++) {
      rect(g, 0, row * 4, 16, 3, row % 2 ? '#a06c3c' : '#ad7843');
      rect(g, 0, row * 4, 16, 1, '#c99258');
      rect(g, 2, row * 4 + 1, 1, 1, '#6e4628');
      rect(g, 13, row * 4 + 1, 1, 1, '#6e4628');
    }
  }, 13, false);
}

function tree (seed: number) {
  return paint(30, 34, (g, r) => {
    rect(g, 12, 22, 6, 12, '#8a5a34');
    rect(g, 12, 22, 2, 12, '#a06c3c');
    rect(g, 16, 22, 2, 12, '#6e4628');
    rect(g, 10, 32, 10, 2, '#6e4628');
    blob(g, 15, 13, 14, 12, PAL.leafDark);
    blob(g, 14, 11, 12, 10, PAL.leaf);
    blob(g, 11, 8, 7, 6, PAL.leafLight);

    for (let i = 0; i < 10; i++) {
      rect(g, 4 + r() * 20, 3 + r() * 16, 2, 1, '#86c06c');
    }

    if (seed % 3 === 0) {
      for (let i = 0; i < 4; i++) {
        rect(g, 5 + r() * 18, 6 + r() * 14, 2, 2, '#d9465a');
      }
    }
  }, seed);
}

function pine (seed: number) {
  return paint(22, 36, g => {
    rect(g, 9, 29, 4, 7, '#7a4f2e');

    for (let layer = 0; layer < 4; layer++) {
      const top = 2 + layer * 7;
      const half = 4 + layer * 2;

      for (let y = 0; y < 9; y++) {
        const w = Math.round(half * (y + 1) / 9);
        rect(g, 11 - w, top + y, w * 2, 1, y < 3 ? '#4a9064' : y < 6 ? '#3b7d55' : '#2f6b4a');
      }
    }

    rect(g, 10, 1, 2, 2, '#4a9064');
  }, seed);
}

function rock (seed: number) {
  return paint(18, 13, (g, r) => {
    blob(g, 9, 7, 8, 5, '#8c8a85');
    blob(g, 8, 6, 7, 4, PAL.stone);
    blob(g, 7, 5, 4, 2, PAL.stoneLight);

    for (let i = 0; i < 4; i++) {
      rect(g, 3 + r() * 10, 2 + r() * 4, 2, 1, '#6aa25a');
    }
  }, seed);
}

function bush (ripe: boolean) {
  return paint(18, 14, (g, r) => {
    blob(g, 9, 8, 8, 6, PAL.leafDark);
    blob(g, 8, 7, 7, 5, PAL.leaf);
    blob(g, 7, 5, 3, 2, PAL.leafLight);

    if (ripe) {
      for (let i = 0; i < 6; i++) {
        const x = 3 + r() * 11;
        const y = 3 + r() * 7;
        rect(g, x, y, 2, 2, '#d9465a');
        rect(g, x, y, 1, 1, '#ff9aa8');
      }
    }
  }, 21);
}

function flower (color: string, seed: number) {
  return paint(9, 12, g => {
    rect(g, 4, 5, 1, 7, '#3f7a3e');
    rect(g, 2, 8, 2, 1, '#4d8f47');
    rect(g, 5, 9, 2, 1, '#4d8f47');
    rect(g, 3, 1, 3, 1, color);
    rect(g, 2, 2, 5, 2, color);
    rect(g, 3, 4, 3, 1, color);
    rect(g, 4, 2, 1, 2, '#f2d16b');
  }, seed);
}

function reeds (full: boolean) {
  return paint(14, 18, (g, r) => {
    for (let k = 0; k < (full ? 7 : 5); k++) {
      const x = 2 + k * 1.6 + r();
      const h = full ? 9 + r() * 7 : 3 + r() * 2;

      rect(g, x, 18 - h, 1, h, pickOne(r, ['#6a9a4a', '#86b25a', '#5d8c44']));

      if (full && k % 2 === 0) {
        rect(g, x, 18 - h - 3, 2, 4, '#7a4a2a');
      }
    }
  }, full ? 31 : 32);
}

function mushroom () {
  return paint(10, 10, g => {
    rect(g, 4, 5, 3, 5, '#f1e3c8');
    blob(g, 5, 4, 4, 3, '#d9534f');
    rect(g, 3, 2, 1, 1, '#fff4ea');
    rect(g, 6, 3, 1, 1, '#fff4ea');
    rect(g, 4, 5, 1, 1, '#fff4ea');
  }, 41);
}

function tallgrass () {
  return paint(14, 13, (g, r) => {
    for (let k = 0; k < 9; k++) {
      let x = 2 + r() * 10;
      let y = 12;
      const h = 6 + r() * 6;
      const lean = (r() - .5) * .8;

      for (let i = 0; i < h; i++) {
        rect(g, x, y, 1, 1, i > h - 3 ? '#d8c48a' : pickOne(r, ['#6aaa52', '#86c262', '#5d9b52']));
        y--;
        x += lean * (i / h);
      }
    }
  }, 51);
}

function stump () {
  return paint(14, 10, g => {
    rect(g, 2, 3, 10, 7, '#8a5a34');
    rect(g, 2, 3, 2, 7, '#a06c3c');
    blob(g, 7, 3, 5, 2, '#c99a6a');
    blob(g, 7, 3, 2, 1, '#a77a4a');
  }, 61);
}

function wallSprite (kind: 'wood' | 'brick' | 'door', cap: boolean) {
  return paint(16, 24, g => {
    const top = kind === 'brick' ? '#d2c6b8' : '#c99258';
    const topLine = kind === 'brick' ? '#b9ab9b' : '#b07a44';

    if (cap) {
      rect(g, 0, 0, 16, 24, top);

      for (let y = 5; y < 24; y += 6) {
        rect(g, 0, y, 16, 1, topLine);
      }

      return;
    }

    rect(g, 0, 0, 16, 8, top);
    rect(g, 0, 7, 16, 1, topLine);

    if (kind === 'brick') {
      rect(g, 0, 8, 16, 16, '#dccbb8');

      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;

        for (let x = -off; x < 16; x += 8) {
          rect(g, x + 1, 8 + row * 4, 7, 3, row % 2 ? '#b0654a' : '#a65d44');
        }
      }
    } else {
      for (let x = 0; x < 16; x++) {
        rect(g, x, 8, 1, 16, x % 4 === 0 ? '#7d5230' : x % 4 === 1 ? '#b07842' : '#9d673a');
      }
    }

    if (kind === 'door') {
      rect(g, 3, 9, 10, 15, '#6e4628');
      rect(g, 4, 10, 8, 14, '#8e5a32');
      rect(g, 5, 12, 6, 4, '#7a4a28');
      rect(g, 5, 18, 6, 4, '#7a4a28');
      rect(g, 10, 16, 1, 2, '#f2d16b');
    }

    rect(g, 0, 23, 16, 1, '#5e3c22');
  }, 70, false);
}

function buildSprites (): Record<BuildId, Sprite> {
  return {
    woodFloor: woodFloor(),
    stonePath: stonePath(),
    bridge: bridge(),
    rug: paint(16, 14, g => {
      rect(g, 0, 1, 16, 12, '#e0b45a');
      rect(g, 1, 2, 14, 10, '#c0564f');
      rect(g, 3, 4, 10, 6, '#a8443e');
      rect(g, 7, 5, 2, 4, '#e0b45a');
      rect(g, 5, 6, 6, 2, '#e0b45a');
    }, 80),
    woodWall: wallSprite('wood', false),
    brickWall: wallSprite('brick', false),
    door: wallSprite('door', false),
    fence: paint(16, 14, g => {
      rect(g, 6, 2, 4, 12, PAL.wood);
      rect(g, 6, 2, 1, 12, PAL.woodLight);
      rect(g, 0, 5, 16, 2, PAL.wood);
      rect(g, 0, 10, 16, 2, PAL.wood);
    }, 81),
    gate: paint(16, 14, g => {
      rect(g, 0, 2, 2, 12, PAL.woodDark);
      rect(g, 14, 2, 2, 12, PAL.woodDark);
      rect(g, 3, 4, 10, 2, PAL.woodLight);
      rect(g, 3, 10, 10, 2, PAL.woodLight);
      rect(g, 4, 4, 2, 8, PAL.wood);
      rect(g, 10, 4, 2, 8, PAL.wood);
    }, 82),
    table: paint(16, 15, g => {
      rect(g, 0, 0, 16, 9, '#c99258');
      rect(g, 0, 0, 16, 1, '#ddb07a');
      rect(g, 0, 8, 16, 2, '#8a5a34');
      rect(g, 1, 10, 2, 5, '#7d5230');
      rect(g, 13, 10, 2, 5, '#7d5230');
      rect(g, 9, 2, 4, 4, '#f0ece0');
      rect(g, 13, 3, 1, 2, '#f0ece0');
      rect(g, 10, 2, 2, 1, '#7a4a28');
      rect(g, 3, 3, 3, 3, '#d9465a');
    }, 83),
    chair: paint(12, 16, g => {
      rect(g, 1, 0, 10, 8, '#a8743f');
      rect(g, 2, 1, 8, 5, '#c99258');
      rect(g, 0, 8, 12, 3, '#c99258');
      rect(g, 1, 11, 2, 5, '#7d5230');
      rect(g, 9, 11, 2, 5, '#7d5230');
    }, 84),
    bed: paint(16, 24, g => {
      rect(g, 0, 0, 16, 24, '#8a5a34');
      rect(g, 1, 1, 14, 22, '#a8743f');
      rect(g, 2, 2, 12, 6, '#f4f0e6');
      rect(g, 2, 7, 12, 1, '#d8d2c4');
      rect(g, 1, 9, 14, 13, '#5a8ad0');
      rect(g, 1, 9, 14, 2, '#7aa8e8');

      for (let x = 3; x < 14; x += 4) {
        rect(g, x, 13, 2, 2, '#9cc0f0');
        rect(g, x + 2, 17, 2, 2, '#9cc0f0');
      }
    }, 85),
    bookshelf: paint(16, 26, g => {
      rect(g, 0, 0, 16, 26, '#7d5230');
      rect(g, 1, 1, 14, 24, '#5e3c22');

      for (const y of [1, 9, 17]) {
        rect(g, 1, y + 7, 14, 1, '#a8743f');
        let x = 2;

        for (const c of ['#c0564f', '#5a8ad0', '#e0b45a', '#6aa25a', '#a06cc0']) {
          const w = 2 + (x % 2);
          rect(g, x, y + 1 + (x % 3), w, 6 - (x % 3), c);
          x += w + 0;

          if (x > 13) {
            break;
          }
        }
      }
    }, 86),
    jamShelf: paint(16, 22, g => {
      rect(g, 0, 0, 16, 22, '#7d5230');
      rect(g, 1, 1, 14, 20, '#5e3c22');

      for (const y of [2, 12]) {
        rect(g, 1, y + 8, 14, 1, '#a8743f');

        for (const x of [2, 7, 11]) {
          rect(g, x, y + 3, 3, 5, '#c0444f');
          rect(g, x, y + 2, 3, 1, '#f2d16b');
          rect(g, x, y + 4, 1, 2, '#ff8a9a');
        }
      }
    }, 87),
    bench: paint(16, 12, g => {
      rect(g, 0, 0, 16, 4, '#a8743f');
      rect(g, 0, 0, 16, 1, '#c99258');
      rect(g, 0, 5, 16, 3, '#c99258');
      rect(g, 1, 8, 2, 4, '#7d5230');
      rect(g, 13, 8, 2, 4, '#7d5230');
    }, 88),
    gardenBed: paint(16, 13, g => {
      rect(g, 0, 1, 16, 12, '#8a5a34');
      rect(g, 1, 2, 14, 10, '#5a3e2a');

      for (const y of [4, 8]) {
        rect(g, 2, y, 12, 1, '#4a3222');
      }

      rect(g, 0, 1, 16, 1, '#a8743f');
    }, 89),
    sapling: paint(10, 14, g => {
      rect(g, 4, 6, 2, 8, '#8a5a34');
      blob(g, 5, 4, 4, 3, PAL.leaf);
      rect(g, 3, 2, 2, 1, PAL.leafLight);
    }, 90),
    flowerPatch: paint(16, 12, (g, r) => {
      blob(g, 8, 8, 7, 3, '#5a3e2a');

      for (let i = 0; i < 6; i++) {
        const x = 2 + r() * 11;
        const y = 2 + r() * 6;
        const c = pickOne(r, ['#ec9ab3', '#f2d16b', '#f4f0e4', '#9ec0f0', '#c08ae0']);

        rect(g, x + 1, y + 2, 1, 3, '#3f7a3e');
        rect(g, x, y, 3, 2, c);
        rect(g, x + 1, y, 1, 1, '#f2d16b');
      }
    }, 91),
    scarecrow: paint(14, 26, g => {
      rect(g, 6, 8, 2, 18, '#7d5230');
      rect(g, 0, 11, 14, 2, '#7d5230');
      rect(g, 3, 10, 8, 9, '#c0564f');
      rect(g, 3, 13, 8, 1, '#a8443e');
      rect(g, 4, 3, 6, 7, '#e8d8b0');
      rect(g, 5, 5, 1, 1, '#2f2a2d');
      rect(g, 8, 5, 1, 1, '#2f2a2d');
      rect(g, 6, 7, 2, 1, '#2f2a2d');
      rect(g, 1, 2, 12, 2, '#e0c060');
      rect(g, 4, 0, 6, 2, '#e0c060');
    }, 92),
    well: paint(18, 24, g => {
      rect(g, 1, 0, 16, 4, '#c0564f');
      rect(g, 0, 3, 18, 2, '#a8443e');
      rect(g, 2, 5, 2, 9, '#7d5230');
      rect(g, 14, 5, 2, 9, '#7d5230');
      rect(g, 4, 8, 10, 1, '#5e3c22');
      rect(g, 8, 9, 2, 3, '#a8743f');
      blob(g, 9, 18, 8, 5, '#a5a39e');
      blob(g, 9, 17, 6, 3, '#3f86a3');
      rect(g, 4, 21, 3, 2, '#86847f');
      rect(g, 11, 21, 3, 2, '#86847f');
    }, 93),
    lantern: paint(8, 24, g => {
      rect(g, 3, 8, 2, 16, '#3d3a40');
      rect(g, 1, 22, 6, 2, '#3d3a40');
      rect(g, 1, 1, 6, 8, '#3d3a40');
      rect(g, 2, 2, 4, 5, '#ffe08a');
      rect(g, 3, 3, 2, 2, '#fff6d0');
      rect(g, 0, 0, 8, 2, '#2f2a2d');
    }, 94),
    campfire: paint(16, 10, g => {
      for (const [x, y] of [[0, 5], [3, 2], [7, 1], [11, 2], [13, 5], [10, 8], [4, 8]]) {
        rect(g, x, y, 3, 2, PAL.stone);
        rect(g, x, y, 3, 1, PAL.stoneLight);
      }

      rect(g, 4, 4, 8, 3, '#5e3c22');
      rect(g, 5, 4, 6, 1, '#8a5a34');
    }, 95),
    pumpkinLamp: paint(12, 11, g => {
      blob(g, 6, 6, 5, 4, '#e8873a');
      rect(g, 3, 3, 1, 6, '#c96d28');
      rect(g, 8, 3, 1, 6, '#c96d28');
      rect(g, 5, 0, 2, 3, '#4d8f47');
      rect(g, 3, 5, 2, 1, '#ffe08a');
      rect(g, 7, 5, 2, 1, '#ffe08a');
      rect(g, 4, 8, 4, 1, '#ffe08a');
    }, 96),
    mushroomLamp: paint(10, 14, g => {
      rect(g, 4, 6, 3, 8, '#f1e3c8');
      blob(g, 5, 4, 4, 3, '#4fb8a8');
      rect(g, 3, 2, 1, 1, '#c8fff4');
      rect(g, 6, 3, 1, 1, '#c8fff4');
      rect(g, 2, 4, 1, 1, '#c8fff4');
    }, 97),
    flowerPot: paint(10, 13, g => {
      rect(g, 2, 7, 6, 6, '#c0704a');
      rect(g, 1, 6, 8, 2, '#d4825a');
      rect(g, 4, 3, 1, 4, '#3f7a3e');
      rect(g, 2, 1, 3, 3, '#ec9ab3');
      rect(g, 5, 2, 3, 3, '#f2d16b');
      rect(g, 3, 2, 1, 1, '#f2d16b');
    }, 98),
    mailbox: paint(10, 18, g => {
      rect(g, 4, 8, 2, 10, '#7d5230');
      rect(g, 0, 2, 10, 7, '#5a8ad0');
      rect(g, 0, 2, 10, 2, '#7aa8e8');
      rect(g, 8, 0, 1, 5, '#d9465a');
      rect(g, 8, 0, 2, 2, '#d9465a');
      rect(g, 2, 5, 4, 1, '#3f5f90');
    }, 99)
  };
}

function cropSprite (crop: CropId, stage: number) {
  return paint(12, 12, g => {
    if (stage === 0) {
      rect(g, 5, 8, 1, 3, '#68aa58');
      rect(g, 4, 8, 1, 1, '#68aa58');
      rect(g, 6, 7, 1, 1, '#68aa58');

      return;
    }

    if (crop === 'carrot') {
      const h = stage === 1 ? 4 : 7;

      for (const x of [3, 5, 7]) {
        rect(g, x, 11 - h, 1, h, x === 5 ? '#4d8f47' : '#68aa58');
      }

      if (stage === 3) {
        rect(g, 4, 9, 4, 3, '#ef8a3a');
        rect(g, 4, 9, 4, 1, '#f6a65a');
      }

      return;
    }

    rect(g, 2, 9, 8, 1, '#4d8f47');
    rect(g, 3, 7, 2, 2, '#68aa58');
    rect(g, 7, 6, 2, 2, '#68aa58');

    if (stage >= 2) {
      blob(g, 6, 8, stage === 3 ? 4 : 2, stage === 3 ? 3 : 2, '#e8873a');
      rect(g, 5, 4, 2, 2, '#4d8f47');
    }
  }, 100 + stage);
}

function playerFrame (dir: Facing, frame: number) {
  return paint(14, 20, g => {
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const skin = '#f1c9a5';
    const eye = '#2b2222';
    const boot = '#3f6f8c';
    const hair = '#6a4a32';

    if (dir === 'side') {
      rect(g, 4 + step, 16, 3, 4, '#355f78');
      rect(g, 7 - step, 16, 3, 4, boot);
    } else {
      rect(g, 3, 16 - (step > 0 ? 1 : 0), 3, 4, boot);
      rect(g, 8, 16 - (step < 0 ? 1 : 0), 3, 4, boot);
    }

    rect(g, 2, 9, 10, 8, PAL.coat);
    rect(g, 2, 15, 10, 1, PAL.coatShade);
    rect(g, 10, 9, 2, 7, PAL.coatShade);

    if (dir === 'down') {
      rect(g, 6, 11, 1, 1, '#b07a2a');
      rect(g, 6, 13, 1, 1, '#b07a2a');
    }

    if (dir === 'side') {
      rect(g, 6 - step, 10, 3, 5, PAL.coatShade);
      rect(g, 6 - step, 15, 3, 1, skin);
    } else {
      rect(g, 0, 10 + (step > 0 ? 1 : 0), 2, 5, PAL.coat);
      rect(g, 12, 10 + (step < 0 ? 1 : 0), 2, 5, PAL.coatShade);
      rect(g, 0, 15 + (step > 0 ? 1 : 0), 2, 1, skin);
      rect(g, 12, 15 + (step < 0 ? 1 : 0), 2, 1, skin);
    }

    rect(g, 2, 1, 10, 9, PAL.coat);
    rect(g, 3, 0, 8, 1, PAL.coat);
    rect(g, 2, 8, 10, 1, PAL.coatShade);

    if (dir === 'down') {
      rect(g, 4, 3, 6, 5, skin);
      rect(g, 4, 3, 6, 1, hair);
      rect(g, 5, 5, 1, 2, eye);
      rect(g, 8, 5, 1, 2, eye);
      rect(g, 4, 7, 1, 1, '#f0a08a');
      rect(g, 9, 7, 1, 1, '#f0a08a');
    } else if (dir === 'side') {
      rect(g, 7, 3, 4, 5, skin);
      rect(g, 7, 3, 4, 1, hair);
      rect(g, 9, 5, 1, 2, eye);
      rect(g, 10, 7, 1, 1, '#f0a08a');
    } else {
      rect(g, 4, 3, 6, 5, PAL.coatShade);
    }
  }, 120 + frame);
}

function visitorFrames (id: VisitorId) {
  const frames: Sprite[] = [];

  for (let f = 0; f < 2; f++) {
    const up = f === 1 ? 1 : 0;

    frames.push(({
      cat: () => paint(15, 11, g => {
        rect(g, 1, 0 + up, 1, 6, '#e0904a');
        rect(g, 2, 4, 9, 5, '#e0904a');
        rect(g, 4, 4, 1, 4, '#c07030');
        rect(g, 7, 4, 1, 4, '#c07030');
        rect(g, 9, 1, 5, 5, '#e0904a');
        rect(g, 9, 0, 1, 2, '#e0904a');
        rect(g, 13, 0, 1, 2, '#e0904a');
        rect(g, 12, 3, 1, 1, '#2f2a2d');
        rect(g, 10, 5, 3, 1, '#f4f0e4');
        rect(g, 3, 9, 2, 2 - up, '#c07030');
        rect(g, 8, 9, 2, 1 + up, '#c07030');
      }, 140),
      duck: () => paint(12, 11, g => {
        rect(g, 1, 5, 9, 5, '#f4f1ea');
        rect(g, 0, 4, 3, 2, '#f4f1ea');
        rect(g, 6, 0 + up, 4, 6, '#f4f1ea');
        rect(g, 10, 2 + up, 2, 2, '#f2a03a');
        rect(g, 8, 1 + up, 1, 1, '#2f2a2d');
        rect(g, 3, 6, 4, 2, '#dcd8cc');
        rect(g, 4, 10, 1, 1, '#f2a03a');
        rect(g, 6, 10, 1, 1, '#f2a03a');
      }, 141),
      frog: () => paint(11, 8, g => {
        rect(g, 1, 3 - up, 9, 4, '#6ab04a');
        rect(g, 2, 1 - up, 3, 3, '#6ab04a');
        rect(g, 6, 1 - up, 3, 3, '#6ab04a');
        rect(g, 3, 2 - up, 1, 1, '#2f2a2d');
        rect(g, 7, 2 - up, 1, 1, '#2f2a2d');
        rect(g, 2, 5 - up, 7, 1, '#f2e6a0');
        rect(g, 0, 7, 3, 1, '#5a9a3e');
        rect(g, 8, 7, 3, 1, '#5a9a3e');
      }, 142),
      rabbit: () => paint(12, 12, g => {
        rect(g, 1, 6, 8, 5, '#d8c4a8');
        rect(g, 0, 7, 2, 2, '#f4f0e4');
        rect(g, 7, 3, 4, 5, '#d8c4a8');
        rect(g, 7, 0 + up, 1, 4, '#d8c4a8');
        rect(g, 9, 0 + up, 1, 4, '#d8c4a8');
        rect(g, 9, 4, 1, 1, '#2f2a2d');
        rect(g, 10, 6, 1, 1, '#e88a9a');
        rect(g, 2, 11, 2, 1, '#b8a488');
        rect(g, 6, 11, 2, 1, '#b8a488');
      }, 143),
      hedgehog: () => paint(12, 8, g => {
        blob(g, 5, 4, 5, 3, '#7a5a3a');

        for (let x = 1; x < 10; x += 2) {
          rect(g, x, 0 + (x % 4 === 1 ? 0 : 1), 1, 2, '#5a4028');
        }

        rect(g, 9, 4, 3, 3, '#e0c8a0');
        rect(g, 11, 5, 1, 1, '#2f2a2d');
        rect(g, 10, 4, 1, 1, '#2f2a2d');
        rect(g, 3, 7, 1, 1 - up, '#5a4028');
        rect(g, 7, 7, 1, up, '#5a4028');
      }, 144),
      owl: () => paint(10, 12, g => {
        rect(g, 1, 2, 8, 10, '#8a6a4a');
        rect(g, 1, 0, 2, 3, '#8a6a4a');
        rect(g, 7, 0, 2, 3, '#8a6a4a');
        rect(g, 2, 3, 3, 3, '#f4f0e4');
        rect(g, 5, 3, 3, 3, '#f4f0e4');
        rect(g, 3, 4, 1, 1 + up, '#2f2a2d');
        rect(g, 6, 4, 1, 1 + up, '#2f2a2d');
        rect(g, 4, 6, 2, 1, '#f2a03a');
        rect(g, 2, 7, 6, 4, '#c4a47a');
      }, 145),
      snail: () => paint(12, 8, g => {
        rect(g, 0, 6, 11, 2, '#e0d0b0');
        rect(g, 9 + up, 3, 2, 4, '#e0d0b0');
        rect(g, 9 + up, 1, 1, 2, '#e0d0b0');
        rect(g, 11, 1, 1, 2, '#e0d0b0');
        blob(g, 4, 3, 4, 3, '#c08a5a');
        rect(g, 4, 2, 2, 2, '#e8b07a');
        rect(g, 3, 3, 1, 1, '#8a5a34');
      }, 146)
    } satisfies Record<VisitorId, () => Sprite>)[id]());
  }

  return frames;
}

function icon (id: MaterialId) {
  return paint(16, 16, (g, r) => {
    switch (id) {
      case 'wood':
        rect(g, 1, 6, 13, 6, '#8a5a34');
        rect(g, 1, 6, 13, 1, '#a8743f');
        blob(g, 13, 9, 2, 3, '#d4a878');
        rect(g, 13, 9, 1, 1, '#a8743f');
        break;
      case 'stone':
        blob(g, 8, 9, 6, 4, PAL.stone);
        blob(g, 7, 8, 3, 2, PAL.stoneLight);
        break;
      case 'fiber':
        for (let k = 0; k < 6; k++) {
          rect(g, 4 + k, 2 + (k % 2), 1, 12, k % 2 ? '#86b25a' : '#6a9a4a');
        }

        rect(g, 3, 8, 9, 2, '#c99258');
        break;
      case 'petals':
        for (const [x, y, c] of [[4, 4, '#ec9ab3'], [9, 5, '#f2d16b'], [6, 9, '#f4f0e4']] as const) {
          blob(g, x, y, 2, 2, c);
        }

        break;
      case 'berries':
        for (const [x, y] of [[4, 7], [8, 6], [6, 10], [10, 10]]) {
          rect(g, x, y, 3, 3, '#d9465a');
          rect(g, x, y, 1, 1, '#ff9aa8');
        }

        rect(g, 7, 2, 1, 4, PAL.leaf);
        break;
      case 'mushroom':
        rect(g, 7, 8, 3, 6, '#f1e3c8');
        blob(g, 8, 6, 5, 3, '#d9534f');
        rect(g, 6, 5, 1, 1, '#fff4ea');
        rect(g, 10, 4, 1, 1, '#fff4ea');
        break;
      case 'seeds':
        blob(g, 8, 9, 5, 5, '#c9a46a');
        rect(g, 6, 3, 4, 2, '#a07c48');

        for (let k = 0; k < 4; k++) {
          rect(g, 5 + r() * 6, 7 + r() * 5, 1, 1, '#6e4a28');
        }

        break;
      case 'acorn':
        blob(g, 8, 10, 4, 4, '#b07a42');
        rect(g, 4, 5, 9, 3, '#7a4f2e');
        rect(g, 8, 3, 1, 2, '#5e3c22');
        break;
      case 'carrot':
        for (let k = 0; k < 8; k++) {
          rect(g, 4 + k, 5 + k, 3, 2, '#ef8a3a');
        }

        rect(g, 2, 2, 3, 3, PAL.leaf);
        rect(g, 4, 1, 2, 3, PAL.leafLight);
        break;
      case 'pumpkin':
        blob(g, 8, 9, 6, 5, '#e8873a');
        rect(g, 5, 5, 1, 9, '#c96d28');
        rect(g, 10, 5, 1, 9, '#c96d28');
        rect(g, 7, 2, 2, 3, PAL.leaf);
        break;
      case 'planks':
        rect(g, 1, 4, 14, 3, '#c99258');
        rect(g, 1, 8, 14, 3, '#b07a44');
        rect(g, 1, 12, 14, 2, '#c99258');
        rect(g, 1, 4, 14, 1, '#ddb07a');
        break;
      case 'brick':
        rect(g, 2, 5, 12, 7, '#b0654a');
        rect(g, 2, 5, 12, 1, '#c97a5c');
        rect(g, 2, 11, 12, 1, '#8a4a36');
        break;
      case 'cloth':
        rect(g, 2, 4, 12, 9, '#7aa8e8');
        rect(g, 2, 4, 12, 2, '#9cc0f0');
        rect(g, 2, 8, 12, 1, '#5a8ad0');
        break;
      case 'paint':
        rect(g, 3, 6, 10, 8, '#c4c2bd');
        rect(g, 3, 5, 10, 3, '#e98aa8');
        rect(g, 5, 8, 2, 3, '#e98aa8');
        rect(g, 7, 2, 2, 4, '#7d5230');
        break;
      case 'jam':
        rect(g, 4, 5, 8, 9, '#c0444f');
        rect(g, 4, 3, 8, 2, '#f2d16b');
        rect(g, 5, 7, 2, 4, '#ff8a9a');
        break;
    }
  }, 200 + id.length);
}

function toolIcon (id: ToolId) {
  return paint(16, 16, g => {
    for (let k = 0; k < 11; k++) {
      rect(g, 2 + k, 13 - k, 1, 1, k < 2 ? '#5e3c22' : '#a8743f');
      rect(g, 3 + k, 13 - k, 1, 1, k < 2 ? '#4e3826' : '#8a5a34');
    }

    if (id === 'axe') {
      rect(g, 8, 1, 5, 7, '#b9bcc4');
      rect(g, 12, 0, 3, 9, '#d8dbe2');
      rect(g, 14, 0, 1, 9, '#f4f6fa');
      rect(g, 8, 1, 1, 7, '#8e9199');
    } else if (id === 'pickaxe') {
      for (const [x, y] of [[4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 3], [11, 3], [12, 4], [13, 5], [13, 6], [14, 7], [14, 8]]) {
        rect(g, x, y, 1, 2, '#b9bcc4');
      }

      rect(g, 6, 1, 3, 1, '#f4f6fa');
      rect(g, 13, 5, 1, 2, '#f4f6fa');
    } else {
      for (const [x, y] of [[9, 1], [10, 0], [11, 0], [12, 0], [13, 1], [14, 2], [14, 3], [14, 4], [13, 5]]) {
        rect(g, x, y, 1, 2, '#b9bcc4');
      }

      rect(g, 11, 0, 2, 1, '#f4f6fa');
    }
  }, 300 + id.length);
}

const HELD = 11;
const HELD_GRIP: [number, number] = [1, 9];

const HELD_HEADS: Record<ToolId, { metal: [number, number][]; shine: [number, number][] }> = {
  axe: {
    metal: [[6, 3], [7, 2], [7, 3], [8, 3], [7, 4], [8, 4], [9, 4], [8, 5], [9, 5], [6, 1], [5, 2]],
    shine: [[9, 4], [9, 5], [8, 5]]
  },
  pickaxe: {
    metal: [[3, 1], [4, 1], [5, 1], [6, 2], [7, 3], [8, 4], [9, 5], [9, 6], [9, 7]],
    shine: [[5, 1], [6, 2]]
  },
  sickle: {
    metal: [[7, 3], [7, 2], [8, 1], [9, 1], [10, 2], [10, 3], [10, 4], [9, 5]],
    shine: [[8, 1], [9, 1]]
  }
};

function heldBase (id: ToolId) {
  const c = makeCanvas(HELD, HELD);
  const g = ctx2d(c);
  const handle: [number, number][] = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5], [6, 4]];

  handle.forEach(([x, y], i) => rect(g, x, y, 1, 1, i < 2 ? '#5e3c22' : '#a8743f'));

  for (const [x, y] of HELD_HEADS[id].metal) {
    rect(g, x, y, 1, 1, '#a9adb6');
  }

  for (const [x, y] of HELD_HEADS[id].shine) {
    rect(g, x, y, 1, 1, '#eef1f6');
  }

  return c;
}

function rotated (src: Sprite, quarterTurns: number) {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);

  g.translate(src.width / 2, src.height / 2);
  g.rotate(quarterTurns * Math.PI / 2);
  g.drawImage(src, -src.width / 2, -src.height / 2);

  return c;
}

function rotatePoint ([x, y]: [number, number], quarterTurns: number): [number, number] {
  const w = HELD - 1;

  if (quarterTurns === 1) {
    return [w - y, x];
  }

  if (quarterTurns === -1) {
    return [y, w - x];
  }

  return [x, y];
}

// Poses are exact quarter turns of one drawing, so every frame keeps the same crisp pixels and outline.
function heldTool (id: ToolId) {
  const base = heldBase(id);
  const turns = [-1, 0, 1];

  return {
    frames: turns.map(t => outline(rotated(base, t))),
    grips: turns.map(t => {
      const [x, y] = rotatePoint(HELD_GRIP, t);

      return [x + 1, y + 1] as [number, number];
    })
  };
}

function natureSprites (): Record<NatureId, Sprite[]> {
  return {
    tree: [1, 2, 3].map(tree),
    pine: [4, 5].map(pine),
    stump: [stump()],
    rock: [7, 8].map(rock),
    bush: [bush(true), bush(false)],
    flower: ['#ec9ab3', '#f2d16b', '#f4f0e4', '#9ec0f0', '#c08ae0'].map((c, i) => flower(c, 10 + i)),
    reeds: [reeds(true), reeds(false)],
    mushroom: [mushroom()],
    tallgrass: [tallgrass()],
    twig: [paint(12, 6, g => {
      for (let i = 0; i < 10; i++) {
        rect(g, 1 + i, 4 - i * .3, 1, 1, i % 3 ? '#8a5a34' : '#6e4628');
      }

      rect(g, 5, 1, 1, 2, '#8a5a34');
      rect(g, 4, 0, 1, 1, PAL.leafLight);
      rect(g, 9, 1, 1, 1, PAL.leaf);
    }, 62)],
    pebble: [paint(11, 6, g => {
      blob(g, 3, 3, 2, 2, PAL.stone);
      blob(g, 8, 4, 2, 1, PAL.stoneDark);
      rect(g, 2, 2, 2, 1, PAL.stoneLight);
    }, 63)]
  };
}

function buildArt () {
  const facings: Facing[] = ['down', 'up', 'side'];

  return {
    ground: [0, 1, 2, 3, 4].map(k => [0, 1, 2].map(v => groundTile(k, v))),
    nature: natureSprites(),
    builds: buildSprites(),
    caps: {
      woodWall: wallSprite('wood', true),
      brickWall: wallSprite('brick', true)
    },
    crops: {
      carrot: [0, 1, 2, 3].map(s => cropSprite('carrot', s)),
      pumpkin: [0, 1, 2, 3].map(s => cropSprite('pumpkin', s))
    } satisfies Record<CropId, Sprite[]>,
    player: Object.fromEntries(facings.map(d => [d, [0, 1, 2].map(f => playerFrame(d, f))])) as Record<Facing, Sprite[]>,
    visitors: {
      cat: visitorFrames('cat'),
      duck: visitorFrames('duck'),
      frog: visitorFrames('frog'),
      rabbit: visitorFrames('rabbit'),
      hedgehog: visitorFrames('hedgehog'),
      owl: visitorFrames('owl'),
      snail: visitorFrames('snail')
    } satisfies Record<VisitorId, Sprite[]>,
    tools: { axe: toolIcon('axe'), pickaxe: toolIcon('pickaxe'), sickle: toolIcon('sickle') } satisfies Record<ToolId, Sprite>,
    held: { axe: heldTool('axe'), pickaxe: heldTool('pickaxe'), sickle: heldTool('sickle') },
    icons: Object.fromEntries((['wood', 'stone', 'fiber', 'petals', 'berries', 'mushroom', 'seeds', 'acorn', 'carrot', 'pumpkin', 'planks', 'brick', 'cloth', 'paint', 'jam'] as MaterialId[]).map(id => [id, icon(id)])) as Record<MaterialId, Sprite>
  };
}

export const ART = buildArt();

const urlCache = new Map<string, string>();

export function materialIconUrl (id: MaterialId) {
  const key = `m:${id}`;

  if (!urlCache.has(key)) {
    urlCache.set(key, ART.icons[id].toDataURL());
  }

  return urlCache.get(key) ?? '';
}

export function buildIconUrl (id: BuildId) {
  const key = `b:${id}`;

  if (!urlCache.has(key)) {
    const c = makeCanvas(26, 26);
    const g = ctx2d(c);
    const sprite = ART.builds[id];

    if (id === 'woodFloor' || id === 'stonePath' || id === 'bridge') {
      g.drawImage(ART.ground[id === 'bridge' ? 4 : 0][0], 5, 5);
    }

    g.drawImage(sprite, Math.floor((26 - sprite.width) / 2), Math.max(0, 26 - sprite.height) - (sprite.height > 26 ? 0 : Math.floor((26 - sprite.height) / 2)), Math.min(sprite.width, 26), Math.min(sprite.height, 26));
    urlCache.set(key, c.toDataURL());
  }

  return urlCache.get(key) ?? '';
}

export function visitorIconUrl (id: VisitorId) {
  const key = `v:${id}`;

  if (!urlCache.has(key)) {
    urlCache.set(key, ART.visitors[id][0].toDataURL());
  }

  return urlCache.get(key) ?? '';
}

export function toolIconUrl (id: ToolId) {
  const key = `t:${id}`;

  if (!urlCache.has(key)) {
    urlCache.set(key, ART.tools[id].toDataURL());
  }

  return urlCache.get(key) ?? '';
}
