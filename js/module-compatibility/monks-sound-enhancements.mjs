import { MODULENAME } from "../utils.mjs"


function OnCreateToken(tokenDocument, data, userId) {
  try {
    const cry = game.modules.get(MODULENAME).api.logic.ActorCry(tokenDocument.actor)
    if (cry) {
      tokenDocument.actor.setFlag('monks-sound-enhancements', 'sound-effect', cry)
    }
  } catch (error) { }
}

export function register() {
  if (!game.modules.get("monks-sound-enhancements")?.active) return;

  Hooks.on("createToken", OnCreateToken);
}