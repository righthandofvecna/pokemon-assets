
import { MODULENAME } from "./utils.mjs";

export function register() {
  if (!game.settings.get(MODULENAME, "preloadAssets")) return;
  Hooks.on("ready", ()=>{
    Sequencer.Preloader.preload([
      "modules/pokemon-assets/audio/bgs/reactions/surprise.mp3",
      "modules/pokemon-assets/audio/bgs/exit.mp3",
      "modules/pokemon-assets/audio/bgs/hit.mp3",
      "modules/pokemon-assets/audio/bgs/pokeball-throw.mp3",
      "modules/pokemon-assets/audio/bgs/field-move-rock-smash.mp3",
      "modules/pokemon-assets/audio/bgs/field-move-cut.mp3",
      "modules/pokemon-assets/audio/bgs/wall-bump.mp3",
    ]);
  });
}