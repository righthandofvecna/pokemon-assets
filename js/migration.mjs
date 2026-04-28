import { MODULENAME } from './utils.mjs';
import { VERSION } from './version.mjs';
import { MIGRATIONS } from './migrations/_index.mjs';

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

  const regen = async (actor) => {
    const tokenUpdate = await RegenerateActorTokenImg(actor);
    if (!tokenUpdate) return;
    if (!game.settings.get(MODULENAME, "allowTokenArtPastBounds")) {
      tokenUpdate["scale"] = 1;
      tokenUpdate["texture.scaleX"] = tokenUpdate["texture.scaleY"] = 1;
      tokenUpdate["texture.fit"] = "fill";
      tokenUpdate["texture.anchorX"] = 0.5;
      tokenUpdate["texture.anchorY"] = 0.5;
    }
    return tokenUpdate;
  }

  const progressNotify = ui.notifications.info("Updating all world actors...", { progress: true, permanent: true, pct: 0 });

  const batchedActorUpdates = [];
  // update all the actors in the world
  for (const actor of game.actors) {
    const tokenUpdate = await regen(actor);
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
      const tokenUpdate = await regen(token.actor ?? token.baseActor);
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
  
  game.settings.register(MODULENAME, "migrationVersion", {
    name: "Migration Version",
    scope: "world",
    config: false,
    default: "0.0.0",
  });

  Hooks.on("ready", async ()=>{
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
      return;
    }

    // Run Migrations if we're the active GM and the migration version is outdated
    const MIGRATION_VERSION = game.settings.get(MODULENAME, "migrationVersion");
    const pendingMigrations = MIGRATIONS.filter(m => foundry.utils.isNewerVersion(m.MIGRATION_VERSION, MIGRATION_VERSION));
    if (game.user.isActiveGM && pendingMigrations.length) {
      await game.settings.set(MODULENAME, "migrationVersion", pendingMigrations.at(-1).MIGRATION_VERSION);
      try {
        for (const migration of pendingMigrations) {
          console.log(`Pokémon Assets Module: Running migration ${migration.MIGRATION_VERSION}...`);
          // all world actors
          for (const actor of game.actors) {
            const updatedData = await migration.updateActor(actor, foundry.utils.deepClone(actor._source));
            if (updatedData) {
              await actor.update(updatedData);
            }
          }
          // all world scenes, their tokens, and tiles
          for (const scene of game.scenes) {
            // all scenes in world
            const updatedData = await migration.updateScene(scene, foundry.utils.deepClone(scene._source));
            if (updatedData) {
              await scene.update(updatedData);
            }
            
            // all tokens in world
            for (const token of scene.tokens) {
              const updatedData = await migration.updateToken(token, foundry.utils.deepClone(token._source));
              if (updatedData) {
                await token.update(updatedData);
              }
            }
            // all tiles in world
            for (const tile of scene.tiles) {
              const updatedData = await migration.updateTile(tile, foundry.utils.deepClone(tile._source));
              if (updatedData) {
                await tile.update(updatedData);
              }
            }
          }
          // all world items
          for (const item of game.items) {
            const updatedData = await migration.updateItem(item, foundry.utils.deepClone(item._source));
            if (updatedData) {
              await item.update(updatedData);
            }
          }
          // all actors/items in compendium packs
          for (const pack of game.packs) {
            if (pack.locked) continue;
            if (pack.documentName === "Actor") {
              const index = await pack.getIndex();
              for (const entry of index) {
                const document = await pack.getDocument(entry._id);
                const updatedData = await migration.updateActor(document, foundry.utils.deepClone(document._source));
                if (updatedData) {
                  await document.update(updatedData);
                }
              }
            } else if (pack.documentName === "Item") {
              const index = await pack.getIndex();
              for (const entry of index) {
                const document = await pack.getDocument(entry._id);
                const updatedData = await migration.updateItem(document, foundry.utils.deepClone(document._source));
                if (updatedData) {
                  await document.update(updatedData);
                }
              }
            }
          }
        }
      } catch (e) {
        await game.settings.set(MODULENAME, "migrationVersion", MIGRATION_VERSION);
        ui.notifications.error(`Pokémon Assets Module: An error occurred while running data migrations. Please check the console for more details.`, { permanent: true });
        console.error("Pokémon Assets Module: Migration error:", e);
      }
    }
  });
}
