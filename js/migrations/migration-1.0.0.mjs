import { Migration } from './migration-base.mjs';
import { MODULENAME, DATNAME, DGANAME } from '../utils.mjs';

const DAT_TOKEN_FIELDS_TO_MIGRATE = [
  `spritesheet`,
  `sheetstyle`,
  `animationframes`,
  `separateidle`,
  `noidle`,
  `unlockedanchor`,
  `unlockedfit`,
  `dialogue`,
  `script`,
  `scriptGm`,
];

const DGA_TILE_FIELDS_TO_MIGRATE = [
  `solid`,
  `pushable`,
  `visibleDistance`,
  `script`,
  `scriptGm`,
];

const DGA_SCENE_FIELDS_TO_MIGRATE = [
  `diagonals`,
  `outOfCombat`,
];

const SHEET_STYLE_ALIASES = {
  trainer: "dlru",
  trainer3: "durlReduced",
  pkmn: "dlru",
  pmd: "eight",
  digimon: "diagonal",
};

const JUMP_RE = /game\.modules\.get\("pokemon-assets"\)\?\.api\?\.scripts\?\.HandleJumps\?\.\("(?<direction>.*)", \.\.\.arguments\);/i;
const SHOW_IMAGE_RE = /if \(arguments\.length < 4\) return;\n\n\/\/ only for the triggering user\nconst regionTrigger = arguments\[3\];\nif \(regionTrigger\.user !== game\.user\) return;\n\nconst \{ token \} = arguments\[3\]\?\.data;\nif \(!token \|\| !game\.modules\.get\("pokemon-assets"\)\?\.api\?\.scripts\?\.TokenHasDirection\(token, \[(?<directions>.*)\]\)\) return;\n\nawait game\.modules\.get\("pokemon-assets"\)\?\.api\?\.scripts\?\.Interact\(\);\nnew ImagePopout\("(?<img>.*)", \{ title: "(?<title>.*)" \}\)\.render\(true\);/im;


export class Migration_1_0_0 extends Migration {

  static MIGRATION_VERSION = "1.0.0";

  static checkPrereqs() {
    if (!game.modules.get(DATNAME)?.active) {
      return false;
    }
    if (!game.modules.get(DGANAME)?.active) {
      return false;
    }
    return true;
  }

  static async updateToken(token, tokenData) {
    tokenData.flags ??= {};
    for (const field of DAT_TOKEN_FIELDS_TO_MIGRATE) {
      if (tokenData.flags?.[MODULENAME]?.[field] !== undefined) {
        tokenData.flags[DATNAME] ??= {};
        tokenData.flags[DATNAME][field] = tokenData.flags[MODULENAME][field];
      }
    }
    if (tokenData.flags?.[DATNAME]?.sheetstyle && SHEET_STYLE_ALIASES[tokenData.flags[DATNAME].sheetstyle]) {
      tokenData.flags[DATNAME].sheetstyle = SHEET_STYLE_ALIASES[tokenData.flags[DATNAME].sheetstyle];
    }
    if (tokenData.flags?.[DGANAME]?.script) {
      const { signMessage } = game.modules.get(DGANAME).api.crypto;
      const signature = JSON.stringify(await signMessage(tokenData.flags[DGANAME].script));
      tokenData.flags[DGANAME] ??= {};
      tokenData.flags[DGANAME].signature = signature;
    }
    return tokenData;
  }

  static async updateActor(actor, actorData) {
    actorData.prototypeToken ??= {};
    actorData.prototypeToken.flags ??= {};
    for (const field of DAT_TOKEN_FIELDS_TO_MIGRATE) {
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

  static async updateTile(tile, tileData) {
    tileData.flags ??= {};
    for (const field of DGA_TILE_FIELDS_TO_MIGRATE) {
      if (tileData.flags?.[MODULENAME]?.[field] !== undefined) {
        tileData.flags[DGANAME] ??= {};
        tileData.flags[DGANAME][field] = tileData.flags[MODULENAME][field];
      }
    }
    if (tileData.flags?.[DGANAME]?.script) {
      const { signMessage } = game.modules.get(DGANAME).api.crypto;
      const signature = JSON.stringify(await signMessage(tileData.flags[DGANAME].script));
      tileData.flags[DGANAME] ??= {};
      tileData.flags[DGANAME].signature = signature;
    }
    return tileData;
  }

  static async updateRegionBehavior(regionBehavior, regionBehaviorData) {
    // replace script macros for Image Show and Jump
    const jumpMatch = JUMP_RE.exec(regionBehaviorData.system?.source ?? "");
    const showImageMatch = SHOW_IMAGE_RE.exec(regionBehaviorData.system?.source ?? "");
    if (regionBehaviorData.type == "executeScript" && jumpMatch) {
      const match = jumpMatch;
      const direction = match?.groups?.direction;
      await regionBehavior.update({
        "type": `${DGANAME}.oneWayJump`,
        "==system": {
          direction: direction,
        }
      });
      return null;
    }
    if (regionBehaviorData.type == "executeScript" && showImageMatch) {
      const match = showImageMatch;
      const img = match?.groups?.img;
      const title = match?.groups?.title;
      const directions = match?.groups?.directions.split(",").map(s => s.trim().substring(1, s.length - 1));

      if (!directions) {
        console.log("no directions", { regionBehaviorData, directions, img, showImageMatch })
        return null;
      }

      await regionBehavior.update({
        "type": `${DGANAME}.imageShow`,
        "==system": {
          imageSrc: img,
          title: title,
          directions: Object.fromEntries(directions.map(d => [d, true])),
        }
      });
      return null;
    }


    // otherwise update the flag for "interact" to DGA
    regionBehaviorData.flags ??= {};
    if (regionBehaviorData.flags?.[MODULENAME]?.hasTokenInteract !== undefined) {
      regionBehaviorData.flags[DGANAME] ??= {};
      regionBehaviorData.flags[DGANAME].hasTokenInteract = regionBehaviorData.flags[MODULENAME].hasTokenInteract;
    }
    return regionBehaviorData;
  }

  static async updateScene(scene, sceneData) {
    sceneData.flags ??= {};
    for (const field of DGA_SCENE_FIELDS_TO_MIGRATE) {
      if (sceneData.flags?.[MODULENAME]?.[field] !== undefined) {
        sceneData.flags[DGANAME] ??= {};
        sceneData.flags[DGANAME][field] = sceneData.flags[MODULENAME][field];
      }
    }
    return sceneData;
  }

  static async updateSettings() {
    game.settings.register(MODULENAME, "avoidBlur", { default: true, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "avoidBlur", game.settings.get(MODULENAME, "avoidBlur"));
    game.settings.register(MODULENAME, "enableFollow", { default: true, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "enableFollow", game.settings.get(MODULENAME, "enableFollow"));
    game.settings.register(MODULENAME, "persistedToolSettings", { default: {}, type: Object, scope: "world", config: false });
    game.settings.set(DGANAME, "persistedToolSettings", game.settings.get(MODULENAME, "persistedToolSettings"));
    game.settings.register(MODULENAME, "walkSpeed", { default: 4, type: Number, scope: "world", config: false });
    game.settings.set(DATNAME, "walkSpeed", game.settings.get(MODULENAME, "walkSpeed"));
    game.settings.register(MODULENAME, "runSpeed", { default: 8, type: Number, scope: "world", config: false });
    game.settings.set(DATNAME, "runSpeed", game.settings.get(MODULENAME, "runSpeed"));
    game.settings.register(MODULENAME, "runDistance", { default: 5, type: Number, scope: "world", config: false });
    game.settings.set(DATNAME, "runDistance", game.settings.get(MODULENAME, "runDistance"));
    game.settings.register(MODULENAME, "playIdleAnimations", { default: false, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "playIdleAnimations", game.settings.get(MODULENAME, "playIdleAnimations"));
    game.settings.register(MODULENAME, "idleAnimTimer", { default: 600, type: Number, scope: "world", config: false });
    game.settings.set(DATNAME, "idleAnimTimer", game.settings.get(MODULENAME, "idleAnimTimer"));
    game.settings.register(MODULENAME, "tokenCollision", { default: true, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "tokenCollision", game.settings.get(MODULENAME, "tokenCollision"));
    game.settings.register(MODULENAME, "tokenCollisionAllied", { default: false, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "tokenCollisionAllied", game.settings.get(MODULENAME, "tokenCollisionAllied"));
    game.settings.register(MODULENAME, "tokenCollisionHidden", { default: false, type: Boolean, scope: "world", config: false });
    game.settings.set(DATNAME, "tokenCollisionHidden", game.settings.get(MODULENAME, "tokenCollisionHidden"));
    game.settings.register(MODULENAME, "autoPlayAudio", { default: true, type: Boolean, scope: "world", config: false });
    game.settings.set(DGANAME, "autoPlayAudio", game.settings.get(MODULENAME, "autoPlayAudio"));
    game.settings.register(MODULENAME, "playInteractSound", { default: true, type: Boolean, scope: "world", config: false });
    game.settings.set(DGANAME, "playInteractSound", game.settings.get(MODULENAME, "playInteractSound"));
  }
}