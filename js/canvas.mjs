
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
}
