
import { early_isGM, MODULENAME, DATNAME, DGANAME } from "./utils.mjs";

function OnUpdateCombat(tracker, delta) {
  if (!game.settings.get(MODULENAME, "playPokemonCryOnTurn") || delta.turn === undefined) return;

  const cry = game.modules.get("pokemon-assets").api.logic.ActorCry(tracker.combatant?.actor);
  if (!cry) return;
  const VolumeSettings = game.modules.get(DGANAME).api.VolumeSettings;

  new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .sound()
      .file(cry)
      .locally(true)
      .volume(VolumeSettings.getVolume("cry"))
      .async()
    .play();
}

export function register() {
  if (!early_isGM()) return;
  Hooks.on("updateCombat", OnUpdateCombat);
}

export function registerAfterDependencies() {
  const DGA = game.modules.get(DGANAME);
  DGA.api ??= {};
  DGA.api.SOUNDS = {
    ...(DGA.api.SOUNDS ?? {}),
    "modules/pokemon-assets/audio/bgs/a-button.mp3": "Default Interaction",
    "modules/pokemon-assets/audio/bgs/receive-item-bw.mp3": "Pick Up Item",
    "modules/pokemon-assets/audio/bgs/key-item-bw.mp3": "Pick Up Key Item",
  };

  DGA.defaults ??= {};
  DGA.defaults.bumpSound = `modules/${MODULENAME}/audio/bgs/wall-bump.mp3`;
  DGA.defaults.interactionSound = `modules/${MODULENAME}/audio/bgs/a-button.mp3`;
  DGA.defaults.pickupSound = `modules/${MODULENAME}/audio/bgs/receive-item-bw.mp3`;
  DGA.defaults.doorSound = `modules/${MODULENAME}/audio/bgs/exit.mp3`;
}