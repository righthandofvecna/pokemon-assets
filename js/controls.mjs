



function Scene_prepareBaseData(wrapped, ...args) {
  wrapped(...args);
  const hasCombat = !!game.combats.find(c=>c.active && c.scene.uuid === this.uuid);
  if (this.getFlag("pokemon-assets", "diagonals") && !(this.getFlag("pokemon-assets", "outOfCombat") && hasCombat)) {
    this.grid.diagonals = CONST.GRID_DIAGONALS.ILLEGAL;
  }
}

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

  puzzleLink.addEventListener("click", async function (event) {
    event.preventDefault();
    console.log("RegionConfig.behaviorCreatePuzzle", event);
    const option = await new Promise(async (resolve)=>{
      Dialog.prompt({
        title: 'Create Automatic Behavior',
        content: `
            <div class="form-group">
              <label for="behavior">Behavior</label>
              <select name="behavior">
                <option value="door">Scene Door</option>
                <option value="jump">One-Way Jump</option>
                <option value="ice">Sliding Ice</option>
                <option value="trainer">Trainer Watch</option>
              </select>
            </div>
        `,
        callback: (html) => resolve(html.find('[name="behavior"]')?.val() ?? null),
      }).catch(()=>{
        resolve(null);
      });
    });

    if (!option) return;


    const currentScene = regionConfig?.options?.document?.parent;

    /**
     * Door!
     */
    if (option === "door") {
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

    if (option === "jump") {
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
          events: ["tokenMoveIn"],
          source: `game.modules.get("pokemon-assets")?.api?.scripts?.HandleJumps?.("${direction}", ...arguments);`
        }
      };
      await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [jumpData]);
      // TODO: create the walls on the edge?
      return;
    }

    if (option === "ice") {
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

    if (option === "trainer") {
      
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

  });
}



export function register() {
  libWrapper.register("pokemon-assets", "Scene.prototype.prepareBaseData", Scene_prepareBaseData, "WRAPPER");
  Hooks.on("renderSceneConfig", OnRenderSceneConfig);
  Hooks.on("renderRegionConfig", OnRenderRegionConfig);
}