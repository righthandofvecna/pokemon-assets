
import { isTheGM, MODULENAME } from "./utils.mjs";
import { SpritesheetGenerator } from "./spritesheets.mjs"; 



export function _getTokenChangesForSpritesheet(src) {
  const spritesheetSettings = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src];
  if (spritesheetSettings === undefined) return {};

  const data = {...spritesheetSettings};
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
  return updates;
}



function OnPreUpdateActor(actor, updates) {
  if (actor.img == updates.img || !updates.img) return;

  // the image has changed!
  const src = updates.img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src];
  if (!spritesheet) return;

  foundry.utils.mergeObject(updates, {
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}

function OnPreCreateActor(actor, data) {
  const img = data.img ?? actor.img;
  if (!img || !img.includes("modules/pokemon-assets/img/trainers-profile/")) return;

  const src = img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src];
  if (!spritesheet) return;

  foundry.utils.mergeObject(data, {
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}

function OnCreateActor(actor) {
  if (!isTheGM()) return;
  if (!actor.img.includes("modules/pokemon-assets/img/trainers-profile/")) return;
  
  const src = actor.img.replace("modules/pokemon-assets/img/trainers-profile/", "modules/pokemon-assets/img/trainers-overworld/");
  const spritesheet = SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src];
  if (!spritesheet) return;

  actor.update({
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  });
}


export function register() {
  if (game.settings.get(MODULENAME, "autoMatchTokenSprite")) {
    Hooks.on("preUpdateActor", OnPreUpdateActor);
    Hooks.on("preCreateActor", OnPreCreateActor);
    Hooks.on("createActor", OnCreateActor);
  }
}