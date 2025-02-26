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

/**
 * Add the actor pile editor
 * @param {*} actorSheet 
 * @returns 
 */
function insertActorHeaderButtons(actorSheet) {
  if (!game.user.isGM) return;

  let obj = actorSheet?.object ?? actorSheet?.actor;
  if (!actorSheet.options.window.controls.find(c=>c.action === "configure-item-piles")) {
    actorSheet.options.window.controls.unshift({
      label: game.settings.get("item-piles", "hideActorHeaderText") ? "" : game.i18n.localize("ITEM-PILES.HeaderButtons.Configure"),
      icon: "fas fa-box-open",
      class: "item-piles-config-button",
      action: "configure-item-piles",
    });
  };
  actorSheet.options.actions["configure-item-piles"] ??= ()=>game.itempiles.apps.ItemPileConfig.show(obj);
}

/**
 * Add the item editor
 * @param {*} itemSheet 
 * @returns 
 */
function insertItemHeaderButtons(itemSheet) {
  if (!game.user.isGM) return;

  let obj = itemSheet?.object ?? itemSheet?.item;
  if (!itemSheet.options.window.controls.find(c=>c.action === "configure-item-pile-entry")) {
    itemSheet.options.window.controls.unshift({
      label: game.settings.get("item-piles", "hideActorHeaderText") ? "" : game.i18n.localize("ITEM-PILES.HeaderButtons.Configure"),
      icon: "fas fa-box-open",
      class: "item-piles-config-button",
      action: "configure-item-pile-entry",
    });
  };
  itemSheet.options.actions["configure-item-pile-entry"] ??= async ()=>{
    if (game.modules.get("item-linking")?.active) {
      const linkedItemUuid = foundry.utils.getProperty(obj, "flags.item-linking.baseItem") ?? false;
      if (linkedItemUuid) {
        obj = await fromUuid(linkedItemUuid);
        return game.itempiles.apps.ItemEditor.show(obj, {
          extraTitle: " - Compendium"
        });
      }
    }
    return game.itempiles.apps.ItemEditor.show(obj);
  }
}

function integrateItemPiles() {
  Hooks.once("item-piles-ready", async () => {
    game.itempiles.API.addSystemIntegration({
      "VERSION": "1.0.1",

      // The actor class type is the type of actor that will be used for the default item pile actor that is created on first item drop.
      "ACTOR_CLASS_TYPE": "humanoid",

      // The item quantity attribute is the path to the attribute on items that denote how many of that item that exists
      "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",

      // The item price attribute is the path to the attribute on each item that determine how much it costs
      "ITEM_PRICE_ATTRIBUTE": "system.cost",

      // Item types and the filters actively remove items from the item pile inventory UI that users cannot loot, such as spells, feats, and classes
      "ITEM_FILTERS": [
        {
          "path": "type",
          "filters": "ability,blueprint,effect,move,perk,species,summon"
        }
      ],

      "UNSTACKABLE_ITEM_TYPES": [],

      // Item similarities determines how item piles detect similarities and differences in the system
      "ITEM_SIMILARITIES": [],

      // Currencies in item piles is a versatile system that can accept actor attributes (a number field on the actor's sheet) or items (actual items in their inventory)
      // In the case of attributes, the path is relative to the "actor.system"
      // In the case of items, it is recommended you export the item with `.toObject()` and strip out any module data
      "CURRENCIES": [],
    });

    game.settings.set("item-piles", "hideActorHeaderButton", true);

    // PTR2e seems to use the actor hook for ITEMS as well....
    // Hooks.on("getActorSheetHeaderButtons", insertActorHeaderButtons);
    Hooks.on("getActorSheetHeaderButtons", (sheet)=>{
      console.log("hi-diddly-ho")
      if ((sheet?.object ?? sheet?.item) instanceof Item)
        return insertItemHeaderButtons(sheet);
      return insertActorHeaderButtons(sheet);
    })
    Hooks.on("getItemSheetHeaderButtons", insertItemHeaderButtons);
  });
}

export function register() {
  if (game.system.id != "ptr2e" || !game.modules.get("item-piles")?.active) return;

  Hooks.on("item-piles-preDropItemDetermined", OnItemPilesPreDropItemDetermined);
  Hooks.on("preCreateCombatant", OnPreCreateCombatant);
  // see docs for more info https://github.com/fantasycalendar/FoundryVTT-ItemPiles/blob/master/docs/api.md
  integrateItemPiles();
}