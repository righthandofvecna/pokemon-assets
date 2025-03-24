import { early_isGM, isTheGM, MODULENAME } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 
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
    
    let sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImg,
      true);
    sequence = game.modules.get("pokemon-assets").api.scripts.CatchPokemon(
      target,
      ballImg,
      shakes,
      caught,
      sequence);
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
    if (slug.endsWith("-alolan")) return "_alolan";
    if (slug.endsWith("-galarian")) return "_galarian";
    if (slug.endsWith("-hisuian")) return "_hisuian";
    if (slug.endsWith("-paldean")) return "_paldean";
    return "";
  })();
  const shiny = actor.system.shiny ? "s" : "";
  const gender = (()=>{
    if (actor.system.gender == "male") return "m";
    if (actor.system.gender == "female") return "f";
    return "";
  })();
  const form = actor.system.form ? `_${actor.system.form}` : "";
  const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
  const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
  const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
  const dexString = `${dexNum}`.padStart(4, "0");

  const variant = formOverride || regionalVariant || form;

  // check if everything is populated!
  const src = (()=>{
    for (const testSrc of [
      `${pmdPath}${dexString}${gender}${shiny}${variant}.png`,
      `${pmdPath}${dexString}${shiny}${variant}.png`,
      `${pmdPath}${dexString}${gender}${variant}.png`,
      `${pmdPath}${dexString}${variant}.png`,
      formOverride == null ? `${pmdPath}${dexString}.png` : "INVALID",
    ]) {
      if (SpritesheetGenerator.hasSheetSettings(testSrc)) {
        return testSrc;
      }
    }
    return null;
  })();

  if (!src) return {};

  const updates = {
    "prototypeToken": _getTokenChangesForSpritesheet(src),
  };
  return updates;
}


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {*} actor
 * @returns 
 */
function OnPreCreateActor(actor, data) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;

  if (actor.type === "pokemon") {
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
      let possibleImages = SpritesheetGenerator.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
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
function OnCreateToken(token) {
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

    const actor = token.actor;
    if (!actor || actor.type !== "pokemon") return;
    const trainer = (()=>{
      if (actor.trainer) return actor.trainer;
      // infer a trainer from the folder structure
      return actor?.folder?.folder?.contents?.[0] ?? null;
    })();
    const source = trainer !== null ? token.scene.tokens.find(t=>t.actor?.id === trainer.id) : null;

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

      sequence = game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, actor.system?.shiny ?? false, sequence);
    } else {
      sequence = game.modules.get("pokemon-assets").api.scripts.SummonWildPokemon(token, actor.system?.shiny ?? false, sequence);
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
function ActorCry(actor) {
  const species = actor?.species;
  if (!actor || !species) return null;

  const dn = species.system.number;
  if (!dn) return null;
  
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
    return `${folder}/${dn}.mp3`;
  }
}


/**
 * Overridden for the purposes of mega evolutions
 */
function TokenImageRuleElement_afterPrepareData(wrapped, ...args) {
  wrapped(...args);
  if (!this.test()) return;

  if (game.settings.get(MODULENAME, "autoOverrideMegaEvolutionSprite")) {
    // check if this is a mega evolution that we have a sprite for
    const foundMegaEvo = (()=>{
      const basename = this.value.substring(this.value.lastIndexOf("/")+1, this.value.lastIndexOf("."));
      if (!basename) return false;

      const alternateForm = basename.substring(basename.indexOf("_"));
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

/**
 * Overridden for the purposes of mega evolutions, setting flags
 */
function PTUTokenDocument_prepareDerivedData(wrapped, ...args) {
  wrapped(...args);
  if (!(this.actor && this.scene)) return;
  const { tokenOverrides } = this.actor.synthetics;

  if (tokenOverrides.flags) {
    this.flags = foundry.utils.mergeObject(this.flags, tokenOverrides.flags);
  }

  if (tokenOverrides.rotation !== undefined) {
    this.rotation = tokenOverrides.rotation;
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
    Dialog.prompt({
      title: 'Select Nurse Token',
      content: `
          <div class="form-group">
            <label for="token">Nurse Token</label>
            <select name="token">
              ${allTokensSelect}
            </select>
          </div>
      `,
      callback: (html) => resolve(html.find('[name="token"]')?.val() ?? null),
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

  libWrapper.register("pokemon-assets", "CONFIG.PTU.rule.elements.builtin.TokenImage.prototype.afterPrepareData", TokenImageRuleElement_afterPrepareData, "WRAPPER");
  libWrapper.register("pokemon-assets", "CONFIG.PTU.Token.documentClass.prototype.prepareDerivedData", PTUTokenDocument_prepareDerivedData, "WRAPPER");

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

  module.api.logic.ActorCry ??= ActorCry;

  module.api.scripts ??= {};
  module.api.scripts.HasMoveFunction ??= HasMoveFunction;

  try {
    fixLockAndKey();
  } catch (e) {
    console.error(`ptu.fixLockAndKey:`, e);
  }
}