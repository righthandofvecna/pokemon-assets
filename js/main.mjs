
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as hooks from "./hooks.mjs";
import * as token from "./token.mjs";
import * as spritesheets from "./spritesheets.mjs";
import * as scripts from "./scripts.mjs";
import * as pixelate from "./pixelate.mjs";

Hooks.on("init", ()=>{
  audio.register();
  controls.register();
  hooks.register();
  token.register();
  spritesheets.register();
  scripts.register();
  pixelate.register();
})