import { early_isGM, sleep } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 

/**
 * A Chat Message listener, that should only be run on the GM's client
 * @param {*} message 
 * @returns 
 */
async function OnCreateChatMessage(message) {

  //
  // Handle Capture Animations
  //
  if (message?.flags?.ptu?.context?.type === "capture-calculation") {
    const context = message?.flags?.ptu?.context;
    const contextTarget = context.targets?.[0];
    if (!context || !contextTarget) return;
    // grab the two tokens
    const sourceId = context.actor;
    const targetId = contextTarget.token;
    if (!targetId || !sourceId) return;

    const target = await fromUuid(targetId);
    const source = target.scene.tokens.find(t=>t.actor.id === sourceId)
    if (!source || !target) return;

    // get the ball image
    const item = await fromUuid(context.origin?.uuid);
    const ballImage = item?.img ?? "systems/ptu/images/item_icons/basic ball.webp";

    // get the roll and the dc
    const captureDC = contextTarget.dc?.value ?? 50;
    const roll = message.rolls[0]?.total ?? captureDC;
    const caught = contextTarget.outcome === "hit";
    const shakes = caught ? 3 : Math.max(0, Math.min(Math.round(3 * captureDC / roll), 3));
    
    game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImage,
      true,
      shakes,
      caught);
    return;
  }

  //
  // Handle the Damage Hit Indicator and sounds
  //
  if (message?.flags?.ptu?.appliedDamage?.isHealing === false) {
    const target = await fromUuid(message.flags.ptu.appliedDamage.uuid);

    // check if the target fainted
    if ((target.system.health.value ?? 0) <= 0) return;

    // check if 1/5 hp or less
    const lowHp = target.system.health.value <= target.system.health.max / 5;

    const token = game.scenes.active.tokens.find(t=>t.actor.uuid === target.uuid);
    game.modules.get("pokemon-assets").api.scripts.IndicateDamage(target, token, lowHp);
    return;
  }
}


function _getPrototypeTokenUpdates(actor, species) {
  const slug = species.slug;
  const dexNum = species.system.number;
  const regionalVariant = (()=>{
    if (slug.endsWith("-alolan")) return "_alolan";
    if (slug.endsWith("-galarian")) return "_galarian";
    if (slug.endsWith("-hisuian")) return "_hisuian";
    if (slug.endsWith("-paldean")) return "_paldean";
    return "";
  })();
  const shiny = actor.system.shiny ? "s" : "";
  const gender = (()=>{
    if (actor.system.gender == "male") return "m";
    if (actor.system.gender == "female") return "f";
    return "";
  })();
  const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
  const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
  const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
  const dexString = `${dexNum}`.padStart(4, "0");

  // check if everything is populated!
  const src = (()=>{
    for (const testSrc of [
      `${pmdPath}${dexString}${gender}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${gender}${regionalVariant}.png`,
      `${pmdPath}${dexString}${regionalVariant}.png`,
      `${pmdPath}${dexString}.png`,
    ]) {
      console.log("testing", testSrc);
      if (testSrc in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS) {
        return testSrc;
      }
    }
    return null;
  })();

  if (!src) return;
  
  const updates = {
    "prototypeToken.texture.src": src,
    "prototypeToken.flags.pokemon-assets": {
      spritesheet: true,
      ...SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src],
    }
  };
  return updates;
}


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {*} actor
 * @returns 
 */
function OnPreCreateActor(actor) {
  if (actor.type !== "pokemon") return;
  const species = actor.items.find(i=>i.type === "species");
  if (!species) return;

  const updates = _getPrototypeTokenUpdates(actor, species);
  actor.updateSource(updates);
}


/**
 * Update the token source if we're updating a pokemon's species
 * @param {*} item 
 * @param {*} metadata 
 * @param {*} userId 
 */
function OnCreateItem(species, metadata, userId) {
  if (game.user.id !== userId) return;
  if (species.type !== "species") return;
  const actor = species.parent;
  if (!actor) return;

  const updates = _getPrototypeTokenUpdates(actor, species);
  actor.update(updates);
}

export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createItem", OnCreateItem);
}