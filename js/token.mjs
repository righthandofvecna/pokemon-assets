
import { SpritesheetGenerator } from "./spritesheets.mjs";

const WALK_SPEED = 4;
const RUN_SPEED = 8;
const RUN_DISTANCE = 5;
const SLIDE_SPEED = WALK_SPEED;


/**
 * Add the spritesheet settings to the token config page
 * @param {*} config 
 * @param {*} html 
 * @param {*} context 
 */
function OnRenderTokenConfig(config, html, context) {
  const form = $(html).find("form").get(0);

  let src = form.querySelector("[name='texture.src'] input[type='text']")?.value;
  let defaultSettings = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src] ?? {
    sheetstyle: "trainer",
    animationframes: 4,
  };

  const isPredefined = src in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS;
  const isSpritesheet = config.token.getFlag("pokemon-assets", "spritesheet") ?? isPredefined;
  const sheetStyle = config.token.getFlag("pokemon-assets", "sheetstyle") ?? defaultSettings.sheetstyle;
  const animationFrames = config.token.getFlag("pokemon-assets", "animationframes") ?? defaultSettings.animationframes;

  $(html).find("[name='texture.src']").before(`<label>Sheet</label><input type="checkbox" name="flags.pokemon-assets.spritesheet" ${isSpritesheet ? "checked" : ""}>`);
  // add control for what size
  const sheetSizeOptions = Object.entries(SpritesheetGenerator.SHEET_STYLES).reduce((allOptions, [val, label])=>{
    return allOptions + `<option value="${val}" ${sheetStyle === val ? "selected" : ""}>${label}</option>`;
  }, "");
  $(html).find("[name='texture.src']").closest(".form-group").after(`
    <div class="form-group spritesheet-config" ${!isPredefined && isSpritesheet ? '' : 'style="display: none"'}>
      <label>Sheet Style</label>
      <div class="form-fields">
        <select name="flags.pokemon-assets.sheetstyle">${sheetSizeOptions}</select>
        <label for="flags.pokemon-assets.animationframes" ${sheetStyle === "pmd" ? '' : 'style="display: none"'}>Frames</label>
        <input type="number" name="flags.pokemon-assets.animationframes" value="${animationFrames}" ${sheetStyle === "pmd" ? '' : 'hidden readonly'}>
      </div>
    </div>`);
  
  const updateDefaults = async function () {
    src = form.querySelector("[name='texture.src'] input[type='text']")?.value;
    const predefined = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src]
    defaultSettings = predefined ?? {
      sheetstyle: "trainer",
      animationframes: 4,
    };

    if (predefined) {
      $(html).find(".spritesheet-config").hide();
      $(html).find(`[name="flags.pokemon-assets.spritesheet"]`).prop("checked", true);
      $(html).find(`[name="flags.pokemon-assets.sheetstyle"]`).prop("hidden", true).prop("readonly", true).val(predefined.sheetstyle);
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`).prop("hidden", true).prop("readonly", true).val(predefined.animationframes);

      const texture = await getTexture(form);
      await updateAnchors(form, texture);
    } else if (form.querySelector("input[name='flags.pokemon-assets.spritesheet']")?.checked) {
      $(html).find(".spritesheet-config").show();
      $(html).find(`[name="flags.pokemon-assets.sheetstyle"]`)
        .prop("hidden", false)
        .prop("readonly", false)
        .val(defaultSettings.sheetstyle);
      let hideAnimationFrames = defaultSettings.sheetstyle === "trainer" || defaultSettings.sheetstyle === "trainer3";
      $(html).find(`[for="flags.pokemon-assets.animationframes"]`).toggle(!hideAnimationFrames);
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`)
        .prop("hidden", hideAnimationFrames)
        .prop("readonly", hideAnimationFrames)
        .val(defaultSettings.animationframes);
    } else {
      $(html).find(".spritesheet-config")
        .hide();
      $(html).find(`[name="flags.pokemon-assets.sheetstyle"]`)
        .prop("hidden", false)
        .prop("readonly", false)
        .val(defaultSettings.sheetstyle);
      let hideAnimationFrames = defaultSettings.sheetstyle === "trainer" || defaultSettings.sheetstyle === "trainer3";
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`)
        .prop("hidden", hideAnimationFrames)
        .prop("readonly", hideAnimationFrames)
        .val(defaultSettings.animationframes);
    }
  }

  const getTexture = async function (form) {
    // get the texture so this can be calculated
    const src = form.querySelector("[name='texture.src'] input[type='text']")?.value;
    if (!src) return;

    return await loadTexture(src, {fallback: CONST.DEFAULT_TOKEN});
  }

  const updateAnchors = async function (form, texture) {
    if (!form.querySelector("input[name='flags.pokemon-assets.spritesheet']")?.checked) return;

    const { width, height } = texture;
    if (!width || !height) return;

    const newSheetStyle = form.querySelector("select[name='flags.pokemon-assets.sheetstyle']")?.value ?? sheetStyle;
    const directions = (()=>{
      switch (newSheetStyle) {
        case "pmd": return 8;
        default: return 4;
      }
    })();
    const newAnimationFrames = parseInt(form.querySelector("input[name='flags.pokemon-assets.animationframes']")?.value) || 4;

    const ratio = (height / width) * (newAnimationFrames / directions);
    const scale = form.querySelector("input[name='scale']")?.value ?? 1;
    const anchorY = (()=>{
      switch (newSheetStyle) {
        case "pmd": return 0.5;
        default: return 1.02 + (0.5 / (-ratio * scale));
      }
    })();

    // set the fields
    form.querySelector("select[name='texture.fit']").value = "width";
    form.querySelector("input[name='texture.anchorX']").value = 0.5;
    form.querySelector("input[name='texture.anchorY']").value = Math.ceil(100 * anchorY) / 100;
  };

  //
  // listeners
  //

  const OnUpdateFilePicker = async function () {
    if (await updateDefaults()) return;

    const texture = await getTexture(form);
    await updateAnchors(form, texture);
  };

  $(html).find("[name='texture.src'] input[type='text']").on("change", OnUpdateFilePicker);
  // dumb workaround to listen on the filepicker button too
  $(html).find("[name='texture.src'] button").on("click", function () {
    const filePicker = $(this).closest("file-picker")?.get(0)?.picker;
    if (!filePicker) return;
    filePicker.callback = ((callback)=>{
      return function () {
        if (callback) callback(...arguments);
        OnUpdateFilePicker();
      }
    })(filePicker.callback);
  })

  // listen for the "spritesheet" toggle
  $(html).find("[name='flags.pokemon-assets.spritesheet']").on("change", async function () {
    if (await updateDefaults()) return;

    if (!form.querySelector("input[name='flags.pokemon-assets.spritesheet']")?.checked) {
      $(html).find(".spritesheet-config").hide();
    } else {
      $(html).find(".spritesheet-config").show();
    }

    const texture = await getTexture(form);
    await updateAnchors(form, texture);
  });

  $(html).find("[name='flags.pokemon-assets.sheetstyle']").on("change", async function () {
    const newSheetStyle = $(this).get(0).value ?? "trainer";
    if (newSheetStyle === "trainer") {
      $(html).find(`[for="flags.pokemon-assets.animationframes"]`).hide();
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`).prop("hidden", true).prop("readonly", true).val(4);
    } else if (newSheetStyle === "trainer3") {
      $(html).find(`[for="flags.pokemon-assets.animationframes"]`).hide();
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`).prop("hidden", true).prop("readonly", true).val(3);
    } else if (newSheetStyle === "pkmn") {
      $(html).find(`[for="flags.pokemon-assets.animationframes"]`).hide();
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`).prop("hidden", true).prop("readonly", true).val(2);
    } else if (newSheetStyle === "pmd") {
      $(html).find(`[for="flags.pokemon-assets.animationframes"]`).show();
      $(html).find(`[name="flags.pokemon-assets.animationframes"]`).prop("hidden", false).prop("readonly", false).val(4);
      // TODO: infer the right number for this?
    }
    const texture = await getTexture(form);
    await updateAnchors(form, texture);
  });

  $(html).find("[name='flags.pokemon-assets.animationframes']").on("change", async function () {
    const texture = await getTexture(form);
    await updateAnchors(form, texture);
  });

  // listen for the "scale" value
  $(html).find("[name='scale']").on("change", async function () {
    if (!form.querySelector("input[name='flags.pokemon-assets.spritesheet']")?.checked) return;
    const texture = await getTexture(form);
    await updateAnchors(form, texture);
  });
}

function OnUpdateToken(token, changes, metadata, user) {
  if (!changes?.texture?.src &&
    !changes?.flags?.["pokemon-assets"]?.sheetstyles &&
    !changes?.flags?.["pokemon-assets"]?.animationframes)
    return;

  const src = changes?.texture?.src ?? token?.texture?.src;
  if (!src) return;
  
  const tokenObj = token?.object;
  if (!tokenObj) return

  tokenObj.renderFlags.set({
    redraw: true
  });
  tokenObj.applyRenderFlags();
}


/* ------------------------------------------------------------------------- */



function OnPreUpdateToken(doc, change, options) {
  if (!doc.getFlag("pokemon-assets", "spritesheet")) return;
  
  const ox = doc.x ?? 0;
  const nx = change?.x ?? ox;
  const oy = doc.y ?? 0;
  const ny = change?.y ?? oy;

  const dx = nx - ox;
  const dy = ny - oy;
  if (dx !== 0 || dy !== 0) {
    change.rotation = getAngleFromDirection(getDirection(dx, dy));
  };

  const { sizeY } = game?.scenes?.active?.grid ?? { sizeX: 100, sizeY: 100 };

  // sort 
  change.sort = Math.floor(ny / sizeY);
}

function getDirection(dx, dy) {
  // normalized rounded dx, dy
  const nrdx = Math.sign(Math.round(dx / Math.abs(dy || dx || 1)));
  const nrdy = Math.sign(Math.round(dy / Math.abs(dx || dy || 1)));
  const result = Object.entries(SpritesheetGenerator.DIRECTIONS).find(([d, { x, y }])=>x === nrdx && y === nrdy)?.[0];
  return result ?? "down";
}

function getAngleFromDirection(d) {
  switch (d) {
    case "down": return 0;
    case "left": return 90;
    case "right": return 270;
    case "up": return 180;
    case "downleft": return 45;
    case "downright": return 315;
    case "upleft": return 135;
    case "upright": return 225;
  }
  return 0;
}

function getDirectionFromAngle(angle) {
  switch (Math.floor(((angle + 22.5) % 360) / 45)) {
    case 0: return "down";
    case 1: return "downleft";
    case 2: return "left";
    case 3: return "upleft";
    case 4: return "up";
    case 5: return "upright";
    case 6: return "right";
    case 7: return "downright";
  }
  return "down";
}


function OnCreateCombatant(combatant) {
  if (!combatant?.token?.getFlag("pokemon-assets", "spritesheet")) return;
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
    #textureKey;
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
      return this.document.getFlag("pokemon-assets", "spritesheet");
    }

    get sheetStyle() {
      return this.document.getFlag("pokemon-assets", "sheetstyle") ?? "trainer";
    }

    get animationFrames() {
      return this.document.getFlag("pokemon-assets", "animationframes") ?? 4;
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
      const genSpritesheetKey = SpritesheetGenerator.generateKey(this.document.texture.src, this.sheetStyle, this.animationFrames);
      if (this.#textures == null || this.#textureSrc !== this.document.texture.src || this.#textureKey !== genSpritesheetKey) {
        let texture;
        if ( this._original ) texture = this._original.texture?.clone();
        else texture = await loadTexture(this.document.texture.src, {fallback: CONST.DEFAULT_TOKEN});

        this.#textureSrc = this.document.texture.src;
        this.#textures = await game.modules.get("pokemon-assets").api.spritesheetGenerator.getTexturesForToken(this, texture);
        this.#textureKey = genSpritesheetKey;
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
      this.#direction = getDirectionFromAngle(this.document.rotation);
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
      const dx = (context?.to?.x ?? changed.x ?? 0) - (changed.x ?? context?.to?.x ?? 0);
      const dy = (context?.to?.y ?? changed.y ?? 0) - (changed.y ?? context?.to?.y ?? 0);
      if (dx != 0 || dy != 0) {
        if (this.document._spinning) { // spinning
          this.#index = 0;
          this.#direction = ["down", "right", "up", "left"][(~~((((changed.x ?? 0) / sizeX) + ((changed.y ?? 0) / sizeY)))) % 4];
        } else { // normal animation
          this.#direction = getDirection(dx, dy);
          // set the index
          const framesPerSquare = 2;
          const [ animStepX, animStepY ] = [ sizeX / framesPerSquare, sizeY / framesPerSquare ];
          const { x: ox, y: oy } = this.#animationData;
          const rdx = (changed.x ?? ox ?? 0) - (ox ?? 0);
          const rdy = (changed.y ?? oy ?? 0) - (oy ?? 0);
          const absDx = Math.abs(rdx / animStepX);
          const absDy = Math.abs(rdy / animStepY);
          const distDiagApprox = Math.max(absDx, absDy) + ( Math.min(absDx, absDy) / 2 ) + ( ox / animStepX) + ( oy / animStepY );
          this.#index = ~~( distDiagApprox % (this.#textures[this.#direction].length));
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
  Hooks.on("updateToken", OnUpdateToken);
  Hooks.on("preUpdateToken", OnPreUpdateToken);
  Hooks.on("createCombatant", OnCreateCombatant);
}