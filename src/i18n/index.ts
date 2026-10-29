import { settings } from '../game/settings';
import type { Locale } from '../game/settings';
import type { BuildCat, BuildId, CropId, MaterialId, NatureId, ToolId, VisitorId } from '../game/defs';
import { en } from './en';
import { ru } from './ru';
import type { Dictionary, MessageKey } from './ru';
import { th } from './th';
import { zh } from './zh';

export type { MessageKey } from './ru';

export type Params = Record<string, string | number>;

const DICTS: Record<Locale, Dictionary> = { ru, en, zh, th };

export function t (key: MessageKey, params?: Params) {
  const text: string = DICTS[settings.locale][key] ?? ru[key];

  if (!params) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match);
}

export const matName = (id: MaterialId) => t(`material.${id}`);
export const toolName = (id: ToolId) => t(`tool.${id}`);
export const toolNote = (id: ToolId) => t(`tool.${id}.note`);
export const toolNeed = (id: ToolId) => t(`tool.${id}.need`);
export const natureName = (id: NatureId) => t(`nature.${id}`);
export const natureGives = (id: NatureId) => t(`nature.${id}.gives`);
export const buildName = (id: BuildId) => t(`build.${id}`);
export const cropName = (id: CropId) => t(`crop.${id}`);
export const catName = (id: BuildCat) => t(`cat.${id}`);
export const visitorName = (id: VisitorId) => t(`visitor.${id}`);
export const visitorLikes = (id: VisitorId) => t(`visitor.${id}.likes`);
export const visitorArrive = (id: VisitorId) => t(`visitor.${id}.arrive`);
export const recipeUse = (id: MaterialId) => t(`recipe.${id}` as MessageKey);

export function buildNote (id: BuildId) {
  const key = `build.${id}.note`;

  return key in ru ? t(key as MessageKey) : '';
}
