
import { SpritesheetGenerator } from "./spritesheets.mjs";

const WALK_SPEED = 4;
const RUN_SPEED = 8;
const RUN_DISTANCE = 5;
const SLIDE_SPEED = WALK_SPEED;


function OnRenderTokenConfig(config, html, context) {
  const isSpritesheet = config.token.getFlag("pokemon-assets", "tileset") ?? false;
  const sheetSize = config.token.getFlag("pokemon-assets", "sheetsize") ?? "trainer";
  $(html).find("[name='texture.src']").before(`<label>Sheet</label><input type="checkbox" name="flags.pokemon-assets.tileset" ${isSpritesheet ? "checked" : ""}>`);
  if (isSpritesheet) {
    // add control for what size
    const sheetSizeOptions = Object.entries(SpritesheetGenerator.SHEET_MODES).reduce((allOptions, [val, label])=>{
      return allOptions + `<option value="${val}" ${sheetSize === val ? "selected" : ""}>${label}</option>`;
    }, "");
    $(html).find("[name='texture.src']").closest(".form-group").after(`<div class="form-group"><label>Sheet Size</label><div class="form-group"><select name="flags.pokemon-assets.sheetsize">${sheetSizeOptions}</select></div></div>`);
  }

  $(html).find("[name='flags.pokemon-assets.tileset']").on("change", async function () {
    if (!this.checked) return;
    const form = $(html).find("form").get(0);

    // get the texture so this can be calculated
    const src = form.querySelector("[name='texture.src'] input[type='text']")?.value;
    if (!src) return;

    const texture = await loadTexture(src, {fallback: CONST.DEFAULT_TOKEN});
    if (!texture) return;
    const { width, height } = texture;
    if (!width || !height) return;

    const ratio = height / width;
    const anchorY = 1.02 + (0.5 / (-ratio));
    // TODO: adjust this math for non-trainer sizes

    // set the fields
    form.querySelector("select[name='texture.fit']").value = "width";
    form.querySelector("input[name='texture.anchorX']").value = 0.5;
    form.querySelector("input[name='texture.anchorY']").value = Math.ceil(100 * anchorY) / 100;
  })
}


function OnPreUpdateToken(doc, change, options) {
  if (!doc.getFlag("pokemon-assets", "tileset")) return;
  
  const ox = doc.x ?? 0;
  const nx = change?.x ?? ox;
  const oy = doc.y ?? 0;
  const ny = change?.y ?? oy;

  const dx = ox - nx;
  const dy = oy - ny;
  if (dx !== 0 || dy !== 0) {
    change.rotation = (()=>{
      if (Math.abs(dx) > Math.abs(dy)) { // horizontal
        if (dx > 0) {
          return 90;
        } else {
          return 270;
        }
      } else {
        if (dy > 0) {
          return 180;
        } else {
          return 0;
        }
      }
    })();
  };

  const { sizeY } = game?.scenes?.active?.grid ?? { sizeX: 100, sizeY: 100 };

  // sort 
  change.sort = Math.floor(ny / sizeY);
}


function OnCreateCombatant(combatant) {
  if (!combatant?.token?.getFlag("pokemon-assets", "tileset")) return;
  combatant.update({
    "img": combatant?.actor?.img ?? "icons/svg/mystery-man.svg",
  });
}


function PlaceablesLayer_getMovableObjects(wrapped, ids, includeLocked) {
  return wrapped(ids, includeLocked).filter(t=>includeLocked || !(t?.document?._sliding ?? false));
}


export function register() {
  class TilesetToken extends CONFIG.Token.objectClass {
    #index;
    #textures;
    #textureSrc;
    #direction;
    #animationData;
    #animationPromise;

    constructor(document) {
      super(document);
      this.#initialize();
    }

    #initialize() {
      this.#animationData = this._getAnimationData();
    }

    /** @override */
    clear() {
      super.clear();
      this.#index = 0;
      this.#textures = null;
      this.#textureSrc = null;
      this.#direction = "down";
    }

    get isTileset() {
      return this.document.getFlag("pokemon-assets", "tileset");
    }

    get allAnimationsPromise() {
      return this.#animationPromise;
    }

    /** @override 
     * Draw the effect icons for ActiveEffect documents which apply to the Token's Actor.
     * Called by {@link Token#drawEffects}.
     * @protected
     */
    async _drawEffects() {
      this.effects.renderable = false;

      // Clear Effects Container
      this.effects.removeChildren().forEach(c => c.destroy());
      this.effects.bg = this.effects.addChild(new PIXI.Graphics());
      this.effects.bg.zIndex = -1;
      this.effects.overlay = null;

      // Categorize effects
      const activeEffects = this.actor?.temporaryEffects || [];
      const overlayEffect = activeEffects.findLast(e => e.img && e.getFlag("core", "overlay"));

      // Draw effects
      const promises = [];
      const iconsDrawn = new Set();
      for ( const [i, effect] of activeEffects.entries() ) {
        if ( !effect.img ) continue;
        if ( effect.img === "systems/ptr2e/img/icons/effect_icon.webp" ) continue; // exclude default icons
        if ( iconsDrawn.has(effect.img) ) continue; // don't draw multiple copies
        iconsDrawn.add(effect.img);

        const promise = effect === overlayEffect
          ? this._drawOverlay(effect.img, effect.tint)
          : this._drawEffect(effect.img, effect.tint);
        promises.push(promise.then(e => {
          if ( e ) e.zIndex = i;
        }));
      }
      await Promise.allSettled(promises);

      this.effects.sortChildren();
      this.effects.renderable = true;
      this.renderFlags.set({refreshEffects: true});
    }

    /** @override */
    async _draw(options) {
      // check if this token has a tileset configured
      if (!this.isTileset) return super._draw(options);
      
      this.#cleanData();

      // Load token texture
      await this.playFromSpritesheet();
  
      // Draw the TokenMesh in the PrimaryCanvasGroup
      this.mesh = canvas.primary.addToken(this);
  
      // Initialize token ring
      // this.#initializeRing();
      // Can't do this...
  
      // Draw the border
      this.border ||= this.addChild(new PIXI.Graphics());
  
      // Draw the void of the TokenMesh
      if ( !this.voidMesh ) {
        this.voidMesh = this.addChild(new PIXI.Container());
        this.voidMesh.updateTransform = () => {};
        this.voidMesh.render = renderer => this.mesh?._renderVoid(renderer);
      }
  
      // Draw the detection filter of the TokenMesh
      if ( !this.detectionFilterMesh ) {
        this.detectionFilterMesh = this.addChild(new PIXI.Container());
        this.detectionFilterMesh.updateTransform = () => {};
        this.detectionFilterMesh.render = renderer => {
          if ( this.detectionFilter ) this._renderDetectionFilter(renderer);
        };
      }
  
      // Draw Token interface components
      this.bars ||= this.addChild(this.#drawAttributeBars());
      this.tooltip ||= this.addChild(this.#drawTooltip());
      this.effects ||= this.addChild(new PIXI.Container());
  
      this.target ||= this.addChild(new PIXI.Graphics());
      this.nameplate ||= this.addChild(this.#drawNameplate());
  
      // Add filter effects
      this._updateSpecialStatusFilterEffects();
  
      // Draw elements
      await this._drawEffects();
  
      // Initialize sources
      if ( !this.isPreview ) this.initializeSources();

    }

    async playFromSpritesheet() {
      if (this.#textures == null || this.#textureSrc !== this.document.texture.src) {
        let texture;
        if ( this._original ) texture = this._original.texture?.clone();
        else texture = await loadTexture(this.document.texture.src, {fallback: CONST.DEFAULT_TOKEN});

        const sheetType = this.document.getFlag("pokemon-assets", "sheetsize") ?? "trainer";

        this.#textureSrc = this.document.texture.src;
        this.#textures = await game.modules.get("pokemon-assets").api.spritesheetGenerator.getTextures(this.document.texture.src, texture, sheetType);
      }
      this.#updateDirection();
      this.texture = this.#textures[this.#direction][this.#index];
    }


    get direction() {
      return this.#direction;
    }

    set direction(value) {
      this.#direction = value;
      if (this.#textures != null) {
        this.texture = this.#textures[this.#direction][this.#index];
        if (this.mesh.texture != this.texture) {
          this.mesh.texture = this.texture;
          this.renderFlags.set({
            refreshMesh: true,
          });
        }
      }
    }

    _canDrag() {
      const scene = this?.document?.parent;
      if (!game.user.isGM && (scene.getFlag("pokemon-assets", "disableDrag") || (scene.getFlag("pokemon-assets", "outOfCombat") && this.inCombat)))
        return false;
      return super._canDrag();
    }

    /**
     * Apply initial sanitizations to the provided input data to ensure that a Token has valid required attributes.
     * Constrain the Token position to remain within the Canvas rectangle.
     */
    #cleanData() {
      const d = this.scene.dimensions;
      const {x: cx, y: cy} = this.getCenterPoint({x: 0, y: 0});
      this.document.x = Math.clamp(this.document.x, -cx, d.width - cx);
      this.document.y = Math.clamp(this.document.y, -cy, d.height - cy);
    }

    /* -------------------------------------------- */

    /**
     * Draw resource bars for the Token
     * @returns {PIXI.Container}
     */
    #drawAttributeBars() {
      const bars = new PIXI.Container();
      bars.bar1 = bars.addChild(new PIXI.Graphics());
      bars.bar2 = bars.addChild(new PIXI.Graphics());
      return bars;
    }

    /* -------------------------------------------- */

    /**
     * Draw the token's nameplate as a text object
     * @returns {PreciseText}    The Text object for the Token nameplate
     */
    #drawNameplate() {
      const nameplate = new PreciseText(this.document.name, this._getTextStyle());
      nameplate.anchor.set(0.5, 0);
      return nameplate;
    }

    /* -------------------------------------------- */

    /**
     * Draw a text tooltip for the token which can be used to display Elevation or a resource value
     * @returns {PreciseText}     The text object used to render the tooltip
     */
    #drawTooltip() {
      const tooltip = new PreciseText(this._getTooltipText(), this._getTextStyle());
      tooltip.anchor.set(0.5, 1);
      return tooltip;
    }

    #updateDirection() {
      switch (Math.floor(this.document.rotation / 90)) {
        case 0:
          this.#direction = "down";
          break;
        case 1:
          this.#direction = "left";
          break;
        case 2:
          this.#direction = "up";
          break;
        case 3:
          this.#direction = "right";
          break;
      }
    }

    /**
     * Refresh the rotation.
     * @protected
     */
    _refreshRotation() {
      if (!this.isTileset) return super._refreshRotation();

      this.mesh.angle = 0;
      this.#updateDirection();
      this.#index = 0;
      if (this.#textures != null) {
        this.texture = this.#textures[this.#direction][this.#index];
        if (this.mesh.texture != this.texture) {
          this.mesh.texture = this.texture;
          this.renderFlags.set({
            refreshMesh: true,
          });
        }
      }
    }

    /** @override */
    async animate(to, {duration, easing, movementSpeed, name, ontick, ...options}={}) {
      // const super_animate = super.animate;
      return this.#animationPromise = (async (p)=>{
        await p;
        if (this.isTileset) {
          // check what properties are being animated
          const updatedProperties = Object.keys(to);
  
          movementSpeed ??= (()=>{
            if (this.document._sliding) return SLIDE_SPEED;
            const { sizeX, sizeY } = game?.scenes?.active?.grid ?? { sizeX: 100, sizeY: 100 };
            const manhattan = (Math.abs((to.x ?? this.#animationData.x) - this.#animationData.x) / sizeX) + (Math.abs((to.y ?? this.#animationData.y) - this.#animationData.y) / sizeY);
            if (manhattan < RUN_DISTANCE) {
              return WALK_SPEED;
            }
            return RUN_SPEED;
          })();
  
          if (updatedProperties.length == 1 && updatedProperties.includes("rotation")) {
            // rotation should be instantaneous.
            duration = 0;
          }
        }
        return await super.animate(to, {duration, easing, movementSpeed, name, ontick, ...options}).then(()=>{
          this.#initialize();
        });
      })(this.#animationPromise);
    }

    /** @override */
    _getAnimationDuration(from, to, options) {
      if (!this.isTileset) return super._getAnimationDuration(from, to, options);

      // exclude rotation from animation duration calculations
      return super._getAnimationDuration({
        ...from,
        rotation: to.rotation,
      }, {
        ...to,
      }, options);
    }

    _onAnimationUpdate(changed, context) {
      const isRelevant = new Set(Object.keys(changed)).intersection(new Set(["x", "y", "rotation"])).size != 0;
      if (!isRelevant || !this.isTileset || this.#textures == null) return super._onAnimationUpdate(changed, context);

      // get tile size
      const { sizeX, sizeY } = game?.scenes?.active?.grid ?? { sizeX: 100, sizeY: 100 };

      // set the direction
      const dx = (changed.x ?? context?.to?.x ?? 0) - (context?.to?.x ?? changed.x ?? 0);
      const dy = (changed.y ?? context?.to?.y ?? 0) - (context?.to?.y ?? changed.y ?? 0);
      if (dx != 0 || dy != 0) {
        if (this.document._spinning) { // spinning
          this.#index = 0;
          this.#direction = ["down", "right", "up", "left"][(~~((((changed.x ?? 0) / sizeX) + ((changed.y ?? 0) / sizeY)))) % 4];
        } else if (Math.abs(dx) > Math.abs(dy)) { // horizontal
          if (dx > 0) {
            this.#direction = "left";
          } else {
            this.#direction = "right";
          }
          // set the index
          this.#index = ~~((2 * changed.x / sizeX) % (this.#textures[this.#direction].length));
        } else { // vertical
          if (dy > 0) {
            this.#direction = "up";
          } else {
            this.#direction = "down";
          }
          // set the index
          this.#index = ~~((2 * changed.y / sizeY) % (this.#textures[this.#direction].length));
        }

        // don't animate rotation while moving
        if (changed.rotation != undefined) {
          delete changed.rotation;
        }
      } else {
        this.#updateDirection();
        this.#index = 0;
      }

      if (this.document._sliding) { // slide with one leg out
        this.#index = Math.min(1, this.#textures[this.#direction].length);
      }

      const newTexture = this.#textures[this.#direction][this.#index];
      if (this.mesh.texture != newTexture) {
        this.mesh.texture = newTexture;
        this.renderFlags.set({
          refreshMesh: true,
        });
      }
      return super._onAnimationUpdate(changed, context);
    }
  };

  CONFIG.Token.objectClass = TilesetToken;

  libWrapper.register("pokemon-assets", "PlaceablesLayer.prototype._getMovableObjects", PlaceablesLayer_getMovableObjects, "WRAPPER");
  Hooks.on("renderTokenConfig", OnRenderTokenConfig);
  Hooks.on("preUpdateToken", OnPreUpdateToken);
  Hooks.on("createCombatant", OnCreateCombatant);
}