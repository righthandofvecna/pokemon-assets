import * as followMe from "./follow-me.mjs";
import * as isometricPerspective from "./isometric-perspective.mjs";
import * as primePerformance from "./prime-performance.mjs";
import * as sequencer from "./sequencer.mjs";
import * as tokenizer from "./tokenizer.mjs";

export function register() {
  followMe.register();
  primePerformance.register();
  isometricPerspective.register();
  sequencer.register();
  tokenizer.register();
}