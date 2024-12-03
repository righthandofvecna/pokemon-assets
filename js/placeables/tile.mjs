import { MODULENAME } from "../utils.mjs";



async function OnRenderTileConfig(sheet, html, context) {
  const form = $(html).find("form").get(0) ?? config.form;
  const tile = sheet.object;

  // exit if the puzzle settings page already exists
  if (form.querySelector(`.sheet-tabs .item[data-tab="puzzle"]`)) return;

  $(form.querySelector(`.sheet-tabs`)).append(`<a class="item" data-tab="puzzle"><i class="fa-solid fa-puzzle-piece"></i> Puzzle</a>`);

  const { solid, cuttable, smashable, strengthable } = tile?.flags?.[MODULENAME] ?? {};

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
      <label>Movable by "Strength"</label>
      <div class="form-fields">
        <input type="checkbox" name="flags.${MODULENAME}.strengthable" ${strengthable ? "checked" : ""}>
      </div>
    </div>
  </div>`);
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
    canvas.edges.set(eid, new foundry.canvas.edges.Edge({x: polygon[pIdx + 0], y: polygon[pIdx + 1]}, {x: polygon[pIdx + 2], y: polygon[pIdx + 3]}, {
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
}

/** @inheritDoc */
function Tile_onDelete(wrapper, options, userId) {
  wrapper(options, userId);
  this.initializeEdges({deleted: true});
}


export function register() {
  CONFIG.Tile.objectClass.prototype.initializeEdges = Tile_initializeEdges;
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onCreate", Tile_onCreate, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onUpdate", Tile_onUpdate, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Tile.objectClass.prototype._onDelete", Tile_onDelete, "WRAPPER");

  Hooks.on("renderTileConfig", OnRenderTileConfig);
}