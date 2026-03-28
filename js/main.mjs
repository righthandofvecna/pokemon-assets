
import * as migration from "./migration.mjs";
import * as settings from "./settings.mjs";
import * as config from "./config.mjs";
import * as preload from "./preload.mjs";
import * as actor from "./actor.mjs";
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as dialog from "./dialog.mjs";
import * as placeables from "./placeables/index.mjs";
import * as configs from "./configs/index.mjs";
import * as spritesheets from "./spritesheets.mjs";
import * as scripts from "./scripts.mjs";
import * as pixelate from "./pixelate.mjs";
import * as pokemonSheets from "./pokemon-sheets.mjs";
import * as regionEvents from "./region-events.mjs";
import * as interact from "./interact.mjs";
import * as canvas from "./canvas.mjs";
import * as filePicker from "./file-picker.mjs";
import * as chat from "./chat.mjs";
import * as moduleCompatibility from "./module-compatibility/index.mjs";
import * as system from "./system-specific/index.mjs";
import * as socket from "./socket.mjs";

Hooks.on("init", ()=>{
  for (const [name, m] of [
    ["migration", migration],
    ["settings", settings],
    ["config", config],
    ["preload", preload],
    ["actor", actor],
    ["audio", audio],
    ["controls", controls],
    ["dialog", dialog],
    ["placeables", placeables],
    ["configs", configs],
    ["spritesheets", spritesheets],
    ["scripts", scripts],
    ["pixelate", pixelate],
    ["pokemonSheets", pokemonSheets],
    ["regionEvents", regionEvents],
    ["interact", interact],
    ["canvas", canvas],
    ["filePicker", filePicker],
    ["chat", chat],
    ["moduleCompatibility", moduleCompatibility],
    ["system", system],
    ["socket", socket]]) {
    try {
      m.register();
    } catch (e) {
      console.error(`${name}.register():`, e);
    }
  }
})
