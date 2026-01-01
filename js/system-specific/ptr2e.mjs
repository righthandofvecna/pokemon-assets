import { early_isGM, sleep, tokenScene, getFiles, MODULENAME } from "../utils.mjs";
import { PokemonSheets } from "../pokemon-sheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";
import { RefreshTokenIndicators } from "../scripts.mjs";
import { default as SPECIAL_CRIES } from "../../data/cries.js";

import * as ptr2eSheet from "./ptr2e/sheet.mjs";
import * as ptr2eFixes from "./ptr2e/fixes.mjs";

/**
 * A Chat Message listener, that should be run on EVERY client
 * @param {*} message 
 * @returns 
 */
async function OnCreateChatMessage(message) {
  //
  // Handle Capture Animations
  //
  if (message.type === "capture") {
    if (!game.settings.get(MODULENAME, "playCaptureAnimation")) return;
    const sourceId = message.actor.uuid;
    const targetId = message.system.target;
    const { source, target } = (()=>{
      // find a scene where both exist
      for (const scene of [game.scenes.active, ...game.scenes.contents]) {
        const source = scene.tokens.find(t=>t.actor.uuid === sourceId)
        const target = scene.tokens.find(t=>t.actor.uuid === targetId)
        if (!source || !target) continue;
        return { source, target };
      }
    })();
    if (!source || !target) return;

    await sleep(1500);

    const ballImg = (()=>{
      if (message.system.action?.img) return message.system.action.img;
      // try to get items
      const ballSlug = message.system.slug.substr(0, message.system.slug.length - 4);
      const domainItem = message.system.origin?.items?.filter?.((i)=>i.system.slug === ballSlug);
      if (!!domainItem && domainItem.length > 0) return domainItem[0].img;
      return game.settings.get(MODULENAME, "defaultBallImage");
    })();
    
    const hit = message.system.context.state.accuracy;
    const crit = message.system.context.state.crit;
    const shakes = 3 - [
      message.system.context.state.shake4,
      message.system.context.state.shake3,
      message.system.context.state.shake2,
      message.system.context.state.shake1,
    ].lastIndexOf(false);

    let sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImg,
      hit);
    if (hit) {
      sequence = game.modules.get("pokemon-assets").api.scripts.CatchPokemon(
        target,
        ballImg,
        Math.min(shakes, crit ? 1 : 3),
        crit ? shakes >= 1 : shakes >= 4,
        sequence);
    }
    await sequence.play();
    return;
  }

  //
  // Handle the Damage Hit Indicator and sounds
  //
  if (message.type === "damage-applied") {
    if (!game.settings.get(MODULENAME, "playDamageAnimation")) return;
    const target = message.system.target;

    // check that the damage applied is positive
    if (message.system.damageApplied <= 0) return;

    // check if the target fainted
    if ((target.system.health.value ?? 0) <= 0) return;

    // check if 1/5 hp or less
    const lowHp = target.system.health.value <= target.system.health.max / 5;

    const token = game.scenes.active.tokens.find(t=>t.actor.uuid === target.uuid);
    game.modules.get("pokemon-assets").api.scripts.IndicateDamage(target, token, lowHp);
    return;
  }
}


async function ImageResolver_createFromSpeciesData(wrapped, config, ...args) {
  const result = await wrapped(config, ...args);
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return result;
  const forms = new Set((config.forms ?? []).map(f=>f.toLowerCase()));
  if (forms.has("token")) {
    const regionalVariant = (()=>{
      if (forms.has("alolan")) return "alolan";
      if (forms.has("galarian")) return "galarian";
      if (forms.has("hisuian")) return "hisuian";
      if (forms.has("paldean")) return "paldean";
      return "";
    })();
    const gender = (()=>{
      if (config.gender == "male") return "m";
      if (config.gender == "female") return "f";
      return "";
    })();
    const { img } = PokemonSheets.getPokemon({
      dex: config.dexId,
      shiny: config.shiny,
      gender,
      region: regionalVariant,
    });
    if (img != null) {
      result.result = img;
      return result;
    }
  }
  return result;
}


function OnPreCreateToken(token, tokenData) {
  let src = tokenData?.texture?.src ?? token?.texture?.src;
  if (!src || !PokemonSheets.hasSheetSettings(src)) return;

  const updates = _getTokenChangesForSpritesheet(src);
  token.updateSource(updates);
}

function OnPreCreateActor(actor, data) {
  if (!game.settings.get(MODULENAME, "autoTrainerImage")) return;
  if ((data.type ?? actor.type) !== "humanoid") return;
  if (!(data.img ?? actor.img).includes("icons/svg/mystery-man.svg")) return;

  const img = (()=>{
    let possibleImages = PokemonSheets.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
    const gender = (()=>{
      const genderSet = (data?.system?.sex ?? actor?.system?.sex ?? "genderless").toLowerCase().trim();
      if (genderSet === "genderless") return "";
      if (["f", "female", "girl", "woman", "lady", "she", "feminine", "fem", "dame", "gal", "lass", "lassie", "madam", "maiden", "doll", "mistress"].includes(genderSet)) {
        return "_f_";
      }
      return "_m_";
    })();
    possibleImages = possibleImages.filter(k=>k.includes(gender));
    // TODO: maybe filter also based on some mapping of perks to the official pokemon trainer classes?
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
}


async function OnCreateToken(token, options) {
  if (!game.settings.get(MODULENAME, "playSummonAnimation")) return;
  if (options.teleport || options.keepId) return; // don't play the animation if the token is teleporting
  
  const actor = token.actor;
  if (!actor || actor.type !== "pokemon") return;
  const isTrained = actor.party?.party?.includes(actor) && actor.party.owner;
  const source = isTrained ? tokenScene(token)?.tokens.find(t=>t.actor?.id === actor.party.owner.id) : null;

  let sequence = null;
  if (isTrained) {
    if (token.object) token.object.localOpacity = 0;

    if (source) {
      const ballImg = await (async ()=>{
        const img = `systems/ptr2e/img/item-icons/${actor.system.details.device.toLowerCase()}.webp`;
        if (actor.system.details.device && await testFilePath(img)) return img;
        return game.settings.get(MODULENAME, "defaultBallImage");
      })();
      sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(source, token, ballImg, true);
    }

    sequence = await game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, actor.system?.shiny ?? false, sequence);
  } else {
    sequence = await game.modules.get("pokemon-assets").api.scripts.SummonWildPokemon(token, actor.system?.shiny ?? false, sequence);
  }
  await sequence.play();
}

/**
 * Test if a particular file path resolves
 * @param {string} filePath - The file path to test
 * @returns {Promise<boolean>} - Returns true if the file exists, false otherwise
 */
async function testFilePath(filePath) {
  try {
    const response = await fetch(filePath, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}


/* ------------------------------------------------------------------------- */
/*                            PTR2e Region Controls                          */
/* ------------------------------------------------------------------------- */


/**
 * Pokemon Center config for PTR2e
 * @param {*} regionConfig 
 */
async function PokemonCenter(regionConfig) {
  const currentScene = regionConfig?.options?.document?.parent;

  const allTokensSelect = currentScene.tokens.map(t=>`<option value="${t.uuid}">${t.name}</option>`).reduce((a, b)=> a + b);

  const tokenUuid = await new Promise(async (resolve)=>{
    foundry.applications.api.DialogV2.wait({
      window: { title: 'Select Nurse Token' },
      content: `
          <div class="form-group">
            <label for="token">Nurse Token</label>
            <select name="token">
              ${allTokensSelect}
            </select>
          </div>
      `,
      buttons: [{
        action: "ok",
        label: "OK",
        default: true,
        callback: (event, button, dialog) => resolve(button.form.elements.token?.value ?? null),
      }],
      close: () => resolve(null),
    }).catch(()=>{
      resolve(null);
    });
  });

  if (!tokenUuid) return;

  // get the direction we need to look in order to trigger this
  // TODO: default to "looking at nurse"
  const directions = (await game.modules.get("pokemon-assets").api.scripts.UserChooseDirections({
    prompt: "Which direction(s) should the token be facing in order to be able to speak to the nurse?",
    directions: ["upleft", "up", "upright"],
  })) ?? [];
  if (directions.length === 0) return;

  // create the document
  const pokemonCenterData = {
    type: "executeScript",
    name: "Pokemon Center",
    flags: {
      [MODULENAME]: {
        "hasTokenInteract": true,
      },
    },
    system: {
      events: [],
      source: `if (arguments.length < 4) return;

// only for the triggering user
const regionTrigger = arguments[3];
if (regionTrigger.user !== game.user) return;

const { token } = arguments[3]?.data;
if (!token || !game.modules.get("pokemon-assets")?.api?.scripts?.TokenHasDirection(token, ${JSON.stringify(directions)})) return;

const toHeal = game.actors.filter(a=>a.isOwner);

const heal = async function () {
  for (const actor of toHeal) {
    if (!actor?.heal) continue;
    await actor.heal({
      fractionToHeal: 1,
      removeWeary: true,
      removeExposed: true,
      removeAllStacks: true,
    });
  }
};

await game.modules.get("pokemon-assets")?.api?.scripts?.PokemonCenter(await fromUuid("${tokenUuid}"), heal);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [pokemonCenterData]);
  return;
}


/**
 * Pokemon Computer config
 * @param {*} regionConfig 
 */
async function PokemonComputer(regionConfig) {
  // get the direction we need to look in order to trigger this
  const directions = (await game.modules.get("pokemon-assets").api.scripts.UserChooseDirections({
    prompt: "Which direction(s) should the token be facing in order to be able to activate the computer?",
    directions: ["upleft", "up", "upright"],
  })) ?? [];
  if (directions.length === 0) return;

  // create the document
  const pokemonComputerData = {
    type: "executeScript",
    name: "Pokemon Computer",
    flags: {
      [MODULENAME]: {
        "hasTokenInteract": true,
      },
    },
    system: {
      source: `const { token } = arguments[3]?.data;
if (!token || !game.modules.get("pokemon-assets")?.api?.scripts?.TokenHasDirection(token, ${JSON.stringify(directions)})) return;
await game.modules.get("pokemon-assets")?.api?.scripts?.PokemonComputer(...arguments);`,
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [pokemonComputerData]);
  return;
}



/**
 * Returns a function which takes in an actor and returns a boolean, true if the actor has the given move
 * @param {string} slug 
 */
function HasMoveFunction(slug) {
  /**
   * Returns whether or not the actor can use the move "slug"
   * @param {PTR2eActor} actor
   * @return true if the actor can use the given move
   */
  return function (actor) {
    return actor.itemTypes.move.some(m=>m.system.slug === slug);
  };
}

/**
 * Get the cry for a given actor
 * @param {*} actor 
 * @returns the path to the cry file
 */
async function ActorCry(actor) {
  if (!actor) return null;

  const dn = actor.species?.number;
  if (dn === undefined) return null;
  const slug = actor.species?.slug;

  const form = ((form)=>{
    if (!form) return "";
    if (form === "alolan") return "_alolan";
    if (form === "galarian") return "_galarian";
    if (form === "hisuian") return "_hisuian";
    if (form === "paldean") return "_paldean";
    return "_" + form[0].toUpperCase() + form.substring(1);
  })(actor.species?.form);
  const mega = (()=>{
    const effectRollOptionKeys = Object.keys(actor.rollOptions.all).filter(k=>(k.includes("forme:mega") || k.includes("form:mega")) && k.endsWith(":active"));
    if (!effectRollOptionKeys || effectRollOptionKeys.length == 0) return "";
    if (effectRollOptionKeys.some(k=>k.endsWith("-x:active"))) return "_MEGA_X";
    if (effectRollOptionKeys.some(k=>k.endsWith("-y:active"))) return "_MEGA_Y";
    return "_MEGA";
  })();
  const gender = (()=>{
    if (actor.system.gender == "male") return "m";
    if (actor.system.gender == "female") return "f";
    return "";
  })();

  if (dn >= 0 && dn <= 1025) {
    // Official Pokemon
    const dexNum = `${dn}`.padStart(4, "0");
    if (!dexNum || dexNum === "0000") return null;
    const cryPath = `modules/pokemon-assets/audio/cries/${dexNum.substring(0, 2)}XX/${dexNum.substring(0, 3)}X/`;
    
    // check if everything is populated!
    for (const testSrc of [
      `${dexNum}${gender}${form}${mega}`,
      `${dexNum}${form}${mega}`,
      `${dexNum}${gender}${mega}`,
      `${dexNum}${form}`,
      `${dexNum}${mega}`,
      `${dexNum}${gender}`
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
    // check if the file exists
    const homebrewCries = await getFiles(folder);
    return homebrewCries.find(f=>f.endsWith(`/${dn}.mp3`)) ?? homebrewCries.find(f=>f.endsWith(`/${slug}.mp3`));
  }
}

/**
 * Get whether or not the actor is catchable
 */
function ActorCatchable(actor) {
  if (!actor) return false;
  if (actor.type !== "pokemon") return false;
  if (actor.hasPlayerOwner) return false;
  if (actor.party?.owner !== undefined) return game.settings.get(MODULENAME, "ownedPokemonCatchable");
  return true;
}

/**
 * Get the catch key for a given actor, for the purposes of checking if the species has been caught before
 * @param {*} actor 
 * @returns a string representing the catch key, or null if the actor is not a pokemon or otherwise invalid
 */
function ActorCatchKey(actor) {
  if (!actor) return null;

  if (actor.type !== "pokemon") return null;

  const slug = actor.species?.slug;
  if (slug === undefined) return null;

  const form = actor.species?.form;
  if (!form) return `${slug}`;
  return `${slug}:${form}`;
}

/**
 * Whether or not the actor's species been caught
 * @param {*} actor 
 */
function ActorCaught(actor) {
  const slug = actor?.species?.slug;
  if (!slug) return null;
  return !!game.actors.find(a=>a.hasPlayerOwner && ["caught", "shiny"].includes(a.system.details.dex.get(slug)?.state));
}

/**
 * 
 */
function OnUpdateActor(actor, update) {
  if (!game.user.isActiveGM) return;
  if (update?.system?.details?.dex === undefined) return;
  RefreshTokenIndicators();
}


// re-apply PTR2e's "_onUpdate" extension. Copied/modified from ptr2e.mjs
function Token_onUpdate(wrapped, e, t, s) {
  wrapped(e,t,s),
  e.width && (this.animation ? this.animation.then( () => {
      this.auras.reset()
  }
  ) : this.auras.reset())
}

/**
 * Overridden for the purposes of mega evolutions
 */
function TokenAlterations_apply(wrapped, ...args) {
  const preUpdatedTexture = foundry.utils.deepClone(this.actor.synthetics.tokenOverrides.texture);

  wrapped(...args);
  if (!this.test()) return;

  // if we're not updating the texture, just return
  if (!this.texture) return;
  
  // check if this is a mega evolution that we have a sprite for
  const foundMegaEvo = (()=>{
    const basename = this.texture.substring(this.texture.lastIndexOf("/")+1, this.texture.lastIndexOf("."));
    if (!basename) return false;

    const src = (()=>{
      for (const src of PokemonSheets.allSheetKeys()) {
        if (src.toLowerCase().includes(basename.toLowerCase())) return src;
      }
    })();

    if (!src) return false;

    this.actor.synthetics.tokenOverrides = foundry.utils.mergeObject(this.actor.synthetics.tokenOverrides, _getTokenChangesForSpritesheet(src));
    return true;
  })();
  if (foundMegaEvo) return;

  // if we're updating the texture to {actor|img}, or updating it to what it already is, such as in the glow automation, undo it
  if (this.texture == "{actor|img}" || this.texture == preUpdatedTexture?.src) {
    this.actor.synthetics.tokenOverrides.texture = preUpdatedTexture;
    return;
  }

  // if we're updating the texture to something defined in pokemon-assets, do that
  if (PokemonSheets.hasSheetSettings(this.texture)) {
    this.actor.synthetics.tokenOverrides = foundry.utils.mergeObject(this.actor.synthetics.tokenOverrides, _getTokenChangesForSpritesheet(this.texture));
    return;
  }

  // if not, disable spritesheet processing
  this.actor.synthetics.tokenOverrides.flags ??= {};
  this.actor.synthetics.tokenOverrides.flags[MODULENAME] ??= { spritesheet: false };
  this.actor.synthetics.tokenOverrides.lockRotation ??= true; // force lock rotation
}


/**
 * Overridden for the purposes of mega evolutions, setting flags
 */
function TokenDocument_prepareDerivedData(wrapped, ...args) {
  wrapped(...args);
  if (!(this.actor && this.scene)) return;
  const { tokenOverrides } = this.actor.synthetics;

  if (tokenOverrides.flags) {
    this.flags = foundry.utils.mergeObject(this.flags, tokenOverrides.flags);
  }

  if (tokenOverrides.lockRotation !== undefined) {
    this.lockRotation = tokenOverrides.lockRotation;
  }

  // check if we need a redraw
  let needsRedraw = false;
  needsRedraw ||= this.texture.src !== (this._cachedSettings?.src ?? this.texture.src);
  const moduleFlags = this.flags?.[MODULENAME] ?? {};

  needsRedraw ||= moduleFlags.spritesheet !== (this._cachedSettings?.spritesheet ?? moduleFlags.spritesheet);
  needsRedraw ||= moduleFlags.sheetstyle !== (this._cachedSettings?.sheetstyle ?? moduleFlags.sheetstyle);
  needsRedraw ||= moduleFlags.animationframes !== (this._cachedSettings?.animationframes ?? moduleFlags.animationframes);
  needsRedraw ||= moduleFlags.separateidle !== (this._cachedSettings?.separateidle ?? moduleFlags.separateidle);

  this._cachedSettings = {
    src: this.texture.src,
    spritesheet: moduleFlags.spritesheet,
    sheetstyle: moduleFlags.sheetstyle,
    animationframes: moduleFlags.animationframes,
    separateidle: moduleFlags.separateidle,
  };

  const tobj = this._destroyed ? null : this._object;
  if (tobj !== null && needsRedraw && this.rendered && !tobj?.isPreview) {
    tobj.renderFlags?.set({
      redraw: true
    });
    tobj.applyRenderFlags();
  }
}


export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }

  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createToken", OnCreateToken);
  Hooks.on("updateActor", OnUpdateActor);
  libWrapper.register(MODULENAME, "game.ptr.util.image.createFromSpeciesData", ImageResolver_createFromSpeciesData, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Token.objectClass.prototype._onUpdate", Token_onUpdate, "WRAPPER");

  libWrapper.register(MODULENAME, "CONFIG.ActiveEffect.dataModels.passive.schema.fields.changes.element.types.token-alterations.model.prototype.apply", TokenAlterations_apply, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Token.documentClass.prototype.prepareDerivedData", TokenDocument_prepareDerivedData, "WRAPPER");

  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;
  api.controls = {
    ...(module.api.controls ?? {}),
    "pokemonCenter": {
      "label": "Pokemon Center",
      "callback": PokemonCenter,
    },
    "pokemonComputer": {
      "label": "Pokemon Computer",
      "callback": PokemonComputer,
    },
  }

  api.logic ??= {};
  /**
   * Return all the actors this token can make use of for the purposes of field moves
   * @param {TokenDocument} token 
   */
  api.logic.FieldMoveParty ??= (token)=>[token?.actor, token.actor?.party?.owner, ...(token.actor?.party?.party ?? [])].filter((t, i, a)=>!!t && i === a.indexOf(t));
  api.logic.CanUseRockSmash ??= HasMoveFunction("rock-smash");
  api.logic.CanUseCut ??= HasMoveFunction("cut");
  api.logic.CanUseStrength ??= HasMoveFunction("strength");
  api.logic.CanUseRockClimb ??= HasMoveFunction("rock-climb");
  api.logic.CanUseWaterfall ??= HasMoveFunction("waterfall");
  api.logic.CanUseWhirlpool ??= HasMoveFunction("whirlpool");
  api.logic.CanUseSurf ??= HasMoveFunction("surf");

  api.logic.ActorCry ??= ActorCry;
  api.logic.ActorCatchable ??= ActorCatchable;
  api.logic.ActorCatchKey ??= ActorCatchKey;
  api.logic.ActorCaught ??= ActorCaught;
  api.logic.ActorShiny ??= (actor)=>actor?.system?.shiny;
  api.logic.isPokemon ??= (token)=>token?.actor?.type === "pokemon";

  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= HasMoveFunction;

  ptr2eSheet.register();
  ptr2eFixes.register();
}