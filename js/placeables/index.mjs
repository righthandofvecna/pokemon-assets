
import * as token from "./token.mjs";
import * as tokensLayer from "./tokens-layer.mjs";
import * as tile from "./tile.mjs";
import * as movement from "./token-movement.mjs";
import * as sceneRegions from "./scene-regions.mjs";

export function register() {
  tokensLayer.register();
  token.register();
  tile.register();
  movement.register();
  sceneRegions.register();
}
