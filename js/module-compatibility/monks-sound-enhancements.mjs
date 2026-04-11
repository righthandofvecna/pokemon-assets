import { MODULENAME } from "../utils.mjs"


async function OnCreateToken(tokenDocument, data, userId) {
  if (!game.user.isActiveGM) return;
  const actor = tokenDocument.baseActor ?? tokenDocument.actor;
  const cry = await game.modules.get(MODULENAME).api.logic.ActorCry(actor);
  if (cry) {
    actor.setFlag('monks-sound-enhancements', 'sound-effect', cry)
  }
}

export function register() {
  if (!game.modules.get("monks-sound-enhancements")?.active) return;

  Hooks.on("createToken", OnCreateToken);
}