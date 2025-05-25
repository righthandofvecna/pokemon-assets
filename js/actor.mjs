
import { isTheGM, MODULENAME } from "./utils.mjs";
import { SpritesheetGenerator } from "./spritesheets.mjs"; 



export function _getTokenChangesForSpritesheet(src) {
  const spritesheetSettings = SpritesheetGenerator.getSheetSettings(src);
  if (spritesheetSettings === undefined) return {};

  const data = {
    "spritesheet": true,
    ...spritesheetSettings
  };
  data.spritesheet = true;
  const updates = {
    "flags.pokemon-assets": data,
    "texture.src": src,
  };
  if ("scale" in data || "anchor" in data) {
    data.scale ??= 1;
    data.anchor ??= 0.5
    if (game.system.id == "ptr2e") updates["flags.ptr2e.autoscale"] = false;
    if (game.system.id == "ptu") updates["flags.ptu.autoscale"] = false;
    updates["texture.scaleX"] = updates["texture.scaleY"] = data.scale;
    updates["texture.fit"] = "width";
    updates["texture.anchorX"] = 0.5;
    updates["texture.anchorY"] = data.anchor;
    delete data.scale;
    delete data.anchor;
  }
  return foundry.utils.expandObject(updates);
}



function OnPreUpdateActor(actor, updates) {
  if (!game.settings.get(MODULENAME, "autoMatchTokenSprite")) return;
  if (actor.img == updates.img || !updates.img) return;

  // the image has changed!
  const src = updates.img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.getSheetSettings(src);
  if (!spritesheet) return;

  foundry.utils.mergeObject(updates, {
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}

function OnPreCreateActor(actor, data) {
  if (!game.settings.get(MODULENAME, "autoMatchTokenSprite")) return;
  const img = data.img ?? actor.img;
  if (!img || !img.includes("modules/pokemon-assets/img/trainers-profile/")) return;

  const src = img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.getSheetSettings(src);
  if (!spritesheet) return;

  foundry.utils.mergeObject(data, {
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}

function OnCreateActor(actor) {
  if (!game.settings.get(MODULENAME, "autoMatchTokenSprite")) return;
  if (!isTheGM()) return;
  if (!actor.img.includes("modules/pokemon-assets/img/trainers-profile/")) return;
  
  const src = actor.img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.getSheetSettings(src);
  if (!spritesheet) return;

  actor.update({
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}


export function register() {
  Hooks.on("preUpdateActor", OnPreUpdateActor);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createActor", OnCreateActor);
}