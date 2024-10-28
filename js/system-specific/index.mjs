
import * as ptr2e from "./ptr2e.mjs";

export function register() {
  console.log("GAME SYSTEM ID", game.system.id)
  switch (game.system.id) {
    case "ptr2e":
      ptr2e.register();
      break;
  }
}