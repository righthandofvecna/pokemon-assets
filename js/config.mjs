import { MODULENAME } from "./utils.mjs";


export function register() {
  CONFIG.Combat.fallbackTurnMarker = `modules/${MODULENAME}/img/ui/grey-pokeball.svg`;
}