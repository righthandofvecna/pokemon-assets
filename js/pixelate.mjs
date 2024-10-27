function setStyle(wrapped, texture, glTexture) {
  if (texture.scaleMode === PIXI.SCALE_MODES.NEAREST || !texture?.resource?.src || texture.resource.src.endsWith(".svg")) {
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