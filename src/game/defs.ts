export type MaterialId =
  | 'wood' | 'stone' | 'fiber' | 'petals' | 'berries' | 'mushroom' | 'seeds' | 'acorn'
  | 'carrot' | 'pumpkin' | 'planks' | 'brick' | 'cloth' | 'paint' | 'jam';

export type Cost = Partial<Record<MaterialId, number>>;

export const MATERIAL_ORDER: MaterialId[] = [
  'wood', 'stone', 'fiber', 'petals', 'berries', 'mushroom', 'seeds', 'acorn',
  'carrot', 'pumpkin', 'planks', 'brick', 'cloth', 'paint', 'jam'
];

export interface Recipe {
  out: MaterialId;
  n: number;
  cost: Cost;
}

export const RECIPES: Recipe[] = [
  { out: 'planks', n: 2, cost: { wood: 1 } },
  { out: 'brick', n: 1, cost: { stone: 2 } },
  { out: 'cloth', n: 1, cost: { fiber: 2 } },
  { out: 'paint', n: 1, cost: { petals: 2 } },
  { out: 'jam', n: 1, cost: { berries: 3 } }
];

export type ToolId = 'axe' | 'pickaxe' | 'sickle';

export interface ToolDef {
  cost: Cost;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  axe: { cost: { wood: 2, stone: 1 } },
  pickaxe: { cost: { wood: 2, stone: 2 } },
  sickle: { cost: { wood: 1, stone: 1 } }
};

export const TOOL_ORDER = Object.keys(TOOLS) as ToolId[];

export type NatureId = 'tree' | 'pine' | 'stump' | 'rock' | 'bush' | 'flower' | 'reeds' | 'mushroom' | 'tallgrass' | 'twig' | 'pebble';

export interface NatureDef {
  tool: ToolId | null;
  solid: boolean;
  work: number;
  drops: [MaterialId, number, number?][];
  after: NatureId | null;
  regrow: number;
  sound: 'chop' | 'stone' | 'pick';
}

export const NATURE: Record<NatureId, NatureDef> = {
  tree: { tool: 'axe', solid: true, work: .8, drops: [['wood', 3], ['acorn', 1, .45]], after: 'stump', regrow: 0, sound: 'chop' },
  pine: { tool: 'axe', solid: true, work: .8, drops: [['wood', 3]], after: 'stump', regrow: 0, sound: 'chop' },
  stump: { tool: 'axe', solid: true, work: .5, drops: [['wood', 1]], after: null, regrow: 0, sound: 'chop' },
  rock: { tool: 'pickaxe', solid: true, work: .7, drops: [['stone', 2]], after: null, regrow: 0, sound: 'stone' },
  bush: { tool: null, solid: true, work: .4, drops: [['berries', 2]], after: null, regrow: 90, sound: 'pick' },
  flower: { tool: null, solid: false, work: .25, drops: [['petals', 1]], after: null, regrow: 0, sound: 'pick' },
  reeds: { tool: 'sickle', solid: false, work: .4, drops: [['fiber', 2]], after: null, regrow: 80, sound: 'pick' },
  mushroom: { tool: null, solid: false, work: .25, drops: [['mushroom', 1]], after: null, regrow: 0, sound: 'pick' },
  tallgrass: { tool: 'sickle', solid: false, work: .3, drops: [['seeds', 1, .6], ['fiber', 1]], after: null, regrow: 0, sound: 'pick' },
  twig: { tool: null, solid: false, work: .2, drops: [['wood', 1]], after: null, regrow: 0, sound: 'pick' },
  pebble: { tool: null, solid: false, work: .2, drops: [['stone', 1]], after: null, regrow: 0, sound: 'pick' }
};

export type CropId = 'carrot' | 'pumpkin';

export type BuildCat = 'floor' | 'wall' | 'furniture' | 'garden' | 'light' | 'decor';

export const BUILD_CATS: BuildCat[] = ['floor', 'wall', 'furniture', 'garden', 'light', 'decor'];

export type BuildId =
  | 'woodFloor' | 'stonePath' | 'bridge' | 'rug'
  | 'woodWall' | 'brickWall' | 'door' | 'fence' | 'gate'
  | 'table' | 'chair' | 'bed' | 'bookshelf' | 'jamShelf' | 'bench'
  | 'gardenBed' | 'sapling' | 'flowerPatch' | 'scarecrow' | 'well'
  | 'lantern' | 'campfire' | 'pumpkinLamp' | 'mushroomLamp'
  | 'flowerPot' | 'mailbox';

export interface LightDef {
  r: number;
  i: number;
  warm: boolean;
}

export interface BuildDef {
  cat: BuildCat;
  cost: Cost;
  layer: 'floor' | 'obj';
  solid: boolean;
  water?: boolean;
  light?: LightDef;
}

export const BUILDS: Record<BuildId, BuildDef> = {
  woodFloor: { cat: 'floor', cost: { planks: 1 }, layer: 'floor', solid: false },
  stonePath: { cat: 'floor', cost: { stone: 1 }, layer: 'floor', solid: false },
  bridge: { cat: 'floor', cost: { planks: 2 }, layer: 'floor', solid: false, water: true },
  rug: { cat: 'floor', cost: { cloth: 2, paint: 1 }, layer: 'obj', solid: false },
  woodWall: { cat: 'wall', cost: { planks: 2 }, layer: 'obj', solid: true },
  brickWall: { cat: 'wall', cost: { brick: 2 }, layer: 'obj', solid: true },
  door: { cat: 'wall', cost: { planks: 3 }, layer: 'obj', solid: false },
  fence: { cat: 'wall', cost: { wood: 1 }, layer: 'obj', solid: true },
  gate: { cat: 'wall', cost: { wood: 2 }, layer: 'obj', solid: false },
  table: { cat: 'furniture', cost: { planks: 3 }, layer: 'obj', solid: true },
  chair: { cat: 'furniture', cost: { planks: 2 }, layer: 'obj', solid: true },
  bed: { cat: 'furniture', cost: { planks: 3, cloth: 2 }, layer: 'obj', solid: true },
  bookshelf: { cat: 'furniture', cost: { planks: 4 }, layer: 'obj', solid: true },
  jamShelf: { cat: 'furniture', cost: { planks: 2, jam: 2 }, layer: 'obj', solid: true },
  bench: { cat: 'furniture', cost: { planks: 3 }, layer: 'obj', solid: true },
  gardenBed: { cat: 'garden', cost: { planks: 2 }, layer: 'obj', solid: false },
  sapling: { cat: 'garden', cost: { acorn: 1 }, layer: 'obj', solid: false },
  flowerPatch: { cat: 'garden', cost: { petals: 3 }, layer: 'obj', solid: false },
  scarecrow: { cat: 'garden', cost: { wood: 2, cloth: 1 }, layer: 'obj', solid: true },
  well: { cat: 'garden', cost: { brick: 4, planks: 2 }, layer: 'obj', solid: true },
  lantern: { cat: 'light', cost: { planks: 1, brick: 1 }, layer: 'obj', solid: true, light: { r: 64, i: 13, warm: true } },
  campfire: { cat: 'light', cost: { stone: 3, wood: 2 }, layer: 'obj', solid: true, light: { r: 78, i: 14, warm: true } },
  pumpkinLamp: { cat: 'light', cost: { pumpkin: 1 }, layer: 'obj', solid: true, light: { r: 44, i: 11, warm: true } },
  mushroomLamp: { cat: 'light', cost: { mushroom: 2, planks: 1 }, layer: 'obj', solid: false, light: { r: 40, i: 10, warm: false } },
  flowerPot: { cat: 'decor', cost: { brick: 1, petals: 2 }, layer: 'obj', solid: true },
  mailbox: { cat: 'decor', cost: { planks: 2, paint: 1 }, layer: 'obj', solid: true }
};

export const BUILD_ORDER = Object.keys(BUILDS) as BuildId[];

export const WALLS: BuildId[] = ['woodWall', 'brickWall', 'door'];

export type VisitorId = 'cat' | 'duck' | 'frog' | 'rabbit' | 'hedgehog' | 'owl' | 'snail';

export interface VisitorDef {
  likes: BuildId[];
  speed: number;
  swims?: boolean;
  perch?: boolean;
}

export const VISITORS: Record<VisitorId, VisitorDef> = {
  cat: { likes: ['rug', 'bed'], speed: 26 },
  duck: { likes: ['bridge'], speed: 20, swims: true },
  frog: { likes: ['flowerPatch', 'well'], speed: 24, swims: true },
  rabbit: { likes: ['gardenBed'], speed: 32 },
  hedgehog: { likes: ['mushroomLamp', 'bench'], speed: 16 },
  owl: { likes: ['lantern', 'scarecrow'], speed: 0, perch: true },
  snail: { likes: ['stonePath', 'flowerPot'], speed: 6 }
};

export const VISITOR_ORDER = Object.keys(VISITORS) as VisitorId[];
