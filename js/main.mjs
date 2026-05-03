
import { MODULENAME, DATNAME, DGANAME } from "./utils.mjs";
import * as migration from "./migration.mjs";
import * as settings from "./settings.mjs";
import * as config from "./config.mjs";
import * as preload from "./preload.mjs";
import * as actor from "./actor.mjs";
import * as audio from "./audio.mjs";
import * as controls from "./controls.mjs";
import * as dialog from "./dialog.mjs";
import * as placeables from "./placeables/index.mjs";
import * as tileConfig from "./tile-config.mjs";
import * as scripts from "./scripts.mjs";
import * as pokemonSheets from "./pokemon-sheets.mjs";
import * as interact from "./interact.mjs";
import * as canvas from "./canvas.mjs";
import * as filePicker from "./file-picker.mjs";
import * as chat from "./chat.mjs";
import * as moduleCompatibility from "./module-compatibility/index.mjs";
import * as system from "./system-specific/index.mjs";
import * as socket from "./socket.mjs";

const SUBMODULES = [
  ["migration", migration],
  ["settings", settings],
  ["config", config],
  ["preload", preload],
  ["actor", actor],
  ["audio", audio],
  ["controls", controls],
  ["dialog", dialog],
  ["placeables", placeables],
  ["tileConfig", tileConfig],
  ["scripts", scripts],
  ["pokemonSheets", pokemonSheets],
  ["interact", interact],
  ["canvas", canvas],
  ["filePicker", filePicker],
  ["chat", chat],
  ["moduleCompatibility", moduleCompatibility],
  ["system", system],
  ["socket", socket],
];

function runForAll(fnId) {
  for (const [name, m] of SUBMODULES) {
    try {
      m[fnId]?.();
    } catch (e) {
      console.error(`[${MODULENAME}] | Error Initializing - ${name}.${fnId}():`, e);
    }
  }
}

Hooks.on("init", async ()=>{
  runForAll("register");

  const DEPENDENCIES = [DATNAME, DGANAME];

  for (const dep of DEPENDENCIES) {
    const module = game.modules.get(dep);
    if (!module || !module.active) {
      Hooks.on("ready", ()=>ui.notifications.error(`"${dep}" module is not active. Please activate it to ensure the "${MODULENAME}" module behaves as expected.`, { permanent: true }));
      return;
    }
  }

  // Wait for all dependencies
  await Promise.all(DEPENDENCIES.map(dep => {
    const module = game.modules.get(dep);
    if (module?.initialized) {
      return Promise.resolve();
    } else {
      return new Promise(resolve => Hooks.once(`${dep}.init`, resolve));
    }
  }));

  runForAll("registerAfterDependencies");
  
  const MODULE = game.modules.get(MODULENAME);
  Hooks.callAll(`${MODULENAME}.init`);
  MODULE.initialized = true;
})
