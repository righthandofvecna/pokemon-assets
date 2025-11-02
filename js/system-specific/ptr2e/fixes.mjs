import { MODULENAME } from "../../utils.mjs";

// sorts the fling attacks based on priority: first if its equipped, then if its IPed, then by sort value
function generateFlingAttack() {
  function getFlingAttack(
    { name, slug, power = 25, accuracy = 100, types = ["untyped"], free = false, variant = true, description = "", id = "", range = null, traits = [] }
      = { name: "", slug: "", power: 25, accuracy: 100, types: ["untyped"], free: false, variant: true, description: "", id: "" }
  ) {
    return {
      slug: `fling${name?.length ? `-${slug}` : ""}`,
      name: `Fling${name?.length ? ` (${name})` : ""}`,
      type: "attack",
      traits: [
        "adaptable",
        "basic",
        "fling",
        "pp-updated",
        ...(traits?.length ? traits : [])
      ],
      range: {
        target: range?.target || "creature",
        distance: range?.distance ?? 10,
        unit: range?.unit || "m"
      },
      cost: {
        activation: "complex",
        powerPoints: 0
      },
      category: "physical",
      power: power || 25,
      accuracy: accuracy || 100,
      types: types?.length ? types : ["untyped"],
      description: description ? description : "<p>Effect: The Type, Power, Accuracy, and Range of this attack are modified by the Fling stats of the utilized item. When using Fling utilizing a Held creature, Fling's Power, Accuracy, and Range change based on the user and the Flung creature.</p>",
      variant: variant ? "fling" : null,
      free,
      img: "systems/ptr2e/img/svg/untyped_icon.svg",
      ...(id ? { flingItemId: id } : {})
    }
  }
  const data = {
    "name": "Fling",
    "type": "move",
    "img": "systems/ptr2e/img/svg/untyped_icon.svg",
    "system": {
      "slug": "fling",
      "description": "<p>Effect: The Type, Power, Accuracy, and Range of this attack are modified by the Fling stats of the utilized item. When using Fling utilizing a Held creature, Fling's Power, Accuracy, and Range change based on the user and the Flung creature.</p>",
      "traits": [
        "adaptable",
        "basic",
        "fling"
      ],
      "actions": [getFlingAttack({
        free: true,
        variant: false
      }), getFlingAttack({
        name: "Actor Toss",
        slug: "actor-toss",
      })],
      "grade": "E"
    },
    "_id": "flingattackitem0",
    "effects": []
  };

  const itemNames = new Set();
  //
  // This is the part that's different
  //
  const sortedContents = this.items?.contents.filter(item=>["consumable", "equipment", "gear", "weapon"].includes(item.type)).sort((a, b) => {
    const aEquipped = ["stowed", "dropped"].includes(a.system.equipped?.carryType) ? 0 : 1;
    const bEquipped = ["stowed", "dropped"].includes(b.system.equipped?.carryType) ? 0 : 1;
    if (aEquipped !== bEquipped) return bEquipped - aEquipped;

    const aTemp = a.system.temporary ? 1 : 0;
    const bTemp = b.system.temporary ? 1 : 0;
    if (aTemp !== bTemp) return bTemp - aTemp;

    return a.sort - b.sort;
  });
  //
  // End different part
  //
  for (const item of sortedContents) {
    // if (!["consumable", "equipment", "gear", "weapon"].includes(item.type)) continue;
    if (!item.system.fling) continue;
    if (itemNames.has(item.slug)) continue;
    if (item.system.quantity !== undefined && typeof item.system.quantity === 'number' && item.system.quantity <= 0) continue;
    itemNames.add(item.slug);

    const flingData = item.system.fling;
    if (flingData.hide) continue;

    data.system.actions.push(getFlingAttack({
      name: item.name, slug: item.slug, power: flingData.power, accuracy: flingData.accuracy, range: flingData.range, types: [flingData.type], traits: item.traits?.map(t => t.slug), id: item.id,
      description: `<p>Effect: The Type, Power, Accuracy, and Range of this attack are modified by the Fling stats of the utilized item.</p><p>This fling variant is based on ${item.link}</p>`
    }));
  }

  const existing = this.items.get(data._id);
  if (existing) {
    existing.updateSource(data);
    existing.reset();
    this.fling = existing;
  }
  else {
    this.fling = new CONFIG.PTR.Item.documentClass(data, { parent: this }); // ItemPTR2e -> CONFIG.PTR.Item.documentClass
  }

  this.items.set(this.fling.id, this.fling);
}


export function register() {
  game.settings.register(MODULENAME, "fixFling", {
		name: "Fix Fling Attack Consumption Priority",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "In PTR2e, prioritize the item to consume for Fling attacks based on whether the item is equipped, then if it's temporary, then by sort value.",
	});
  if (!game.settings.get(MODULENAME, "fixFling")) return;
  libWrapper.register(MODULENAME, "CONFIG.PTR.Actor.documentClass.prototype.generateFlingAttack", generateFlingAttack, "OVERRIDE");
}