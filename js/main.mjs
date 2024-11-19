
import * as settings from "./settings.mjs";
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as token from "./token.mjs";
import * as spritesheets from "./spritesheets.mjs";
import * as scripts from "./scripts.mjs";
import * as pixelate from "./pixelate.mjs";
import * as system from "./system-specific/index.mjs";

Hooks.on("init", ()=>{
  settings.register();
  audio.register();
  controls.register();
  token.register();
  spritesheets.register();
  scripts.register();
  pixelate.register();
  system.register();
})