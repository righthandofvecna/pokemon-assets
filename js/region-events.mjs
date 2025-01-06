
import { MODULENAME, sleep, isFacing } from "./utils.mjs";
import * as socket from "./socket.mjs";


function RegionBehaviorConfig_getFields(wrapped) {
  const fieldsets = wrapped();
  const eventFieldSet = fieldsets.find(fs=>fs.legend === "BEHAVIOR.TYPES.base.SECTIONS.events");
  if (eventFieldSet) {
    const eventField = eventFieldSet.fields[0];
    const doc = this.document;
    const hasTokenInteract = doc.getFlag(MODULENAME, "hasTokenInteract");
    if (hasTokenInteract) {
      eventField.value = [...eventField.value, "tokenInteract"];
    }
    eventField.field = foundry.utils.deepClone(eventField.field);
    eventField.field.element.choices.tokenInteract = "Token Interact";
  }
  return fieldsets;
}

function RegionBehaviorConfig_prepareSubmitData(wrapped, event, form, formData) {
  const submitData = wrapped(event, form, formData);
  submitData.flags ??= {};
  submitData.flags[MODULENAME] ??= {};
  if (submitData?.system?.events?.includes("tokenInteract")) {
    submitData.system.events.splice(submitData.system.events.indexOf("tokenInteract"));
    submitData.flags[MODULENAME].hasTokenInteract = true;
  } else {
    submitData.flags[MODULENAME].hasTokenInteract = false;
  }
  return submitData;
}

/**
   * Handle the Region event.
   * @param {RegionEvent} event    The Region event
   * @returns {Promise<void>}
   * @internal
   */
async function RegionBehavior_handleRegionEvent(wrapped, event) {
  await wrapped(event);
  const system = this.system;
  if ( !(system instanceof foundry.data.regionBehaviors.RegionBehaviorType) ) return;
  if (event.name !== "tokenInteract" || !this.getFlag(MODULENAME, "hasTokenInteract")) return;
  await system._handleRegionEvent(event);
}

/**
 * 
 * @param {object} a the thing that has the rotation
 * @param {number} a.x
 * @param {number} a.y
 * @param {number} a.w
 * @param {number} a.h
 * @param {number} a.r
 * @param {object} b the thing we want to check for adjacency
 * @param {number} b.x
 * @param {number} b.y
 * @param {number} b.w
 * @param {number} b.h
 * @param {boolean} requireFacing whether or not we should require a to be facing b
 */
function _is_adjacent(a, b, requireFacing=true) {
  if (!((Math.abs(b.x - a.x) * 2 <= a.w + b.w) && (Math.abs(b.y - a.y) * 2 <= a.h + b.h))) {
    return false;
  }
  if (!requireFacing) return true;
  // check facing
  return isFacing(a, b);
}

/**
 * Trigger the "tokenInteract" region behavior for all selected tokens
 */
async function OnInteract() {
  const selected = game.canvas.tokens.placeables.filter(o => o.controlled).map(o => o.document);
  if (selected.length === 0) return;

  // check if the game is paused
  if ( game.paused && !game.user.isGM ) {
    ui.notifications.warn("GAME.PausedWarning", {localize: true});
    return this;
  }

  // send interact event
  selected.forEach(token=>{
    token.regions.forEach(region=>{
      // if has tokenInteract
      if (region.behaviors.some(b=>b.getFlag(MODULENAME, "hasTokenInteract"))) {
        region._triggerEvent("tokenInteract", { token });
      }
    });
  });

  // if we only have one token selected, do the other "interact" behavior as well.
  if (selected.length !== 1) return;

  const token = selected[0];
  const tObj = token.object;
  const { x: tx, y: ty } = canvas.grid.getCenterPoint(tObj.center);
  const { sizeX, sizeY } = canvas.grid;
  const tokenBounds = { x: tx, y: ty, w: Math.max(tObj.w, sizeX), h: Math.max(tObj.h, sizeY), r: token.rotation};
  const requireFacing = !!tObj?.isTileset;

  // check if we are facing/adjacent to an item pile
  if (game.modules.get("item-piles")?.active) {
    const facingTokens = game.canvas.tokens.placeables.filter(o=>{
      if (o === tObj || !o.document?.flags?.["item-piles"]?.data?.enabled) return false;
      const { x: ox, y: oy } = canvas.grid.getCenterPoint(o.center);
      return _is_adjacent(
        tokenBounds,
        { x: ox, y: oy, w: Math.max(o.w, sizeX), h: Math.max(o.h, sizeY) },
        requireFacing,
      );
    });

    if (facingTokens.length > 0) {
      facingTokens.forEach(ip=>game.itempiles.API.renderItemPileInterface(ip.document, { inspectingTarget: token?.actor?.uuid }));
    }
  };

  // check if we are facing/adjacent to an tile (either with Rock Smash or Cut or Strength)
  const facingTiles = game.canvas.tiles.placeables.filter(tile=>{
    const tileAssetsFlags = tile?.document?.flags?.[MODULENAME];
    if (!tileAssetsFlags?.smashable && !tileAssetsFlags?.cuttable && !tileAssetsFlags?.pushable) return false;
    const { x: ox, y: oy } = canvas.grid.getCenterPoint(tile.center);
    return _is_adjacent(
      tokenBounds,
      { x: ox, y: oy, w: Math.max(tile.bounds.width, sizeX), h: Math.max(tile.bounds.height, sizeY)},
      requireFacing,
    );
  });
  if (facingTiles.length > 0) {
    // let's wait until we lift the enter key
    do {
      await sleep(100);
    } while (keyboard.downKeys.has("Enter"));

    const smashable = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.smashable);
    const cuttable = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.cuttable);
    const pushable = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.pushable);

    const soc = socket.current();
    const logic = game.modules.get(MODULENAME).api.logic;
    const fieldMoveParty = logic.FieldMoveParty(token);

    const hasFieldMoveRockSmash = fieldMoveParty.find(logic.CanUseRockSmash);
    const hasFieldMoveCut = fieldMoveParty.find(logic.CanUseCut);
    const hasFieldMoveStrength = fieldMoveParty.find(logic.CanUseStrength);

    if (!!hasFieldMoveRockSmash && game.settings.get(MODULENAME, "canUseRockSmash")) {
      smashable.forEach(async (rs)=>{
        if (token._smashing || await new Promise((resolve)=>Dialog.confirm({
          title: "Rock Smash",
          content: "This rock appears to be breakable. Would you like to use Rock Smash?",
          yes: ()=>resolve(true),
          no: ()=>resolve(false),
          options: {
            pokemon: true,
          },
        }))) {
          await Dialog.prompt({
            content: `<p>${hasFieldMoveRockSmash?.name} used Rock Smash!</p>`,
            options: {
              pokemon: true,
            },
          });
          // set a volatile local variable that this token is currently using Rock Smash
          token._smashing = true;
          await soc.executeAsGM("triggerRockSmash", rs.document.uuid);
        };
      });
    } else if (smashable.length > 0) {
      Dialog.prompt({
        title: "Rock Smash",
        content: "This rock appears to be breakable.",
        options: {
          pokemon: true,
        },
      });
    }

    if (!!hasFieldMoveCut && game.settings.get(MODULENAME, "canUseCut")) {
      cuttable.forEach(async (rs)=>{
        if (token._cutting || await new Promise((resolve)=>Dialog.confirm({
          title: "Cut",
          content: "This tree looks like it can be cut down. Would you like to use Cut?",
          yes: ()=>resolve(true),
          no: ()=>resolve(false),
          options: {
            pokemon: true,
          },
        }))) {
          await Dialog.prompt({
            content: `<p>${hasFieldMoveCut?.name} used Cut!</p>`,
            options: {
              pokemon: true,
            },
          });
          // set a volatile local variable that this token is currently using Cut
          token._cutting = true;
          await soc.executeAsGM("triggerCut", rs.document.uuid);
        };
      });
    } else if (cuttable.length > 0) {
      Dialog.prompt({
        title: "Cut",
        content: "This tree looks like it can be cut down.",
        options: {
          pokemon: true,
        },
      });
    }

    if (!!hasFieldMoveStrength && game.settings.get(MODULENAME, "canUseStrength") && pushable.length > 0) {
      if (!token._pushing && await new Promise((resolve)=>Dialog.confirm({
        title: "Strength",
        content: "It's a big boulder, but a Pokémon may be able to push it aside. Would you like to use Strength?",
        yes: ()=>resolve(true),
        no: ()=>resolve(false),
        options: {
          pokemon: true,
        },
      }))) {
        await Dialog.prompt({
          content: `<p>${hasFieldMoveStrength?.name} used Strength! ${hasFieldMoveStrength?.name}'s Strength made it possible to move boulders around!</p>`,
          options: {
            pokemon: true,
          },
        });
        // set a volatile local variable that this token is currently using Strength
        token._pushing = true;
      };
    } else if (pushable.length > 0) {
      Dialog.prompt({
        title: "Strength",
        content: "It's a big boulder, but a Pokémon may be able to push it aside.",
        options: {
          pokemon: true,
        },
      });
    }
  }
  
  // check if we're facing a wall/door
  const shifted = game.canvas.grid.getShiftedPoint({ x: tx, y: ty }, token.rotation + 90);
  const collides = token.object.checkCollision(shifted, { mode: "closest" });
  if (!collides) return;
  const walls = collides.edges.filter(e=>e.object instanceof Wall);
  // open unlocked doors
  if (walls.size > 0) {
    for (const wall of walls.map(e=>e.object.document)) {
      if (wall.door === CONST.WALL_DOOR_TYPES.NONE) continue;
      if (wall.door === CONST.WALL_DOOR_TYPES.SECRET && wall.ds === CONST.WALL_DOOR_STATES.LOCKED) continue;

      // check what state the door is in
      if (wall.ds === CONST.WALL_DOOR_STATES.LOCKED) {
        wall.object._playDoorSound("test");
        continue;
      }

      wall.update({ds: wall.ds === CONST.WALL_DOOR_STATES.CLOSED ? CONST.WALL_DOOR_STATES.OPEN : CONST.WALL_DOOR_STATES.CLOSED}, { sound: true });
    }
  }
}


export function register() {
  libWrapper.register(MODULENAME, "foundry.applications.sheets.RegionBehaviorConfig.prototype._getFields", RegionBehaviorConfig_getFields, "WRAPPER");
  libWrapper.register(MODULENAME, "foundry.applications.sheets.RegionBehaviorConfig.prototype._prepareSubmitData", RegionBehaviorConfig_prepareSubmitData, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.RegionBehavior.documentClass.prototype._handleRegionEvent", RegionBehavior_handleRegionEvent, "WRAPPER");

  game.keybindings.register(MODULENAME, "tokenInteract", {
    name: "Token Interact",
    hint: "The button which triggers Scene Regions configured as \"Token Interactions\"",
    editable: [
      {
        key: "Enter"
      }
    ],
    onDown: OnInteract,
    onUp: ()=>{},
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
  });
}