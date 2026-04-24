import { early_isGM, isTheGM, MODULENAME, DATNAME, tokenScene, getCombatsForScene, getAngleFromDirection, getDirectionFromAngle } from "../utils.mjs";
import { getAllInFollowChain, getAllFollowing } from "../module-compatibility/follow-me.mjs";
import { NonPrivateTokenMixin } from "../foundry/token.mjs";


/* ------------------------------------------------------------------------- */

function OnCreateCombatant(combatant) {
  if (!isTheGM()) return;
  if (!combatant?.token?.getFlag(MODULENAME, "spritesheet")) return;
  combatant.update({
    "img": combatant?.actor?.img ?? "icons/svg/mystery-man.svg",
  });
}


/** 
 * Initialize all the edges for tiles when the canvas refreshes
 */
function OnInitializeEdges() {
  // Token edges are deprecated - Tiles still use edges for collision detection
  for (const tile of canvas.tiles.placeables) {
    tile?.initializeEdges?.();
  }
}

/* ------------------------------------------------------------------------- */


/**
 * Returns the indicators to be displayed on the token, such as caught/uncaught, shiny, uncatchable, etc. This is used by Dylan's Animated Tokens to display the appropriate indicators on the token.
 * @param {*} tokenDoc 
 * @returns 
 */
async function getIndicators(wrapper, tokenDoc) {
  const allIndicators = await wrapper(tokenDoc);

  // Caught/Uncaught Indicator
  if (game.settings.get(MODULENAME, "showCaughtIndicator")) {
    const logic = game?.modules?.get(MODULENAME)?.api?.logic;
    // if the pokemon is uncaught, draw the "uncaught" effect
    const catchable = logic?.ActorCatchable(tokenDoc?.actor);
    let caught = catchable ? logic?.ActorCaught?.(tokenDoc?.actor) ?? null : null;
    if (catchable && caught === null) {
      const catchKey = logic?.ActorCatchKey(tokenDoc?.actor);
      if (catchable && catchKey) {
        caught = game.settings.get(MODULENAME, "caughtPokemon")?.has(catchKey);
      }
    }
    // add the indicator
    if (caught === true) {
      const tex = await foundry.canvas.loadTexture(`modules/${MODULENAME}/img/ui/caught-indicator.png`, {fallback: "icons/svg/hazard.svg"});
      const icon = new PIXI.Sprite(tex);
      allIndicators.push(icon);
    } else if (caught === false) {
      const tex = await foundry.canvas.loadTexture(`modules/${MODULENAME}/img/ui/uncaught-indicator.png`, {fallback: "icons/svg/hazard.svg"});
      const icon = new PIXI.Sprite(tex);
      allIndicators.push(icon);
    }
  }
  
  // Shiny Indicator
  if (game.settings.get(MODULENAME, "showShinyIndicator")) {
    const logic = game?.modules?.get(MODULENAME)?.api?.logic;
    // if the pokemon is shiny, draw the "shiny" effect
    const shiny = logic?.ActorShiny(tokenDoc?.actor);
    // add the indicator
    if (shiny) {
      const tex = await foundry.canvas.loadTexture(`modules/${MODULENAME}/img/ui/shiny-indicator.png`, {fallback: "icons/svg/explosion.svg"});
      const icon = new PIXI.Sprite(tex);
      allIndicators.push(icon);
    }
  }

  // Uncatchable Indicator
  if (game.settings.get(MODULENAME, "showUncatchableIndicator")) {
    const logic = game?.modules?.get(MODULENAME)?.api?.logic;
    const uncatchable = logic?.IsUncatchable?.(tokenDoc?.actor);
    if (uncatchable) {
      const tex = await foundry.canvas.loadTexture(`modules/${MODULENAME}/img/ui/uncatchable-indicator.png`, {fallback: "icons/svg/hazard.svg"});
      const icon = new PIXI.Sprite(tex);
      allIndicators.push(icon);
    }
  }
  return allIndicators;
}

/**
 * Checks if the token is in water, either by checking if the token is within a region that has the "surf" behavior.
 * This is used by Dylan's Animated Tokens to determine if the token should be animated with a surfboard/surf sprite.
 * @param {*} wrapper 
 * @param {*} point 
 * @returns 
 */
function isWater(wrapper, point) {
  return wrapper(point) || (canvas.scene.regions.contents.some(r=>r.behaviors.contents.some(b=>b.type == `${MODULENAME}.surf` && !b.disabled) && r.testPoint(point)));
}

/**
 * Returns the surfboard animation to be used for the token when it is in water.
 * This is used by Dylan's Animated Tokens to determine which surfboard/surf sprite to use when animating the token in water.
 * @param {*} wrapper 
 * @param {*} tokenDoc 
 * @returns 
 */
function getSurfboard(wrapper, tokenDoc) {
  return `modules/${MODULENAME}/img/animations/surf_pokemon_frlg.json`;
}



/* ------------------------------------------------------------------------- */

export function register() {
  Hooks.on("initializeEdges", OnInitializeEdges);
  if (early_isGM()) {
    Hooks.on("createCombatant", OnCreateCombatant);
  }
}

/**
 * After dependencies are initialized, set various API parameters to interface with features of this module
 */
export function registerAfterDependencies() {
  const DAT = game.modules.get(DATNAME);

  // use a closure to wrap the various functions of Dylan's Animated Tokens that we want to interface with
  // so that we can add our own logic to them without modifying the original functions
  const wrap = (method, fn) => {
    DAT.api[method] = (function (wrapper) {
      return (...args)=>fn(wrapper, ...args);
    })(DAT.api[method]);
  }

  wrap("getIndicators", getIndicators);
  wrap("isWater", isWater);
  wrap("getSurfboard", getSurfboard);
}