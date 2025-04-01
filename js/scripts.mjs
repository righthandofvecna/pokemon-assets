
import { isTheGM, MODULENAME, sleep, snapToGrid, isFacing } from "./utils.mjs";
import { VolumeSettings } from "./settings.mjs";
import * as socket from "./socket.mjs";
import { getAllFollowing } from "./module-compatibility/follow-me.mjs";

/**
 * Run when a Pokemon Center is triggered.
 * nurse: the nurse token
 * doHeal: a function to run to actually heal the pokemon
 */
async function PokemonCenter(nurse, doHeal) {
  const music = game.scenes.active?.playlistSound?.sound;
  let volume = music?.volume ?? 1;

  const talk = async function(text, ms=1500) {
    await Dialog.prompt({
      content: `<p>${game.i18n.localize(text)}</p>`,
      options: {
        pokemon: true,
      },
    });
  }
  await talk("POKEMON-ASSETS.PokemonCenter.Welcome1");
  await talk("POKEMON-ASSETS.PokemonCenter.Welcome2");

  if (await new Promise((resolve)=>Dialog.confirm({
    title: "Pokemon Center Nurse",
    content: game.i18n.localize("POKEMON-ASSETS.PokemonCenter.Question"),
    yes: ()=>resolve(false),
    no: ()=>resolve(true),
    options: {
      pokemon: true,
    },
  }))) {
    await talk("POKEMON-ASSETS.PokemonCenter.Goodbye");
    return;
  };

  await talk("POKEMON-ASSETS.PokemonCenter.Take");

  // turn the nurse
  if (nurse?.object?.direction) nurse.object.direction = "left";

  let currentTime = 0;
  if (music?.playing) {
    currentTime = music.currentTime;
    volume = music.volume;
    await music.stop({ fade: 500, volume: 0, });
    currentTime = currentTime == undefined ? 0 : currentTime + 0.5;
  }

  const recoverySound = await game.audio.create({
    src: "modules/pokemon-assets/audio/bgs/pokemon-recovery-GBA.mp3",
  });

  const recoverySoundDone = new Promise((resolve)=>{
    recoverySound.addEventListener("stop", ()=>{
      setTimeout(()=>{
        if (isNaN(volume) || !isFinite(volume)) return;
        music?.play({ offset: currentTime, fade: 500, volume: volume });
      }, 500);
      resolve();
    });
  });

  await recoverySound.load();
  await recoverySound.play({ volume: Math.clamp(game.settings.get("core", "globalInterfaceVolume") * VolumeSettings.getRawVolume("heal"), 0, 1) });

  await doHeal();
  await recoverySoundDone;

  // turn the nurse back
  if (nurse?.object?.direction) nurse.object.direction = "down";

  await talk("POKEMON-ASSETS.PokemonCenter.Thank1");
  await talk("POKEMON-ASSETS.PokemonCenter.Thank2");
  await talk("POKEMON-ASSETS.PokemonCenter.Goodbye");
}

/**
 * Run when a Pokemon Computer is triggered
 * @param {*} scene 
 * @param {*} regionDocument 
 * @param {*} regionBehavior 
 * @param {*} event 
 * @returns 
 */
async function PokemonComputer(scene, regionDocument, regionBehavior, event) {
  if (event?.user !== game.user) return;

  const token = event?.data?.token;
  if (!token) return;
  const actor = token.actor;
  if (!actor) return;

  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
  .sound()
    .file(`modules/pokemon-assets/audio/bgs/computeropen.mp3`)
    .locally(true)
    .volume(VolumeSettings.getVolume("pc"))
    .async()
  .play();

  switch (game.system.id) {
    case "ptr2e": return actor?.folder?.renderPartySheet?.();
    case "ptu": return new CONFIG.PTU.ui.party.sheetClass({ actor }).render(true)
  }
}


/**
 * Play a grass flying animation
 * @param {*} scene 
 * @param {*} regionDocument 
 * @param {*} regionBehavior 
 * @param {*} event 
 * @returns 
 */
async function GrassShake(scene, regionDocument, regionBehavior, event) {
  if (event?.user !== game.user) return;

  const destination = (()=>{
    const { sizeX, sizeY } = scene?.grid ?? { sizeX: 100,  sizeY: 100 };
    const { x, y } =  event?.data?.destination ?? { x: 0, y: 0 };
    return canvas.grid.getSnappedPoint(
      { x: x + (sizeX / 2), y: y + (sizeY / 2), },
      { mode: CONST.GRID_SNAPPING_MODES.CENTER }
    );
  })();

  if (!destination) return;

  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_0.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .waitUntilFinished()
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_1.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .waitUntilFinished()
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_2.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .fadeOut(50)
    .play();
}


/**
 * Add a reaction icon above an actor and play a noise.
 * @param {*} token 
 * @param {*} reaction 
 * @returns 
 */
async function TokenReact(token, reaction) {
  const destination = (()=>{
    const { x, y } = token;
    const { sizeX, sizeY } = token?.parent?.grid ?? { sizeX: 100,  sizeY: 100 };
    return {
      x: x + (sizeX / 2),
      y: y - (sizeY / 2),
    }
  })();
  return new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .sound()
      .file(`modules/pokemon-assets/audio/bgs/reactions/${reaction}.mp3`)
      .locally(false)
      .volume(VolumeSettings.getVolume(`reaction-${reaction}`))
    .effect()
      .file(`modules/pokemon-assets/img/reactions/${reaction}.png`, { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(2000)
      .fadeIn(50)
      .fadeOut(50)
      .async()
    .play();
}


/**
 * When triggered, pause the game, react, and walk the provided token over to the triggering token
 * @param {*} token 
 * @param {*} scene 
 * @param {*} regionDocument 
 * @param {*} regionBehavior 
 * @param {*} event 
 * @returns 
 */
async function TrainerEyesMeet(token, scene, regionDocument, regionBehavior, event) {
  if (!isTheGM()) return; // only do updates as the GM
  if (token === event?.data?.token) return; // the token can't trigger its own vision!
  if (token.disposition === event?.data?.token?.disposition) return; // the token has to be aligned differently

  // pause game!
  game.togglePause(true, true);

  // turn the token
  const target = event?.data?.destination;
  const dx = token.x - target.x;
  const dy = token.y - target.y;
  const rotation = (()=>{
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) return 90;
      return 270;
    }
    if (dy > 0) return 180;
    return 0;
  })();
  await token.update({
    rotation,
  });

  // disable region behavior
  await regionBehavior.update({
    disabled: true,
  });

  await TokenReact(token, "surprise");
  const { sizeX, sizeY } = token?.parent?.grid ?? { sizeX: 100,  sizeY: 100 };

  // new target location
  const nx = target.x + (Math.sign(dx) * sizeX);
  const ny = target.y + (Math.sign(dy) * sizeY);
  await token.update({
    x: nx,
    y: ny,
  });
}

/**
 * 
 * @param {*} newScene 
 * @param {*} position 
 * @param {*} scene
 * @param {*} regionDocument
 * @param {*} regionBehavior
 * @param {object} triggerInfo
 * @param {*} triggerInfo.data
 * @param {*} triggerInfo.name
 * @param {*} triggerInfo.user
 * @returns 
 */
async function SwitchScenes(newScene, newAttributes, ...args) {
  const [scene, regionDocument, regionBehavior, { data: { token }, name: trigger, user }] = args;
  if (!newScene || !scene || !token) return;
  if (!isTheGM()) return;

  const tokenData = {
    ...token.toObject(),
    ...newAttributes,
  };

  const tokensToMove = [token];
  if (game.settings.get(MODULENAME, "enableFollow")) {
    tokensToMove.push(...getAllFollowing(token));
  }
  const createData = tokensToMove.map(t=>({
    ...t.toObject(),
    ...foundry.utils.deepClone(newAttributes),
  }));

  const createdTokens = await newScene.createEmbeddedDocuments("Token", createData, { teleport: true });
  // update following
  if (game.settings.get(MODULENAME, "enableFollow") && tokensToMove.length > 1) {
    const idMap = {};
    createdTokens.forEach((t, idx)=>{
      idMap[tokensToMove[idx].id] = t.id;
    });
    await newScene.updateEmbeddedDocuments("Token", createdTokens.map(t=>({
      _id: t.id,
      [`flags.${MODULENAME}.following.who`]: idMap[t?.getFlag(MODULENAME, "following")?.who] ?? null,
    })));
  }
  
  await scene.deleteEmbeddedDocuments("Token", tokensToMove.map(t=>t.id));

  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .sound()
      .file("modules/pokemon-assets/audio/bgs/exit.mp3")
      .volume(VolumeSettings.getVolume("exit"))
      .forUsers([user.id])
      .async()
    .play();
  await game.socket.emit("pullToScene", newScene.id, user.id);
}

/**
 * Handles tokens jumping down a one-way ledge.
 * Best used with the "Token Moved In" event
 * called like: game.modules.get("pokemon-assets")?.api?.scripts?.HandleJumps?.(direction, ...arguments);
 * @param {*} direction
 * @returns 
 */
async function HandleJumps() {
  const [direction, scene, regionDocument, regionBehavior, { data: { token }, name: eventName, user }] = arguments;

  if (user !== game.user || !token || !scene) return;

  const { sizeX, sizeY } = scene.grid;

  const renderedToken = token.object;

  const unlock = token.lockMovement();
  // wait until the token has finished animating
  await renderedToken.allAnimationsPromise;

  // check if the token is still inside the jump area
  if (!token.regions.has(regionDocument)) {
    unlock();
    return;
  }
  switch (direction) {
    case "down": 
      await token.update({ y: token.y + sizeY});
      break;
    case "left":
      await token.update({ x: token.x - sizeX});
      break;
    case "right":
      await token.update({ x: token.x + sizeX});
      break;
    case "up":
      await token.update({ y: token.y - sizeY});
      break;
  }
  unlock();
}

/**
 * Handles tokens sliding on a region of ice.
 * Best used with the "After Token Moved" event
 * called like: game.modules.get("pokemon-assets")?.api?.scripts?.HandleIce?.(...arguments);
 * @param {*} scene
 * @param {*} regionDocument
 * @param {*} regionBehavior
 * @param {*} event
 * @param {*} event.data
 * @param {*} event.data.token
 * @param {*} event.name
 * @param {*} event.user
 * @returns 
 */
async function HandleIce() {
  const [scene, regionDocument, regionBehavior, { data: { token }, name: eventName, user }] = arguments;

  if (user !== game.user || !token || !scene) return;

  if (token._sliding ?? false) return;
  token._sliding = true;
  const unlock = token.lockMovement();

  const { sizeX, sizeY } = scene.grid;
  const { x: originalX, y: originalY } = token;

  const renderedToken = token.object;

  // wait until the token has finished animating
  await renderedToken.allAnimationsPromise;

  const dx = Math.sign(token.x - originalX) * sizeX;
  const dy = Math.sign(token.y - originalY) * sizeY;

  let count = 0;
  // check if the token is still inside the jump area
  while (count < 80 && token.regions.has(regionDocument)) {
    await renderedToken.allAnimationsPromise;
    const shiftedPosition = renderedToken._getShiftedPosition(dx, dy);
    await token.update(shiftedPosition);
    count++;
  }
  await renderedToken.allAnimationsPromise;
  token._sliding = false;
  unlock();
  renderedToken._refreshRotation();
}

/**
 * Flash a token momentarily and play the hit noise, indicating it's taken damage
 * @param {*} actor the damaged actor
 * @param {*} token the token to flash
 * @param {boolean} lowHp if below 1/5 hp, we should play the alert
 */
async function IndicateDamage(actor, token, lowHp) {
  const sequence = new Sequence({ moduleName: "pokemon-assets", softFail: true });
  sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/hit.mp3`)
      .volume(VolumeSettings.getVolume("damage"))
      .locally();
  if (!!token) {
    sequence.localAnimation()
      .on(token)
      .opacity(0.5)
      .duration(125)
      .waitUntilFinished();
    sequence.localAnimation()
      .on(token)
      .opacity(1)
      .duration(125)
      .waitUntilFinished();
    sequence.localAnimation()
      .on(token)
      .opacity(0.5)
      .duration(125)
      .waitUntilFinished();
    sequence.localAnimation()
      .on(token)
      .opacity(1)
      .duration(125)
      .waitUntilFinished();
  }
  
  // check if 1/5 hp or less
  if (lowHp && actor.isOwner) {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/low-hp.mp3`)
      .volume(VolumeSettings.getVolume("low-hp"))
      // .audioChannel("interface")
      .locally();
  }

  sequence.play()
}


/**
 * Throw a Pokeball!
 * @param {*} source the source token
 * @param {*} target the targeted token
 * @param {*} img the image of the pokeball to throw
 * @param {*} hit whether the pokeball hit or not
 * @returns the sequence to play
 */
function ThrowPokeball(source, target, img, hit) {
  Sequencer.Preloader.preload([
    "modules/pokemon-assets/audio/bgs/pokeball-throw.mp3",
    "modules/pokemon-assets/audio/bgs/pokeball-drop.mp3",
  ]);

  const targetCenter = target.center ?? {
    x: target.x + (target.width * (target?.scene?.grid?.sizeX ?? game.scenes.active?.grid?.sizeX ?? 100) / 2),
    y: target.y + (target.height * (target?.scene?.grid?.sizeY ?? game.scenes.active?.grid?.sizeY ?? 100) / 2)
  };

  const sourceCenter = source.center ?? {
    x: source.x + (source.width * (source?.scene?.grid?.sizeX ?? game.scenes.active?.grid?.sizeX ?? 100) / 2),
    y: source.y + (source.height * (source?.scene?.grid?.sizeY ?? game.scenes.active?.grid?.sizeY ?? 100) / 2)
  };

  const volume = VolumeSettings.getVolume("catch");
  const sequence = new Sequence({ moduleName: "pokemon-assets", softFail: true });
  sequence.sound()
    .file(`modules/pokemon-assets/audio/bgs/pokeball-throw.mp3`)
    .volume(volume)
    .locally();
  sequence.effect()
    .file(img)
    .atLocation(sourceCenter)
    .moveTowards(targetCenter)
    .missed(!hit)
    .duration(500)
    .size(0.35, { gridUnits: true })
    .randomSpriteRotation()
    .rotateOut(360, 100)
    .locally()
    .waitUntilFinished();
  sequence.sound()
    .file(`modules/pokemon-assets/audio/bgs/pokeball-drop.mp3`)
    .volume(volume)
    .locally()
    .waitUntilFinished();
  
  return sequence;
}

/**
 * Play a "Catch" animation from the thrown Pokeball
 * @param {*} target the targeted token
 * @param {*} img the image of the pokeball to throw
 * @param {*} shakes how many shakes the pokeball does
 * @param {*} caught whether or not to play the caught or escaped animation
 * @returns the sequence to play
 */
function CatchPokemon(target, img, shakes, caught, extendSequence=null) {
  Sequencer.Preloader.preload([
    "modules/pokemon-assets/audio/bgs/pokeball-shake.mp3",
    "modules/pokemon-assets/audio/bgs/pokeball-caught.mp3",
    "modules/pokemon-assets/audio/bgs/pokeball-escape.mp3",
  ]);

  const volume = VolumeSettings.getVolume("catch");
  const sequence = extendSequence ?? new Sequence({ moduleName: "pokemon-assets", softFail: true });

  const targetCenter = target.center ?? {
    x: target.x + (target.width * (target?.scene?.grid?.sizeX ?? game.scenes.active?.grid?.sizeX ?? 100) / 2),
    y: target.y + (target.height * (target?.scene?.grid?.sizeY ?? game.scenes.active?.grid?.sizeY ?? 100) / 2)
  };

  sequence.localAnimation()
    .on(target)
    .opacity(0);
  sequence.effect()
    .file(img)
    .atLocation(targetCenter)
    .duration(2000)
    .size(0.35, { gridUnits: true })
    .locally()
    .waitUntilFinished();
  for (let shake=0; shake < shakes; shake++) {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/pokeball-shake.mp3`)
      .volume(volume)
      .locally();
    sequence.effect()
      .file(img)
      .atLocation(targetCenter)
      .duration(2000)
      .size(0.35, { gridUnits: true })
      .rotateIn(45, 2000, { ease: "easeOutElastic", delay: 0 })
      .waitUntilFinished()
      .locally();
  }

  if (caught) {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/pokeball-caught.mp3`)
      .volume(volume)
      .locally();
    sequence.effect()
      .file(img)
      .tint("#555555")
      .atLocation(targetCenter)
      .duration(2000)
      .size(0.35, { gridUnits: true })
      .locally()
      .waitUntilFinished();
  } else {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/pokeball-escape.mp3`)
      .volume(volume)
      .locally();
    sequence.localAnimation()
      .on(target)
      .opacity(1);
  }
  
  return sequence;
}

/**
 * Play a "Summon" animation for a Pokemon
 * @param {*} target 
 * @param {*} extendSequence 
 * @returns 
 */
function SummonPokemon(target, shiny, extendSequence=null) {
  const cry = game.modules.get(MODULENAME)?.api?.logic?.ActorCry(target?.actor);
  const preloads = ["modules/pokemon-assets/audio/bgs/pokeball-escape.mp3"];
  if (cry) preloads.push(cry);
  Sequencer.Preloader.preload(preloads);

  const volume = VolumeSettings.getVolume("catch");
  const cryVolume = VolumeSettings.getVolume("cry");
  const sequence = extendSequence ?? new Sequence({ moduleName: "pokemon-assets", softFail: true });

  const targetCenter = target.center ?? {
    x: target.x + (target.width * (target.scene?.grid?.sizeX ?? game.scenes.active?.grid?.sizeX ?? 100) / 2),
    y: target.y + (target.height * (target.scene?.grid?.sizeY ?? game.scenes.active?.grid?.sizeX ?? 100) / 2)
  };

  sequence.sound()
    .file(`modules/pokemon-assets/audio/bgs/pokeball-escape.mp3`)
    .volume(volume)
    .locally()
  sequence.effect()
    .atLocation(targetCenter)
    .file("modules/pokemon-assets/img/animations/pokeball_open.json")
    .playbackRate(0.75)
    .size((target?.width ?? 1) * 3, { gridUnits: true })
    .locally()
    .waitUntilFinished();
  sequence.localAnimation()
    .on(target)
    .opacity(1);

  if (cry) {
    sequence.sound()
      .file(cry)
      .delay(150)
      .volume(cryVolume)
      .locally()
      .waitUntilFinished();
  }

  if (shiny) {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/pokemon-shiny.mp3`)
      .delay(500)
      .volume(volume)
      .locally()
    sequence.effect()
      .atLocation(targetCenter)
      .delay(500)
      .file("modules/pokemon-assets/img/animations/shiny_sparkle.json")
      .playbackRate(0.5)
      .size((target?.width ?? 1) * 3, { gridUnits: true })
      .locally()
  }

  return sequence;
}

/**
 * Play a "Summon" animation for a wild Pokemon
 * @param {*} target 
 * @param {*} shiny 
 * @param {*} extendSequence 
 */
function SummonWildPokemon(target, shiny, extendSequence=null) {
  const cry = game.modules.get(MODULENAME)?.api?.logic?.ActorCry(target?.actor);
  const preloads = ["modules/pokemon-assets/audio/bgs/grass-shake.mp3"];
  if (cry) preloads.push(cry);
  Sequencer.Preloader.preload(preloads);

  const volume = VolumeSettings.getVolume("catch");
  const cryVolume = VolumeSettings.getVolume("cry");
  const sequence = extendSequence ?? new Sequence({ moduleName: "pokemon-assets", softFail: true });

  const targetCenter = target.center ?? {
    x: target.x + (target.width * (target.scene?.grid?.sizeX ?? game.scenes.active?.grid?.sizeX ?? 100) / 2),
    y: target.y + (target.height * (target.scene?.grid?.sizeY ?? game.scenes.active?.grid?.sizeX ?? 100) / 2)
  };

  sequence.sound()
    .file(`modules/pokemon-assets/audio/bgs/grass-shake.mp3`)
    .volume(volume)
    .locally()
  sequence.effect()
    .atLocation(targetCenter)
    .file("modules/pokemon-assets/img/animations/grass_shake.json")
    .playbackRate(0.2)
    .size((target?.width ?? 1) * 2, { gridUnits: true })
    .locally()
    .waitUntilFinished();

  if (cry) {
    sequence.sound()
      .file(cry)
      .volume(cryVolume)
      .locally()
      .waitUntilFinished();
  }

  if (shiny) {
    sequence.sound()
      .file(`modules/pokemon-assets/audio/bgs/pokemon-shiny.mp3`)
      .delay(500)
      .volume(volume)
      .locally()
    sequence.effect()
      .atLocation(targetCenter)
      .delay(500)
      .file("modules/pokemon-assets/img/animations/shiny_sparkle.json")
      .playbackRate(0.5)
      .size((target?.width ?? 1) * 3, { gridUnits: true })
      .locally()
  }

  return sequence;
}

/**
 * 
 * @param {*} tile 
 * @param {*} actor 
 * @param {*} items 
 * @param {*} message 
 */
async function PickUpItem(tile, actor, items, message) {
  const itemObjects = (await Promise.all(items.map(uuid=>fromUuid(uuid)))).map(item=>item.toObject());
  
  const awardItems = game.modules.get(MODULENAME)?.api?.scripts?.AwardItems;
  Dialog.prompt({ content: message, options: { pokemon: true }, callback: async ()=>{
    DeleteTile(tile.uuid).then(()=>awardItems(actor, itemObjects)).catch(()=>{
      Dialog.prompt({
        content: `Oops! Someone else grabbed ${items.length > 1 ? "them" : "it"} first!`,
        options: { pokemon: true }
      });
    })
  }});
}

/**
 * Play the interaction sound!
 */
export async function Interact(options = { sound: `modules/pokemon-assets/audio/bgs/a-button.mp3`}) {
  if (game.settings.get(MODULENAME, "playInteractSound")) {
    await new Sequence({ moduleName: MODULENAME, softFail: true })
      .sound()
        .file(options.sound ?? `modules/pokemon-assets/audio/bgs/a-button.mp3`)
        .volume(VolumeSettings.getVolume("interact"))
        .locally(true)
        .waitUntilFinished()
      .play();
  }
}

async function DeleteTile(tileUuid) {
  if (!game.user.isGM) return socket.current().executeAsGM("deleteTile", tileUuid);
  const tile = await fromUuid(tileUuid);
  await tile.delete();
}

/**
 * Play the Rock Smash animation and destroy the tile.
 * @param {TileDocument} tile the tile document to destroy using Rock Smash
 */
async function TriggerRockSmash(tile) {
  if (!game.user.isGM) return;

  await sleep(300);
  await new Sequence()
    .sound()
      .file(`modules/pokemon-assets/audio/bgs/field-move-rock-smash.mp3`)
      .volume(VolumeSettings.getVolume("rock-smash"))
    .animation()
      .on(tile)
      .delay(100)
      .hide()
    .effect()
      .atLocation(tile)
      .file("modules/pokemon-assets/img/animations/rock_smash_frlg.json")
      .playbackRate(0.25)
      .size(1, { gridUnits: true })
      .belowTokens()
      .async()
    .play();
  await tile.delete();
}

/**
 * Play the Cut animation and destroy the tile.
 * @param {TileDocument} tile the tile document to destroy using Cut
 */
async function TriggerCut(tile) {
  if (!game.user.isGM) return;

  await sleep(300);
  await new Sequence()
    .sound()
      .file(`modules/pokemon-assets/audio/bgs/field-move-cut.mp3`)
      .volume(VolumeSettings.getVolume("cut"))
    .animation()
      .on(tile)
      .delay(100)
      .hide()
    .effect()
      .atLocation(tile)
      .file("modules/pokemon-assets/img/animations/cut_frlg.json")
      .playbackRate(0.25)
      .size(1, { gridUnits: true })
      .belowTokens()
      .async()
    .play();
  await tile.delete();
}

/**
 * Play the Whirlpool animation and destroy the tile.
 * @param {TileDocument} tile the tile document to destroy using Whirlpool
 */
async function TriggerWhirlpool(tile) {
  if (!game.user.isGM) return;

  await sleep(300);
  await new Sequence()
    .animation()
      .on(tile)
      .duration(1000)
      .fadeOut(1000)
      .opacity(1)
      .async()
    .play();
  await tile.delete();
}

/**
 * Play a climbing animation, either rock climb or waterfall
 * @param climbType either "rocky-wall" or "waterfall"
 * @param to the destination to move the token to
 * @param args 
 */
async function TriggerClimb(climbType, to, ...args) {
  const [scene, regionDocument, regionBehavior, { data: { token }, user }] = args;
  if (!token) return;
  if (user.id !== game.user.id) return; // run only as the triggering user

  // require the token to be facing towards "to"
  if (!(
      (to.x > token.x && TokenHasDirection(token, ["upright","right","downright"])) ||
      (to.x < token.x && TokenHasDirection(token, ["upleft","left","downleft"])) ||
      (to.y < token.y && TokenHasDirection(token, ["upleft","up","upright"])) ||
      (to.y > token.y && TokenHasDirection(token, ["downleft","down","downright"]))
    )) {
    return;
  }

  const grid = token?.scene?.grid;

  // check if we can do this
  const logic = game.modules.get(MODULENAME).api.logic;
  const fieldMoveParty = logic.FieldMoveParty(token);

  switch (climbType) {
    case "rocky-wall":
      const hasFieldMoveRockClimb = fieldMoveParty.find(logic.CanUseRockClimb);
      if (await UseFieldMove("RockClimb", hasFieldMoveRockClimb, !!hasFieldMoveRockClimb && game.settings.get(MODULENAME, "canUseRockClimb"), token._climbing)) {
        // set a volatile local variable that this token is currently using Rock Climb
        token._climbing = true;
      } else {
        return;
      }
      const preTo = to;
      const animationOptions = {};

      let seq = await new Sequence();
      if (token.y > to.y) {
        const dgY = Math.round((token.y - preTo.y) / (grid?.sizeY ?? 100));
        animationOptions.duration = dgY * 100;

        for (let a=0; a<dgY; a++) {
          seq = seq.effect()
              .atLocation(grid?.getSnappedPoint({ 
                x: (token.x * (dgY - a) + preTo.x * (a)) / dgY,
                y: token.y - (a * grid.sizeY)
              }, { mode: CONST.GRID_SNAPPING_MODES.CENTER }))
              .file("modules/pokemon-assets/img/animations/rock_smash_dppt.json")
              .size(3, { gridUnits: true })
              // .belowTokens()
              .fadeOut(100)
              .delay(a * 100);
        }
      }
      seq.play();
      await token.update(to, { animation: animationOptions });

      return;
    case "waterfall":
      const hasFieldMoveWaterfall = fieldMoveParty.find(logic.CanUseWaterfall);
      if (await UseFieldMove("Waterfall", hasFieldMoveWaterfall, !!hasFieldMoveWaterfall && game.settings.get(MODULENAME, "canUseWaterfall"), token._waterfall)) {
        // set a volatile local variable that this token is currently using Waterfall
        token._waterfall = true;
      } else {
        return;
      }
      await token.update(to);
      return;
    default: return;
  }
}

export async function UseFieldMove(fieldMove, who, canUse, skipQuery) {
  if (canUse) {
    if (skipQuery|| await new Promise((resolve)=>Dialog.confirm({
      title: game.i18n.localize(`POKEMON-ASSETS.FieldMoves.${fieldMove}.Title`),
      content: game.i18n.localize(`POKEMON-ASSETS.FieldMoves.${fieldMove}.CanUse`),
      yes: ()=>resolve(true),
      no: ()=>resolve(false),
      options: {
        pokemon: true,
      },
    }))) {
      await Dialog.prompt({
        title: game.i18n.localize(`POKEMON-ASSETS.FieldMoves.${fieldMove}.Title`),
        content: game.i18n.format(`POKEMON-ASSETS.FieldMoves.${fieldMove}.Used`, { name: who?.name}),
        options: {
          pokemon: true,
        },
      });
      return true;
    };
    return false;
  } else {
    Dialog.prompt({
      title: game.i18n.localize(`POKEMON-ASSETS.FieldMoves.${fieldMove}.Title`),
      content: game.i18n.localize(`POKEMON-ASSETS.FieldMoves.${fieldMove}.CannotUse`),
      options: {
        pokemon: true,
      },
    });
    return false;
  }
}


/**
 * Check if the token is facing one of the given directions
 * @param {TilesetToken} token 
 * @param {array} directions 
 * @returns 
 */
function TokenHasDirection(token, directions) {
  return !token?.object?.isTileset || directions.includes(token?.object?.direction);
}

class PainterTemplate extends MeasuredTemplate {
  #initialLayer;
  #events;
  #moveTime;

  /**
   * Creates a preview of the template.
   * @returns {Promise}  A promise that resolves with the final template if created.
   */
  drawPreview() {
    const initialLayer = canvas.activeLayer;

    // Draw the template and switch to the template layer
    this.draw();
    this.layer.activate();
    this.layer.preview.addChild(this);

    // Hide the sheet that originated the preview
    // this.actorSheet?.minimize();

    // Activate interactivity
    return this.activatePreviewListeners(initialLayer);
  }

  /** @override */
  async _draw(options) {

    // Load Fill Texture
    if ( this.document.texture ) {
      this.texture = await loadTexture(this.document.texture, {fallback: "icons/svg/hazard.svg"});
    } else {
      this.texture = null;
    }

    // Template Shape
    this.template = this.addChild(new PIXI.Graphics());

    // Enable highlighting for this template
    canvas.interface.grid.addHighlightLayer(this.highlightId);
  }

  /**
   * Refresh the displayed state of the MeasuredTemplate.
   * This refresh occurs when the user interaction state changes.
   * @protected
   */
  _refreshState() {

    // Template Visibility
    const wasVisible = this.visible;
    this.visible = this.isVisible && !this.hasPreview;
    if ( this.visible !== wasVisible ) MouseInteractionManager.emulateMoveEvent();

    // Sort on top of others on hover
    this.zIndex = this.hover ? 1 : 0;

    // Control Icon Visibility
    const isHidden = this.document.hidden;

    // Alpha transparency
    const alpha = isHidden ? 0.5 : 1;
    this.template.alpha = alpha;
    const highlightLayer = canvas.interface.grid.getHighlightLayer(this.highlightId);
    highlightLayer.visible = this.visible;
    // FIXME the elevation is not considered in sort order of the highlight layers
    highlightLayer.zIndex = this.document.sort;
    highlightLayer.alpha = alpha;
    this.alpha = this._getTargetAlpha();
  }

  _refreshRulerText() { }

  _refreshElevation() { }

  /* -------------------------------------------- */

  /**
   * Activate listeners for the template preview
   * @param {CanvasLayer} initialLayer  The initially active CanvasLayer to re-activate after the workflow is complete
   * @returns {Promise}                 A promise that resolves with the final measured template if created.
   */
  activatePreviewListeners(initialLayer) {
    return new Promise((resolve, reject) => {
      this.#initialLayer = initialLayer;
      this.#events = {
        cancel: this._onCancelPlacement.bind(this),
        confirm: this._onConfirmPlacement.bind(this),
        move: this._onMovePlacement.bind(this),
        resolve,
        reject,
      };

      // Activate listeners
      canvas.stage.on("mousemove", this.#events.move);
      canvas.stage.on("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = this.#events.cancel;
    });
  }

  /* -------------------------------------------- */

  /**
   * Shared code for when template placement ends by being confirmed or canceled.
   * @param {Event} event  Triggering event that ended the placement.
   */
  async _finishPlacement(event) {
    this.layer._onDragLeftCancel(event);
    canvas.stage.off("mousemove", this.#events.move);
    canvas.stage.off("mousedown", this.#events.confirm);
    canvas.app.view.oncontextmenu = null;
    canvas.app.view.onwheel = null;
    this.#initialLayer.activate();
    // await this.actorSheet?.maximize();
  }

  /* -------------------------------------------- */

  /**
   * Move the template preview when the mouse moves.
   * @param {Event} event  Triggering mouse event.
   */
  _onMovePlacement(event) {
    event.stopPropagation();
    const now = Date.now(); // Apply a 20ms throttle
    if ( now - this.#moveTime <= 20 ) return;
    const center = event.data.getLocalPosition(this.layer);
    const snapped = snapToGrid(center, canvas.grid);
    this.document.updateSource({x: snapped.x, y: snapped.y});
    this.refresh();
    this.#moveTime = now;
  }

  /* -------------------------------------------- */

  /**
   * Confirm placement when the left mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onConfirmPlacement(event) {
    await this._finishPlacement(event);
    const destination = snapToGrid(this.document, canvas.grid);
    this.document.updateSource(destination);
    this.#events.resolve(this.document.toObject());
  }

  /* -------------------------------------------- */

  /**
   * Cancel placement when the right mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onCancelPlacement(event) {
    await this._finishPlacement(event);
    this.#events.reject();
  }
}

/**
 * @returns {Promise}  A promise that resolves with the final location selected.
 */
export async function UserPaintArea() {
  const cls = CONFIG.MeasuredTemplate.documentClass;
  const template = new cls({
    t: "rect",
    user: game.user.id,
    distance: Math.hypot(1, 1),
    width: 1,
    direction: 45,
    x: 0,
    y: 0,
    fillColor: game.user.color
  }, {parent: canvas.scene});
  const location = await (new PainterTemplate(template)).drawPreview();
  if (!location) return null;

  const { x, y } = location;
  return { x, y };
}

async function UserChooseDirections({ prompt, directions } = { prompt: "Select a direction", directions: ["all"] }) {
  const isAll = directions.includes("all") || directions.length >= 8;
  if (isAll) {
    directions = ["upleft", "up", "upright", "left", "right", "downleft", "down", "downright"];
  }
  const selectedDirections = await new Promise(async (resolve)=>{
    Dialog.prompt({
      title: 'Select Directions',
      content: `
          <p>${prompt}</p>
          <div class="directional-chooser">
            <label class="upleft"><input type="checkbox" name="upleft" ${directions.includes("upleft") ? "checked" : ""}><span><i class="fa-solid fa-arrow-up-left"></i></span></label>
            <label class="up"><input type="checkbox" name="up" ${directions.includes("up") ? "checked" : ""}><span><i class="fa-solid fa-arrow-up"></i></span></label>
            <label class="upright"><input type="checkbox" name="upright" ${directions.includes("upright") ? "checked" : ""}><span><i class="fa-solid fa-arrow-up-right"></i></span></label>
            <label class="left"><input type="checkbox" name="left" ${directions.includes("left") ? "checked" : ""}><span><i class="fa-solid fa-arrow-left"></i></span></label>
            <span class="center"></span>
            <label class="right"><input type="checkbox" name="right" ${directions.includes("right") ? "checked" : ""}><span><i class="fa-solid fa-arrow-right"></i></span></label>
            <label class="downleft"><input type="checkbox" name="downleft" ${directions.includes("downleft") ? "checked" : ""}><span><i class="fa-solid fa-arrow-down-left"></i></span></label>
            <label class="down"><input type="checkbox" name="down" ${directions.includes("down") ? "checked" : ""}><span><i class="fa-solid fa-arrow-down"></i></span></label>
            <label class="downright"><input type="checkbox" name="downright" ${directions.includes("downright") ? "checked" : ""}><span><i class="fa-solid fa-arrow-down-right"></i></span></label>
          </div>
      `,
      callback: (html) => resolve(html.find('.directional-chooser input[type="checkbox"]:checked').toArray().map(el=>el.name).filter(n=>n!=="all") ?? null),
    }).catch(()=>{
      resolve(null);
    });
  });

  return selectedDirections;
}

async function ShowPopup(username, message) {
  return Dialog.wait({
    title: `Message From: ${username}`,
    content: message,
    close: ()=>{},
    buttons: {}, // no buttons
  });
}

async function ShowGMPopup(message) {
  if (game.user.isGM) {
    return ShowPopup("Yourself", message);
  }
  return socket.current().executeAsGM("showPopup", game.user.name, message);
}



export function register() {
  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  module.api.scripts = {
    PokemonCenter,
    GrassShake,
    TokenReact,
    TrainerEyesMeet,
    PokemonComputer,
    SwitchScenes,
    HandleIce,
    HandleJumps,
    ThrowPokeball,
    CatchPokemon,
    SummonPokemon,
    SummonWildPokemon,
    IndicateDamage,
    Interact,
    TokenHasDirection,
    UserPaintArea,
    UserChooseDirections,
    UseFieldMove,
    TriggerRockSmash,
    TriggerCut,
    TriggerClimb,
    TriggerWhirlpool,
    PickUpItem,
    ShowGMPopup,
  };

  socket.registerSocket("deleteTile", DeleteTile);
  socket.registerSocket("triggerRockSmash", async (tileId)=>TriggerRockSmash(await fromUuid(tileId)));
  socket.registerSocket("triggerCut", async (tileId)=>TriggerCut(await fromUuid(tileId)));
  socket.registerSocket("triggerWhirlpool", async (tileId)=>TriggerWhirlpool(await fromUuid(tileId)));

  socket.registerSocket("showPopup", async (username, message)=>ShowPopup(await fromUuid(tileId)));
}