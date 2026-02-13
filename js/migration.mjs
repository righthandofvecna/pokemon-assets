import { MODULENAME } from './utils.mjs';
import { VERSION } from './version.mjs';

/**
 * Regenerate all the token images in the world.
 * @returns 
 */
async function RegenerateAllImages() {
  const module = game.modules.get(MODULENAME);
  const RegenerateActorTokenImg = module?.api?.scripts?.RegenerateActorTokenImg;

  if (!RegenerateActorTokenImg) {
    ui.notifications.error("Pokémon Assets Module: This game system may not support regenerating token images.");
    return;
  }

  if (!await foundry.applications.api.DialogV2.confirm({
    window: { title: "Refresh Token Images", },
    content: `<p>Are you sure you want to refresh all token images in the world? This will update <strong>all Tokens and Actors in this world</strong> back to their default generated images.</p>`,
  })) {
    return;
  }

  const progressNotify = ui.notifications.info("Updating all world actors...", { progress: true, permanent: true, pct: 0 });

  const batchedActorUpdates = [];
  // update all the actors in the world
  for (const actor of game.actors) {
    const tokenUpdate = await RegenerateActorTokenImg(actor);
    if (!tokenUpdate) continue;
    batchedActorUpdates.push({"prototypeToken": foundry.utils.expandObject(tokenUpdate), _id: actor.id});
  }
  await Actor.updateDocuments(batchedActorUpdates)

  ui.notifications.update(progressNotify, { message: "Updating all world tokens...", pct: 0.2 });

  // update all the tokens in the world
  const numScenes = game.scenes.size;
  let scenesUpdated = 0;
  for (const scene of game.scenes) {
    const batchedTokenUpdates = [];
    for (const token of scene.tokens) {
      const tokenUpdate = await RegenerateActorTokenImg(token.actor ?? token.baseActor);
      if (!tokenUpdate) continue;
      batchedTokenUpdates.push({...tokenUpdate, _id: token.id});
    }
    await scene.updateEmbeddedDocuments("Token", batchedTokenUpdates);
    scenesUpdated++;
    ui.notifications.update(progressNotify, { pct: 0.2 + 0.8 * (scenesUpdated / numScenes) });
  }

  ui.notifications.remove(progressNotify);
  ui.notifications.info("All token images updated!");
}

/**
 * Disable all spritesheets in the world, reverting all tokens and actors to their profile images.
 * Useful for if you want to disable this module.
 * @returns 
 */
async function DisableAllSpritesheets() {
  if (!await foundry.applications.api.DialogV2.confirm({
    window: { title: "Disable Spritesheets", },
    content: `<p>Are you sure you want to disable all spritesheets in the world? This will update <strong>all spritesheet-based Tokens and Actors in this world</strong> back to their profile images.</p>`,
  })) {
    return;
  }

  const progressNotify = ui.notifications.info("Updating all world actors...", { progress: true, permanent: true, pct: 0 });

  const batchedActorUpdates = [];
  // update all the actors in the world
  for (const actor of game.actors) {
    if (!actor?.prototypeToken?.flags?.[MODULENAME]?.spritesheet) continue;
    const tokenUpdate = { "texture.src": actor.img, [`flags.${MODULENAME}.spritesheet`]: false };
    batchedActorUpdates.push({"prototypeToken": foundry.utils.expandObject(tokenUpdate), _id: actor.id});
  }
  await Actor.updateDocuments(batchedActorUpdates)

  ui.notifications.update(progressNotify, { message: "Updating all world tokens...", pct: 0.2 });

  // update all the tokens in the world
  const numScenes = game.scenes.size;
  let scenesUpdated = 0;
  for (const scene of game.scenes) {
    const batchedTokenUpdates = [];
    for (const token of scene.tokens) {
      if (!token?.flags?.[MODULENAME]?.spritesheet) continue;
      const tokenUpdate = { "texture.src": token.actor?.img, [`flags.${MODULENAME}.spritesheet`]: false };
      batchedTokenUpdates.push({...tokenUpdate, _id: token.id});
    }
    await scene.updateEmbeddedDocuments("Token", batchedTokenUpdates);
    scenesUpdated++;
    ui.notifications.update(progressNotify, { pct: 0.2 + 0.8 * (scenesUpdated / numScenes) });
  }

  ui.notifications.remove(progressNotify);
  ui.notifications.info("All spritesheets disabled!");
}


export function register() {
  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  module.api.migration ??= {};
  module.api.migration.RegenerateAllImages = RegenerateAllImages;
  module.api.migration.DisableAllSpritesheets = DisableAllSpritesheets;

  Hooks.on("ready", ()=>{
    // Check version
    if (game.modules.get(MODULENAME).version !== VERSION) {
      const isMac = (()=>{
        try {
          return navigator?.userAgentData?.platform?.includes("Mac") ?? navigator?.platform?.includes("Mac");
        } catch {
          return false;
        }
      })()
      const keyCombo = isMac ? "⌘ + Shift + R" : "Ctrl + F5";
      ui.notifications.error(`Pokémon Assets Module: Your browser cache appears to be out of date. Please reload the page using ${keyCombo} to ensure the module behaves as expected.`, { permanent: true});
    }
  });
}
