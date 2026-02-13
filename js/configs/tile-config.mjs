import { MODULENAME, listenFilepickerChange } from "../utils.mjs";
import { SOUNDS } from "../audio.mjs";

const { StringField } = foundry.data.fields;

async function TileConfig_preparePartContext(wrapped, partId, context, options) {
  context = await wrapped(partId, context, options);
  if (partId === "puzzle") {
    const tile = context.document;
    const pa = tile?.flags?.[MODULENAME] ?? {};
    pa.isCustomSound = pa.interactionSound && !Object.keys(SOUNDS).some(v=>v === pa.interactionSound);
    pa.sounds = SOUNDS;
    pa.scriptField = new StringField({}, { parent: { fieldPath: `flags.${MODULENAME}.script` } });
    context.pa = pa;
  }
  return context;
}


function TileConfig_attachPartListeners(wrapped, partId, htmlElement, options) {
  wrapped(partId, htmlElement, options);

  if (partId === "puzzle") {
    $(htmlElement).find(`select[name="flags.${MODULENAME}.interactionSound"]`).on("change", function() {
      const custom = $(htmlElement).find("option.custom-interaction").get(0).value;
      const customInput = $(htmlElement).find(`.custom-interaction[type=text], .custom-interaction [type=text]`).get(0);
      if (this.value === custom) {
        $(htmlElement).find(`.custom-sound`).show();
        if (this.value == "custom") {
          customInput.value = "";
        } else {
          customInput.value = this.value;
        }
      } else {
        $(htmlElement).find(`.custom-sound`).hide();
        customInput.value = "";
      }
    });

    listenFilepickerChange($(htmlElement).find(`.custom-interaction`), function(value) {
      const custom = $(htmlElement).find("option.custom-interaction").get(0);
      const select = $(htmlElement).find(`select[name="flags.${MODULENAME}.interactionSound"]`).get(0);
      if (!value) {
        select.value = "custom";
      } else {
        custom.value = value;
      }
    });
  }
}



export function register() {
  const TileConfig = foundry.applications.sheets.TileConfig;
  TileConfig.PARTS.puzzle = {
    template: "modules/pokemon-assets/templates/tile-settings.hbs"
  }
  const footer = TileConfig.PARTS.footer;
  delete TileConfig.PARTS.footer;
  TileConfig.PARTS.footer = footer;

  TileConfig.TABS.sheet.tabs.push({
    id: "puzzle",
    icon: "fa-solid fa-puzzle-piece",
  });
  libWrapper.register(MODULENAME, "foundry.applications.sheets.TileConfig.prototype._preparePartContext", TileConfig_preparePartContext, "WRAPPER");
  libWrapper.register(MODULENAME, "foundry.applications.sheets.TileConfig.prototype._attachPartListeners", TileConfig_attachPartListeners, "WRAPPER");
}