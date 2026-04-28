
import * as token from "./token.mjs";
import * as tokensLayer from "./tokens-layer.mjs";
import * as sceneRegions from "./scene-regions.mjs";

export function register() {
  token.register();
  sceneRegions.register();
}

export function registerAfterDependencies() {
  token.registerAfterDependencies();
  tokensLayer.registerAfterDependencies();
}
