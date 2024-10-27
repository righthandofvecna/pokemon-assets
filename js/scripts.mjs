
import { sleep } from "./utils.mjs";

/**
 * Run when a Pokemon Center is triggered.
 * nurse: an x, y position to place the text
 * doHeal: a function to run to actually heal the pokemon
 */
async function PokemonCenter(nurse, doHeal) {
  const { x, y, width } = nurse;
  const { sizeX } = nurse?.parent?.grid ?? { sizeX: 100 };
  const textPosition = {
    x: x + ((width ?? 1) * sizeX / 2),
    y,
  };

  const talkSound = await game.audio.create({
    src: "modules/pokemon-assets/audio/bgs/a-button.mp3",
  });
  await talkSound.load();

  const music = game.scenes.active?.playlistSound?.sound;
  let volume = music?.volume ?? 1;

  const talk = async function(text, ms=1500) {
    game.canvas.interface.createScrollingText(textPosition, text);
    await sleep(ms/2);
    await Promise.all([
      talkSound.play({ volume: Math.clamp(volume * 1.5, 0.09, 1) }),
      sleep(ms/2),
    ])
  }
  await talk("Hello, and welcome to the Pokémon Center.").then(()=>{
    return talk("We restore your tired Pokémon to full health.")
  })

  talk("Would you like to rest your Pokémon?");
  if (await new Promise((resolve)=>Dialog.confirm({
    title: "Pokemon Center Nurse",
    content: "Would you like to rest your Pokémon?",
    yes: ()=>resolve(false),
    no: ()=>resolve(true),
  }))) {
    await talk("We hope to see you again!");
    return;
  };

  await talk("OK, I'll take your Pokémon for a few seconds.");

  // turn the nurse
  if (nurse?.object?.direction) nurse.object.direction = "left";

  let currentTime = 0;
  if (music?.playing) {
    currentTime = music.currentTime;
    volume = music.volume;
    await music.stop({ fade: 500, volume: 0, });
    currentTime = currentTime == undefined ? 0 : currentTime + 0.5;
  }

  const recoverySound = await game.audio.create({
    src: "modules/pokemon-assets/audio/bgs/pokemon-recovery-GBA.mp3",
  });

  const recoverySoundDone = new Promise((resolve)=>{
    recoverySound.addEventListener("stop", ()=>{
      setTimeout(()=>{
        if (isNaN(volume) || !isFinite(volume)) return;
        music?.play({ offset: currentTime, fade: 500, volume: volume });
      }, 500);
      resolve();
    });
  });

  await recoverySound.load();
  await recoverySound.play({ volume: Math.clamp(volume * 1.5, 0.09, 1) });

  await doHeal();
  await recoverySoundDone;

  // turn the nurse back
  if (nurse?.object?.direction) nurse.object.direction = "down";

  talk("Thank you for waiting.").then(()=>{
    return talk("We've restored your Pokémon to full health.")
  }).then(()=>{
    return talk("We hope to see you again!");
  })
}


async function PokemonComputer(scene, regionDocument, regionBehavior, event) {
  if (event?.user !== game.user) return;

  const token = event?.data?.token;
  if (!token) return;
  const actor = token.actor;
  if (!actor) return;

  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
  .sound()
    .file(`modules/pokemon-assets/audio/bgs/computeropen.mp3`)
    .locally(true)
    // .audioChannel("environment")
    .async()
  .play();

  actor?.folder?.renderPartySheet?.();
}


async function GrassShake(scene, regionDocument, regionBehavior, event) {
  if (event?.user !== game.user) return;

  const destination = (()=>{
    const { sizeX, sizeY } = scene?.grid ?? { sizeX: 100,  sizeY: 100 };
    const { x, y } =  event?.data?.destination ?? { x: 0, y: 0 };
    return canvas.grid.getSnappedPoint(
      { x: x + (sizeX / 2), y: y + (sizeY / 2), },
      {
        mode: CONST.GRID_SNAPPING_MODES.CENTER
      }
    );
  })();

  console.log(arguments, destination);
  if (!destination) return;

  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_0.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .waitUntilFinished()
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_1.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .waitUntilFinished()
    .effect()
      .file("modules/pokemon-assets/img/animations/grass_frame_2.png", { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(100)
      .fadeOut(50)
    .play();
}


async function TokenReact(token, reaction) {
  const destination = (()=>{
    const { x, y } = token;
    const { sizeX, sizeY } = token?.parent?.grid ?? { sizeX: 100,  sizeY: 100 };
    return {
      x: x + (sizeX / 2),
      y: y - (sizeY / 2),
    }
  })();
  return new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .sound()
      .file(`modules/pokemon-assets/audio/bgs/reactions/${reaction}.mp3`)
      .locally(false)
      // .audioChannel("environment")
    .effect()
      .file(`modules/pokemon-assets/img/reactions/${reaction}.png`, { antialiasing: PIXI.SCALE_MODES.NEAREST })
      .atLocation(destination)
      .size(2, { gridUnits: true })
      .duration(2000)
      .fadeIn(50)
      .fadeOut(50)
      .async()
    .play();
}


async function TrainerEyesMeet(token, scene, regionDocument, regionBehavior, event) {
  if (!game.user.isGM) return; // only do updates as the GM
  if (token === event?.data?.token) return; // the token can't trigger its own vision!
  if (token.disposition === event?.data?.token?.disposition) return; // the token has to be aligned differently

  // pause game!
  game.togglePause(true, true);

  // turn the token
  const target = event?.data?.destination;
  const dx = token.x - target.x;
  const dy = token.y - target.y;
  const rotation = (()=>{
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) return 90;
      return 270;
    }
    if (dy > 0) return 180;
    return 0;
  })();
  await token.update({
    rotation,
  });

  // disable region behavior
  await regionBehavior.update({
    disabled: true,
  });

  await TokenReact(token, "surprise");
  const { sizeX, sizeY } = token?.parent?.grid ?? { sizeX: 100,  sizeY: 100 };

  // new target location
  const nx = target.x + (Math.sign(dx) * sizeX);
  const ny = target.y + (Math.sign(dy) * sizeY);
  await token.update({
    x: nx,
    y: ny,
  });
}

/**
 * 
 * @param {*} newScene 
 * @param {*} position 
 * @param {*} scene
 * @param {*} regionDocument
 * @param {*} regionBehavior
 * @param {object} triggerInfo
 * @param {*} triggerInfo.data
 * @param {*} triggerInfo.name
 * @param {*} triggerInfo.user
 * @returns 
 */
async function SwitchScenes(newScene, newAttributes, ...args) {
  const [scene, regionDocument, regionBehavior, { data: { token }, name: trigger, user }] = args;
  if (!newScene || !scene || !token) return;
  if (!game.user.isGM) return;
  if (user.isGM && user !== game.user) return;

  const tokenData = {
    ...token.toObject(),
    ...newAttributes,
  };

  console.log(user, scene, tokenData);

  await newScene.createEmbeddedDocuments("Token", [tokenData]);
  await token.delete();
  await new Sequence({ moduleName: "pokemon-assets", softFail: true })
    .sound()
      .file("modules/pokemon-assets/audio/bgs/exit.mp3")
      .forUsers([user.id])
      .async()
    .play();
  await game.socket.emit("pullToScene", newScene.id, user.id)
}

/**
 * Handles tokens jumping down a one-way ledge.
 * Best used with the "Token Moved In" event
 * called like: game.modules.get("pokemon-assets")?.api?.scripts?.HandleJumps?.(direction, ...arguments);
 * @param {*} direction
 * @returns 
 */
async function HandleJumps() {
  const [direction, scene, regionDocument, regionBehavior, { data: { token }, name: eventName, user }] = arguments;

  if (user !== game.user || !token || !scene) return;

  const { sizeX, sizeY } = scene.grid;

  const renderedToken = game.canvas.tokens.ownedTokens.find(t=>t.id === token.id);

  // wait until the token has finished animating
  await renderedToken.allAnimationsPromise;

  // check if the token is still inside the jump area
  if (!token.regions.has(regionDocument)) return;
  switch (direction) {
    case "down": return await token.update({ y: token.y + sizeY});
    case "left": return await token.update({ x: token.x - sizeX});
    case "right": return await token.update({ x: token.x + sizeX});
    case "up": return await token.update({ y: token.y - sizeY});
  }
}

/**
 * Handles tokens sliding on a region of ice.
 * Best used with the "After Token Moved" event
 * called like: game.modules.get("pokemon-assets")?.api?.scripts?.HandleIce?.(...arguments);
 * @param {*} scene
 * @param {*} regionDocument
 * @param {*} regionBehavior
 * @param {*} event
 * @param {*} event.data
 * @param {*} event.data.token
 * @param {*} event.name
 * @param {*} event.user
 * @returns 
 */
async function HandleIce() {
  const [scene, regionDocument, regionBehavior, { data: { token }, name: eventName, user }] = arguments;

  if (user !== game.user || !token || !scene) return;

  if (token._sliding ?? false) return;
  token._sliding = true;

  const { sizeX, sizeY } = scene.grid;
  const { x: originalX, y: originalY } = token;

  const renderedToken = game.canvas.tokens.ownedTokens.find(t=>t.id === token.id);

  // wait until the token has finished animating
  await renderedToken.allAnimationsPromise;

  const dx = Math.sign(token.x - originalX) * sizeX;
  const dy = Math.sign(token.y - originalY) * sizeY;

  let count = 0;
  // check if the token is still inside the jump area
  while (count < 80 && token.regions.has(regionDocument)) {
    await renderedToken.allAnimationsPromise;
    const shiftedPosition = renderedToken._getShiftedPosition(dx, dy);
    await token.update(shiftedPosition);
    count++;
  }
  await renderedToken.allAnimationsPromise;
  token._sliding = false;
  renderedToken._refreshRotation();
}

class PainterTemplate extends MeasuredTemplate {
  #initialLayer;
  #events;
  #moveTime;

  /**
   * Creates a preview of the template.
   * @returns {Promise}  A promise that resolves with the final template if created.
   */
  drawPreview() {
    const initialLayer = canvas.activeLayer;

    // Draw the template and switch to the template layer
    this.draw();
    this.layer.activate();
    this.layer.preview.addChild(this);

    // Hide the sheet that originated the preview
    // this.actorSheet?.minimize();

    // Activate interactivity
    return this.activatePreviewListeners(initialLayer);
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for the template preview
   * @param {CanvasLayer} initialLayer  The initially active CanvasLayer to re-activate after the workflow is complete
   * @returns {Promise}                 A promise that resolves with the final measured template if created.
   */
  activatePreviewListeners(initialLayer) {
    return new Promise((resolve, reject) => {
      this.#initialLayer = initialLayer;
      this.#events = {
        cancel: this._onCancelPlacement.bind(this),
        confirm: this._onConfirmPlacement.bind(this),
        move: this._onMovePlacement.bind(this),
        resolve,
        reject,
      };

      // Activate listeners
      canvas.stage.on("mousemove", this.#events.move);
      canvas.stage.on("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = this.#events.cancel;
    });
  }

  /* -------------------------------------------- */

  /**
   * Shared code for when template placement ends by being confirmed or canceled.
   * @param {Event} event  Triggering event that ended the placement.
   */
  async _finishPlacement(event) {
    this.layer._onDragLeftCancel(event);
    canvas.stage.off("mousemove", this.#events.move);
    canvas.stage.off("mousedown", this.#events.confirm);
    canvas.app.view.oncontextmenu = null;
    canvas.app.view.onwheel = null;
    this.#initialLayer.activate();
    // await this.actorSheet?.maximize();
  }

  /* -------------------------------------------- */

  /**
   * Move the template preview when the mouse moves.
   * @param {Event} event  Triggering mouse event.
   */
  _onMovePlacement(event) {
    event.stopPropagation();
    const now = Date.now(); // Apply a 20ms throttle
    if ( now - this.#moveTime <= 20 ) return;
    const center = event.data.getLocalPosition(this.layer);
    const interval = canvas.grid.type === CONST.GRID_TYPES.GRIDLESS ? 0 : 1;
    const snapped = canvas.grid.getSnappedPosition(center.x, center.y, interval);
    this.document.updateSource({x: snapped.x, y: snapped.y});
    this.refresh();
    this.#moveTime = now;
  }

  /* -------------------------------------------- */

  /**
   * Confirm placement when the left mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onConfirmPlacement(event) {
    await this._finishPlacement(event);
    const interval = canvas.grid.type === CONST.GRID_TYPES.GRIDLESS ? 0 : 2;
    const destination = canvas.grid.getSnappedPosition(this.document.x, this.document.y, interval);
    this.document.updateSource(destination);
    this.#events.resolve(this.document.toObject());
  }

  /* -------------------------------------------- */

  /**
   * Cancel placement when the right mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onCancelPlacement(event) {
    await this._finishPlacement(event);
    this.#events.reject();
  }
}

/**
 * @returns {Promise}  A promise that resolves with the final location selected.
 */
async function UserPaintArea() {
  const cls = CONFIG.MeasuredTemplate.documentClass;
  const template = new cls({
    t: "rect",
    user: game.user.id,
    distance: Math.hypot(1, 1),
    width: 1,
    direction: 45,
    x: 0,
    y: 0,
    fillColor: game.user.color
  }, {parent: canvas.scene});
  const location = await (new PainterTemplate(template)).drawPreview();
  if (!location) return null;

  const { x, y } = location;
  return { x, y };
}



export function register() {
  const module = game.modules.get("pokemon-assets");
  module.api ??= {};
  module.api.scripts = {
    PokemonCenter,
    GrassShake,
    TokenReact,
    TrainerEyesMeet,
    PokemonComputer,
    SwitchScenes,
    HandleIce,
    HandleJumps,
    UserPaintArea,
  };
}