import { MODULENAME } from "../utils.mjs";
import * as socket from "../socket.mjs";


/**
 * Simultaneously move multiple PlaceableObjects via keyboard movement offsets.
 * This executes a single database operation using Scene#updateEmbeddedDocuments.
 * @param {object} options                  Options which configure how multiple objects are moved
 * @param {-1|0|1} [options.dx=0]             Horizontal movement direction
 * @param {-1|0|1} [options.dy=0]             Vertical movement direction
 * @param {boolean} [options.rotate=false]    Rotate the placeable to direction instead of moving
 * @param {string[]} [options.ids]            An Array of object IDs to target for movement.
 *                                            The default is the IDs of controlled objects.
 * @param {boolean} [options.includeLocked=false] Move objects whose documents are locked?
 * @returns {Promise<PlaceableObject[]>}    An array of objects which were moved during the operation
 * @throws                                  An error if an explicitly provided id is not valid
 */
async function PlaceablesLayer_moveMany({dx=0, dy=0, rotate=false, ids, includeLocked=false}={}) {
  if ( ![-1, 0, 1].includes(dx) ) throw new Error("Invalid argument: dx must be -1, 0, or 1");
  if ( ![-1, 0, 1].includes(dy) ) throw new Error("Invalid argument: dy must be -1, 0, or 1");
  if ( !dx && !dy ) return [];
  if ( game.paused && !game.user.isGM ) {
    ui.notifications.warn("GAME.PausedWarning", {localize: true});
    return [];
  }

  // Identify the objects requested for movement
  const objects = this._getMovableObjects(ids, includeLocked);
  if ( !objects.length ) return objects;

  // Define rotation angles
  const rotationAngles = {
    square: [45, 135, 225, 315],
    hexR: [30, 150, 210, 330],
    hexQ: [60, 120, 240, 300]
  };

  // Determine the rotation angle
  let offsets = [dx, dy];
  let angle = 0;
  let angles = rotationAngles.square;
  const gridType = canvas.grid.type;
  if ( gridType >= CONST.GRID_TYPES.HEXODDQ ) angles = rotationAngles.hexQ;
  else if ( gridType >= CONST.GRID_TYPES.HEXODDR ) angles = rotationAngles.hexR;
  if (offsets.equals([0, 1])) angle = 0;
  else if (offsets.equals([-1, 1])) angle = angles[0];
  else if (offsets.equals([-1, 0])) angle = 90;
  else if (offsets.equals([-1, -1])) angle = angles[1];
  else if (offsets.equals([0, -1])) angle = 180;
  else if (offsets.equals([1, -1])) angle = angles[2];
  else if (offsets.equals([1, 0])) angle = 270;
  else if (offsets.equals([1, 1])) angle = angles[3];

  // Conceal any active HUD
  this.hud?.clear();

  let bumped = false;
  // Commit updates to the Scene
  const updateData = objects.map(obj => {
    let update = {_id: obj.id};
    if ( rotate ) update.rotation = angle;
    else {
      const shifted = obj._getShiftedPosition(...offsets);
      if (obj.x == shifted.x && obj.y == shifted.y) {
        // bumped!
        if (obj.document.getFlag("pokemon-assets", "spritesheet")) {
          update.rotation = angle;
          bumped ||= Math.round(obj.document.rotation / 45) == Math.round(angle / 45);
        } else {
          bumped = true;
        }
        if ( bumped && obj.document._pushing ) obj._tryPush?.(...offsets);
      } else {
        foundry.utils.mergeObject(update, shifted)
      }
    };
    return update;
  });
  await canvas.scene.updateEmbeddedDocuments(this.constructor.documentName, updateData);
  if (bumped && game.settings.get(MODULENAME, "playCollisionSound")) {
    await new Sequence({ moduleName: "pokemon-assets", softFail: true })
      .sound()
        .file(`modules/pokemon-assets/audio/bgs/wall-bump.mp3`)
        .locally(true)
        .async()
      .play();
  }
  return objects;
}

function TilesetToken_tryPush(dx, dy) {
  const shifted = Tile.prototype._getShiftedPosition.bind(this)(dx, dy);
  const collides = this.checkCollision(this.getCenterPoint(shifted), { mode: "closest" });
  console.log("collides", collides);
  if (!collides) return;
  const walls = collides.edges.filter(e=>e.object instanceof Wall);
  // check if we collided with a tile that can be pushed
  if (walls.size === 0) {
    const pushables = collides.edges.filter(e=>e.object instanceof Tile && e.object?.document?.flags?.[MODULENAME]?.pushable).map(e=>e.object);
    pushables.forEach(tile=>socket.current().executeAsGM("pushTile", tile?.document?.uuid, dx, dy))
  }
  // TODO: open unlocked doors??
}


function PlaceablesLayer_getMovableObjects(wrapped, ids, includeLocked) {
  return wrapped(ids, includeLocked).filter(t=>includeLocked || (t?.document?.movable ?? true));
}


function TokenDocument_lockMovement() {
  const lockId = foundry.utils.randomID();
  if (this._movementLocks === undefined)
    this._movementLocks = new Set();
  this._movementLocks.add(lockId);
  const thisToken = this;
  return function () {
    thisToken._movementLocks.delete(lockId);
  };
}


export function register() {
  libWrapper.register("pokemon-assets", "PlaceablesLayer.prototype.moveMany", PlaceablesLayer_moveMany, "OVERRIDE");
  libWrapper.register("pokemon-assets", "PlaceablesLayer.prototype._getMovableObjects", PlaceablesLayer_getMovableObjects, "WRAPPER");
  CONFIG.Token.documentClass.prototype.lockMovement = TokenDocument_lockMovement;
  CONFIG.Token.objectClass.prototype._tryPush = TilesetToken_tryPush;
}
