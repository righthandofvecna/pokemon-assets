


/**
 * Apply the diagonal forbidding setting
 * @param {*} wrapped 
 * @param  {...any} args 
 */
function Scene_prepareBaseData(wrapped, ...args) {
  wrapped(...args);
  const hasCombat = !!game.combats.find(c=>c.active && c.scene.uuid === this.uuid);
  if (this.getFlag("pokemon-assets", "diagonals") && !(this.getFlag("pokemon-assets", "outOfCombat") && hasCombat)) {
    this.grid.diagonals = CONST.GRID_DIAGONALS.ILLEGAL;
  }
}

/**
 * Add the puzzle settings to the scene configuration!
 * @param {*} sceneConfig 
 * @param {*} html 
 * @param {*} context 
 * @returns 
 */
async function OnRenderSceneConfig(sceneConfig, html, context) {
  const scene = sceneConfig?.object;
  const htmlEl = html.get(0);
  if (!scene || !htmlEl) return;

  const data = {
    ...context,
    flags: scene.flags["pokemon-assets"],
  }

  const tabs = htmlEl.querySelector(".sheet-tabs.tabs");
  const puzzleSettingsLink = document.createElement("a");
  puzzleSettingsLink.classList = "item";
  puzzleSettingsLink.setAttribute("data-tab", "puzzle");
  const puzzleIcon = document.createElement("i");
  puzzleIcon.classList = "fa-solid fa-puzzle-piece";
  puzzleSettingsLink.appendChild(puzzleIcon);
  puzzleSettingsLink.appendChild(document.createTextNode("Puzzle"));

  tabs.appendChild(puzzleSettingsLink);

  // create puzzle page
  const puzzleSettingsPage = $(await renderTemplate("modules/pokemon-assets/templates/scene-settings-page.hbs", data)).get(0);
  htmlEl.querySelector("footer").before(puzzleSettingsPage);
}


/**
 * Add the puzzle button to the RegionConfig page
 * @param {*} regionConfig 
 * @param {*} html 
 */
async function OnRenderRegionConfig(regionConfig, html) {
  const behaviorControls = html.querySelector(".region-element.region-behavior .region-element-controls");
  const puzzleLink = document.createElement("a");
  puzzleLink.classList = "region-control";
  puzzleLink.setAttribute("data-tooltip", "Automatic Behaviors");
  puzzleLink.setAttribute("aria-label", "Automatic Behaviors");
  const puzzleIcon = document.createElement("i");
  puzzleIcon.classList = "fa-solid fa-puzzle-piece";
  puzzleLink.appendChild(puzzleIcon);

  behaviorControls.appendChild(puzzleLink);

  const controls = game.modules.get("pokemon-assets").api.controls;
  puzzleLink.addEventListener("click", async function (event) {
    event.preventDefault();
    const options = Object.entries(controls).reduce((o, [k, v])=>o+`<option value="${k}">${v.label}</option>`, "");
    const option = await new Promise(async (resolve)=>{
      Dialog.prompt({
        title: 'Create Automatic Behavior',
        content: `
            <div class="form-group">
              <label for="behavior">Behavior</label>
              <select name="behavior">${options}</select>
            </div>
        `,
        callback: (html) => resolve(html.find('[name="behavior"]')?.val() ?? null),
      }).catch(()=>{
        resolve(null);
      });
    });

    if (!option || !(option in controls)) return;

    await controls[option].callback(regionConfig);
  });
}

/* ------------------------------------------------------------------------- */
/*                          Generic Region Controls                          */
/* ------------------------------------------------------------------------- */


/**
 * Create a door region!
 * @param {*} regionConfig 
 * @returns 
 */
async function CreateDoor(regionConfig) {
  const currentScene = regionConfig?.options?.document?.parent;
  const otherScenes = game.scenes.filter(s=>s.uuid !== currentScene?.uuid);//.reduce((m, s)=>({...m, [s.uuid]: s.name}), {});

  // prompt for the other scene
  const otherScenesSelect = otherScenes.map(s=>`<option value="${s.uuid}">${s.name}</option>`).reduce((a, b)=> a + b);
  const sceneUuid = await new Promise(async (resolve)=>{
    Dialog.prompt({
      title: 'Select Scene',
      content: `
          <div class="form-group">
            <label for="scene">Scene</label>
            <select name="scene">
              ${otherScenesSelect}
            </select>
          </div>
      `,
      callback: (html) => resolve(html.find('[name="scene"]')?.val() ?? null),
    }).catch(()=>{
      resolve(null);
    });
  });

  if (!sceneUuid) return;
  const otherScene = await fromUuid(sceneUuid);
  if (!otherScene) return;

  await otherScene.view();
  const doorLocation = await game.modules.get("pokemon-assets").api.scripts.UserPaintArea();

  console.log("doorLocation", doorLocation);

  // create the document
  const doorData = {
    type: "executeScript",
    name: `Door To ${otherScene.name}`,
    system: {
      events: ["tokenEnter"],
      source: `game.modules.get("pokemon-assets")?.api?.scripts?.SwitchScenes?.(await fromUuid("${otherScene.uuid}"), { x: ${doorLocation.x}, y: ${doorLocation.y} }, ...arguments);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [doorData]);

  await currentScene.view();
  return;
}


/**
 * Create a jump/slide region!
 * @param {*} regionConfig 
 * @returns 
 */
async function CreateJump(regionConfig) {
  // prompt for the direction
  const direction = await new Promise(async (resolve)=>{
    Dialog.prompt({
      title: 'Jump Direction',
      content: `
          <div class="form-group">
            <label for="direction">Jump Direction</label>
            <select name="direction">
              <option value="down">Down</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="up">Up</option>
            </select>
          </div>
      `,
      callback: (html) => resolve(html.find('[name="direction"]')?.val() ?? null),
    }).catch(()=>{
      resolve(null);
    });
  });

  if (!direction) return;

  // create the document
  const jumpData = {
    type: "executeScript",
    name: `Jump ${direction.titleCase()}`,
    system: {
      events: ["tokenMove"],
      source: `game.modules.get("pokemon-assets")?.api?.scripts?.HandleJumps?.("${direction}", ...arguments);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [jumpData]);
  // TODO: create the walls on the edge?
  return;
}


/**
 * Create an ice region
 * @param {*} regionConfig 
 * @returns 
 */
async function CreateIce(regionConfig) {
  // create the document
  const iceData = {
    type: "executeScript",
    name: `Slippery Floor`,
    system: {
      events: ["tokenMove"],
      source: `game.modules.get("pokemon-assets")?.api?.scripts?.HandleIce?.(...arguments);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [iceData]);
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
    Dialog.prompt({
      title: 'Select Token',
      content: `
          <div class="form-group">
            <label for="token">Token</label>
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
  const trainerData = {
    type: "executeScript",
    name: `Trainer Watch: ${currentScene.tokens.find(t=>t.uuid === tokenUuid)?.name ?? "Unknown"}`,
    system: {
      events: ["tokenMove"],
      source: `await game.modules.get("pokemon-assets")?.api?.scripts?.TrainerEyesMeet?.(await fromUuid("${tokenUuid}"), ...arguments);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [trainerData]);
  return;
}


/**
 * Show Image region
 * @param {*} regionConfig 
 * @returns 
 */
async function CreateImageShow(regionConfig) {
  const imageSrc = await new Promise((resolve)=>{
    new FilePicker({ callback: (src, filePicker)=>{
      resolve(src);
    }}).render(true);
  });
  if (!imageSrc) return;

  const title = imageSrc.substring(imageSrc.lastIndexOf("/") + 1, imageSrc.lastIndexOf(".")).replace("_", " ").replace("-", " ").titleCase();

  // create the document
  const trainerData = {
    type: "executeScript",
    name: `Show Image: ${title}`,
    system: {
      events: ["tokenMoveIn"],
      source: `if (arguments.length < 4) return;

// only for the triggering user
const regionTrigger = arguments[3];
if (regionTrigger.user !== game.user) return;

new ImagePopout("${imageSrc}", { title: "${title}" }).render(true);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [trainerData]);
  return;
}


export function register() {
  libWrapper.register("pokemon-assets", "Scene.prototype.prepareBaseData", Scene_prepareBaseData, "WRAPPER");
  Hooks.on("renderSceneConfig", OnRenderSceneConfig);
  Hooks.on("renderRegionConfig", OnRenderRegionConfig);

  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.controls = {
    ...(module.api.controls ?? {}),
    "door": {
      "label": "Scene Door",
      "callback": CreateDoor,
    },
    "jump": {
      "label": "One-Way Jump / Slide",
      "callback": CreateJump,
    },
    "ice": {
      "label": "Sliding Ice",
      "callback": CreateIce,
    },
    "trainer": {
      "label": "Trainer Eyes Meeting",
      "callback": CreateTrainer,
    },
    "imageShow": {
      "label": "Image Show",
      "callback": CreateImageShow,
    }
  }
}