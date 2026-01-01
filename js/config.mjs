import { MODULENAME } from "./utils.mjs";

async function GamePause_prepareContext(wrapped, ...args) {
  const context = await wrapped(...args);
  context.icon = `modules/${MODULENAME}/img/ui/grey-pokeball.svg`;
  return context;
}

export function register() {
  CONFIG.Combat.fallbackTurnMarker = `modules/${MODULENAME}/img/ui/grey-pokeball.svg`;
  libWrapper.register(MODULENAME, "foundry.applications.ui.GamePause.prototype._prepareContext", GamePause_prepareContext, "WRAPPER");
}