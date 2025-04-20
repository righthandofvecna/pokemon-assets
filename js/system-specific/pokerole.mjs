import { MODULENAME, tokenScene } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";
import { default as SPECIAL_CRIES } from "../../data/cries.js";



function isActorPokemon(actor, data={}) {
  const dexNum = data?.system?.pokedexId ?? actor?.system?.pokedexId ?? 0;
  return (data.type ?? actor.type) == "pokemon" && dexNum > 0;
}

function _getPokemonSprite(actor, data={}) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;

  const dexNum = data?.system?.pokedexId ?? actor?.system?.pokedexId ?? 0;
  const name = data.name ?? actor.name;
  const regionalVariant = (()=>{
    if (name.includes("Alolan ")) return "_alolan";
    if (name.includes("Galarian ")) return "_galarian";
    if (name.includes("Hisuian ")) return "_hisuian";
    if (name.includes("Paldean ")) return "_paldean";
    return "";
  })();
  const mega = (()=>{
    if (name.includes("Mega X ")) return "MEGA_X";
    if (name.includes("Mega Y ")) return "_MEGA_Y";
    if (name.includes("Mega ")) return "_MEGA";
    return "";
  })();
  // const shiny = config.shiny ? "s" : "";
  // const gender = (()=>{
  //   if (config.gender == "male") return "m";
  //   if (config.gender == "female") return "f";
  //   return "";
  // })();
  const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
  const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
  const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
  const dexString = `${dexNum}`.padStart(4, "0");

  // check if everything is populated!
  for (const testSrc of [
    // `${pmdPath}${dexString}${gender}${shiny}${regionalVariant}.png`,
    // `${pmdPath}${dexString}${shiny}${regionalVariant}.png`,
    // `${pmdPath}${dexString}${gender}${regionalVariant}.png`,
    `${pmdPath}${dexString}${mega}${regionalVariant}.png`,
    `${pmdPath}${dexString}${mega}.png`,
    `${pmdPath}${dexString}${regionalVariant}.png`,
    `${pmdPath}${dexString}.png`,
  ]) {
    if (SpritesheetGenerator.hasSheetSettings(testSrc)) {
      return testSrc;
    }
  }
  return null;
}

function OnPreCreateActor(actor, data) {
  if (isActorPokemon(actor, data)) {
    if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;

    const name = data.name ?? actor.name;
    const img = _getPokemonSprite(actor, data);
    if (img) {
      const updates = {
        flags: {
          "pokemon-assets": {
            originalName: name,
          }
        },
        prototypeToken: _getTokenChangesForSpritesheet(img)
      };
      foundry.utils.mergeObject(data, foundry.utils.deepClone(updates));
      actor.updateSource(updates);
    }
    return;
  } else {
    if (!game.settings.get(MODULENAME, "autoTrainerImage")) return;
    if (!(data.img ?? actor.img).includes("icons/svg/mystery-man.svg")) return;
    const img = (()=>{
      let possibleImages = SpritesheetGenerator.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
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
  if ((!src || !SpritesheetGenerator.hasSheetSettings(src)) && isActorPokemon(token.actor) && token.actor?.prototypeToken?.flags?.[MODULENAME]?.spritesheet === undefined) {
    src = _getPokemonSprite(token.actor, {}) ?? src;
  }

  if (!src || !SpritesheetGenerator.hasSheetSettings(src)) return;

  const updates = _getTokenChangesForSpritesheet(src);
  token.updateSource(updates);
}

function OnPreUpdateActor(actor, updates, options) {
  options.oldhp ??= actor?.system?.hp?.value;
}

function OnUpdateActor(actor, updates, options) {
  const hp = updates?.system?.hp?.value ?? actor?.system?.hp?.value ?? 0;
  if (hp && hp < (options.oldhp ?? 0)) {
    if (!game.settings.get(MODULENAME, "playDamageAnimation")) return;
    // check if the target fainted
    if (hp <= 0) return;

    // check if 1/5 hp or less
    const lowHp = hp <= (actor?.system?.hp?.max ?? 0) / 5;

    const token = game.scenes.active.tokens.find(t=>t.actor.uuid === actor.uuid);
    game.modules.get("pokemon-assets").api.scripts.IndicateDamage(actor, token, lowHp);
    return;
  }
}

/**
 * Get the cry for a given actor
 * @param {*} actor 
 * @returns the path to the cry file
 */
function ActorCry(actor) {
  if (!actor) return null;

  const dn = actor?.system?.pokedexId ?? 0;
  if (dn === undefined) return null;

  const name = actor.getFlag(MODULENAME, "originalName") ?? actor.name;
  const form = (()=>{
    if (name.includes("Alolan ")) return "_alolan";
    if (name.includes("Galarian ")) return "_galarian";
    if (name.includes("Hisuian ")) return "_hisuian";
    if (name.includes("Paldean ")) return "_paldean";
    return "";
  })();
  const mega = (()=>{
    if (name.includes("Mega X ")) return "MEGA_X";
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
  const trainerId = actor.getFlag(MODULENAME, "trainerId");
  const source = trainerId ? scene?.tokens?.find(t=>t.actor?.uuid === trainerId || t.baseActor?.uuid === trainerId) : null;
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
    sequence = game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, shiny, sequence);
  } else {
    sequence = game.modules.get("pokemon-assets").api.scripts.SummonWildPokemon(token, shiny, sequence);
  }
  await sequence.play();
}

function OnRenderPokeroleActorSheet(sheet, html, context) {
  if (!isActorPokemon(sheet.object)) return;

  // add a pokeball field to the sheet
  const ball = sheet.actor.getFlag(MODULENAME, "pokeballImage") ?? game.settings.get(MODULENAME, "defaultBallImage");
  const pbf = $(`<div class="pokeball-field" data-tooltip="POKEMON-ASSETS.Fields.Pokeball.hint">${game.i18n.localize("POKEMON-ASSETS.Fields.Pokeball.label")}: <img src="${ball}"></div>`);
  $(html).find(".pokedex-number-name").after(pbf);
  $(pbf).on("click", (event) => {
    event.preventDefault();
    new FilePicker({
      type: "image",
      callback: (path) => {
        if (!path) return;
        sheet.actor.setFlag(MODULENAME, "pokeballImage", path)
      },
    }).browse(ball);
  });

  // Add a trainer field to the sheet
  const trainer = sheet.actor.getFlag(MODULENAME, "trainerId") ?? null;
  fromUuid(trainer).then(trainer=>{
    const name = trainer?.name ?? game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.none");
    $(html).find(".pokedex-number-name").after(`<div class="trainer" data-tooltip="POKEMON-ASSETS.Settings.Trainer.hint">${game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.label")}: ${name}</div>`);
    // add a drop hook
    const trainerDiv = $(html).find(".trainer").get(0);
    trainerDiv.addEventListener("drop", async (event) => {
      event.preventDefault();
      const data = TextEditor.getDragEventData(event);
      if (data.type !== "Actor") {
        ui.notifications.error(game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.dropWarning"));
        return;
      }
      const actor = await fromUuid(data.uuid);
      if (!actor) return;
      if (isActorPokemon(actor)) {
        ui.notifications.error(game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.dropWarning"));
        return;
      }
      sheet.actor.setFlag(MODULENAME, "trainerId", actor.uuid);
    });
  });

}


export function register() {
  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createToken", OnCreateToken);
  Hooks.on("preUpdateActor", OnPreUpdateActor);
  Hooks.on("updateActor", OnUpdateActor);
  Hooks.on("renderPokeroleActorSheet", OnRenderPokeroleActorSheet);

  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;

  api.logic ??= {};
  api.logic.ActorCry ??= ActorCry;
};