import { early_isGM, isTheGM, sleep, MODULENAME } from "../utils.mjs";
import { SpritesheetGenerator } from "../spritesheets.mjs"; 

/**
 * A Chat Message listener, that should only be run on the GM's client
 * @param {*} message 
 * @returns 
 */
async function OnCreateChatMessage(message) {
  // early return if you are not the "first" logged in GM
  if (!isTheGM()) return;
  
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
      for (const domain of message.system.result.domains) {
        const did = domain.replace("-pokeball", "").replaceAll(/-./g, (x)=>x[1].toUpperCase());
        const domainItem = message.system.origin?.items?.get?.(did);
        if (!domainItem) continue;
        return domainItem.img;
      }
      return "systems/ptr2e/img/item-icons/basic ball.webp";
    })();
    
    const crit = message.system.context.state.crit;
    const shakes = 3 - [
      message.system.context.state.shake4,
      message.system.context.state.shake3,
      message.system.context.state.shake2,
      message.system.context.state.shake1,
    ].lastIndexOf(false);
    game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      ballImg,
      message.system.context.state.accuracy,
      Math.min(shakes, crit ? 1 : 3),
      crit ? shakes >= 1 : shakes >= 4);
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
      if (testSrc in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS) {
        result.result = testSrc;
        return result;
      }
    }
  }
  return result;
}


function OnPreCreateToken(token, tokenData) {
  let src = tokenData?.texture?.src ?? token?.texture?.src;
  if (!src || !(src in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS)) return;

  const data = {...SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src]};
  data.spritesheet = true;
  const updates = {
    "flags.pokemon-assets": data,
  };
  if ("scale" in data || "anchor" in data) {
    updates["flags.ptr2e.autoscale"] = false;
    updates["texture.scaleX"] = updates["texture.scaleY"] = data.scale ?? 1;
    updates["texture.fit"] = "width";
    updates["texture.anchorX"] = 0.5;
    updates["texture.anchorY"] = data.anchor ?? 0.5;
    delete data.scale;
    delete data.anchor;
  }

  token.updateSource(updates);
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



export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }

  Hooks.on("preCreateToken", OnPreCreateToken);
  libWrapper.register(MODULENAME, "game.ptr.util.image.createFromSpeciesData", ImageResolver_createFromSpeciesData, "WRAPPER");

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
}