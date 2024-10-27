
import { early_isGM } from "./utils.mjs";

// make globally accessible helpers, to help 

async function playlistOnce() {
  return game.scenes.active.playlist.stopAll();
}

async function doPreloadScenePlaylist(scene) {
  // stop the music from the current scene
  const oldScene = game.scenes.active;
  if (oldScene !== scene) {
    oldScene.playlist?.stopAll();
  };

  const playlist = scene.playlist;
  if (!playlist) {
    console.log("no playlist for", scene);
    return;
  }

  // wait for the audio system to be ready to load audio
  if (game.audio.locked) await game.audio.unlock;

  // remove playlistOnce listeners
  // and preload all members of the playlist
  const loaded = [];
  for (const sound of playlist?.sounds?.contents ?? []) {
    // kick off an async preload
    loaded.push(sound.load().then(()=>{
      sound.sound.removeEventListener("end", playlistOnce);
    }));
  };
  await Promise.all(loaded);

  // if the last sound is set not to repeat, then add the playlistOnce listener
  const sound = playlist.sounds.get(playlist.playbackOrder[playlist.playbackOrder.length - 1]);
  const playlistHasEnd = sound && !sound.repeat;
  scene.setFlag("pokemon-assets", "playlistHasEnd", playlistHasEnd);
  if (playlistHasEnd) {
    if (!sound.sound) {
      console.error(`Preloaded all scene playlist sounds, but sound "${sound.id}" is not preloaded`);
      return;
    }
    sound.sound.addEventListener("end", playlistOnce);
  }
}

function OnPreUpdateScene(scene, changes, data, id) {
  if (!changes.active) return;
  doPreloadScenePlaylist(scene);
}

function OnReady() {
  doPreloadScenePlaylist(game.scenes.active);
}

function OnDeleteCombat(tracker, info, id) {
  // game.scenes.active.playlist.playNext();
  const scene = tracker?.scene;
  if (scene && scene.getFlag("pokemon-assets", "playlistHasEnd") && scene.playlist) {
    scene.playlist.playNext();
  }
}


export function register() {
  if (!early_isGM()) return;

  Hooks.on("ready", OnReady);
  Hooks.on("preUpdateScene", OnPreUpdateScene);
  Hooks.on("deleteCombat", OnDeleteCombat);

  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.playlistOnce = playlistOnce;
}