import { early_isGM } from "../utils.mjs";

export function register() {
  if (!early_isGM() || !game.modules.get("fvtt-perf-optim")?.active) return;
  Hooks.once("ready", ()=>{
    if (game.settings.get("fvtt-perf-optim", "token-bars-caching")) {
      ui.notifications.warn(`"Pokemon Assets": The "Token Bars Caching" setting in the "Prime Performance" module has been disabled for better compatibility. Please refresh the page.`);
      game.settings.set("fvtt-perf-optim", "token-bars-caching", false);
    };
  });
}