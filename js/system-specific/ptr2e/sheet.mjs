import { MODULENAME } from "../../utils.mjs";

export function register() {
  class PTR2eSheetPA extends CONFIG.PTR.Actor.sheetClasses.character {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      classes: [...super.DEFAULT_OPTIONS.classes, MODULENAME],
    }, { inplace: false });

    static PARTS = {
      ...super.PARTS,
      sidebar: {
        id: "sidebar",
        template: `modules/${MODULENAME}/templates/ptr2e/actor-sidebar.hbs`,
      }
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
      }

      return context;
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
}