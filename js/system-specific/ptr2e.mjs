import { sleep } from "../utils.mjs";

function OnPreUpdateActor(actor, update) {
  console.log("OnPreUpdateActor", arguments)
  if (!game.user.isGM) return;
  
  // check for common health
  if (!update?.system?.health) return;

  // not damaged
  if ((update.system.health.value ?? 0) >= (actor.system.health.max ?? 0)) return;

  // fainted
  if ((update.system.health.value ?? 0) <= 0) return;

  const token = game.scenes.active.tokens.find(t=>t.actor.uuid === actor.uuid);
  // check if 1/5 hp or less
  const lowHp = update.system.health.value <= ((actor.system?.health?.max ?? 0) / 5)

  game.modules.get("pokemon-assets").api.scripts.IndicateDamage(actor, token, lowHp);
}

async function OnCreateChatMessage(message) {
  console.log("OnCreateChatMessage", message);
  if (message.type === "capture") {
    if (!game.user.isGM) return;

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
      Math.min(shakes, 3),
      shakes >= 4);
  }
}


export function register() {
  Hooks.on("preUpdateActor", OnPreUpdateActor);
  Hooks.on("createChatMessage", OnCreateChatMessage);
}