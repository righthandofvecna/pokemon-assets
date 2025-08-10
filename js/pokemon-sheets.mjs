import { default as SPRITESHEET_MAP } from "../data/spritesheetmap.js";
import { MODULENAME } from "./utils.mjs";


export class PokemonSheets {
  static CONFIGURED_SHEET_SETTINGS = SPRITESHEET_MAP;

  static getSheetSettings(src) {
    const direct = PokemonSheets.CONFIGURED_SHEET_SETTINGS[src];
    if (direct) return direct;
    // if it's in our homebrew folder, check there
    const homebrewPath = game.settings.get(MODULENAME, "homebrewSpritesheetFolder") + "/";
    if (src.startsWith(homebrewPath)) {
      const hss = game.settings.get(MODULENAME, "homebrewSpritesheetSettings")?.[src.substring(homebrewPath.length)];
      return hss;
    }
    
    // check indirectly
    for (const [key, value] of Object.entries(PokemonSheets.CONFIGURED_SHEET_SETTINGS)) {
      if (src.startsWith(key)) {
        const { images, ...flags } = value;
        // check the subimages
        const subimage = images[src.substring(key.length)];
        if (subimage) return {
          ...subimage,
          ...flags,
        };
      }
    }
  }

  static hasSheetSettings(src) {
    return !!PokemonSheets.getSheetSettings(src);
  }

  static allSheetKeys() {
    if (PokemonSheets._allSheetKeys) return PokemonSheets._allSheetKeys;
    PokemonSheets._allSheetKeys = new Set();
    // add all the core-defined sheet settings
    for (const [key, value] of Object.entries(PokemonSheets.CONFIGURED_SHEET_SETTINGS)) {
      if (value.images !== undefined) {
        for (const image of Object.keys(value.images)) {
          PokemonSheets._allSheetKeys.add(key + image);
        }
      } else {
        PokemonSheets._allSheetKeys.add(key);
      }
    }
    // add all the homebrew sheet settings
    const hp = game.settings.get(MODULENAME, "homebrewSpritesheetFolder")
    Object.keys(game.settings.get(MODULENAME, "homebrewSpritesheetSettings") ?? {}).map(k=>`${hp}/${k}`).forEach(k=>PokemonSheets._allSheetKeys.add(k));
    return PokemonSheets._allSheetKeys;
  }

  static getPokemon({ dex, shiny, gender, region, form}) {
    if (!dex) return { img: null, settings: null };
    const dexNum = parseInt(dex);
    if (isNaN(dexNum)) return { img: null, settings: null };
    const g = gender || "";
    const s = shiny ? "s" : "";
    const v = (()=>{
      if (form) return `_${form}`;
      if (region) return `_${region}`;
      return "";
    })();
    const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
    const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
    const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
    const dexString = `${dexNum}`.padStart(4, "0");
  
    const homebrewPath = game.settings.get(MODULENAME, "homebrewSpritesheetFolder") + "/";

    const allSheetKeys = PokemonSheets.allSheetKeys();

    // check if everything is populated!
    for (const testSrcSuffix of [
      `${g}${s}${v}.png`,
      `${s}${v}.png`,
      `${g}${v}.png`,
      `${v}.png`,
      // not the right variant, but do our best
      `${g}${s}.png`,
      `${s}.png`,
      `${g}.png`,
      `.png`,
    ]) {
      for (const testSrc of [
        `${homebrewPath}${dexNum}${testSrcSuffix}`,
        `${homebrewPath}${dexString}${testSrcSuffix}`,
        `${pmdPath}${dexString}${testSrcSuffix}`,
      ]) {
        if (allSheetKeys.has(testSrc)) {
          return { img: testSrc, settings: PokemonSheets.getSheetSettings(testSrc) };
        }
      }
    }
    return { img: null, settings: null };
  }
}


export function register() {
  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.PokemonSheets = PokemonSheets;
}