import { MODULENAME, DGANAME } from "../utils.mjs";


import * as ptr2e from "./ptr2e.mjs";
import * as ptu from "./ptu.mjs";
import * as pokerole from "./pokerole.mjs";
import * as dnd5e from "./dnd5e.mjs";
import * as generic from "./generic.mjs";

export function register() {
  switch (game.system.id) {
    case "ptr2e":
      ptr2e.register();
      break;
    case "ptu":
      ptu.register();
      break;
    case "pokerole":
      pokerole.register();
      break;
    case "dnd5e":
      dnd5e.register();
      break;
  }
  generic.register();
}

export function registerAfterDependencies() {
  const MODULE = game.modules.get(MODULENAME);
  const DGA = game.modules.get(DGANAME);

  DGA.api.scripts.AwardItems = MODULE.api.scripts.AwardItems;
}