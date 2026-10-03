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
  // Skip confirmation if we came from the Surf/Fish/Cancel combined dialog
  const skipConfirm = !!token._skipFishSurfConfirm;
  token._skipFishSurfConfirm = false;
  if (await UseFieldMove("Surf", hasFieldMove, !!hasFieldMove, skipConfirm || token._surfing)) {
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

async function _checkForFishingRegion(region, entry, token) {
  // if this isn't a fishing region, we don't care about it
  if (!region.behaviors.some(b => b.type == `${MODULENAME}.fishing` && !b.disabled)) return false;

  // If already mid-sequence (catch window or waiting cancel), delegate straight to Fishing()
  // to handle _fishingWaiting / _fishingCancelCallback — don't show the combined dialog
  if (token._fishingWaiting || token._fishing) {
    return game.modules.get(MODULENAME).api.scripts.Fishing(region, entry, token);
  }

  // Check whether the region ALSO has a surf behavior and the player can surf
  const hasSurf = region.behaviors.some(b => b.type == `${MODULENAME}.surf` && !b.disabled);
  const canSurf = hasSurf && !token?.object?.surfing && !!_hasFieldMove(token, "CanUseSurf", "Surf");

  if (canSurf) {
    // Both surf and fishing are present — check whether the party has a matching rod
    const fishingBehavior = region.behaviors.find(b => b.type == `${MODULENAME}.fishing` && !b.disabled);
    const rodTables = fishingBehavior?.system?.rodTables ?? [];
    const party = game.modules.get(MODULENAME).api.logic.FieldMoveParty(token);
    const hasRod = rodTables.some(rodEntry => {
      if (!rodEntry.rodUuid || !rodEntry.tableUuid) return false;
      return party.some(partyActor =>
        partyActor?.items?.some(item =>
          foundry.utils.getProperty(item, "_stats.compendiumSource") === rodEntry.rodUuid
        )
      );
    });

    if (!hasRod) {
      // Can surf but has no rod — let the surf callback handle it
      return false;
    }

    // Both actions available — ask the player to choose
    const { Interact } = game.modules.get(DGANAME)?.api?.scripts ?? {};
    const FooterDialog = game.modules.get(DGANAME)?.api?.FooterDialog;
    if (!FooterDialog) return false;

    Interact();
    const choice = await FooterDialog.wait({
      window: { title: game.i18n.localize("POKEMON-ASSETS.Fishing.Title") },
      content: `<div class="dialog-content"><p>${game.i18n.localize("POKEMON-ASSETS.SurfOrFish.Question")}</p></div>`,
      buttons: [
        { action: "surf",   label: game.i18n.localize("POKEMON-ASSETS.SurfOrFish.Surf"),   callback: () => "surf" },
        { action: "fish",   label: game.i18n.localize("POKEMON-ASSETS.SurfOrFish.Fish"),   callback: () => "fish" },
        { action: "cancel", label: game.i18n.localize("POKEMON-ASSETS.SurfOrFish.Cancel"), callback: () => null  },
      ],
      rejectClose: false,
    });

    if (choice === "surf") {
      token._skipFishSurfConfirm = true;
      return _checkForSurfRegion(region, entry, token);
    }
    if (choice === "fish") {
      token._skipFishSurfConfirm = true;
      return game.modules.get(MODULENAME).api.scripts.Fishing(region, entry, token);
    }
    return true; // canceled
  }

  return game.modules.get(MODULENAME).api.scripts.Fishing(region, entry, token);
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

  // Register fishing BEFORE surf so that combined surf+fishing regions are handled
  // by the fishing callback first (which can show the Surf/Fish/Cancel dialog).
  DGA.api.regionInteractions["fishing"] = {
    eligible: () => true,
    callback: _checkForFishingRegion,
  };

  DGA.api.regionInteractions["surf"] = {
    eligible: (token) => !token?.object?.surfing && !!_hasFieldMove(token, "CanUseSurf", "Surf"),
    callback: _checkForSurfRegion,
  };
}