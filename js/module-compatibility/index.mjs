import * as barBrawl from "./bar-brawl.mjs";
import * as isometricPerspective from "./isometric-perspective.mjs";
import * as primePerformance from "./prime-performance.mjs";
import * as sequencer from "./sequencer.mjs";
import * as tokenizer from "./tokenizer.mjs";
import * as ptr1eItemPiles from "./ptr1e-item-piles.mjs";
import * as ptr2eItemPiles from "./ptr2e-item-piles.mjs";
import * as monksSoundEnhancements from "./monks-sound-enhancements.mjs";
import * as dylansModules from "./dylans-modules.mjs";

const submodules = [
  barBrawl,
  isometricPerspective,
  primePerformance,
  sequencer,
  tokenizer,
  ptr1eItemPiles,
  ptr2eItemPiles,
  monksSoundEnhancements,
  dylansModules,
];

export function register() {
  for (const submodule of submodules) {
    submodule?.register?.();
  }
}

export function registerAfterDependencies() {
  for (const submodule of submodules) {
    submodule?.registerAfterDependencies?.();
  }
}