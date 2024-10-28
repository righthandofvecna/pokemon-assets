import { early_isGM, sleep } from "../utils.mjs";

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


export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }
}