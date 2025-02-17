
import { MODULENAME, sleep, isFacing } from "./utils.mjs";
import { UseFieldMove } from "./scripts.mjs";
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

async function runAsMacro(self, {speaker, actor, token, ...scope}={}) {
  // get the command
  const command = self?.flags?.[MODULENAME]?.script;
  const executeAsGM = self?.flags?.[MODULENAME]?.scriptGm;

  if (!command) return;

  // Add variables to the evaluation scope
  speaker = speaker || ChatMessage.implementation.getSpeaker({actor, token});
  const character = game.user.character;
  token = token || (canvas.ready ? canvas.tokens.get(speaker.token) : null) || null;
  actor = actor || token?.actor || game.actors.get(speaker.actor) || null;
  self = self || null;

  // Unpack argument names and values
  const argNames = Object.keys(scope);
  if ( argNames.some(k => Number.isNumeric(k)) ) {
    throw new Error("Illegal numeric Macro parameter passed to execution scope.");
  }
  const argValues = Object.values(scope);

  // Attempt macro execution
  try {
    if (!executeAsGM || game.user.isGM) {
      // Define an AsyncFunction that wraps the macro content
      // eslint-disable-next-line no-new-func
      const fn = new foundry.utils.AsyncFunction("speaker", "actor", "token", "self", "character", "scope", ...argNames, `{${command}\n}`);
      return fn.call(self, speaker, actor, token, self, character, scope, ...argValues);
    }
    return socket.current()?.executeAsGM("runAsMacro", self.uuid, speaker, actor.uuid, token.uuid, character.uuid, scope);
  } catch(err) {
    ui.notifications.error("MACRO.Error", { localize: true });
  }
}

async function runAsMacro_socket(selfUuid, speaker, actorUuid, tokenUuid, characterUuid, scope) {
  const self = await fromUuid(selfUuid);
  const actor = await fromUuid(actorUuid);
  const token = await fromUuid(tokenUuid);
  const character = await fromUuid(characterUuid);
  const argNames = Object.keys(scope);
  const argValues = Object.values(scope);
  const command = self?.flags?.[MODULENAME]?.script;
  
  // Define an AsyncFunction that wraps the macro content
  // eslint-disable-next-line no-new-func
  const fn = new foundry.utils.AsyncFunction("speaker", "actor", "token", "self", "character", "scope", ...argNames,
    `{${command}\n}`);

  // Attempt macro execution
  try {
    return fn.call(self, speaker, actor, token, self, character, scope, ...argValues);
  } catch(err) {
    ui.notifications.error("MACRO.Error", { localize: true });
  }
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
    if (!token.movable) return;
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
  if (!token.movable) return;
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
    if (!tileAssetsFlags?.smashable &&
        !tileAssetsFlags?.cuttable &&
        !tileAssetsFlags?.whirlpool &&
        !tileAssetsFlags?.pushable &&
        !tileAssetsFlags?.script) return false;
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
    const whirlpool = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.whirlpool);
    const pushable = facingTiles.filter(t=>t?.document?.flags?.[MODULENAME]?.pushable);
    const withScript = facingTiles.filter(t=>!!t?.document?.flags?.[MODULENAME]?.script);

    const soc = socket.current();
    const logic = game.modules.get(MODULENAME).api.logic;
    const fieldMoveParty = logic.FieldMoveParty(token);

    const hasFieldMoveRockSmash = fieldMoveParty.find(logic.CanUseRockSmash);
    const hasFieldMoveCut = fieldMoveParty.find(logic.CanUseCut);
    const hasFieldMoveWhirlpool = fieldMoveParty.find(logic.CanUseWhirlpool);
    const hasFieldMoveStrength = fieldMoveParty.find(logic.CanUseStrength);

    if (smashable.length > 0 && await UseFieldMove("RockSmash", hasFieldMoveRockSmash, !!hasFieldMoveRockSmash && game.settings.get(MODULENAME, "canUseRockSmash"), token._smashing)) {
      smashable.forEach(async (rs)=>{
        // set a volatile local variable that this token is currently using Rock Smash
        token._smashing = true;
        await soc.executeAsGM("triggerRockSmash", rs.document.uuid);
      });
    }

    if (cuttable.length > 0 && await UseFieldMove("Cut", hasFieldMoveCut, !!hasFieldMoveCut && game.settings.get(MODULENAME, "canUseCut"), token._cutting)) {
      cuttable.forEach(async (rs)=>{
        // set a volatile local variable that this token is currently using Cut
        token._cutting = true;
        await soc.executeAsGM("triggerCut", rs.document.uuid);
      });
    }

    if (whirlpool.length > 0 && await UseFieldMove("Whirlpool", hasFieldMoveWhirlpool, !!hasFieldMoveWhirlpool && game.settings.get(MODULENAME, "canUseWhirlpool"), token._whirlpool)) {
      whirlpool.forEach(async (rs)=>{
        // set a volatile local variable that this token is currently using Whirlpool
        token._whirlpool = true;
        await soc.executeAsGM("triggerWhirlpool", rs.document.uuid);
      });
    }

    if (pushable.length > 0 && await UseFieldMove("Strength", hasFieldMoveStrength, !!hasFieldMoveStrength && game.settings.get(MODULENAME, "canUseStrength"), token._pushing)) {
      pushable.forEach(async (rs)=>{
        // set a volatile local variable that this token is currently using Strength
        token._pushing = true;
      });
    }

    if (withScript.length > 0) {
      withScript.forEach(async (tile)=>{
        await runAsMacro(tile?.document);
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

  socket.registerSocket("runAsMacro", runAsMacro_socket);

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