
import * as token from "./token.mjs";
import * as tile from "./tile.mjs";
import * as movement from "./token-movement.mjs";

export function register() {
  token.register();
  tile.register();
  movement.register();
}
