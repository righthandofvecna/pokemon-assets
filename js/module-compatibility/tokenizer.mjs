import { early_isGM } from "../utils.mjs";

export function register() {
  if (game.modules.get("vtta-tokenizer")?.active) {
    if (early_isGM()) {
      Hooks.on("ready", ()=>ui.notifications.warn(`The "Tokenizer" module makes setting spritesheets for the "Pokemon Assets" module difficult. It is recommended to disable "Tokenizer".`));
    }
    return;
  }
};
