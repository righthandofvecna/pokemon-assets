import { MODULENAME, early_isGM, sleep, snapToGrid, listenFilepickerChange, getCombatsForScene } from "./utils.mjs";
import { SOUNDS } from "./audio.mjs";
import { UserPaintArea } from "./scripts.mjs";


/**
 * Apply the diagonal forbidding setting
 * @param {*} wrapped 
 * @param  {...any} args 
 */
function Scene_prepareBaseData(wrapped, ...args) {
  wrapped(...args);
  const hasCombat = getCombatsForScene(this.uuid).length > 0;
  if (this.getFlag(MODULENAME, "diagonals") && !(this.getFlag(MODULENAME, "outOfCombat") && hasCombat)) {
    this.grid.diagonals = CONST.GRID_DIAGONALS.ILLEGAL;
  }
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

  const controls = game.modules.get(MODULENAME).api.controls;
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


function OnGetSceneControlButtons(controls) {
  const tiles = controls["tiles"];//.find(c=>c.name === "tiles");
  const regions = controls["regions"];//.find(c=>c.name === "regions");

  //
  // Tile tools
  //
  tiles.tools["breakable-rock"] = {
    icon: "fa-solid fa-pickaxe",
    name: "breakable-rock",
    title: "Place Breakable Rock",
    toolclip: {
      heading: "Place Breakable Rock",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["cuttable-plant"] = {
    icon: "fa-solid fa-tree-palm",
    name: "cuttable-plant",
    title: "Place Cuttable Plant",
    toolclip: {
      heading: "Place Cuttable Plant",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["movable-boulder"] ={
    icon: "fa-solid fa-curling-stone",
    name: "movable-boulder",
    title: "Place Movable Boulder",
    toolclip: {
      heading: "Place Movable Boulder",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["whirlpool"] = {
    icon: "fa-solid fa-tornado",
    name: "whirlpool",
    title: "Place Whirlpool",
    toolclip: {
      heading: "Place Whirlpool",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["sign"] = {
    icon: "fa-solid fa-sign-post",
    name: "sign",
    title: "Place Sign",
    toolclip: {
      heading: "Place Sign",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["item"] = {
    icon: "fa-solid fa-box",
    name: "item",
    title: "Place Item",
    toolclip: {
      heading: "Place Item",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };
  tiles.tools["headbutt-tree"] = {
    icon: "fa-solid fa-tree",
    name: "headbutt-tree",
    title: "Place Headbutt Tree",
    toolclip: {
      heading: "Place Headbutt Tree",
      items: [
        {
          heading: "Place",
          reference: "CONTROLS.DoubleClick",
        }
      ],
    },
  };

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

function TilesLayer_onClickLeft2(wrapper, event) {
  wrapper(event);
  const { x, y } = snapToGrid(canvas.mousePosition, canvas.grid)
  switch (game.activeTool) {
    case "breakable-rock":
      canvas.scene.createEmbeddedDocuments("Tile", [{
        "flags.pokemon-assets.solid": true,
        "flags.pokemon-assets.smashable": true,
        width: canvas.grid.sizeX,
        height: canvas.grid.sizeY,
        texture: {
          src: "modules/pokemon-assets/img/items-overworld/breakable_rock_frlg.png",
        },
        x,
        y,
      }])
      break;
    case "cuttable-plant":
      canvas.scene.createEmbeddedDocuments("Tile", [{
        "flags.pokemon-assets.solid": true,
        "flags.pokemon-assets.cuttable": true,
        width: canvas.grid.sizeX,
        height: canvas.grid.sizeY,
        texture: {
          src: "modules/pokemon-assets/img/items-overworld/cuttable_plant_frlg.png",
        },
        x,
        y,
      }])
      break;
    case "movable-boulder":
      canvas.scene.createEmbeddedDocuments("Tile", [{
        "flags.pokemon-assets.solid": true,
        "flags.pokemon-assets.pushable": true,
        width: canvas.grid.sizeX,
        height: canvas.grid.sizeY,
        texture: {
          src: "modules/pokemon-assets/img/items-overworld/movable_boulder_frlg.png",
        },
        x,
        y,
      }])
      break;
    case "whirlpool":
      canvas.scene.createEmbeddedDocuments("Tile", [{
        "flags.pokemon-assets.solid": true,
        "flags.pokemon-assets.whirlpool": true,
        width: canvas.grid.sizeX,
        height: canvas.grid.sizeY,
        texture: {
          src: "modules/pokemon-assets/img/animations/whirlpool_frlg.webm",
        },
        x,
        y,
      }])
      break;
    case "sign":
      (new Promise(async (resolve)=>{
        Dialog.prompt({
          title: 'Text to Display',
          content: `
              <div class="form-group">
                <label for="text">Text to Display</label>
                <input name="text" type="text" />
              </div>
          `,
          callback: (html) => resolve(html.find('[name="text"]')?.val() ?? null),
        }).catch(()=>{
          resolve(null);
        });
      })).then((text)=>{
        if (!text) return;
        canvas.scene.createEmbeddedDocuments("Tile", [{
          "flags.pokemon-assets.solid": true,
          "flags.pokemon-assets.interactionSound": "modules/pokemon-assets/audio/bgs/a-button.mp3",
          "flags.pokemon-assets.script": `Dialog.prompt({ content: ${JSON.stringify(text)}, options: { pokemon: true }});`,
          width: canvas.grid.sizeX,
          height: canvas.grid.sizeY,
          texture: {
            src: "modules/pokemon-assets/img/items-overworld/sign_frlg.png",
          },
          x,
          y,
        }])
      });
      break;
    case "item":
      (new Promise(async (resolve)=>{
        Dialog.prompt({
          title: 'Items Contained',
          content: `
              <!--<div class="form-group">
                <label>Overworld Type</label>
                <div class="form-fields">
                  <label><img src="modules/pokemon-assets/img/items-overworld/pokeball.png"></img><input type="radio" name="overworldType" value="item" checked></label>
                </div>
              </div>-->
              <div class="form-group">
                <label>Interact Sound</label>
                <div class="form-fields">
                  <select name="interactionSound">
                    <option value="">None</option>
                    ${Object.entries(SOUNDS).map(([k, v])=>`<option value="${k}" ${k === "modules/pokemon-assets/audio/bgs/receive-item-bw.mp3" ? "default selected" : ""}>${v}</option>`).reduce((a, b)=> a + b)}
                    <option class="custom-interaction" value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div class="form-group custom-sound" style='display:none'>
                <label>Custom Interaction Sound</label>
                <div class="form-fields">
                  <file-picker class="custom-interaction" type="audio" value=""></file-picker>
                </div>
              </div>
              <div class="form-group">
                <div id="item-drop-zone" style="min-height: 100px; border: 2px dashed #ccc; padding: 10px; margin-bottom: 10px;">
                  <p class="drop-text">Drag and drop items here</p>
                  <div id="dropped-items-list"></div>
                </div>
              </div>
          `,
          callback: (html) => {
            // const overworldType = html.find('[name="overworldType"]')?.val() ?? null;
            const interactionSound = html.find('[name="interactionSound"]')?.val() ?? null;
            const items = html.find('#dropped-items-list').data('items') || [];
            resolve({items, interactionSound});
          },
          render: (html) => {
            $(html).find(`select[name="interactionSound"]`).on("change", function() {
              const custom = $(this).find("option.custom-interaction").get(0).value;
              const customInput = $(html).find(`.custom-interaction[type=text], .custom-interaction [type=text]`).get(0);
              if (this.value === custom) {
                $(html).find(`.custom-sound`).show();
                if (this.value == "custom") {
                  customInput.value = "";
                } else {
                  customInput.value = this.value;
                }
              } else {
                $(html).find(`.custom-sound`).hide();
                customInput.value = "";
              }
            });
          
            listenFilepickerChange($(html).find(`.custom-interaction`), function(value) {
              const custom = $(html).find("option.custom-interaction").get(0);
              const select = $(html).find(`select[name="flags.${MODULENAME}.interactionSound"]`).get(0);
              if (!value) {
                select.value = "custom";
              } else {
                custom.value = value;
              }
            });

            //
            // set up drag and drop area
            //
            const dropZone = html.find('#item-drop-zone')[0];
            const itemsList = html.find('#dropped-items-list');
            const items = [];
    
            // Set up drag and drop handlers
            dropZone.addEventListener('dragover', (e) => {
              e.preventDefault();
              dropZone.style.backgroundColor = '#f0f0f0';
            });
    
            dropZone.addEventListener('dragleave', (e) => {
              e.preventDefault();
              dropZone.style.backgroundColor = 'transparent';
            });
    
            dropZone.addEventListener('drop', async (e) => {
              e.preventDefault();
              dropZone.style.backgroundColor = 'transparent';
              
              const data = TextEditor.getDragEventData(e);
              const item = await (async ()=>{
                let item = await fromUuid(data.uuid);
                if (!item) return null;
                if (item instanceof RollTable) {
                  let result = await item.roll();
                  if (result.results.length != 1) {
                    return null;
                  } else {
                    let r = result.results[0];
                    let uuid = "";
                    if (r.type == "pack") {
                      uuid = `Compendium.${r.documentCollection}.Item.${r.documentId}`;
                    } else {
                      return null;
                    }
                    item = await fromUuid(uuid);
                  }
                }
                return item;
              })()
              if (!item) return;
    
              items.push(item.uuid);
              itemsList.data('items', items);
    
              // Update visual list
              const itemElement = document.createElement('div');
              itemElement.innerHTML = `
                <div class="item" style="display: flex; align-items: center; margin: 5px 0;">
                  <img src="${item.img}" width="24" height="24" style="margin-right: 8px;">
                  <span>${item.name}</span>
                  <a class="remove-item" style="margin-left: auto;"><i class="fas fa-times"></i></a>
                </div>
              `;
    
              // Add remove handler
              itemElement.querySelector('.remove-item').addEventListener('click', () => {
                const index = items.indexOf(item);
                if (index > -1) {
                  items.splice(index, 1);
                  itemsList.data('items', items);
                  itemElement.remove();
                }
              });
    
              itemsList.append(itemElement);
            });
          },
        }).catch(()=>{
          resolve(null);
        });
      })).then(async ({items, interactionSound})=>{
        if (!items) return;
        const itemFrequency = items.reduce((l,i)=>({...l, [i]: (l[i] ?? 0) + 1}), {});
        const itemObjects = await Promise.all(Object.keys(itemFrequency).map(uuid=>fromUuid(uuid)));
        const itemTexts = itemObjects.map((item, i)=>itemFrequency[item.uuid] > 1 ? `${itemFrequency[item.uuid]}&times; ${item.name}` : ("aeiou".includes(item.name.toLowerCase()[0]) ? `an ${item.name}` : `a ${item.name}`));
        // do a natural join of the item names (eg, "a, b, and c" or "a and b")
        if (itemTexts.length > 1) {
          itemTexts[itemTexts.length - 2] += " and " + itemTexts.pop();
        }
        const message = `You found ${itemTexts.join(", ")}!`;
        canvas.scene.createEmbeddedDocuments("Tile", [{
          "flags.pokemon-assets.solid": true,
          "flags.pokemon-assets.interactionSound": interactionSound ?? null,
          "flags.pokemon-assets.script": `const items = [${items.reduce((l,i)=>l+'"'+i+'",', "")}];\ngame.modules.get("${MODULENAME}")?.api?.scripts?.PickUpItem?.(self, actor, items, ${JSON.stringify(message)});`,
          width: canvas.grid.sizeX,
          height: canvas.grid.sizeY,
          texture: {
            src: "modules/pokemon-assets/img/items-overworld/pokeball.png",
            scaleX: 0.5,
            scaleY: 0.5,
          },
          x,
          y,
        }])
      });
      break;
    case "headbutt-tree":
      (new Promise(async (resolve)=>{
        Dialog.prompt({
          title: 'Pokemon To Spawn',
          content: `
              <div class="form-group">
                <label for="text">Species Rolltable</label>
                <select name="species">
                  ${game.tables.map(t=>`<option value="${t.uuid}">${t.name}</option>`).reduce((a, b)=> a + b)}
                </select>
              </div>
          `,
          callback: (html) => resolve(html.find('[name="species"]')?.val() ?? null),
        }).catch(()=>{
          resolve(null);
        });
      })).then((speciesTable)=>{
        if (!speciesTable) return;
        canvas.scene.createEmbeddedDocuments("Tile", [{
          "flags.pokemon-assets.solid": true,
          "flags.pokemon-assets.script": `const api = game.modules.get("${MODULENAME}")?.api;\nconst scripts = api?.scripts;\nconst canUseHeadbutt = api?.logic?.FieldMoveParty(token)?.find(scripts?.HasMoveFunction("headbutt"));\nif (await scripts?.UseFieldMove("Headbutt", canUseHeadbutt, !!canUseHeadbutt, false)){\n  const rollTable = await fromUuid("${speciesTable}");\n  const result = (await rollTable.roll())?.results[0];\n  const resultUuid = scripts?.GetUuidFromTableResult(result);\n  const item = await fromUuid(resultUuid);\n  scripts?.ShowGMPopup(await TextEditor.enrichHTML("<p>Headbutt Tree Roll: "+item.link+"</p>"));\n};`,
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
      break;
    }
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
  const dest = await UserPaintArea().catch(()=>{
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
        flags: { "pokemon-assets": { hasTokenInteract: true } },
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
        flags: { "pokemon-assets": { hasTokenInteract: true } },
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
  const doorLocation = await game.modules.get(MODULENAME).api.scripts.UserPaintArea();

  // create the document
  const doorData = {
    type: "executeScript",
    name: `Door To ${otherScene.name}`,
    system: {
      events: ["tokenEnter"],
      source: `game.modules.get("${MODULENAME}")?.api?.scripts?.SwitchScenes?.(await fromUuid("${otherScene.uuid}"), { x: ${doorLocation.x}, y: ${doorLocation.y} }, ...arguments);`
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
      source: `game.modules.get("${MODULENAME}")?.api?.scripts?.HandleJumps?.("${direction}", ...arguments);`
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
      source: `game.modules.get("${MODULENAME}")?.api?.scripts?.HandleIce?.(...arguments);`
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
      source: `await game.modules.get("${MODULENAME}")?.api?.scripts?.TrainerEyesMeet?.(await fromUuid("${tokenUuid}"), ...arguments);`
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

  const title = imageSrc.substring(imageSrc.lastIndexOf("/") + 1, imageSrc.lastIndexOf(".")).replaceAll("_", " ").replaceAll("-", " ").titleCase();

  // get the direction we need to look in order to trigger this
  const directions = (await game.modules.get(MODULENAME).api.scripts.UserChooseDirections({
    prompt: "Which direction(s) should the token be facing in order to be able to display this image?",
    directions: ["upleft", "up", "upright"],
  })) ?? [];
  if (directions.length === 0) return;

  // create the document
  const trainerData = {
    type: "executeScript",
    name: `Show Image: ${title}`,
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
if (!token || !game.modules.get("${MODULENAME}")?.api?.scripts?.TokenHasDirection(token, ${JSON.stringify(directions)})) return;

await game.modules.get("${MODULENAME}")?.api?.scripts?.Interact();
new ImagePopout("${imageSrc}", { title: "${title}" }).render(true);`
    }
  };
  await regionConfig.options.document.createEmbeddedDocuments("RegionBehavior", [trainerData]);
  return;
}


async function SceneConfig_preparePartContext(wrapped, partId, context, options) {
  context = await wrapped(partId, context, options);
  if (partId === "puzzle") {
    const scene = context.document;
    context.flags = scene.flags[MODULENAME]
  }
  return context;
}

export function register() {
  libWrapper.register(MODULENAME, "Scene.prototype.prepareBaseData", Scene_prepareBaseData, "WRAPPER");
  Hooks.on("renderRegionConfig", OnRenderRegionConfig);
  if (early_isGM()) {
    Hooks.on("getSceneControlButtons", OnGetSceneControlButtons);
    libWrapper.register(MODULENAME, "TilesLayer.prototype._onClickLeft2", TilesLayer_onClickLeft2, "WRAPPER");
    libWrapper.register(MODULENAME, "RegionLayer.prototype._onClickLeft2", RegionLayer_onClickLeft2, "WRAPPER");
  }

  // scene config controls
  const SceneConfig = foundry.applications.sheets.SceneConfig;
  SceneConfig.PARTS.puzzle = {
    template: "modules/pokemon-assets/templates/scene-settings-page.hbs"
  };
  const footer = SceneConfig.PARTS.footer;
  delete SceneConfig.PARTS.footer;
  SceneConfig.PARTS.footer = footer;

  SceneConfig.TABS.sheet.tabs.push({
    id: "puzzle",
    icon: "fa-solid fa-puzzle-piece",
  });
  libWrapper.register(MODULENAME, "foundry.applications.sheets.SceneConfig.prototype._preparePartContext", SceneConfig_preparePartContext, "WRAPPER");
  

  const module = game.modules.get(MODULENAME);
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