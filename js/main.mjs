
import * as settings from "./settings.mjs";
import * as preload from "./preload.mjs";
import * as actor from "./actor.mjs";
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as dialog from "./dialog.mjs";
import * as placeables from "./placeables/index.mjs";
import * as spritesheets from "./spritesheets.mjs";
import * as scripts from "./scripts.mjs";
import * as pixelate from "./pixelate.mjs";
import * as regionEvents from "./region-events.mjs";
import * as canvas from "./canvas.mjs";
import * as moduleCompatibility from "./module-compatibility/index.mjs";
import * as system from "./system-specific/index.mjs";
import * as socket from "./socket.mjs";

Hooks.on("init", ()=>{
  for (const m of [settings,
    preload,
    actor,
    audio,
    controls,
    dialog,
    placeables,
    spritesheets,
    scripts,
    pixelate,
    regionEvents,
    canvas,
    moduleCompatibility,
    system,
    socket]) {
    try {
      m.register();
    } catch (e) {
      console.error(`?.register():`, e);
    }
  }
})