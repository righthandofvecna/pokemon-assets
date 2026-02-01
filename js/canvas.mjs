
import { MODULENAME, getCombatsForScene } from "./utils.mjs";

function OnCanvasReady(cnvs) {
  try {
    cnvs?.tokens?.objects?.children?.forEach(o=>o?.startIdleAnimation?.());
  } catch (e) {
    console.error("OnCanvasReady():", e);
  }
}

// When a new token is dropped on the canvas, start its idle animation
function OnCreateToken(token) {
  try {
    setTimeout(()=>token?.object?.startIdleAnimation?.(), 200);
  } catch (e) {
    console.error("OnCreateToken():", e);
  }
  (()=>{
    if (!game.user.isActiveGM || !game.settings.get(MODULENAME, "tokenDropAddToCombat")) return;
    const scene = token?.parent;
    if (!scene) return;
    const combat = getCombatsForScene(scene.id)?.at(0);
    if (!combat || !combat.active) return;

    if (game.modules.get("item-piles")?.active &&
        token?.flags?.["item-piles"]?.data?.enabled) {
      return;
    }

    foundry.applications.api.DialogV2.confirm({
      window: { title: `Token Drop - ${token.name}` },
      content: `Add ${token.name} to the active combat?`,
    }).then((toggle)=>{
      if (!toggle) return;
      token.toggleCombatant({
        active: true,
      });
    }).catch();
  })();
}

function Token_onCreate(data, options, userId) {
  foundry.canvas.placeables.PlaceableObject.prototype._onCreate.call(this, data, options, userId);
  this.initializeSources(); // Update vision and lighting sources
  // do not assume control of the token on creation
  // if ( !game.user.isGM && this.isOwner && !this.document.hidden && !canvas.tokens.controlled.length ) {
  //   this.control({pan: true}); // Assume control
  // }
  canvas.perception.update({refreshOcclusion: true});
}

export function register() {
  Hooks.on("canvasReady", OnCanvasReady);
  Hooks.on("createToken", OnCreateToken);

  game.settings.register(MODULENAME, "tokenDropAddToCombat", {
		name: "Add Token To Combat",
		default: true,
		type: Boolean,
		scope: "world",
		config: true,
		hint: "When dropping a token onto a scene that has an actively running combat, prompt the GM to add it to the combat tracker."
	});

  if (!game.settings.get(MODULENAME, "autoControlOwnedToken")) {
    libWrapper.register(MODULENAME, "foundry.canvas.placeables.Token.prototype._onCreate", Token_onCreate, "OVERRIDE");
  }
}
