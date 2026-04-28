import { MODULENAME, DGANAME, early_isGM, sleep, snapToGrid, listenFilepickerChange, getCombatsForScene } from "./utils.mjs";



function OnGetSceneControlButtons(controls) {
  const tiles = controls["tiles"];//.find(c=>c.name === "tiles");
  const regions = controls["regions"];//.find(c=>c.name === "regions");


  //
  // Region Tools
  //
  regions.tools["rocky-wall"] = {
    icon: "fa-solid fa-hill-rockslide",
    name: "rocky-wall",
    title: "Place Climbable Rocks",
    toolclip: {
      heading: "Place Climbable Rocks",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  regions.tools["waterfall"] = {
    icon: "fa-solid fa-water-arrow-up",
    name: "waterfall",
    title: "Place Waterfall",
    toolclip: {
      heading: "Place Waterfall",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
}

function _placeTileBreakableRock(x, y) {
  canvas.scene.createEmbeddedDocuments("Tile", [{
    [`flags.${DGANAME}.solid`]: true,
    "flags.pokemon-assets.smashable": true,
    width: canvas.grid.sizeX,
    height: canvas.grid.sizeY,
    texture: {
      src: "modules/pokemon-assets/img/items-overworld/breakable_rock_frlg.png",
    },
    x,
    y,
  }]);
}

function _placeTileCuttablePlant(x, y) {
  canvas.scene.createEmbeddedDocuments("Tile", [{
    [`flags.${DGANAME}.solid`]: true,
    "flags.pokemon-assets.cuttable": true,
    width: canvas.grid.sizeX,
    height: canvas.grid.sizeY,
    texture: {
      src: "modules/pokemon-assets/img/items-overworld/cuttable_plant_frlg.png",
    },
    x,
    y,
  }]);
}

function _placeTileMovableBoulder(x, y) {
  canvas.scene.createEmbeddedDocuments("Tile", [{
    [`flags.${DGANAME}.solid`]: true,
    [`flags.${DGANAME}.pushable`]: true,
    width: canvas.grid.sizeX,
    height: canvas.grid.sizeY,
    texture: {
      src: "modules/pokemon-assets/img/items-overworld/movable_boulder_frlg.png",
    },
    x,
    y,
  }]);
}

function _placeTileWhirlpool(x, y) {
  canvas.scene.createEmbeddedDocuments("Tile", [{
    [`flags.${DGANAME}.solid`]: true,
    "flags.pokemon-assets.whirlpool": true,
    width: canvas.grid.sizeX,
    height: canvas.grid.sizeY,
    texture: {
      src: "modules/pokemon-assets/img/animations/whirlpool_frlg.webm",
    },
    x,
    y,
  }]);
}

function _placeTileHeadbuttTree(x, y) {
  if (game.tables.size === 0) {
    ui.notifications.error("You must have at least one Roll Table in your world to add a Headbutt Tree.");
    return;
  }
  (new Promise(async (resolve)=>{
    foundry.applications.api.DialogV2.wait({
      window: { title: 'Pokemon To Spawn' },
      content: `
          <div class="form-group">
            <label for="text">Species Rolltable</label>
            <select name="species">
              ${game.tables.map(t=>`<option value="${t.uuid}">${t.name}</option>`).reduce((a, b)=> a + b, "")}
            </select>
          </div>
      `,
      buttons: [{
        action: "ok",
        label: "OK",
        default: true,
        callback: (event, button, dialog) => resolve(button.form.elements.species?.value ?? null),
      }],
      close: () => resolve(null),
    }).catch(()=>{
      resolve(null);
    });
  })).then((speciesTable)=>{
    if (!speciesTable) return;
    canvas.scene.createEmbeddedDocuments("Tile", [{
      [`flags.${DGANAME}.solid`]: true,
      [`flags.${DGANAME}.script`]: `const api = game.modules.get("${MODULENAME}")?.api;\nconst scripts = api?.scripts;\nconst canUseHeadbutt = api?.logic?.FieldMoveParty(token)?.find(scripts?.HasMoveFunction("headbutt"));\nif (await scripts?.UseFieldMove("Headbutt", canUseHeadbutt, !!canUseHeadbutt, false)){\n  const rollTable = await fromUuid("${speciesTable}");\n  const result = (await rollTable.roll())?.results[0];\n  const resultUuid = scripts?.GetUuidFromTableResult(result);\n  const item = await fromUuid(resultUuid);\n  scripts?.ShowGMPopup(await TextEditor.enrichHTML("<p>Headbutt Tree Roll: "+item.link+"</p>"));\n};`,
      hidden: true,
      width: canvas.grid.sizeX,
      height: canvas.grid.sizeY,
      texture: {
        src: "modules/pokemon-assets/img/items-overworld/non_tile.png",
      },
      x,
      y,
    }])
  });
}

function RegionLayer_onClickLeft2(wrapper, event) {
  wrapper(event);
  switch (game.activeTool) {
    case "rocky-wall":
      _addClimbable("rocky-wall");
      break;
    case "waterfall":
      _addClimbable("waterfall");
      break;
  }
}

async function _addClimbable(via) {
  const src = snapToGrid(canvas.mousePosition, canvas.grid);
  await sleep(50);
  const dest = await game.modules.get(DGANAME).api.scripts.UserPaintArea().catch(()=>{
    return src; // cancelled
  });
  if (src.x == dest.x && src.y == dest.y) return;

  const color = Color.fromHSV([Math.random(), 0.8, 0.8]).css;
  // create the source and destination regions
  canvas.scene.createEmbeddedDocuments("Region", [
    {
      name: `${via} - Bottom`,
      color,
      locked: true,
      shapes: [{
        type: "rectangle",
        height: canvas.grid.sizeY,
        width: canvas.grid.sizeX,
        x: src.x,
        y: src.y
      }],
      behaviors: [{
        type: "executeScript",
        flags: { [DGANAME]: { hasTokenInteract: true } },
        name: "Climb Script",
        system: {
          source: `game.modules.get("${MODULENAME}")?.api?.scripts?.TriggerClimb?.("${via}", { x: ${dest.x}, y: ${dest.y} }, ...arguments);`
        },
      }]
    },
    {
      name: `${via} - Top`,
      color,
      locked: true,
      shapes: [{
        type: "rectangle",
        height: canvas.grid.sizeY,
        width: canvas.grid.sizeX,
        x: dest.x,
        y: dest.y
      }],
      behaviors: [{
        type: "executeScript",
        flags: { [DGANAME]: { hasTokenInteract: true } },
        name: "Climb Script",
        system: {
          source: `game.modules.get("${MODULENAME}")?.api?.scripts?.TriggerClimb?.("${via}", { x: ${src.x}, y: ${src.y} }, ...arguments);`
        },
      }]
    }
  ]);
}

/* ------------------------------------------------------------------------- */
/*                          Generic Region Controls                          */
/* ------------------------------------------------------------------------- */


/**
 * Pokemon Center config (generic - uses api.logic.HealParty for system-specific healing)
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
  await game.modules.get("pokemon-assets")?.api?.logic?.HealParty(toHeal);
};

await game.modules.get("pokemon-assets")?.api?.scripts?.PokemonCenter(await fromUuid("${tokenUuid}"), heal);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [pokemonCenterData]);
  return;
}



/**
 * Create a trainer watch region!
 * @param {*} regionConfig 
 * @returns 
 */
async function CreateTrainer(regionConfig) {
  const currentScene = regionConfig?.options?.document?.parent;

  const allTokensSelect = currentScene.tokens.map(t=>`<option value="${t.uuid}">${t.name}</option>`).reduce((a, b)=> a + b);

  const tokenUuid = await new Promise(async (resolve)=>{
    foundry.applications.api.DialogV2.wait({
      window: { title: 'Select Token' },
      content: `
          <div class="form-group">
            <label for="token">Token</label>
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

  // create the document
  const trainerData = {
    type: "executeScript",
    name: `Trainer Watch: ${currentScene.tokens.find(t=>t.uuid === tokenUuid)?.name ?? "Unknown"}`,
    system: {
      events: ["tokenEnter"],
      source: `await game.modules.get("${MODULENAME}")?.api?.scripts?.TrainerEyesMeet?.(await fromUuid("${tokenUuid}"), ...arguments);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [trainerData]);
  return;
}


export function register() {
  if (early_isGM()) {
    Hooks.on("getSceneControlButtons", OnGetSceneControlButtons);
    libWrapper.register(MODULENAME, "foundry.canvas.layers.RegionLayer.prototype._onClickLeft2", RegionLayer_onClickLeft2, "WRAPPER");
  }
}


export function registerAfterDependencies() {
  const DGA = game.modules.get(DGANAME);
  DGA.api ??= {};
  DGA.api.tileTools = {
    ...(DGA.api.tileTools ?? {}),
    "breakable-rock": {
      icon: "fa-solid fa-pickaxe",
      name: "breakable-rock",
      title: "Place Breakable Rock",
      requiresConfig: false,
      callback: _placeTileBreakableRock,
    },
    "cuttable-plant": {
      icon: "fa-solid fa-tree-palm",
      name: "cuttable-plant",
      title: "Place Cuttable Plant",
      requiresConfig: false,
      callback: _placeTileCuttablePlant,
    },
    "movable-boulder": {
      icon: "fa-solid fa-curling-stone",
      name: "movable-boulder",
      title: "Place Movable Boulder",
      requiresConfig: false,
      callback: _placeTileMovableBoulder,
    },
    "whirlpool": {
      icon: "fa-solid fa-tornado",
      name: "whirlpool",
      title: "Place Whirlpool",
      requiresConfig: false,
      callback: _placeTileWhirlpool,
    },
    "headbutt-tree": {
      icon: "fa-solid fa-tree",
      name: "headbutt-tree",
      title: "Place Headbutt Tree",
      requiresConfig: true,
      callback: _placeTileHeadbuttTree,
    },
  };
  DGA.api.regionScripts = { // TODO: turn these into region behaviors
    ...(DGA.api.regionScripts ?? {}),
    "pokemonCenter": {
      "label": "Pokemon Center",
      "callback": PokemonCenter,
    },
    "trainer": {
      "label": "Trainer Eyes Meeting",
      "callback": CreateTrainer,
    },
  }

  DGA.defaults.signImg = `modules/${MODULENAME}/img/items-overworld/sign_frlg.png`;
  DGA.defaults.itemImg = `modules/${MODULENAME}/img/items-overworld/pokeball.png`;
}