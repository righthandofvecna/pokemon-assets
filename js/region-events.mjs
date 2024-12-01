
import { MODULENAME } from "./utils.mjs";


function RegionBehaviorConfig_getFields(wrapped) {
  const fieldsets = wrapped();
  const eventFieldSet = fieldsets.find(fs=>fs.legend === "BEHAVIOR.TYPES.base.SECTIONS.events");
  if (eventFieldSet) {
    const eventField = eventFieldSet.fields[0];
    const doc = this.document;
    const hasTokenInteract = doc.getFlag(MODULENAME, "hasTokenInteract");
    if (hasTokenInteract) {
      eventField.value = [...eventField.value, "tokenInteract"];
    }
    eventField.field = foundry.utils.deepClone(eventField.field);
    eventField.field.element.choices.tokenInteract = "Token Interact";
  }
  return fieldsets;
}

function RegionBehaviorConfig_prepareSubmitData(wrapped, event, form, formData) {
  const submitData = wrapped(event, form, formData);
  submitData.flags ??= {};
  submitData.flags[MODULENAME] ??= {};
  if (submitData?.system?.events?.includes("tokenInteract")) {
    submitData.system.events.splice(submitData.system.events.indexOf("tokenInteract"));
    submitData.flags[MODULENAME].hasTokenInteract = true;
  } else {
    submitData.flags[MODULENAME].hasTokenInteract = false;
  }
  return submitData;
}

/**
   * Handle the Region event.
   * @param {RegionEvent} event    The Region event
   * @returns {Promise<void>}
   * @internal
   */
async function RegionBehavior_handleRegionEvent(wrapped, event) {
  await wrapped(event);
  const system = this.system;
  if ( !(system instanceof foundry.data.regionBehaviors.RegionBehaviorType) ) return;
  if (event.name !== "tokenInteract" || !this.getFlag(MODULENAME, "hasTokenInteract")) return;
  await system._handleRegionEvent(event);
}


function _norm_angle(a) {
  return a < 0 ? a + 360 : (a >= 360 ? a - 360 : a);
}

/**
 * Trigger the "tokenInteract" region behavior for all selected tokens
 */
function OnInteract() {
  const selected = game.canvas.tokens.placeables.filter(o => o.controlled).map(o => o.document);
  if (selected.length === 0) return;
  // send interact event
  selected.forEach(token=>{
    token.regions.forEach(region=>{
      // if has tokenInteract
      if (region.behaviors.some(b=>b.getFlag(MODULENAME, "hasTokenInteract"))) {
        region._triggerEvent("tokenInteract", { token });
      }
    })
    // check if we are facing/adjacent to an item pile
    if (game.modules.get("item-piles")?.active) {
      const tObj = token.object;
      const { x: tx, y: ty } = canvas.grid.getCenterPoint(tObj.center);
      const { sizeX, sizeY } = canvas.grid;
      const adjacent = game.canvas.tokens.placeables.filter(o=>{
        if (o === tObj || !o.document?.flags?.["item-piles"]?.data?.enabled) return false;
        const { x: ox, y: oy } = canvas.grid.getCenterPoint(o.center);
        return (Math.abs(ox - tx) * 2 <= Math.max(o.w, sizeX) + Math.max(tObj.w, sizeX)) && (Math.abs(oy - ty) * 2 <= Math.max(o.h, sizeY) + Math.max(tObj.h, sizeY));
      })
      
      const facing = (()=>{
        // if we're not a token with facing, we're done!
        if (!tObj.isTileset) return adjacent;
        // otherwise, check the direction to the other token
        return adjacent.filter(o=>{
          const { x: ox, y: oy } = canvas.grid.getCenterPoint(o.center);
          const direction = (Math.atan2(oy - ty, ox - tx) * 180 / Math.PI) - 90;
          return Math.floor(_norm_angle(direction + 22.5) / 8) == Math.floor(_norm_angle(token.rotation + 22.5) / 8);
        })
      })();

      if (facing.length > 0) {
        facing.forEach(ip=>game.itempiles.API.renderItemPileInterface(ip.document, { inspectingTarget: token?.actor?.uuid }));
      }
    }
  });
}


export function register() {
  libWrapper.register(MODULENAME, "foundry.applications.sheets.RegionBehaviorConfig.prototype._getFields", RegionBehaviorConfig_getFields, "WRAPPER");
  libWrapper.register(MODULENAME, "foundry.applications.sheets.RegionBehaviorConfig.prototype._prepareSubmitData", RegionBehaviorConfig_prepareSubmitData, "WRAPPER");
  libWrapper.register(MODULENAME, "CONFIG.RegionBehavior.documentClass.prototype._handleRegionEvent", RegionBehavior_handleRegionEvent, "WRAPPER");

  game.keybindings.register(MODULENAME, "tokenInteract", {
    name: "Token Interact",
    hint: "The button which triggers Scene Regions configured as \"Token Interactions\"",
    editable: [
      {
        key: "Enter"
      }
    ],
    onDown: OnInteract,
    onUp: ()=>{},
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
  });
}