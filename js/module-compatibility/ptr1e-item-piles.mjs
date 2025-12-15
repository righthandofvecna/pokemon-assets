import { MODULENAME } from "../utils.mjs";


/**
 * This is the most critical part of the integration.
 * @param {*} wrapped 
 * @param {*} updates 
 * @param {*} context 
 * @returns 
 */
async function Actor_updateDocuments(wrapped, updates, context) {
  const safeUpdates = [];
  const unsafeUpdates = [];
  const updateWasSafe = [];
  // split the updates into those that are item piles and those that are not
  for (const changed of updates) {
    const actorId = String(changed._id);
    const actor = game.actors.get(actorId);
    if ((foundry.utils.getProperty(actor || {}, "flags.item-piles.data.enabled") || foundry.utils.getProperty(foundry.utils.flattenObject(changed), "flags.item-piles.data.enabled"))) {
      console.log("Updating unsafe:", actor, foundry.utils.deepClone(changed));
      unsafeUpdates.push(changed);
      updateWasSafe.push(false);
    } else {
      console.log("Updating safe:", actor, foundry.utils.deepClone(changed));
      safeUpdates.push(changed);
      updateWasSafe.push(true);
    }
  }
  let safeResults = []
  let unsafeResults = [];
  if (safeUpdates.length > 0) {
    safeResults = await wrapped(safeUpdates, context);
  }
  if (unsafeUpdates.length > 0) {
    unsafeResults = await Actor.updateDocuments.bind(this)(unsafeUpdates, context);
  }
  // recombine the results in the original order
  const results = [];
  for (const wasSafe of updateWasSafe) {
    if (wasSafe) {
      results.push(safeResults.shift());
    } else {
      results.push(unsafeResults.shift());
    }
  }
  return results;
}

/* ------------------------------------------------------------------------- */

function OnItemPilesPreDropItemDetermined(a, b, dropData, d) {
  if (dropData?.item?.type === "species") return false;
}

function OnPreCreateCombatant(actor, { actorId, hidden, sceneId, tokenId }={}, metadata, userId) {
  if (!actor?.token?.flags?.["item-piles"]?.data?.enabled) return;

  // check if we're only selecting item piles
  const selected = game.canvas.tokens.placeables.filter(o => o.controlled).map(o => o.document);
  const selectedPiles = selected.filter((token)=>token?.flags?.["item-piles"]?.data?.enabled);
  const allPiles = selected.length == selectedPiles.length;
  if (allPiles) return;
  // actor.token.object.release();
  if (selectedPiles[0]?.id === tokenId) {
    ui.notifications.info(`${selectedPiles.length} selected Item Pile${selectedPiles.length!==1?"s":""} not added to combat!`);
  }
  return false;
}



function integrateItemPiles() {
  Hooks.once("item-piles-ready", async () => {
    game.itempiles.API.addSystemIntegration({
      "VERSION": "1.0.1",

      // The actor class type is the type of actor that will be used for the default item pile actor that is created on first item drop.
      "ACTOR_CLASS_TYPE": "character",

      // The item quantity attribute is the path to the attribute on items that denote how many of that item that exists
      "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",

      // The item price attribute is the path to the attribute on each item that determine how much it costs
      "ITEM_PRICE_ATTRIBUTE": "system.cost",

      // Item types and the filters actively remove items from the item pile inventory UI that users cannot loot, such as spells, feats, and classes
      "ITEM_FILTERS": [
        {
          "path": "type",
          "filters": "ability,capability,condition,contestmove,dexentry,edge,effect,feat,move,pokeball,pokeedge,reference,species,spiritaction"
        }
      ],

      "UNSTACKABLE_ITEM_TYPES": [],

      // Item similarities determines how item piles detect similarities and differences in the system
      "ITEM_SIMILARITIES": [],

      // Currencies in item piles is a versatile system that can accept actor attributes (a number field on the actor's sheet) or items (actual items in their inventory)
      // In the case of attributes, the path is relative to the "actor.system"
      // In the case of items, it is recommended you export the item with `.toObject()` and strip out any module data
      "CURRENCIES": [{
        "primary": true,
        "name": "Poké",
        "abbreviation": "{#}₽",
        "exchangeRate": 1,
        "data": {
          "path": "system.money",
        },
      }],
    });

    game.settings.set("item-piles", "hideActorHeaderButton", false);

    // PTR2e seems to use the actor hook for ITEMS as well....
    // Hooks.on("getActorSheetHeaderButtons", insertActorHeaderButtons);
    // Hooks.on("getActorSheetHeaderButtons", (sheet)=>{
    //   console.log(sheet);
    //   if ((sheet?.object ?? sheet?.item) instanceof Item)
    //     return insertItemHeaderButtons(sheet);
    //   return insertActorHeaderButtons(sheet);
    // })
    // Hooks.on("getItemSheetHeaderButtons", insertItemHeaderButtons);
  });
}

export function register() {
  if (game.system.id != "ptu" || !game.modules.get("item-piles")?.active) return;

  libWrapper.register(MODULENAME, "CONFIG.PTU.Actor.documentClasses.character.updateDocuments", Actor_updateDocuments, "MIXED");

  Hooks.on("item-piles-preDropItemDetermined", OnItemPilesPreDropItemDetermined);
  Hooks.on("preCreateCombatant", OnPreCreateCombatant);
  // see docs for more info https://github.com/fantasycalendar/FoundryVTT-ItemPiles/blob/master/docs/api.md
  integrateItemPiles();
}