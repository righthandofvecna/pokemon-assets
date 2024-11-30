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
    
    const crit = message.system.rolls.crit.total <= 0;
    const shakes = 3 - [
      message.system.rolls.shake4,
      message.system.rolls.shake3,
      message.system.rolls.shake2,
      message.system.rolls.shake1,
    ].map(shake=>shake.total <= 0).lastIndexOf(false);
    game.modules.get("pokemon-assets").api.scripts.ThrowPokeball(
      source,
      target,
      message.system.action.img,
      message.system.rolls.accuracy.result <= 0,
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


/**
 * Whenever an actor would be created, try to populate its sprite
 * @param {PTR2eActor} actor
 * @param {object} actorData
 * @returns 
 */
function OnPreCreateActor(actor, actorData) {
  if (!game.settings.get(MODULENAME, "autoSetTokenSprite")) return;
  if (actor.type !== "pokemon") return;
  const species = actorData.items.find(i=>i.type === "species")?.system;
  if (!species) return;
  const slug = species.slug;
  const dexNum = species.number;
  const regionalVariant = (()=>{
    if (slug.startsWith("alolan-")) return "_alolan";
    if (slug.startsWith("galarian-")) return "_galarian";
    if (slug.startsWith("hisuian-")) return "_hisuian";
    if (slug.startsWith("paldean-")) return "_paldean";
    return "";
  })();
  const shiny = actorData.system.shiny ? "s" : "";
  const gender = (()=>{
    if (actorData.system.gender == "male") return "m";
    if (actorData.system.gender == "female") return "f";
    return "";
  })();
  const f1 = `${~~(dexNum/100)}`.padStart(2, "0") + "XX";
  const f2 = `${~~(dexNum/10)}`.padStart(3, "0") + "X";
  const pmdPath = `modules/pokemon-assets/img/pmd-overworld/${f1}/${f2}/`;
  const dexString = `${dexNum}`.padStart(4, "0");

  // check if everything is populated!
  const src = (()=>{
    for (const testSrc of [
      `${pmdPath}${dexString}${gender}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${shiny}${regionalVariant}.png`,
      `${pmdPath}${dexString}${gender}${regionalVariant}.png`,
      `${pmdPath}${dexString}${regionalVariant}.png`,
      `${pmdPath}${dexString}.png`,
    ]) {
      if (testSrc in SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS) {
        return testSrc;
      }
    }
    return null;
  })();

  if (!src) return;
  
  const updates = {
    "prototypeToken.texture.src": src,
    "prototypeToken.flags.pokemon-assets": {
      spritesheet: true,
      ...SpritesheetGenerator.CONFIGURED_SHEET_SETTINGS[src],
    }
  };
  actor.updateSource(updates);
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

  // create the document
  const pokemonCenterData = {
    type: "executeScript",
    name: "Pokemon Center",
    system: {
      events: ["tokenMoveIn"],
      source: `if (arguments.length < 4) return;

// only for the triggering user
const regionTrigger = arguments[3];
if (regionTrigger.user !== game.user) return;


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
  // create the document
  const pokemonComputerData = {
    type: "executeScript",
    name: "Pokemon Computer",
    system: {
      events: ["tokenMoveIn"],
      source: `await game.modules.get("pokemon-assets")?.api?.scripts?.PokemonComputer(...arguments);`,
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [pokemonComputerData]);
  return;
}




export function register() {
  if (early_isGM) {
    Hooks.on("createChatMessage", OnCreateChatMessage);
  }
  Hooks.on("preCreateActor", OnPreCreateActor);

  const module = game.modules.get("pokemon-assets");
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
}