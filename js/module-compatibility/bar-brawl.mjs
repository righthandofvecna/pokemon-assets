

function OnPreCreateActor(actor, data) {
  if (game.system.id === "ptr2e") {
    actor.updateSource(foundry.utils.expandObject({
      "prototypeToken.texture.src": foundry.utils.getProperty(data, "prototypeToken.texture.src"),
      "prototypeToken.flags.pokemon-assets": foundry.utils.getProperty(data, "prototypeToken.flags.pokemon-assets"),
    }));
  }
}

export function register() {
  Hooks.on("ready", ()=>{
    if (game.modules.get("barbrawl")?.active) {
      Hooks.on("preCreateActor", OnPreCreateActor);
    }
  })
}