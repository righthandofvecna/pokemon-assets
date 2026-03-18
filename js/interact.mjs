import { MODULENAME, sleep, isAdjacent, getGridDirectionFromAngle, getDirectionFromAngle } from "./utils.mjs";
import { UseFieldMove, Interact } from "./scripts.mjs";
import * as socket from "./socket.mjs";

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
 * Get all the tokens that this one is facing (or adjacent to, if the token doesn't have facing)
 * @param {*} token 
 * @param {*} filter 
 * @returns 
 */
function getFacingTokens(token, filter=()=>true) {
  const tObj = token.object;
  const { x: tx, y: ty } = canvas.grid.getCenterPoint(tObj.center);
  const { sizeX, sizeY } = canvas.grid;
  const tokenBounds = { x: tx, y: ty, w: Math.max(tObj.w, sizeX), h: Math.max(tObj.h, sizeY), r: token.rotation};
  const requireFacing = tObj?.hasFacing ?? false;

  return game.canvas.tokens.placeables.filter(o=>{
      if (o === tObj || !filter(o)) return false;
      const { x: ox, y: oy } = canvas.grid.getCenterPoint(o.center);
      return isAdjacent(
        tokenBounds,
        { x: ox, y: oy, w: Math.max(o.w, sizeX), h: Math.max(o.h, sizeY) },
        requireFacing,
      );
    });
}

/**
 * Trigger the "tokenInteract" region behavior for all selected tokens
 */
async function OnInteract() {
  // check if focus is on something that we don't want to trigger interact from
  if (document.activeElement.closest("dialog, #chat-notifications, #sidebar") !== null) return;

  const selected = game.canvas.tokens.placeables.filter(o => o.controlled).map(o => o.document);
  if (selected.length === 0) return;

  // check if the game is paused
  if ( game.paused && !game.user.isGM ) {
    ui.notifications.warn("GAME.PausedWarning", {localize: true});
    return this;
  }

  // send interact event
  for (const token of selected) {
    if (!token.movable) return;
    for (const region of token.regions) {
      // if has tokenInteract
      if (region.behaviors.some(b=>b.getFlag(MODULENAME, "hasTokenInteract"))) {
        return region._triggerEvent("tokenInteract", { token });
      }
    };
  };

  // if we only have one token selected, do the other "interact" behavior as well.
  if (selected.length !== 1) return;

  const token = selected[0];
  if (!token.movable) return;
  const tObj = token.object;
  const { x: tx, y: ty } = canvas.grid.getCenterPoint(tObj.center);
  const { sizeX, sizeY } = canvas.grid;
  const tokenBounds = { x: tx, y: ty, w: Math.max(tObj.w, sizeX), h: Math.max(tObj.h, sizeY), r: token.rotation};
  const requireFacing = tObj?.hasFacing ?? false;

  // let's wait until we lift the enter key
  do {
    await sleep(100);
  } while (game.keyboard.downKeys.has("Enter"));

  // check if we are facing/adjacent to an item pile
  if (game.modules.get("item-piles")?.active) {
    const facingTokens = getFacingTokens(token, o=>o.document?.flags?.["item-piles"]?.data?.enabled);

    if (facingTokens.length > 0) {
      Interact();
      return game.itempiles.API.renderItemPileInterface(facingTokens.at(0)?.document, { inspectingTarget: token?.actor?.uuid });
    }
  };
  // check if we are facing/adjacent to a token with an interaction script
  const facingTokens = getFacingTokens(token, o=>!!o.document?.flags?.[MODULENAME]?.script || !!o.document?.flags?.[MODULENAME]?.dialogue);

  if (facingTokens.length > 0) {
    const facingDoc = facingTokens.at(0)?.document;
    if (facingDoc?.flags?.[MODULENAME]?.dialogue) {
      Interact();
      // set the direction of the facing token
      const oldDirection = facingDoc.object.direction;
      facingDoc.object.direction = getDirectionFromAngle((Math.atan2(canvas.grid.getCenterPoint(facingTokens.at(0).center).y - ty, canvas.grid.getCenterPoint(facingTokens.at(0).center).x - tx) * 180 / Math.PI) + 90);
      await game.modules.get(MODULENAME).api.PokemonPrompt({
        title: facingDoc.name,
        content: `<p>${facingDoc.flags[MODULENAME].dialogue}</p>`,
      });
      facingDoc.object.direction = oldDirection;
      return;
    } else {
      Interact();
      return runAsMacro(facingTokens.at(0)?.document);
    }
  }

  // check if we are facing/adjacent to an tile (either with Rock Smash or Cut or Strength)
  const facingTiles = game.canvas.tiles.placeables.filter(tile=>{
    const tileAssetsFlags = tile?.document?.flags?.[MODULENAME];
    if (!tileAssetsFlags?.smashable &&
        !tileAssetsFlags?.cuttable &&
        !tileAssetsFlags?.whirlpool &&
        !tileAssetsFlags?.pushable &&
        !tileAssetsFlags?.script) return false;
    const { x: ox, y: oy } = canvas.grid.getCenterPoint(tile.center);
    return isAdjacent(
      tokenBounds,
      { x: ox, y: oy, w: Math.max(tile.bounds.width, sizeX), h: Math.max(tile.bounds.height, sizeY)},
      requireFacing,
    );
  });
  if (facingTiles.length > 0) {

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

    if (withScript.length > 0) {
      const tile = withScript.at(0);
      const interactionSound = tile?.document?.flags?.[MODULENAME]?.interactionSound;
      if (interactionSound) {
        Interact({ sound: interactionSound });
      };
      return runAsMacro(tile?.document);
    }

    if (smashable.length > 0 && await UseFieldMove("RockSmash", hasFieldMoveRockSmash, !!hasFieldMoveRockSmash && game.settings.get(MODULENAME, "canUseRockSmash"), token._smashing)) {
      const tile = smashable.at(0);
      token._smashing = true;
      return soc.executeAsGM("triggerRockSmash", tile.document.uuid);
    }

    if (cuttable.length > 0 && await UseFieldMove("Cut", hasFieldMoveCut, !!hasFieldMoveCut && game.settings.get(MODULENAME, "canUseCut"), token._cutting)) {
      const tile = cuttable.at(0);
      token._cutting = true;
      return soc.executeAsGM("triggerCut", tile.document.uuid);
    }

    if (whirlpool.length > 0 && await UseFieldMove("Whirlpool", hasFieldMoveWhirlpool, !!hasFieldMoveWhirlpool && game.settings.get(MODULENAME, "canUseWhirlpool"), token._whirlpool)) {
      const tile = whirlpool.at(0);
      token._whirlpool = true;
      return soc.executeAsGM("triggerWhirlpool", tile.document.uuid);
    }

    if (pushable.length > 0 && await UseFieldMove("Strength", hasFieldMoveStrength, !!hasFieldMoveStrength && game.settings.get(MODULENAME, "canUseStrength"), token._pushing)) {
      const tile = pushable.at(0);
      token._pushing = true;
      return soc.executeAsGM("triggerStrength", tile.document.uuid);
    }
  }

  const foundryGridDirections = requireFacing ? [getGridDirectionFromAngle(token.rotation)] : [CONST.MOVEMENT_DIRECTIONS.UP, CONST.MOVEMENT_DIRECTIONS.DOWN, CONST.MOVEMENT_DIRECTIONS.RIGHT, CONST.MOVEMENT_DIRECTIONS.LEFT];

  // check if we are facing/adjacent to a Surf region
  if (!tObj.surfing) {
    const surfRegions = game.canvas.scene.regions.filter(region=>region.behaviors.some(b=>b.type == `${MODULENAME}.surf` && !b.disabled));
    // if requireFacing, only consider regions we're facing
    const entry = surfRegions.flatMap(region=>foundryGridDirections.map(dir=>{
      const checkPoint = game.canvas.grid.getShiftedPoint({ x: tx, y: ty, elevation: token.elevation }, dir);
      if (region.testPoint(checkPoint) && !token.object.checkCollision(checkPoint, { mode: "closest" })) {
        return checkPoint;
      }
      return undefined;
    })).filter(r=>r).at(0);
    if (entry) {
      const logic = game.modules.get(MODULENAME).api.logic;
      const fieldMoveParty = logic.FieldMoveParty(token);
      const hasFieldMoveSurf = fieldMoveParty.find(logic.CanUseSurf);
      if (await UseFieldMove("Surf", hasFieldMoveSurf, !!hasFieldMoveSurf && game.settings.get(MODULENAME, "canUseSurf"), token._surfing)) {
        token._surfing = true;
        // update the token's position to be on the water
        const topLeftEntry = canvas.grid.getTopLeftPoint(entry);
        return token.update({ x: topLeftEntry.x, y: topLeftEntry.y }, {
          movement: {
            [token.id]: {
              constrainOptions: {
                ignoreWalls: true,
                ignoreCost: true,
                ignoreTokens: true,
                history: false,
              }
            }
          }
        });
      }
      return;
    }
  }

  
  // check if we're facing a wall/door
  for (const foundryGridDirection of foundryGridDirections) {
    const shifted = game.canvas.grid.getShiftedPoint({ x: tx, y: ty, elevation: token.elevation }, foundryGridDirection);
    const collides = token.object.checkCollision(shifted, { mode: "closest" });
    if (!collides) return;
    const walls = collides.edges.filter(e=>e.object instanceof foundry.canvas.placeables.Wall);
    // open unlocked doors
    if (walls.size > 0) {
      for (const wall of walls.map(e=>e.object.document)) {
        if (wall.door === CONST.WALL_DOOR_TYPES.NONE) continue;
        if (wall.door === CONST.WALL_DOOR_TYPES.SECRET && wall.ds === CONST.WALL_DOOR_STATES.LOCKED) continue;

        // check what state the door is in
        if (wall.ds === CONST.WALL_DOOR_STATES.LOCKED) {
          return wall.object._playDoorSound("test");
        }

        return wall.update({ds: wall.ds === CONST.WALL_DOOR_STATES.CLOSED ? CONST.WALL_DOOR_STATES.OPEN : CONST.WALL_DOOR_STATES.CLOSED}, { sound: true });
      }
    }
  }
}

export function register() {
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