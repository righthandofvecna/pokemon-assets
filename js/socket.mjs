import { DGANAME } from "./utils.mjs";

export function current() {
  return game.modules.get(DGANAME).soc;
}

export function registerSocket(name, fn) {
  const socket = current();
  if (typeof socket !== "object") {
    game.modules.get(DGANAME).socketFunctions ??= [];
    game.modules.get(DGANAME).socketFunctions.push({ name, fn });
    return;
  }
  socket.register(name, fn);
}

// Hooks.once("socketlib.ready", () => {
//   const socket = socketlib.registerModule(DGANAME);
//   game.modules.get(DGANAME).soc = socket;
//   (game.modules.get(DGANAME).socketFunctions ?? []).forEach(({ name, fn })=>{
//     socket.register(name, fn);
//   });
// });


export function register() {}
