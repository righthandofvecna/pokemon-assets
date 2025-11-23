import { MODULENAME } from "../../utils.mjs";
import { createPerkListManager, register as registerPerkTemplates } from "./perk-list.mjs";

export function register() {
  class PTR2eSheetPA extends CONFIG.PTR.Actor.sheetClasses.character {
    static get name() { return 'PTR2eSheetPA'; }
    
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      classes: [...super.DEFAULT_OPTIONS.classes, MODULENAME],
      actions: {
        "open-perk-list": PTR2eSheetPA._onOpenPerkList
      }
    }, { inplace: false });

    static PARTS = {
      ...super.PARTS,
      sidebar: {
        id: "sidebar",
        template: `modules/${MODULENAME}/templates/ptr2e/actor-sidebar.hbs`,
      },
      overview: {
        id: "overview",
        template: `modules/${MODULENAME}/templates/ptr2e/actor-overview.hbs`,
      },
      header: {
        id: "header",
        template: `modules/${MODULENAME}/templates/ptr2e/actor-header.hbs`,
      },
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);

      //
      // Sidebar
      //
      if (partId === "sidebar") {
        // Experience
        const advancement = this.actor.system.advancement;
        const xpPercent = (()=> {
          const prevXp = Math.ceil((1 * Math.pow(Math.min(advancement.level, 100), 3)) / 1);
          const { current, next } = advancement.experience;
          return 100 * Math.max(0, current - prevXp) / Math.max(1, next - prevXp);
        })();
        context.experience = {
          value: advancement.experience.current,
          max: advancement.experience.next,
          percent: xpPercent,
        };

        // Combat Stages
        const stages = [];
        stages.push(...Object.entries(this.actor.system.attributes).map(([key, attr])=> ({
          key,
          fieldName: `system.attributes.${key}.stage`,
          value: attr.stage ?? 0,
        })));
        stages.push(...Object.entries(this.actor.system.battleStats).map(([key, attr])=> ({
          key,
          fieldName: `system.battleStats.${key}.stage`,
          value: attr.stage ?? 0,
        })));

        context.stages = stages.filter(stage=>stage.value != 0).sort((a, b) => b.value - a.value).map(stage=>({
          ...stage,
          classes: stage.value > 0 ? "positive" : (stage.value < 0 ? "negative" : ""),
          icon: stage.value > 0 ? "fas fa-angles-up" : "fas fa-angles-down",
          label: `POKEMON-ASSETS.Stages.${stage.key}.Label`,
          value: stage.value > 0 ? `+${stage.value}` : stage.value,
        }));

        // Creature Types
        context.types = (this.actor.system.traits?.contents ?? []).filter(trait=>this.actor.system.type.types.has(trait.slug)).map(trait=>({
          slug: trait.slug,
          label: trait.label,
          icon: `systems/ptr2e/img/icons/${trait.slug}_icon.png`,
          hint: trait.description,
        }));

        // Natures
        context.natures = Object.fromEntries(Object.entries(context.natures).map(([key, value])=>([key, {
          label: key.capitalize(),
          hint: value,
        }])));

        console.log(context);
      }

      //
      // Overview
      //
      if (partId === "overview") {
        Object.values(context.effectiveness).forEach(list=>list.forEach(entry=>{
          entry.slug = entry.name;
          const trait = CONFIG.PTR.data.traits.find(t=>t.slug==entry.slug);
          entry.label = trait?.label ?? entry.name;
          entry.icon = `systems/ptr2e/img/icons/${entry.slug}_icon.png`;
          entry.multiplier = entry.value <= 0.25 ? "¼" : entry.value === 0.5 ? "½" : entry.value;
        }));
      }

      return context;
    }

    /* -------------------------------------------- */

    /**
     * Handle opening the perk list view
     * @param {PointerEvent} event  The triggering event.
     * @param {HTMLElement} target  The target element.
     */
    static async _onOpenPerkList(event, target) {
      event.preventDefault();
      
      const actor = this.actor;
      if (!actor) return;
      
      // Create the perk list manager (now combines global and species perks)
      const manager = await createPerkListManager(actor);
      manager.showDialog({
        title: `${actor.name} - Perk List`
      });
    }

    /** @inheritDoc */
    async _onRender(context, options) {
      await super._onRender(context, options);
      // Meter editing
      for ( const meter of this.element.querySelectorAll('.meter > [role="meter"]:has(> input)') ) {
        meter.addEventListener("click", event => this.#toggleMeter(event, true));
        meter.querySelector(":scope > input")?.addEventListener("blur", event => this.#toggleMeter(event, false));
      }
    }

    /* -------------------------------------------- */

    /**
     * Toggle editing hit points.
     * @param {PointerEvent} event  The triggering event.
     * @param {boolean} edit        Whether to toggle to the edit state.
     */
    #toggleMeter(event, edit) {
      const target = event.currentTarget.closest('[role="meter"]');
      if ( event.target.nodeName === "BUTTON" ) return;
      const label = target.querySelector(":scope > .label");
      const input = target.querySelector(":scope > input");
      label.hidden = edit;
      input.hidden = !edit;
      if ( edit ) input.focus();
    }
  }

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, MODULENAME, PTR2eSheetPA, {
    types: ["humanoid", "pokemon"],
    makeDefault: false,
    label: "POKEMON-ASSETS.SheetClassCharacter"
  });

  registerPerkTemplates();
}