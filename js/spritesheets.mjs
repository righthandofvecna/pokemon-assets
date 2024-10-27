export class SpritesheetGenerator {

  static SHEET_MODES = {
    trainer: "4-direction, 4-frame (Trainer Overworld Style)",
    pkmn: "4-direction, 2-frame (Pokemon Overworld Style)",
    pmd: "8-direction, arbitrary-frame (Mystery Dungeon Style)",
  };

  static DIRECTIONS = {
    down:      { x:  0, y:  1 },
    left:      { x: -1, y:  0 },
    right:     { x:  1, y:  0 },
    up:        { x:  0, y: -1 },
    downleft:  { x: -1, y:  1 },
    downright: { x:  1, y:  1 },
    upleft:    { x: -1, y: -1 },
    upright:   { x:  1, y: -1 },
  };


  spritesheets;

  constructor () {
    this.spritesheets = {};
  }

  async #getSpritesheet(src, texture, mode) {
    if (src in this.spritesheets) {
      if (this.spritesheets[src]?.baseTexture?.valid) return this.spritesheets[src];

      // remove the unloaded assets from the cache
      this.spritesheets[src]._frameKeys.forEach(t=>PIXI.Texture.removeFromCache(t));
    }

    // build up spritesheet slicing info
    const spritesheetSlicingInfo = {
      meta: {
        image: src,
        format: 'RGBA8888',
        size: { w: texture.width, h: texture.height },
        scale: 1
      },
      frames: {},
      animations: Object.keys(SpritesheetGenerator.DIRECTIONS).reduce((a,d)=>({...a, [d]: []}), {}),
    }
    const [frameWidth, frameHeight] = (()=>{
      switch (mode) {
        case "pmd":
          // infer the number of frames from the height/width ratio by assuming they're square
          let height = spritesheetSlicingInfo.meta.size.h / 8;
          let estimatedFrames = Math.round(spritesheetSlicingInfo.meta.size.w / height);
          console.log(estimatedFrames, spritesheetSlicingInfo);
          return [spritesheetSlicingInfo.meta.size.w / estimatedFrames, height];
        default:
        case "trainer": return [spritesheetSlicingInfo.meta.size.w / 4, spritesheetSlicingInfo.meta.size.h / 4];
      }
    })();

    if (mode === "pmd") {
      for (let c=0; c<4; c++) {
        for (let r=0; r<8; r++) {
          const direction = (()=>{
            switch (r) {
              case 0: return "down";
              case 1: return "downright";
              case 2: return "right";
              case 3: return "upright";
              case 4: return "up";
              case 5: return "upleft";
              case 6: return "left";
              case 7: return "downleft";
            }
          })();
          const key = `${src}-${direction}${c}`;

          spritesheetSlicingInfo.animations[direction].push(key);
          // handle the fact that this sheet doesn't have diagonals
          if (direction === "down") {
            spritesheetSlicingInfo.animations.downleft.push(key);
            spritesheetSlicingInfo.animations.downright.push(key);
          } else if (direction === "up") {
            spritesheetSlicingInfo.animations.upleft.push(key);
            spritesheetSlicingInfo.animations.upright.push(key);
          }

          spritesheetSlicingInfo.frames[key] = {
            frame: { x: frameWidth * c, y: frameHeight * r, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight },
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          }
        }
      }
    } else {
      for (let c=0; c<4; c++) {
        for (let r=0; r<4; r++) {
          const direction = (()=>{
            switch (r) {
              case 0: return "down";
              case 1: return "left";
              case 2: return "right";
              case 3: return "up";
            }
          })();
          const key = `${src}-${direction}${c}`;

          spritesheetSlicingInfo.animations[direction].push(key);
          // handle the fact that this sheet doesn't have diagonals
          if (direction === "down") {
            spritesheetSlicingInfo.animations.downleft.push(key);
            spritesheetSlicingInfo.animations.downright.push(key);
          } else if (direction === "up") {
            spritesheetSlicingInfo.animations.upleft.push(key);
            spritesheetSlicingInfo.animations.upright.push(key);
          }

          spritesheetSlicingInfo.frames[key] = {
            frame: { x: frameWidth * c, y: frameHeight * r, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight },
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          }
        }
      }
    }

    const spritesheet = new PIXI.Spritesheet(texture, spritesheetSlicingInfo);
    // Generate all the Textures asynchronously
    await spritesheet.parse();

    this.spritesheets[src] = spritesheet;
    return spritesheet;

  }

  async getTexture(src, texture, mode, direction, index=0) {
    const spritesheet = await this.#getSpritesheet(src, texture, mode);
    return spritesheet.animations[direction][index];
  }

  async getTextures(src, texture, mode) {
    const spritesheet = await this.#getSpritesheet(src, texture, mode);
    return spritesheet.animations;
  }

}


export function register() {
  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.spritesheetGenerator = new SpritesheetGenerator();
}