import { default as SPRITESHEET_MAP } from "../data/spritesheetmap.js";

export class SpritesheetGenerator {

  static SHEET_STYLES = {
    trainer: "4-directions (Trainer Overworld Style)",
    trainer3: "4-directions (Reduced Trainer Overworld Style)",
    pkmn: "4-directions (Pokemon Overworld Style)",
    pmd: "8-direction (Mystery Dungeon Style)",
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

  static CONFIGURED_SHEET_SETTINGS = SPRITESHEET_MAP;

  static getSheetSettings(src) {
    const direct = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src];
    if (direct) return direct;
    
    for (const [key, value] of Object.entries(SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS)) {
      if (src.startsWith(key)) {
        const { images, ...flags } = value;
        // check the subimages
        const subimage = images[src.substring(key.length)];
        if (subimage) return {
          ...subimage,
          ...flags,
        };
      }
    }
  }

  static hasSheetSettings(src) {
    return !!SpritesheetGenerator.getSheetSettings(src);
  }

  static allSheetKeys() {
    if (SpritesheetGenerator._allSheetKeys) return SpritesheetGenerator._allSheetKeys;
    SpritesheetGenerator._allSheetKeys = new Set();
    for (const [key, value] of Object.entries(SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS)) {
      if (value.images !== undefined) {
        for (const image of Object.keys(value.images)) {
          SpritesheetGenerator._allSheetKeys.add(key + image);
        }
      } else {
        SpritesheetGenerator._allSheetKeys.add(key);
      }
    }
    return SpritesheetGenerator._allSheetKeys;
  }


  spritesheets;

  constructor () {
    this.spritesheets = {};
  }

  static generateKey(src, mode, frames) {
    if (mode === "trainer3") frames = 3;
    return `${mode}-${frames}:${src}`;
  }

  async #getSpritesheet(src, texture, mode, frames) {
    const sheetKey = SpritesheetGenerator.generateKey(src, mode, frames);
    if (sheetKey in this.spritesheets) {
      if (this.spritesheets[sheetKey]?.baseTexture?.valid) return this.spritesheets[sheetKey];

      // remove the unloaded assets from the cache
      this.spritesheets[sheetKey]._frameKeys.forEach(t=>PIXI.Texture.removeFromCache(t));
    }

    if (mode === "trainer3") {
      // force this to be 3 for trainer3
      frames = 3;
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
        case "pmd": return [spritesheetSlicingInfo.meta.size.w / frames, spritesheetSlicingInfo.meta.size.h / 8];
        default:
        case "trainer": return [spritesheetSlicingInfo.meta.size.w / frames, spritesheetSlicingInfo.meta.size.h / 4];
      }
    })();

    if (mode === "pmd") {
      for (let c=0; c<frames; c++) {
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
          const key = `${sheetKey}-${direction}${c}`;

          spritesheetSlicingInfo.animations[direction].push(key);
          
          spritesheetSlicingInfo.frames[key] = {
            frame: { x: frameWidth * c, y: frameHeight * r, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight },
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          }
        }
      }
    } else if (mode === "trainer3") {
      for (let c=0; c<frames; c++) {
        for (let r=0; r<4; r++) {
          const direction = (()=>{
            switch (r) {
              case 0: return "down";
              case 1: return "up";
              case 2: return "right";
              case 3: return "left";
            }
          })();
          const key = `${src}-${direction}${c}`;

          spritesheetSlicingInfo.animations[direction].push(key);
          // handle the fact that this sheet doesn't have diagonals
          if (direction === "down") {
            spritesheetSlicingInfo.animations.downleft.push(key);
            spritesheetSlicingInfo.animations.downright.push(key);
          } else if (direction === "left") {
            spritesheetSlicingInfo.animations.upleft.push(key);
          } else if (direction === "right") {
            spritesheetSlicingInfo.animations.upright.push(key);
          }

          spritesheetSlicingInfo.frames[key] = {
            frame: { x: frameWidth * c, y: frameHeight * r, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight },
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          }
        }
      }

      // duplicate the first texture of each row
      for (const [k, anim] of Object.entries(spritesheetSlicingInfo.animations)) {
        spritesheetSlicingInfo.animations[k] = [anim[0], anim[1], anim[0], anim[2]];
      }
    } else {
      for (let c=0; c<frames; c++) {
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
          } else if (direction === "left") {
            spritesheetSlicingInfo.animations.upleft.push(key);
          } else if (direction === "right") {
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

    this.spritesheets[sheetKey] = spritesheet;
    return spritesheet;

  }

  async getTexture(src, texture, mode, frames, direction, index=0) {
    const spritesheet = await this.#getSpritesheet(src, texture, mode, frames);
    return spritesheet.animations[direction][index];
  }

  async getTextures(src, texture, mode, frames) {
    const spritesheet = await this.#getSpritesheet(src, texture, mode, frames);
    return spritesheet.animations;
  }

  async getTexturesForToken(tilesetToken, texture) {
    const spritesheet = await this.#getSpritesheet(
      tilesetToken.document.texture.src,
      texture,
      tilesetToken.sheetStyle,
      tilesetToken.animationFrames
    );
    spritesheet._registeredTokens ??= new Set();
    spritesheet._registeredTokens.add(tilesetToken);
    return spritesheet.animations;
  }
}


export function register() {
  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.spritesheetGenerator = new SpritesheetGenerator();
}