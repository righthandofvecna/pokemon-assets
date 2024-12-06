import * as followMe from "./follow-me.mjs";
import * as primePerformance from "./prime-performance.mjs";

export function register() {
  followMe.register();
  primePerformance.register();
}