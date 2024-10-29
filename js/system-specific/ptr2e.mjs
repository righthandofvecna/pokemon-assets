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
  if (message.type === "capture") {
    const sourceId = message.actor.uuid;
    const targetId = message.system.target;
    const { source, target } = (()=>{
      // find a scene where both exist
      for (const scene of [game.scenes.active, ...game.scenes.contents]) {
        const source = scene.tokens.find(t=>t.actor.uuid === sourceId)
        const target = scene.tokens.find(t=>t.actor.uuid === targetId)
        if (!source || !target) continue;
        return { source, target };
      }
    })();
    if (!source || !target) return;

    await sleep(1500);
    
    const crit = message.system.rolls.crit.total <= 0;
    const shakes = 3 - [
      message.system.rolls.shake4,
      message.system.rolls.shake3,
      message.system.rolls.shake2,
      message.system.rolls.shake1,
    ].map(shake=>shake.total <= 0).lastIndexOf(false);
    game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      message.system.action.img,
      message.system.rolls.accuracy.result <= 0,
      Math.min(shakes, crit ? 1 : 3),
      crit ? shakes >= 1 : shakes >= 4);
    return;
  }

  //
  // Handle the Damage Hit Indicator and sounds
  //
  if (message.type === "damage-applied") {
    const target = message.system.target;

    // check that the damage applied is positive
    if (message.system.damageApplied <= 0) return;

    // check if the target fainted
    if ((target.system.health.value ?? 0) <= 0) return;

    // check if 1/5 hp or less
    const lowHp = target.system.health.value <= target.system.health.max / 5;

    const token = game.scenes.active.tokens.find(t=>t.actor.uuid === target.uuid);
    game.modules.get("pokemon-assets").api.scripts.IndicateDamage(target, token, lowHp);
    return;
  }
}


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {*} actor
 * @returns 
 */
function OnPreCreateActor(actor) {
  // console.log("OnPreCreateActor", ...[...arguments].map(a=>foundry.utils.deepClone(a)));
  if (actor.type !== "pokemon") return;
  const species = actor.system.species;
  const slug = species.slug;
  const dexNum = species.number;
  const regionalVariant = (()=>{
    if (slug.startsWith("alolan-")) return "_alolan";
    if (slug.startsWith("galarian-")) return "_galarian";
    if (slug.startsWith("hisuian-")) return "_hisuian";
    if (slug.startsWith("paldean-")) return "_paldean";
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
  actor.updateSource(updates);
}


export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }
  Hooks.on("preCreateActor", OnPreCreateActor);
}