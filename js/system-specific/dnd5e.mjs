import { MODULENAME, tokenScene } from "../utils.mjs";
import { PokemonSheets } from "../pokemon-sheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";
import { default as SPECIAL_CRIES } from "../../data/cries.js";


function getPokedexId(actor, data={}) {
  const description = data?.system?.details?.biography?.public ?? actor?.system?.details?.biography?.public ?? "";
  const dexRe = /Pok[eé]dex Number\s*:\s*<\/strong>\s*#?(\d{1,4})\./ig;
  const dexMatch = dexRe.exec(description);
  if (dexMatch) {
    return parseInt(dexMatch[1]);
  }
  return undefined;
}

function isActorPokemon(actor, data={}) {
  return getPokedexId(actor, data) !== undefined;
}

function _getPokemonSprite(actor, data={}) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return { img: null, settings: null };

  const dex = getPokedexId(actor, data);
  const name = data.name ?? actor.name;
  const region = (()=>{
    if (name.includes("Alolan ")) return "alolan";
    if (name.includes("Galarian ")) return "galarian";
    if (name.includes("Hisuian ")) return "hisuian";
    if (name.includes("Paldean ")) return "paldean";
    return "";
  })();
  const mega = (()=>{
    if (name.includes("Mega X ")) return "MEGA_X";
    if (name.includes("Mega Y ")) return "MEGA_Y";
    if (name.includes("Mega ")) return "MEGA";
    return "";
  })();
  // const shiny = config.shiny ? "s" : "";
  // const gender = (()=>{
  //   if (config.gender == "male") return "m";
  //   if (config.gender == "female") return "f";
  //   return "";
  // })();
  return PokemonSheets.getPokemon({
    dex,
    mega,
    region,
  });
}

function OnPreCreateActor(actor, data) {
  if (isActorPokemon(actor, data)) {
    if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;

    const name = data.name ?? actor.name;
    const { img, settings } = _getPokemonSprite(actor, data);
    if (img) {
      const updates = {
        flags: {
          "pokemon-assets": {
            originalName: name,
          }
        },
        prototypeToken: settings,
      };
      foundry.utils.mergeObject(data, foundry.utils.deepClone(updates));
      actor.updateSource(updates);
    }
    return;
  } else {
    if (!game.settings.get(MODULENAME, "autoTrainerImage")) return;
    if (!(data.img ?? actor.img).includes("icons/svg/mystery-man.svg")) return;
    const img = (()=>{
      let possibleImages = PokemonSheets.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
      // const gender = (()=>{
      //   const genderSet = (data?.system?.sex ?? actor?.system?.sex ?? "genderless").toLowerCase().trim();
      //   if (genderSet === "genderless") return "";
      //   if (["f", "female", "girl", "woman", "lady", "she", "feminine", "fem", "dame", "gal", "lass", "lassie", "madam", "maiden", "doll", "mistress"].includes(genderSet)) {
      //     return "_f_";
      //   }
      //   return "_m_";
      // })();
      // possibleImages = possibleImages.filter(k=>k.includes(gender));
      if (possibleImages.size === 0) return null;
      return [...possibleImages][~~(Math.random() * possibleImages.size)];
    })();
    if (!img) return;
  
    const updates = {
      img: `modules/pokemon-assets/img/trainers-profile/${img}`,
      prototypeToken: _getTokenChangesForSpritesheet(`modules/pokemon-assets/img/trainers-overworld/${img}`),
    }
    foundry.utils.mergeObject(data, foundry.utils.deepClone(updates));
    actor.updateSource(updates);
    return;
  }

  
}

function OnPreCreateToken(token, tokenData) {
  let src = tokenData?.texture?.src ?? token?.texture?.src;
  if ((!src || !PokemonSheets.hasSheetSettings(src)) && isActorPokemon(token.actor) && token.actor?.prototypeToken?.flags?.[MODULENAME]?.spritesheet === undefined) {
    const { img, settings } = _getPokemonSprite(token.actor, {});
    if (!img) return;
    token.updateSource(settings);
  }
}

function OnPreUpdateActor(actor, updates, options) {
  options.oldhp ??= actor?.system?.attributes?.hp?.value;
}

function OnUpdateActor(actor, updates, options) {
  const hp = updates?.system?.attributes?.hp?.value ?? actor?.system?.attributes?.hp?.value ?? 0;
  if (hp && hp < (options.oldhp ?? 0)) {
    if (!game.settings.get(MODULENAME, "playDamageAnimation")) return;
    // check if the target fainted
    if (hp <= 0) return;

    // check if 1/5 hp or less
    const lowHp = hp <= (actor?.system?.attributes?.hp?.max ?? 0) / 5;

    const token = game.scenes.active.tokens.find(t=>t.actor.uuid === actor.uuid);
    game.modules.get(MODULENAME).api.scripts.IndicateDamage(actor, token, lowHp);
    return;
  }
}

/**
 * Get the cry for a given actor
 * @param {*} actor 
 * @returns the path to the cry file
 */
async function ActorCry(actor) {
  if (!actor) return null;

  const dn = getPokedexId(actor);
  if (dn === undefined || dn === -1) return null;

  const name = actor.getFlag(MODULENAME, "originalName") ?? actor.name;
  const form = (()=>{
    if (name.includes("Alolan ")) return "_alolan";
    if (name.includes("Galarian ")) return "_galarian";
    if (name.includes("Hisuian ")) return "_hisuian";
    if (name.includes("Paldean ")) return "_paldean";
    return "";
  })();
  const mega = (()=>{
    if (name.includes("Mega X ")) return "_MEGA_X";
    if (name.includes("Mega Y ")) return "_MEGA_Y";
    if (name.includes("Mega ")) return "_MEGA";
    return "";
  })();
  // const gender = (()=>{
  //   if (actor.system.gender == "male") return "m";
  //   if (actor.system.gender == "female") return "f";
  //   return "";
  // })();

  if (dn > 0 && dn <= 1025) {
    // Official Pokemon
    const dexNum = `${dn}`.padStart(4, "0");
    if (!dexNum || dexNum === "0000") return null;
    const cryPath = `modules/pokemon-assets/audio/cries/${dexNum.substring(0, 2)}XX/${dexNum.substring(0, 3)}X/`;
    
    // check if everything is populated!
    for (const testSrc of [
      // `${dexNum}${gender}${form}${mega}`,
      `${dexNum}${form}${mega}`,
      // `${dexNum}${gender}${mega}`,
      `${dexNum}${form}`,
      `${dexNum}${mega}`,
      // `${dexNum}${gender}`
    ]) {
      if (SPECIAL_CRIES.has(testSrc)) {
        return `${cryPath}${testSrc}.mp3`;
      }
    }
    return `${cryPath}${dexNum}.mp3`;
  } else {
    // Custom Pokemon
    const folder = game.settings.get(MODULENAME, "homebrewCryFolder");
    if (!folder) return null;
    return `${folder}/${dn}.mp3`;
  }
}

async function OnCreateToken(token, options) {
  if (!game.settings.get(MODULENAME, "playSummonAnimation")) return;
  if (options.teleport || options.keepId) return; // don't play the animation if the token is teleporting
  
  const actor = token.actor;
  if (!isActorPokemon(actor)) return;
  const scene = tokenScene(token);
  const trainerId = actor.getFlag(MODULENAME, "trainerId"); // TODO: add this
  const source = trainerId ? scene?.tokens?.find(t=>t.actor?.uuid == trainerId || t.baseActor?.uuid == trainerId) : null;
  const isTrained = !!trainerId;

  const shiny = false;

  let sequence = null;
  if (isTrained) {
    if (token.object) token.object.localOpacity = 0;

    if (source) {
      const ballImg = await (async ()=>{
        return actor.getFlag(MODULENAME, "pokeballImage") ?? game.settings.get(MODULENAME, "defaultBallImage");
      })();
      sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(source, token, ballImg, true);
    }
    sequence = await game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, shiny, sequence);
  } else {
    sequence = await game.modules.get("pokemon-assets").api.scripts.SummonWildPokemon(token, shiny, sequence);
  }
  await sequence.play();
}

/**
 * Returns a function which takes in an actor and returns a boolean, true if the actor has the given move
 * @param {string} moveId 
 */
function HasMoveFunction(moveId) {
  /**
   * Returns whether or not the actor can use the move "moveId"
   * @param {Actor} actor
   * @return true if the actor can use the given move
   */
  return function (actor) {
    return actor.items.contents?.some(m => m.system.identifier == moveId) ?? false;
  };
}


export function register() {
  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createToken", OnCreateToken);
  Hooks.on("preUpdateActor", OnPreUpdateActor);
  Hooks.on("updateActor", OnUpdateActor);

  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;

  // api.controls = {
  //   ...(module.api.controls ?? {}),
  //   "pokemonCenter": {
  //     "label": "Pokemon Center",
  //     "callback": PokemonCenter,
  //   },
  // }

  api.logic ??= {};
  // api.logic.FieldMoveParty ??= (token)=>GetParty(token.actor);
  api.logic.CanUseRockSmash ??= HasMoveFunction("rock-smash");
  api.logic.CanUseCut ??= HasMoveFunction("cut");
  api.logic.CanUseStrength ??= HasMoveFunction("strength");
  api.logic.CanUseRockClimb ??= HasMoveFunction("rock-climb");
  api.logic.CanUseWaterfall ??= HasMoveFunction("waterfall");
  api.logic.CanUseWhirlpool ??= HasMoveFunction("whirlpool");
  api.logic.CanUseSurf ??= HasMoveFunction("surf");

  api.logic.ActorCry ??= ActorCry;
  // api.logic.ActorShiny ??= (actor)=>actor?.system?.shiny ?? false;

  api.logic.isPokemon ??= (actor)=>isActorPokemon(actor);

  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= HasMoveFunction;
};