import { early_isGM, isTheGM, MODULENAME } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 

/**
 * A Chat Message listener, that should only be run on the GM's client
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
    const ballImage = item?.img ?? "systems/ptu/images/item_icons/basic ball.webp";

    // get the roll and the dc
    const captureDC = contextTarget.dc?.value ?? 50;
    const roll = message.rolls[0]?.total ?? captureDC;
    const caught = contextTarget.outcome === "hit";
    const shakes = caught ? 3 : Math.max(0, Math.min(Math.round(3 * captureDC / roll), 3));
    
    game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImage,
      true,
      shakes,
      caught);
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
      if (testSrc in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS) {
        return testSrc;
      }
    }
    return null;
  })();

  if (!src) return {};
  
  const updates = {
    "prototypeToken.texture.src": src,
    "prototypeToken.flags.pokemon-assets": {
      spritesheet: true,
      ...SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src],
    }
  };
  return updates;
}


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {*} actor
 * @returns 
 */
function OnPreCreateActor(actor) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
  if (actor.type !== "pokemon") return;
  const species = actor.items.find(i=>i.type === "species");
  if (!species) return;

  const updates = _getPrototypeTokenUpdates(actor, species);
  actor.updateSource(updates);
}

/**
 *  Whenever a token would be created, try to populate its sprite
 */
function OnCreateToken(token) {
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
 * Overridden for the purposes of mega evolutions
 */
function TokenImageRuleElement_afterPrepareData(wrapped, ...args) {
  wrapped(...args);
  if (!this.test()) return;

  if (game.settings.get(MODULENAME, "autoOverrideMegaEvolutionSprite")) {
    // check if this is a mega evolution that we have a sprite for
    const foundMegaEvo = (()=>{
      const basename = this.value.substring(this.value.lastIndexOf("/"), this.value.lastIndexOf("."));
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
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }
  Hooks.on("preCreateActor", OnPreCreateActor);
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

  try {
    fixLockAndKey();
  } catch (e) {
    console.error(`ptu.fixLockAndKey:`, e);
  }
}