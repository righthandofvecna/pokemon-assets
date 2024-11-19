import { MODULENAME } from "./utils.mjs";

function setStyle(wrapped, texture, glTexture) {
  if (!game.settings.get(MODULENAME, "avoidBlur") || texture.scaleMode === PIXI.SCALE_MODES.NEAREST || !texture?.resource?.src || texture.resource.src.endsWith(".svg")) {
    return wrapped(texture, glTexture);
  };
  return wrapped({
    ...texture,
    scaleMode: PIXI.SCALE_MODES.NEAREST,
  }, glTexture);
}


export function register() {
  libWrapper.register("pokemon-assets", "PIXI.TextureSystem.prototype.setStyle", setStyle, "WRAPPER");
};