import { MODULENAME } from "../utils.mjs";

// const fu = foundry.utils;

/**
 * The SurfRegionBehaviorType class defines a region behavior that requires surfing when a token enters or exits the region.
 */
class SurfRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  static _systemType = `${MODULENAME}.surf`;
  
  /** @override */
  static defineSchema() {
    return {};
  }

  /* ---------------------------------------- */

  // /** @override */
  // static events = {
  //   [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#onTokenEnter,
  //   [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
  // };

  // /* ---------------------------------------- */

  // static async #onTokenEnter(event) {
  //   const token = event?.data?.token;
  //   if (!token) return;
    
  //   console.log("SurfRegionBehaviorType: Token entered surf region", event, token);
  // }

  // /* ---------------------------------------- */

  // static async #onTokenExit(event) {
  //   const token = event?.data?.token;
  //   if (!token) return;
    
  //   console.log("SurfRegionBehaviorType: Token exited surf region", event, token);
  // }

}

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api; 

/**
 * The FishingRegionBehaviorType class defines a region behavior for fishing spots.
 * GMs configure rod→table mappings, cooldown, no-bite chance, and grace period.
 */
class FishingRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  static _systemType = `${MODULENAME}.fishing`;

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      rodTables: new fields.ArrayField(
        new fields.SchemaField({
          rodUuid: new fields.StringField({
            label: "POKEMON-ASSETS.Fishing.Fields.RodUuid",
            required: false, blank: true, nullable: true, initial: "",
          }),
          tableUuid: new fields.StringField({
            label: "POKEMON-ASSETS.Fishing.Fields.TableUuid",
            required: false, blank: true, nullable: true, initial: "",
          }),
        }),
        {
          label: "POKEMON-ASSETS.Fishing.Fields.RodTables",
          required: false, initial: [],
        }
      ),
      cooldownSeconds: new fields.NumberField({
        label: "POKEMON-ASSETS.Fishing.Fields.CooldownSeconds",
        hint: "POKEMON-ASSETS.Fishing.Fields.CooldownSecondsHint",
        min: 0, integer: true, initial: 0, nullable: false,
      }),
      noBiteChance: new fields.NumberField({
        label: "POKEMON-ASSETS.Fishing.Fields.NoBiteChance",
        hint: "POKEMON-ASSETS.Fishing.Fields.NoBiteChanceHint",
        min: 0, max: 100, integer: true, initial: 50, nullable: false,
      }),
      gracePeriodSeconds: new fields.NumberField({
        label: "POKEMON-ASSETS.Fishing.Fields.GracePeriodSeconds",
        hint: "POKEMON-ASSETS.Fishing.Fields.GracePeriodSecondsHint",
        min: 1, max: 60, integer: true, initial: 5, nullable: false,
      }),
    };
  }
}

/**
 * Custom config sheet for the FishingRegionBehaviorType.
 * Provides a proper add/remove UI for the rod→table mappings.
 */
class FishingRegionBehaviorConfig extends HandlebarsApplicationMixin(DocumentSheetV2) {
  constructor(options) {
    super(options);
    this.options.window.icon = CONFIG.RegionBehavior.typeIcons[this.document.type];
  }

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULENAME}/templates/region-behavior-fishing.hbs`,
      scrollable: [""],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      region: context.document,
      buttons: [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "BEHAVIOR.ACTIONS.update" }],
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("[data-action='addRod']")
      ?.addEventListener("click", () => this.#addRod());
    this.element.querySelectorAll("[data-action='removeRod']").forEach(btn => {
      btn.addEventListener("click", () => this.#removeRod(parseInt(btn.dataset.index)));
    });
  }

  /** Add a new empty rod→table row and re-render. */
  #addRod() {
    const current = this.document.system.rodTables ?? [];
    this.document.updateSource({ system: { rodTables: [...current, { rodUuid: "", tableUuid: "" }] } });
    this.render();
  }

  /** Remove the rod→table row at the given index and re-render. */
  #removeRod(idx) {
    const current = [...(this.document.system.rodTables ?? [])];
    current.splice(idx, 1);
    this.document.updateSource({ system: { rodTables: current } });
    this.render();
  }

  /** @override — ensure rodTables is parsed as an array before saving. */
  async _processSubmitData(event, form, submitData) {
    // submitData is the already-expanded form data plain object
    // FormDataExtended may give rodTables as a plain object with numeric keys — convert to array
    if (submitData.system?.rodTables && !Array.isArray(submitData.system.rodTables)) {
      submitData.system.rodTables = Object.values(submitData.system.rodTables);
    }
    if (submitData.system) submitData.system.rodTables ??= [];
    return this.document.update(submitData);
  }
}

export function register() {
  const SurfRBT = SurfRegionBehaviorType;
  CONFIG.RegionBehavior.dataModels[SurfRBT._systemType] = SurfRBT;
  CONFIG.RegionBehavior.typeLabels[SurfRBT._systemType] = `TYPES.RegionBehavior.${SurfRBT._systemType}`;
  CONFIG.RegionBehavior.typeIcons[SurfRBT._systemType] = "fas fa-wave";

  const FishingRBT = FishingRegionBehaviorType;
  CONFIG.RegionBehavior.dataModels[FishingRBT._systemType] = FishingRBT;
  CONFIG.RegionBehavior.typeLabels[FishingRBT._systemType] = `TYPES.RegionBehavior.${FishingRBT._systemType}`;
  CONFIG.RegionBehavior.typeIcons[FishingRBT._systemType] = "fas fa-fish";

  foundry.applications.apps.DocumentSheetConfig.registerSheet(RegionBehavior, MODULENAME, FishingRegionBehaviorConfig, {
    makeDefault: true,
    types: [FishingRBT._systemType],
    label: "Fishing Spot Config",
  });
}