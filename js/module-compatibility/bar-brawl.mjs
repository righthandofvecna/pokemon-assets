
import { MODULENAME, MYSTERY_MAN } from "../utils.mjs";


async function PTR2e_OnCreateActor(actor) {
  if (!game.user.isActiveGM) return;
  // check if this is a pokemon that has the same image and prototype image
  if (actor.img != actor.prototypeToken.texture.src && actor.prototypeToken.texture.src != MYSTERY_MAN) return;
  // regenerate the token because Bar Brawl probably messed it up
  const config = game.ptr.data.artMap.get(actor?.species?.slug ?? "");
  if (!config) return;
  const tokenResolver = await game.ptr.util.image.createFromSpeciesData(
    {
      dexId: actor?.species?.number,
      shiny: actor?.system?.shiny ?? false,
      female: actor?.gender === "female",
      forms: actor?.species?.form ? [...actor.species.form.split("-"), "token"] : ["token"],
    },
    config
  );
  if (!tokenResolver.result || tokenResolver.result == actor.prototypeToken.texture.src) return;
  await actor.update({
    "prototypeToken.texture.src": tokenResolver.result,
  });
}

export function register() {
  Hooks.on("ready", ()=>{
    if (game.modules.get("barbrawl")?.active) {
      if (game.system.id === "ptr2e") {
        Hooks.on("createActor", PTR2e_OnCreateActor);
      }
    }
  })
}