
import * as settings from "./settings.mjs";
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as placeables from "./placeables/index.mjs";
import * as spritesheets from "./spritesheets.mjs";
import * as scripts from "./scripts.mjs";
import * as pixelate from "./pixelate.mjs";
import * as regionEvents from "./region-events.mjs";
import * as followMe from "./follow-me.mjs";
import * as system from "./system-specific/index.mjs";
import * as socket from "./socket.mjs";

Hooks.on("init", ()=>{
  settings.register();
  audio.register();
  controls.register();
  placeables.register();
  spritesheets.register();
  scripts.register();
  pixelate.register();
  regionEvents.register();
  followMe.register();
  system.register();
  socket.register();
})