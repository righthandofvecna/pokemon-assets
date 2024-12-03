
import { MODULENAME, sleep } from "./utils.mjs";
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


function _norm_angle(a) {
  return a < 0 ? a + 360 : (a >= 360 ? a - 360 : a);
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
  const direction = (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) - 90;
  return Math.floor(_norm_angle(direction + 22.5) / 8) == Math.floor(_norm_angle(a.r + 22.5) / 8);
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
    if (!tileAssetsFlags?.smashable && !tileAssetsFlags?.cuttable && !tileAssetsFlags?.strengthable) return false;
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
    const strengthable = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.strengthable);

    const soc = socket.current();

    smashable.forEach(async (rs)=>{
      // TODO: check if we *can* use Rock Smash
      if (await new Promise((resolve)=>Dialog.confirm({
        title: "Rock Smash",
        content: "This rock appears to be breakable. Would you like to use Rock Smash?",
        yes: ()=>resolve(true),
        no: ()=>resolve(false),
      }))) {
        // TODO: figure out who has Rock Smash, if anyone
        console.log("X used Rock Smash!");
        // TODO: show the message
        // TODO: play the smashing animation
        await soc.executeAsGM("triggerRockSmash", rs.document.uuid);
      };
    });

    cuttable.forEach(async (rs)=>{
      // TODO: check if we *can* use Cut
      if (await new Promise((resolve)=>Dialog.confirm({
        title: "Cut",
        content: "This tree looks like it can be cut down. Would you like to use Cut?",
        yes: ()=>resolve(true),
        no: ()=>resolve(false),
      }))) {
        // TODO: figure out who has Cut, if anyone
        console.log("X used Cut!");
        // TODO: show the message
        // TODO: play the cutting animation
        await soc.executeAsGM("triggerCut", rs.document.uuid);
      };
    });
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