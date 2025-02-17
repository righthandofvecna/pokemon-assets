import { early_isGM, isTheGM, sleep, MODULENAME } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 
import { _getTokenChangesForSpritesheet } from "../actor.mjs";


const BASIC_BALL_IMG = "systems/ptr2e/img/item-icons/basic ball.webp";

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
      return BASIC_BALL_IMG;
    })();
    
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
      message.system.context.state.accuracy);
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
  const forms = new Set((config.forms ?? []).map(f=>f.toLowerCase()));
  if (forms.has("token")) {
    const dexNum = config.dexId;
    const regionalVariant = (()=>{
      if (forms.has("alolan")) return "_alolan";
      if (forms.has("galarian")) return "_galarian";
      if (forms.has("hisuian")) return "_hisuian";
      if (forms.has("paldean")) return "_paldean";
      return "";
    })();
    const shiny = config.shiny ? "s" : "";
    const gender = (()=>{
      if (config.gender == "male") return "m";
      if (config.gender == "female") return "f";
      return "";
    })();
    const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
    const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
    const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
    const dexString = `${dexNum}`.padStart(4, "0");
  
    // check if everything is populated!
    for (const testSrc of [
      `${pmdPath}${dexString}${gender}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${gender}${regionalVariant}.png`,
      `${pmdPath}${dexString}${regionalVariant}.png`,
      `${pmdPath}${dexString}.png`,
    ]) {
      if (SpritesheetGenerator.hasSheetSettings(testSrc)) {
        result.result = testSrc;
        return result;
      }
    }
  }
  return result;
}


function OnPreCreateToken(token, tokenData) {
  let src = tokenData?.texture?.src ?? token?.texture?.src;
  if (!src || !SpritesheetGenerator.hasSheetSettings(src)) return;

  const updates = _getTokenChangesForSpritesheet(src);
  token.updateSource(updates);
}

function OnPreCreateActor(actor, data) {
  if (!game.settings.get(MODULENAME, "autoTrainerImage")) return;
  if ((data.type ?? actor.type) !== "humanoid") return;
  if (!(data.img ?? actor.img).includes("icons/svg/mystery-man.svg")) return;

  const img = (()=>{
    let possibleImages = SpritesheetGenerator.allSheetKeys().filter(k=>k.startsWith("modules/pokemon-assets/img/trainers-overworld/trainer_")).map(k=>k.substring(46));
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


async function OnCreateToken(token) {
  const actor = token.actor;
  if (!actor || actor.type !== "pokemon") return;
  if (!actor.party?.party?.includes(actor)) return;
  if (token.object) token.object.localOpacity = 0;
  const source = actor.party.owner ? token.scene.tokens.find(t=>t.actor?.id === actor.party.owner.id) : null;

  let sequence = null;
  if (source) {
    // TODO the pokeball the pokemon was caught with, when PTR2e eventually stores that information
    sequence = game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(source, token, BASIC_BALL_IMG, true);
  }
  sequence = game.modules.get("pokemon-assets").api.scripts.SummonPokemon(token, actor.system?.shiny ?? false, sequence);
  await sequence.play();
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


// 



// re-prepare the token document on render? to account for weird size issues
function Token_applyRenderFlags(wrapped, flags) {
  TokenDocument.prototype.prepareData.apply(this.document);
  wrapped(flags);
}

/**
 * Overridden for the purposes of mega evolutions
 */
function TokenAlterations_apply(wrapped, ...args) {
  wrapped(...args);
  if (!this.test()) return;

  if (true || game.settings.get(MODULENAME, "autoOverrideMegaEvolutionSprite")) {
    // check if this is a mega evolution that we have a sprite for
    const foundMegaEvo = (()=>{
      const basename = this.texture.substring(this.texture.lastIndexOf("/")+1, this.texture.lastIndexOf("."));
      if (!basename) return false;

      const src = (()=>{
        for (const src of SpritesheetGenerator.allSheetKeys()) {
          if (src.toLowerCase().includes(basename.toLowerCase())) return src;
        }
      })();

      if (!src) return false;

      this.actor.synthetics.tokenOverrides = foundry.utils.mergeObject(this.actor.synthetics.tokenOverrides, _getTokenChangesForSpritesheet(src));
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
function TokenDocument_prepareDerivedData(wrapped, ...args) {
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


export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }

  Hooks.on("preCreateToken", OnPreCreateToken);
  Hooks.on("preCreateActor", OnPreCreateActor);
  Hooks.on("createToken", OnCreateToken);
  libWrapper.register(MODULENAME, "game.ptr.util.image.createFromSpeciesData", ImageResolver_createFromSpeciesData, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Token.objectClass.prototype._applyRenderFlags", Token_applyRenderFlags, "WRAPPER");

  libWrapper.register(MODULENAME, "CONFIG.ActiveEffect.dataModels.passive.schema.fields.changes.element.types.token-alterations.model.prototype.apply", TokenAlterations_apply, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.Token.documentClass.prototype.prepareDerivedData", TokenDocument_prepareDerivedData, "WRAPPER");

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
  /**
   * Return all the actors this token can make use of for the purposes of field moves
   * @param {TokenDocument} token 
   */
  module.api.logic.FieldMoveParty ??= (token)=>[token?.actor, token.actor?.party?.owner, ...(token.actor?.party?.party ?? [])].filter((t, i, a)=>!!t && i === a.indexOf(t));
  module.api.logic.CanUseRockSmash ??= HasMoveFunction("rock-smash");
  module.api.logic.CanUseCut ??= HasMoveFunction("cut");
  module.api.logic.CanUseStrength ??= HasMoveFunction("strength");
  module.api.logic.CanUseRockClimb ??= HasMoveFunction("rock-climb");
  module.api.logic.CanUseWaterfall ??= HasMoveFunction("waterfall");
  module.api.logic.CanUseWhirlpool ??= HasMoveFunction("whirlpool");

  module.api.scripts ??= {};
  module.api.scripts.HasMoveFunction ??= (actor, slug)=>HasMoveFunction(slug)(actor);;
}