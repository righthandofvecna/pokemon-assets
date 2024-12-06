
import * as ptr2e from "./ptr2e.mjs";
import * as ptu from "./ptu.mjs";
import * as generic from "./generic.mjs";

export function register() {
  switch (game.system.id) {
    case "ptr2e":
      ptr2e.register();
      break;
    case "ptu":
      ptu.register();
      break;
    default:
      generic.register();
      break;
  }
}