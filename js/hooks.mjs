

function OnUpdateActor(actor, update) {
  console.log(arguments);
  if (!game.user.isGM) return;
  
  // check for common health
  if (!update?.system?.health) return;

  // not damaged
  if ((update.system.health.value ?? 0) >= (actor.system.health.max ?? 0)) return;

  // fainted
  if ((update.system.health.value ?? 0) <= 0) return;

  const allowedLevels = [CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER];
  const users = (()=>{
    if (allowedLevels.includes(actor.ownership.default)) return game.users;
    return game.users.filter(u=>u.isGM || allowedLevels.includes(actor.ownership[u.id] ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE));
  })().map(u=>u.id);

  const token = game.scenes.active.tokens.find(t=>t.actor.uuid === actor.uuid);

  let sequence = new Sequence({ moduleName: "pokemon-assets", softFail: true });
  sequence = sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/hit.mp3`);
  if (!!token) {
    sequence = sequence.animation()
        .on(token)
        .hide()
        .duration(125)
        .async()
      .animation()
        .on(token)
        .show()
        .duration(125)
        .async()
      .animation()
        .on(token)
        .hide()
        .duration(125)
        .async()
      .animation()
        .on(token)
        .show()
        .duration(125)
        .async();
  }
  

  // check if 1/5 hp or less
  if (update.system.health.value <= ((actor.system?.health?.max ?? 0) / 5)) {
    sequence = sequence.sound()
        .file(`modules/pokemon-assets/audio/bgs/low-hp.mp3`)
        // .audioChannel("interface")
        .forUsers(users);
  }

  sequence.play()
}

async function OnCreateChatMessage(message) {
  if (game.system.id === "ptr2e" && message.type === "capture") {
    const source = message.actor?.token;
    const target = game.scenes.active.tokens.find(t=>t.actor.uuid === message.system.target);
    if (!source || !target) return;
    let sequence = new Sequence({ moduleName: "pokemon-assets", softFail: true });
    sequence = sequence
      .sound()
        .file(`modules/pokemon-assets/audio/bgs/pokeball-throw.mp3`)
      .effect()
        .file(message.system.action.img)
        .atLocation(source)
        .moveTowards(target)
        .missed(false)
        .duration(500)
        .size(0.25, { gridUnits: true })
        .randomSpriteRotation()
        .rotateOut(360, 100)
        .async()
      .sound()
        .file(`modules/pokemon-assets/audio/bgs/pokeball-drop.mp3`)
        .async();
    
    sequence.play();
  }
}


export function register() {
  Hooks.on("updateActor", OnUpdateActor);
  Hooks.on("createChatMessage", OnCreateChatMessage);
}