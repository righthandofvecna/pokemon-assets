import * as barBrawl from "./bar-brawl.mjs";
import * as followMe from "./follow-me.mjs";
import * as isometricPerspective from "./isometric-perspective.mjs";
import * as primePerformance from "./prime-performance.mjs";
import * as sequencer from "./sequencer.mjs";
import * as tokenizer from "./tokenizer.mjs";
import * as ptr1eItemPiles from "./ptr1e-item-piles.mjs";
import * as ptr2eItemPiles from "./ptr2e-item-piles.mjs";
import * as monksSoundEnhancements from "./monks-sound-enhancements.mjs";

export function register() {
  barBrawl.register();
  followMe.register();
  primePerformance.register();
  isometricPerspective.register();
  sequencer.register();
  tokenizer.register();
  ptr1eItemPiles.register();
  ptr2eItemPiles.register();
  monksSoundEnhancements.register();
}
