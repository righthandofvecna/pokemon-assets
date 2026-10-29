import { MODULENAME, DGANAME, DATNAME } from "../utils.mjs";


import * as ptr2e from "./ptr2e.mjs";
import * as ptu from "./ptu.mjs";
import * as pokerole from "./pokerole.mjs";
import * as dnd5e from "./dnd5e.mjs";
import * as generic from "./generic.mjs";

function gameSystem() {
  switch (game.system.id) {
    case "ptr2e":
      return ptr2e;
    case "ptu":
      return ptu;
    case "pokerole":
      return pokerole;
    case "dnd5e":
      return dnd5e;
    default:
      return null;
  }
}

export function register() {
  gameSystem()?.register?.();
  generic.register();
}

export function registerAfterDependencies() {
  const MODULE = game.modules.get(MODULENAME);
  const DGA = game.modules.get(DGANAME);
  const DAT = game.modules.get(DATNAME);

  DGA.api.scripts.AwardItems = MODULE.api.scripts.AwardItems;
  DAT.api.CanTokenMoveThrough = MODULE.api.logic.CanTokenMoveThrough;
}