import { MODULENAME, listenFilepickerChange } from "../utils.mjs";
import { SOUNDS } from "../audio.mjs";
import { registerSocket } from "../socket.mjs";



async function OnRenderTileConfig(sheet, html, context) {
  const form = $(html).find("form").get(0) ?? sheet.form;
  const tile = sheet.object;

  // exit if the puzzle settings page already exists
  if (form.querySelector(`.sheet-tabs .item[data-tab="puzzle"]`)) return;

  $(form.querySelector(`.sheet-tabs`)).append(`<a class="item" data-tab="puzzle"><i class="fa-solid fa-puzzle-piece"></i> Puzzle</a>`);

  const { solid, cuttable, smashable, whirlpool, pushable, interactionSound, scriptGm, script } = tile?.flags?.[MODULENAME] ?? {};

  const isCustomSound = interactionSound && !Object.keys(SOUNDS).some(v=>v === interactionSound);

  const tabs = form.getElementsByClassName("tab");
  $(tabs[tabs.length-1]).after(`<div class="tab" data-tab="puzzle">
    <p class="notes">Additional attributes for controlling how the tile can be interacted with.</p>
    <div class="form-group">
      <label>Acts as a Wall</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.solid" ${solid ? "checked" : ""}>
      </div>
    </div>
    <div class="form-group">
      <label>Destroyed by "Rock Smash"</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.smashable" ${smashable ? "checked" : ""}>
      </div>
    </div>
    <div class="form-group">
      <label>Destroyed by "Cut"</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.cuttable" ${cuttable ? "checked" : ""}>
      </div>
    </div>
    <div class="form-group">
      <label>Destroyed by "Whirlpool"</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.whirlpool" ${whirlpool ? "checked" : ""}>
      </div>
    </div>
    <div class="form-group">
      <label>Movable by "Strength"</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.pushable" ${pushable ? "checked" : ""}>
      </div>
    </div>
    <div class="form-group">
      <label>Interaction Sound</label>
      <div class="form-fields">
        <select name="flags.${MODULENAME}.interactionSound">
          <option value="" default>None</option>
          ${Object.entries(SOUNDS).map(([k, v])=>`<option value="${k}" ${interactionSound === k ? "selected" : ""}>${v}</option>`).join("")}
          <option class="custom-interaction" value="${isCustomSound ? interactionSound : "custom"}" ${isCustomSound ? "selected" : ""}>Custom</option>
        </select>
      </div>
    </div>
    <div class="form-group custom-sound" ${isCustomSound ? "" : "style='display:none'"}>
      <label>Custom Interaction Sound</label>
      <div class="form-fields">
        <file-picker class="custom-interaction" type="audio" value="${isCustomSound ? (interactionSound ?? "") : ""}"></file-picker>
      </div>
    </div>
    <div class="form-group stacked">
      <label>Interaction Script</label>
      <label>Execute as GM? <input type="checkbox" name="flags.${MODULENAME}.scriptGm" ${scriptGm ? "checked" : ""}></label>
      <div class="form-fields">
        <textarea type="checkbox" name="flags.${MODULENAME}.script">${script ?? ""}</textarea>
      </div>
    </div>
  </div>`);

  const puzzleTab = $(form).find(".tab[data-tab=puzzle]");

  $(puzzleTab).find(`select[name="flags.${MODULENAME}.interactionSound"]`).on("change", function() {
    const custom = $(this).find("option.custom-interaction").get(0).value;
    const customInput = $(puzzleTab).find(`.custom-interaction[type=text], .custom-interaction [type=text]`).get(0);
    if (this.value === custom) {
      $(puzzleTab).find(`.custom-sound`).show();
      if (this.value == "custom") {
        customInput.value = "";
      } else {
        customInput.value = this.value;
      }
    } else {
      $(puzzleTab).find(`.custom-sound`).hide();
      customInput.value = "";
    }
  });

  listenFilepickerChange($(puzzleTab).find(`.custom-interaction`), function(value) {
    const custom = $(puzzleTab).find("option.custom-interaction").get(0);
    const select = $(puzzleTab).find(`select[name="flags.${MODULENAME}.interactionSound"]`).get(0);
    if (!value) {
      select.value = "custom";
    } else {
      custom.value = value;
    }
  });
}


function Tile_initializeEdges({deleted=false}={}) {
  // the tile has been deleted
  if ( deleted ) {
    [...canvas.edges.keys()].filter(k=>k.startsWith(`${this.id}_`)).forEach(eid=>canvas.edges.delete(eid));
    return;
  }

  if (!this?.document?.flags?.[MODULENAME]?.solid) return;

  const polygon = this?.bounds?.toPolygon()?.points;
  if (!polygon) return;
  polygon.push(polygon[0], polygon[1]);
  for (let e=0; e < 4; e++) {
    const eid = `${this.id}_${e}`;
    const pIdx = e * 2;
    canvas.edges.set(eid, new foundry.canvas.geometry.edges.Edge({x: polygon[pIdx + 0], y: polygon[pIdx + 1]}, {x: polygon[pIdx + 2], y: polygon[pIdx + 3]}, {
      id: eid,
      object: this,
      type: "wall",
      direction: CONST.WALL_DIRECTIONS.LEFT,
      light: CONST.WALL_SENSE_TYPES.NONE,
      sight: CONST.WALL_SENSE_TYPES.NONE,
      sound: CONST.WALL_SENSE_TYPES.NONE,
      move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
      threshold: {
        light: 0,
        sight: 0,
        sound: 0,
        attenuation: false,
      }
    }));
  }
}

/** @inheritDoc */
function Tile_onCreate(wrapper, data, options, userId) {
  wrapper(data, options, userId);
  this.initializeEdges();
}

/** @inheritDoc */
function Tile_onUpdate(wrapper, changed, options, userId) {
  wrapper(changed, options, userId);
  if ("flags" in changed && MODULENAME in changed.flags) {
    this.initializeEdges({ deleted: !(changed?.flags[MODULENAME]?.solid ?? this?.document?.flags[MODULENAME]?.solid) });
  } else if ("x" in changed || "y" in changed || "width" in changed || "height" in changed) {
    this.initializeEdges();
  }

  if (("x" in changed || "y" in changed) && options.animate === true) {
    this.animate({ x: changed.x ?? this.x, y: changed.y ?? this.y }, options.animation);
  }
}

/** @inheritDoc */
function Tile_onDelete(wrapper, options, userId) {
  wrapper(options, userId);
  this.initializeEdges({deleted: true});
}

async function PushTile(tileUuid, dx, dy) {
  const tile = await fromUuid(tileUuid);
  if (!tile) return;
  // check if the tile is pushable
  if (!tile?.flags?.[MODULENAME]?.pushable) return;
  // try pushing the tile
  const shifted = tile.object._getShiftedPosition(dx, dy);
  if (shifted.x !== tile.x || shifted.y !== tile.y) {
    await tile.update(shifted, { animate: true, animation: { easing: "easeOutExpo", duration: 600 } });
  }
}

function Tile_getShiftedPosition(wrapped, dx, dy) {
  const shifted = wrapped(dx, dy);
  if (!this.document?.flags?.[MODULENAME]?.pushable) return shifted;

  const origin = this.center;
  const delta = { x: origin.x - this.document._source.x, y: origin.y - this.document._source.y };
  const source = new foundry.canvas.sources.PointMovementSource({object: this});
  source.initialize({x: origin.x, y: origin.y, elevation: this.document.elevation});
  const collides = CONFIG.Canvas.polygonBackends.move.testCollision(origin, {x: shifted.x + delta.x, y: shifted.y + delta.y }, {type: "move", mode: "any", source});
  return collides ? {x: this.document._source.x, y: this.document._source.y} : shifted;
}

async function Tile_animate(to, { duration, easing, name, ontick, ...options }={}) {
  // restrict "to" to x and y
  to = { x: to.x, y: to.y };
  
  this._animating = true;
  const animationData = { x: this.x, y: this.y };
  const priorAnimationData = foundry.utils.deepClone(animationData);
  const animateFrame = (context) => {
    if ( context.time >= context.duration ) foundry.utils.mergeObject(animationData, context.to);
    const changes = foundry.utils.diffObject(priorAnimationData, animationData);
    foundry.utils.mergeObject(priorAnimationData, animationData);
    foundry.utils.mergeObject(this.document, animationData, {insertKeys: false});
    const positionChanged = ("x" in changes) || ("y" in changes);
    this.renderFlags.set({
      refreshPosition: positionChanged,
    });
  };

  let context = {};
  context.to = to;

  const changes = foundry.utils.diffObject(animationData, to);
  const attributes = [...Object.keys(changes)].map(k=>({ attribute: k, parent: animationData, to: changes[k] }));

  duration ??= 100;
  animateFrame(context);
  // Dispatch the animation
  context.promise = CanvasAnimation.animate(attributes, {
    name: "move",
    context: this,
    duration,
    easing,
    priority: PIXI.UPDATE_PRIORITY.OBJECTS + 1, // Before perception updates and Token render flags
    ontick: (dt, anim) => {
      context.time = anim.time;
      if ( ontick ) ontick(dt, anim, animationData);
      animateFrame(context);
    }
  });
  await context.promise.finally(() => {
    this._animating = false;
  });
}


export function register() {
  CONFIG.Tile.objectClass.prototype.initializeEdges = Tile_initializeEdges;
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onCreate", Tile_onCreate, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onUpdate", Tile_onUpdate, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onDelete", Tile_onDelete, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._getShiftedPosition", Tile_getShiftedPosition, "WRAPPER");
  CONFIG.Tile.objectClass.prototype.animate = Tile_animate;

  Hooks.on("renderTileConfig", OnRenderTileConfig);
  registerSocket("pushTile", PushTile);
}