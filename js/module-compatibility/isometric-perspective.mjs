
import { MODULENAME } from "../utils.mjs";

function isIsometricScene(scene) {
  return scene?.flags?.["isometric-perspective"]?.isometricEnabled;
}

function OnPreCreateToken(token) {
  const scene = token?.scene;
  if (!isIsometricScene(scene)) return;
  if (token?.flags?.["isometric-perspective"]?.offsetX !== undefined) return;

  // in isometric-perspective, X is the vertical axis
  token.updateSource({
    [`flags.isometric-perspective.offsetX`]: scene.grid.size / 2
  });
}

function OnPreCreateTile(tile, tileData) {
  const scene = tile?.parent;
  if (!isIsometricScene(scene)) return;
  if (!tileData?.flags?.[MODULENAME]) return;
  if (tileData?.flags?.["isometric-perspective"]?.offsetX !== undefined) return;

  // in isometric-perspective, X is the vertical axis
  tile.updateSource({
    [`flags.isometric-perspective.offsetX`]: scene.grid.size / 2,
    [`flags.isometric-perspective.scale`]: 0.88,
  });
  
}

export function register() {
  if (!game.modules.get("isometric-perspective")?.active) return;

  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateTile", OnPreCreateTile);
}

