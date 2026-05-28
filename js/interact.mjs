import { MODULENAME, DGANAME, sleep, isAdjacent, getGridDirectionFromAngle, getDirectionFromAngle } from "./utils.mjs";
import { UseFieldMove } from "./scripts.mjs";
import * as socket from "./socket.mjs";


/* ------------------------------------------------------------------------- */

function _hasFieldMove(token, logicFunctionName, fieldMoveName) {
  if (!game.settings.get(MODULENAME, `canUse${fieldMoveName}`)) return null;
  const logic = game.modules.get(MODULENAME).api.logic;
  const fieldMoveParty = logic.FieldMoveParty(token);
  return fieldMoveParty.find(logic[logicFunctionName]);
}

function _checkForTile(flagName, logicFunctionName, fieldMoveName, locallyActivated) {
  return async function (tile, token) {
    if (!foundry.utils.getProperty(tile?.flags ?? {}, flagName)) return false;
    const soc = socket.current();
    const hasFieldMove = _hasFieldMove(token, logicFunctionName, fieldMoveName);
    if (await UseFieldMove(fieldMoveName, hasFieldMove, !!hasFieldMove, token[locallyActivated])) {
      token[locallyActivated] = true;
      if (soc?.functions?.has(`trigger${fieldMoveName}`)) {
        await soc.executeAsGM(`trigger${fieldMoveName}`, tile?.uuid);
      }
      return true;
    }
    
    return true;
  }
}

async function _checkForSurfRegion(region, entry, token) {
  // if this isn't a surf region, we don't care about it
  if (!region.behaviors.some(b=>b.type == `${MODULENAME}.surf` && !b.disabled)) return false;
  // if we're already surfing, we don't want to trigger the surf behavior again
  if (token?.object?.surfing) return false;
  const hasFieldMove = _hasFieldMove(token, "CanUseSurf", "Surf");
  if (await UseFieldMove("Surf", hasFieldMove, !!hasFieldMove, token._surfing)) {
    token._surfing = true;
    // update the token's position to be on the water
    const topLeftEntry = canvas.grid.getTopLeftPoint(entry);
    await token.update({ x: topLeftEntry.x, y: topLeftEntry.y }, {
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
  return true;
}

/* ------------------------------------------------------------------------- */

export function registerAfterDependencies() {
  const DGA = game.modules.get(DGANAME);
  DGA.api.tileInteractions["pushable"] = {
    eligible: (token) => !!_hasFieldMove(token, "CanUseStrength", "Strength"),
    callback: _checkForTile(`${DGANAME}.pushable`, "CanUseStrength", "Strength", "_pushing"),
  };
  DGA.api.tileInteractions["cuttable"] = {
    eligible: (token) => !!_hasFieldMove(token, "CanUseCut", "Cut"),
    callback: _checkForTile(`${MODULENAME}.cuttable`, "CanUseCut", "Cut", "_cutting"),
  };
  DGA.api.tileInteractions["smashable"] = {
    eligible: (token) => !!_hasFieldMove(token, "CanUseRockSmash", "RockSmash"),
    callback: _checkForTile(`${MODULENAME}.smashable`, "CanUseRockSmash", "RockSmash", "_smashing"),
  };
  DGA.api.tileInteractions["whirlpool"] = {
    eligible: (token) => !!_hasFieldMove(token, "CanUseWhirlpool", "Whirlpool"),
    callback: _checkForTile(`${MODULENAME}.whirlpool`, "CanUseWhirlpool", "Whirlpool", "_whirlpool"),
  };

  DGA.api.regionInteractions["surf"] = {
    eligible: (token) => !token?.object?.surfing && !!_hasFieldMove(token, "CanUseSurf", "Surf"),
    callback: _checkForSurfRegion,
  };
}