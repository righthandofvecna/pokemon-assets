
import * as token from "./token.mjs";
import * as movement from "./token-movement.mjs";

export function register() {
  token.register();
  movement.register();
}
