import { Migration } from './migration-base.mjs';
import { MODULENAME, DATNAME } from '../utils.mjs';

const DAT_FIELDS_TO_MIGRATE = [
  `spritesheet`,
  `sheetstyle`,
  `animationframes`,
  `separateidle`,
  `noidle`,
  `unlockedanchor`,
  `unlockedfit`,
];

const SHEET_STYLE_ALIASES = {
  trainer: "dlru",
  trainer3: "durlReduced",
  pkmn: "dlru",
  pmd: "eight",
  digimon: "diagonal",
};


export class Migration_1_0_0 extends Migration {

  static MIGRATION_VERSION = "1.0.0";

  static async updateToken(token, tokenData) {
    console.log("Running Migration 1.0.0 for token", token.name);
    tokenData.flags ??= {};
    for (const field of DAT_FIELDS_TO_MIGRATE) {
      if (tokenData.flags?.[MODULENAME]?.[field] !== undefined) {
        tokenData.flags[DATNAME] ??= {};
        tokenData.flags[DATNAME][field] = tokenData.flags[MODULENAME][field];
      }
    }
    if (tokenData.flags?.[DATNAME]?.sheetstyle && SHEET_STYLE_ALIASES[tokenData.flags[DATNAME].sheetstyle]) {
      tokenData.flags[DATNAME].sheetstyle = SHEET_STYLE_ALIASES[tokenData.flags[DATNAME].sheetstyle];
    }
    return tokenData;
  }

  static async updateActor(actor, actorData) {
    actorData.prototypeToken ??= {};
    actorData.prototypeToken.flags ??= {};
    for (const field of DAT_FIELDS_TO_MIGRATE) {
      if (actorData.prototypeToken.flags?.[MODULENAME]?.[field] !== undefined) {
        actorData.prototypeToken.flags[DATNAME] ??= {};
        actorData.prototypeToken.flags[DATNAME][field] = actorData.prototypeToken.flags[MODULENAME][field];
      }
    }
    if (actorData.prototypeToken.flags?.[DATNAME]?.sheetstyle && SHEET_STYLE_ALIASES[actorData.prototypeToken.flags[DATNAME].sheetstyle]) {
      actorData.prototypeToken.flags[DATNAME].sheetstyle = SHEET_STYLE_ALIASES[actorData.prototypeToken.flags[DATNAME].sheetstyle];
    }
    return actorData;
  }
}