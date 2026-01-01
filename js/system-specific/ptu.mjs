import { isTheGM, getFiles, tokenScene, MODULENAME } from "../utils.mjs";
import { PokemonSheets } from "../pokemon-sheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";
import { default as SPECIAL_CRIES } from "../../data/cries.js";

/**
 * A Chat Message listener, that should be run on EVERY client
 * @param {*} message 
 * @returns 
 */
async function OnCreateChatMessage(message) {

  //
  // Handle Capture Animations
  //
  if (message?.flags?.ptu?.context?.type === "capture-calculation") {
    if (!game.settings.get(MODULENAME, "playCaptureAnimation")) return;
    const context = message?.flags?.ptu?.context;
    const contextTarget = context.targets?.[0];
    if (!context || !contextTarget) return;
    // grab the two tokens
    const sourceId = context.actor;
    const targetId = contextTarget.token;
    if (!targetId || !sourceId) return;

    const target = await fromUuid(targetId);
    const source = target.scene.tokens.find(t=>t.actorId === sourceId);
    if (!source || !target) return;

    // get the ball image
    const item = await fromUuid(message?.flags?.ptu?.origin?.uuid);
    const ballImg = item?.img ?? game.settings.get(MODULENAME, "defaultBallImage");

    // get the roll and the dc
    const captureDC = contextTarget.dc?.value ?? 50;
    const roll = message.rolls[0]?.total ?? captureDC;
    const caught = contextTarget.outcome === "hit" || contextTarget.outcome === "crit-hit";
    const shakes = caught ? 3 : Math.max(0, Math.min(Math.round(3 * captureDC / roll), 3));

    // figure out if the previous accuracy check hit
    const hit = (()=>{
      const messages = game.messages.contents;
      for (let msgIdx = messages.length - 1; msgIdx >= 0; msgIdx--) {
        const msg = messages[msgIdx];
        if (msg.id === message.id) continue;
        if (msg.flags?.ptu?.context?.type !== "capture-throw") continue;
        if (msg.flags?.ptu?.context?.origin?.uuid !== message.flags.ptu.context?.origin?.uuid) continue;
        return msg.flags?.ptu?.context?.targets?.some(t=>t.outcome === "hit" || t.outcome === "crit-hit");
      }
      return false;
    })();
    
    let sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImg,
      hit);
    if (hit) {
      sequence = game.modules.get("pokemon-assets").api.scripts.CatchPokemon(
        target,
        ballImg,
        shakes,
        caught,
        sequence);
    }
    await sequence.play();
    return;
  }

  //
  // Handle the Damage Hit Indicator and sounds
  //
  if (message?.flags?.ptu?.appliedDamage?.isHealing === false) {
    if (!game.settings.get(MODULENAME, "playDamageAnimation")) return;
    const target = await fromUuid(message.flags?.ptu?.appliedDamage?.uuid);
    if (!target) return;

    // check if the target fainted
    if ((target.system?.health?.value ?? 0) <= 0) return;

    // check if 1/5 hp or less
    const lowHp = target.system?.health?.value <= target.system?.health?.max / 5;
    const token = game.scenes.active.tokens.find(t=>t.actor?.uuid === target.uuid);
    if (!token) return;
    
    game.modules.get("pokemon-assets").api.scripts.IndicateDamage(target, token, lowHp);
    return;
  }
}


function _getPrototypeTokenUpdates(actor, species, formOverride=null) {
  const slug = species.slug;
  const dexNum = species.system.number;
  const regionalVariant = (()=>{
    if (slug.endsWith("-alolan")) return "alolan";
    if (slug.endsWith("-galarian")) return "galarian";
    if (slug.endsWith("-hisuian")) return "hisuian";
    if (slug.endsWith("-paldean")) return "paldean";
    return "";
  })();
  const gender = (()=>{
    if (actor.system.gender == "male") return "m";
    if (actor.system.gender == "female") return "f";
    return "";
  })();
  const form = formOverride || actor.system.form || "";

  const { img, settings } = PokemonSheets.getPokemon({
    dex: dexNum,
    shiny: actor.system.shiny,
    gender,
    region: regionalVariant,
    form,
  });
  if (img == null) return {};

  const updates = {
    "prototypeToken": settings,
  };
  return updates;
}


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {*} actor
 * @returns 
 */
function OnPreCreateActor(actor, data) {
  if (actor.type === "pokemon") {
    if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
    const species = actor.items.find(i=>i.type === "species");
    if (!species) return;
  
    const updates = _getPrototypeTokenUpdates(actor, species);
    actor.updateSource(updates);
    return;
  }

  if (actor.type === "character") {
    if (!game.settings.get(MODULENAME, "autoTrainerImage")) return;
    if (!(data.img ?? actor.img ?? "icons/svg/mystery-man.svg").includes("icons/svg/mystery-man.svg")) return;
  
    const img = (()=>{
      let possibleImages = PokemonSheets.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
      const sex = (()=>{
        const sexSet = data?.system?.sex ?? actor?.system?.sex;
        if (!sexSet) return "";
        if (["f", "female", "girl", "woman", "lady", "she", "feminine", "fem", "dame", "gal", "lass", "lassie", "madam", "maiden", "doll", "mistress"].includes(sexSet.toLowerCase().trim())) {
          return "_f_";
        }
        return "_m_";
      })();
      possibleImages = possibleImages.filter(k=>k.includes(sex));
      // TODO: maybe filter also based on some mapping of classes to the official pokemon trainer classes?
      if (possibleImages.size === 0) return null;
      return [...possibleImages][~~(Math.random() * possibleImages.size)];
    })();
    if (!img) return;

    const updates = {
      img: `modules/pokemon-assets/img/trainers-profile/${img}`,
      prototypeToken: _getTokenChangesForSpritesheet(`modules/pokemon-assets/img/trainers-overworld/${img}`),
    }
    actor.updateSource(foundry.utils.deepClone(updates));
    foundry.utils.mergeObject(data, foundry.utils.deepClone(updates)); // this is just in case ptr1e changes the way it handles updates
    return;
  }
  
}

// Disable the autoscaling
function OnPreCreateToken(token, data) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
  token.updateSource({
    "flags.ptu.autoscale": false,
  });
}

/**
 *  Whenever a token would be created, try to populate its sprite
 */
function OnCreateToken(token, options) {
  // if the token is a pokemon, doesn't have a random image, and hasn't been configured yet, set its sprite
  (()=>{
    if (!isTheGM()) return;
    if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
    const actor = token.actor;
    if (!actor) return;
    if (actor.type !== "pokemon") return;
    if (actor.prototypeToken.randomImg) return;
  
    // check if the 'ptu' flag is set
    if (!token.flags.ptu) return;
  
    // check that the pokemon-assets flags are not set
    if (token.flags[MODULENAME] !== undefined) return;
  
    const species = actor.itemTypes.species?.at(0);
    if (!species) return;
  
    const actorUpdates = _getPrototypeTokenUpdates(actor, species);
    const updates = foundry.utils.expandObject(actorUpdates)?.prototypeToken ?? {};
    token.update(updates);
  })();

  // If the token is a pokemon, play the summoning animation
  (async ()=>{
    if (!game.settings.get(MODULENAME, "playSummonAnimation")) return;
    if (options.teleport || options.keepId) return; // don't play the animation if the token is teleporting

    const actor = token.actor;
    if (!actor || actor.type !== "pokemon") return;
    const trainer = (()=>{
      if (actor.trainer) return actor.trainer;
      // infer a trainer from the folder structure
      return actor?.folder?.folder?.contents?.[0] ?? null;
    })();
    const source = trainer !== null ? tokenScene(token)?.tokens.find(t=>t.actor?.id === trainer.id) : null;

    let sequence = null;
    if (trainer !== null) {
      if (token.object) token.object.localOpacity = 0;

      if (source) {
        const ballImg = await (async ()=>{
          const img = `systems/ptu/images/item_icons/${actor.system.pokeball.toLowerCase()}.webp`;
          if (actor.system.pokeball && testFilePath(img)) return img;
          return game.settings.get(MODULENAME, "defaultBallImage");
        })();
        sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(source, token, ballImg, true);
      }

      sequence = await game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, actor.system?.shiny ?? false, sequence);
    } else {
      sequence = await game.modules.get("pokemon-assets").api.scripts.SummonWildPokemon(token, actor.system?.shiny ?? false, sequence);
    }
    sequence.play();
  })();
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


/**
 * Update the token source if we're updating a pokemon's species
 * @param {*} item 
 * @param {*} metadata 
 * @param {*} userId 
 */
function OnCreateItem(species, metadata, userId) {
  if (!isTheGM()) return;
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
  if (game.user.id !== userId) return;
  if (species.type !== "species") return;
  const actor = species.parent;
  if (!actor) return;

  const updates = _getPrototypeTokenUpdates(actor, species);
  actor.update(updates);
}

/**
 * Get the cry for a given actor
 * @param {*} actor 
 * @returns the path to the cry file
 */
async function ActorCry(actor) {
  const species = actor?.species;
  if (!actor || !species) return null;

  const dn = species.system.number;
  if (!dn) return null;
  const slug = species?.system?.slug;
  
  if (dn >= 0 && dn <= 1025) {
    // Official Pokemon
    const dexNum = `${species.system.number}`.padStart(4, "0");
    if (!dexNum || dexNum === "0000") return null;
    const cryPath = `modules/pokemon-assets/audio/cries/${dexNum.substring(0, 2)}XX/${dexNum.substring(0, 3)}X/`;
    const form = (()=>{
      if (species.slug.endsWith("-alolan")) return "_alolan";
      if (species.slug.endsWith("-galarian")) return "_galarian";
      if (species.slug.endsWith("-hisuian")) return "_hisuian";
      if (species.slug.endsWith("-paldean")) return "_paldean";
      return actor.system.form ? `_${actor.system.form}` : "";
    })();
    const gender = (()=>{
      if (actor.system.gender == "male") return "m";
      if (actor.system.gender == "female") return "f";
      return "";
    })();
    const mega = (()=>{
      if (species.name.endsWith("-Mega-X")) return "_MEGA_X";
      if (species.name.endsWith("-Mega-Y")) return "_MEGA_Y";
      if (species.name.endsWith("-Mega")) return "_MEGA";
      return "";
    })();
    
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


function ExtendTokenImageRuleElement() {
  const TokenImageRuleElement = CONFIG.PTU.rule.elements.builtin.TokenImage;
  if (!TokenImageRuleElement) return;

  /**
   * Extends the TokenImageRuleElement to add support for spritesheets and mega evolutions
   */
  class TokenImageRuleElementPA extends TokenImageRuleElement {
    constructor(data, item, options = {}) {
      const { spritesheet, sheetstyle, animationframes, separateidle } = data;
      super(data, item, options);

      if (typeof spritesheet === "boolean") {
        this.spritesheet = spritesheet;

        if (typeof animationframes === "number" && animationframes > 0) {
          this.animationframes = animationframes;
        }

        if (typeof sheetstyle === "string") {
          this.sheetstyle = sheetstyle;
        }

        if (typeof separateidle === "boolean") {
          this.separateidle = separateidle;
        }
      }
    }

    afterPrepareData(...args) {
      super.afterPrepareData(...args);
      if (!this.test()) return;

      if (this.spritesheet === true) {
        this.actor.synthetics.tokenOverrides.flags ??= {};
        this.actor.synthetics.tokenOverrides.flags[MODULENAME] ??= {};
        this.actor.synthetics.tokenOverrides.flags[MODULENAME].spritesheet = true;
        if (this.sheetstyle !== undefined) {
          this.actor.synthetics.tokenOverrides.flags[MODULENAME].sheetstyle = this.sheetstyle;
        }
        if (this.animationframes !== undefined) {
          this.actor.synthetics.tokenOverrides.flags[MODULENAME].animationframes = this.animationframes;
        }
        if (this.separateidle !== undefined) {
          this.actor.synthetics.tokenOverrides.flags[MODULENAME].separateidle = this.separateidle;
        }
        return;
      }

      if (game.settings.get(MODULENAME, "autoOverrideMegaEvolutionSprite")) {
        // check if this is a mega evolution that we have a sprite for
        const foundMegaEvo = (()=>{
          const basename = this.value.substring(this.value.lastIndexOf("/")+1, this.value.lastIndexOf("."));
          if (!basename) return false;

          const alternateForm = basename.substring(basename.indexOf("_")+1);
          if (!alternateForm) return false;

          const species = this.actor.itemTypes.species?.at(0);
          if (!species) return false;

          const actorUpdates = _getPrototypeTokenUpdates(this.actor, species, alternateForm);
          const updates = foundry.utils.expandObject(actorUpdates)?.prototypeToken ?? {};
          if (!updates.texture) return false;

          this.actor.synthetics.tokenOverrides = foundry.utils.mergeObject(this.actor.synthetics.tokenOverrides, updates);
          return true;
        })();
        if (foundMegaEvo) return;
      }

      // if not, disable spritesheet processing
      this.actor.synthetics.tokenOverrides.flags ??= {};
      this.actor.synthetics.tokenOverrides.flags[MODULENAME] ??= { spritesheet: false };
      this.actor.synthetics.tokenOverrides.rotation ??= 0; // force rotation to be 0
    }
  }

  CONFIG.PTU.rule.elements.builtin.TokenImage = TokenImageRuleElementPA;
};

/**
 * Overridden for the purposes of mega evolutions, setting flags
 */
function PTUTokenDocument_prepareDerivedData(wrapped, ...args) {
  wrapped(...args);
  if (!(this.actor && this.scene)) return;
  const { tokenOverrides } = this.actor.synthetics;
  let needsRedraw = false;

  if (tokenOverrides.flags) {
    // if the token overrides for animation/spritesheet are set, we need to trigger a re-render of the token
    this.flags = foundry.utils.mergeObject(this.flags, tokenOverrides.flags);

    // if the sheetstyle is trainer3, animationframes needs to be 3
    if (this.flags[MODULENAME]?.sheetstyle === "trainer3") {
      this.flags[MODULENAME].animationframes = 3;
    };

    // check against the current flags to see if we need to redraw
    if (this._cachedFlags) {
      for (const key of ["spritesheet", "sheetstyle", "animationframes", "idleframe"]) {
        needsRedraw ||= this.flags?.[MODULENAME]?.[key] != this._cachedFlags?.[MODULENAME]?.[key];
      }
    }
    this._cachedFlags = foundry.utils.deepClone(this.flags);
  }

  if (tokenOverrides.rotation !== undefined) {
    this.rotation = tokenOverrides.rotation;
  }

  const tobj = this._destroyed ? null : this._object;
  if (needsRedraw && this.rendered && !tobj?.isPreview) {
    tobj.renderFlags?.set({
      redraw: true
    });
    tobj.applyRenderFlags();
  }
}


/* ------------------------------------------------------------------------- */
/*                            PTR1e Region Controls                          */
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
  const actorUpdates = [];
  for (const actor of toHeal) {
    if (!actor) continue;
    actorUpdates.push({
      "_id": actor.id,
      "system.health.value": actor.system.health.total,
      "system.health.injuries": Math.max(0, actor.system.health.injuries - 3)
    });
    await actor.deleteEmbeddedDocuments("Item", actor.items.filter(i=>i.type === "condition" && !i.isGranted).map(i => i.id))
  }
  if (actorUpdates.length > 0) {
    await Actor.updateDocuments(actorUpdates);
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
 * Gets all the party members of the given actor
 * @param {PTUActor} actor 
 */
function GetParty(actor) {
  const trainerFolder = actor.folder;
  if (!trainerFolder) return [actor];
  const party = trainerFolder.children.find(folder => folder.folder.name == "Party")?.folder ?? game.folders.find(folder => folder.name == "Party" && folder._source.folder == trainerFolder.id);

  // If the trainer has a party folder, get the pokemon from the folder
  if (party) {
    return [actor, ...party.contents.filter(actor => actor.type == "pokemon")];
  }

  // Otherwise, get the pokemon from the flag
  return [actor, ...game.actors.filter(pkmn =>
    pkmn.type == "pokemon" &&
    pkmn.flags?.ptu?.party?.trainer == actor.id &&
    !pkmn.flags?.ptu?.party?.boxed)];
}

/**
 * Returns a function which takes in an actor and returns a boolean, true if the actor has the given move
 * @param {string} name 
 */
function HasMoveFunction(slug) {
  /**
   * Returns whether or not the actor can use the move "slug"
   * @param {PTR2eActor} actor
   * @return true if the actor can use the given move
   */
  return function (actor) {
    return actor.itemTypes.move.some(m=>m.slug === slug);
  };
}



function fixLockAndKey() {
  if (!game.modules.get("LocknKey")?.active) return;
  Hooks.on("ready", ()=> {
    Hooks.on("renderItemSheet", (item, html, context)=>{
      // move the button into the nav
      $(html).find(`a[data-tab="LocknKey"]`).detach().appendTo($(html).find(`nav.tabs[data-group="primary"]`));

      $(html).find(`.tab.LocknKey`).css("flex-direction", "column");
    });
  });
}


export function register() {
  Hooks.on("createChatMessage", OnCreateChatMessage);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("createToken", OnCreateToken);
  Hooks.on("createItem", OnCreateItem);

  ExtendTokenImageRuleElement();
  libWrapper.register("pokemon-assets", "CONFIG.PTU.Token.documentClass.prototype.prepareDerivedData", PTUTokenDocument_prepareDerivedData, "WRAPPER");

  // extend

  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  module.api.controls = {
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

  module.api.logic ??= {};
  module.api.logic.FieldMoveParty ??= (token)=>GetParty(token.actor);
  module.api.logic.CanUseRockSmash ??= HasMoveFunction("rock-smash");
  module.api.logic.CanUseCut ??= HasMoveFunction("cut");
  module.api.logic.CanUseStrength ??= HasMoveFunction("strength");
  module.api.logic.CanUseRockClimb ??= HasMoveFunction("rock-climb");
  module.api.logic.CanUseWaterfall ??= HasMoveFunction("waterfall");
  module.api.logic.CanUseWhirlpool ??= HasMoveFunction("whirlpool");
  module.api.logic.CanUseSurf ??= HasMoveFunction("surf");

  module.api.logic.ActorCry ??= ActorCry;
  module.api.logic.ActorShiny ??= (actor)=>actor?.system?.shiny;

  module.api.logic.isPokemon ??= (token)=>token?.actor?.type === "pokemon";

  module.api.scripts ??= {};
  module.api.scripts.HasMoveFunction ??= HasMoveFunction;

  try {
    fixLockAndKey();
  } catch (e) {
    console.error(`ptu.fixLockAndKey:`, e);
  }
}