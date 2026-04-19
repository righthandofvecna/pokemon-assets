import { MODULENAME, tokenScene } from "../utils.mjs";
import { PokemonSheets } from "../pokemon-sheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";
import { default as SPECIAL_CRIES } from "../../data/cries.js";



function isActorPokemon(actor, data={}) {
  const dexNum = data?.system?.pokedexId ?? actor?.system?.pokedexId ?? 0;
  return (data.type ?? actor.type) == "pokemon" && dexNum > 0;
}

function _getPokemonSprite(actor, data={}) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return { img: null, settings: null };

  const dex = data?.system?.pokedexId ?? actor?.system?.pokedexId ?? 0;
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

async function RegenerateActorTokenImg(actor) {
  const { img, settings } = _getPokemonSprite(actor);
  if (img) return {
    "texture.src": img,
    ...settings,
  }

  // check if the current actor image is a trainer
  if (actor.img.startsWith("modules/pokemon-assets/img/trainers-profile/")) {
    const trainerImg = `modules/pokemon-assets/img/trainers-overworld/${actor.img.substring(44)}`;
    if (PokemonSheets.hasSheetSettings(trainerImg)) {
      return {
        "texture.src": trainerImg,
        ..._getTokenChangesForSpritesheet(trainerImg),
      }
    }
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
  options.oldhp ??= actor?.system?.hp?.value;
  options.actorId ??= actor?.uuid;
}

function OnUpdateActor(actor, updates, options) {
  if (actor.uuid !== options.actorId) return;
  const hp = updates?.system?.hp?.value ?? actor?.system?.hp?.value ?? 0;
  if (hp && hp < (options.oldhp ?? hp)) {
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
async function ActorCry(actor) {
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

/**
 * Gets all the party members of the given actor (trainer or pokemon)
 * @param {Actor} actor 
 */
function GetParty(actor) {
  if (isActorPokemon(actor)) {
    // If it's a pokemon, return just itself
    return [actor];
  }
  
  // If it's a trainer, get all pokemon owned by this trainer
  const trainerId = actor.uuid;
  const party = game.actors.filter(a => 
    a.getFlag(MODULENAME, "trainerId") === trainerId
  );
  
  return [actor, ...party];
}

/**
 * Returns a function which takes in an actor and returns a boolean, true if the actor has the given move
 * @param {string} moveName 
 */
function HasMoveFunction(moveName) {
  /**
   * Returns whether or not the actor can use the move "slug"
   * @param {Actor} actor
   * @return true if the actor can use the given move
   */
  return function (actor) {
    return actor.itemTypes?.move?.some(m => m.system.learned && m.name == moveName) ?? false;
  };
}

function OnRenderPokeroleActorSheet(sheet, html, context) {
  if (!isActorPokemon(sheet.actor ?? sheet.object)) return;

  // Create fieldset with both pokeball and trainer fields
  const ball = sheet.actor.getFlag(MODULENAME, "pokeballImage") ?? game.settings.get(MODULENAME, "defaultBallImage");
  const trainerId = sheet.actor.getFlag(MODULENAME, "trainerId") ?? null;
  
  fromUuid(trainerId).then(async (trainer) => {
    const trainerLink = await (async ()=>{
      if (trainer) return await foundry.applications.ux.TextEditor.implementation.enrichHTML(trainer.link);
      return `<span>${game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.none")}</span>`;
    })()
    
    const fieldset = $(`
      <fieldset class="pokemon-assets-flags">
        <legend>Pokemon Assets Flags</legend>
        <div class="trainer" data-tooltip="POKEMON-ASSETS.Settings.Trainer.hint">
          <label>${game.i18n.localize("POKEMON-ASSETS.Settings.Trainer.label")}:</label> ${trainerLink}
        </div>
        <div class="pokeball-field" data-tooltip="POKEMON-ASSETS.Fields.Pokeball.hint">
          <label>${game.i18n.localize("POKEMON-ASSETS.Fields.Pokeball.label")}:</label> <img src="${ball}" />
        </div>
      </fieldset>
    `);
    
    $(html).find(".species-data:last-child .pokedex-number-name").after(fieldset);
    
    // Add pokeball click handler
    fieldset.find(".pokeball-field").on("click", (event) => {
      event.preventDefault();
      new FilePicker({
        type: "image",
        callback: (path) => {
          if (!path) return;
          sheet.actor.setFlag(MODULENAME, "pokeballImage", path);
        },
      }).browse(ball);
    });
    
    // Add trainer drop handler
    fieldset.find(".trainer").get(0).addEventListener("drop", async (event) => {
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

/**
 * Update the ownership of the given pokemon and assign it to the trainer
 */
async function AssignPokemonToActor(pokemon, actor) {
  if (!pokemon || !actor) return;
  const ownership = foundry.utils.deepClone(pokemon.ownership);
  for (const playerId of Object.keys(actor.ownership)) {
    ownership[playerId] = Math.max(ownership[playerId] ?? 0, actor.ownership[playerId]);
  }
  await pokemon.update({
    ownership,
    [`flags.${MODULENAME}.trainerId`]: actor.uuid,
  });
}

export function register() {
  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("preUpdateActor", OnPreUpdateActor);
  Hooks.on("updateActor", OnUpdateActor);
  Hooks.on("renderPokeroleActorSheet", OnRenderPokeroleActorSheet);

  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;

  api.logic ??= {};
  api.logic.HealParty ??= async (actors) => {
    for (const actor of actors) {
      await actor.update({
        'system.hp.value': actor.system.hp.max,
        'system.will.value': actor.system.will.max,
        'system.ailments': []
      });
    }
  };
  api.logic.GetSummonSource ??= async (token) => {
    const actor = token.actor;
    const trainerId = actor.getFlag(MODULENAME, "trainerId");
    if (!trainerId) return null;
    const source = tokenScene(token)?.tokens?.find(t=>t.actor?.uuid == trainerId || t.baseActor?.uuid == trainerId) ?? null;
    const ballImg = actor.getFlag(MODULENAME, "pokeballImage") ?? game.settings.get(MODULENAME, "defaultBallImage");
    return { source, ballImg };
  };
  api.logic.FieldMoveParty ??= (token)=>GetParty(token.actor);
  api.logic.CanUseRockSmash ??= HasMoveFunction("Rock Smash");
  api.logic.CanUseCut ??= HasMoveFunction("Cut");
  api.logic.CanUseStrength ??= HasMoveFunction("Strength");
  api.logic.CanUseRockClimb ??= HasMoveFunction("Rock Climb");
  api.logic.CanUseWaterfall ??= HasMoveFunction("Waterfall");
  api.logic.CanUseWhirlpool ??= HasMoveFunction("Whirlpool");
  api.logic.CanUseSurf ??= HasMoveFunction("Surf");

  api.logic.ActorCry ??= ActorCry;
  api.logic.ActorShiny ??= (actor)=>actor?.system?.shiny ?? false;

  api.logic.isPokemon ??= (token)=>isActorPokemon(token?.actor);

  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= HasMoveFunction;
  api.scripts.RegenerateActorTokenImg ??= RegenerateActorTokenImg;
  api.scripts.AssignPokemonToActor ??= AssignPokemonToActor;
};