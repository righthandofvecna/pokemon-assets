import { MODULENAME, DGANAME, listenFilepickerChange } from "./utils.mjs";


export function registerAfterDependencies() {
  const DGA = game.modules.get(DGANAME);
  DGA.api ??= {};
  DGA.api.BooleanTileSettings = {
    ...(DGA.api.BooleanTileSettings ?? {}),
    smashable: {
      label: `Destroyed by "Rock Smash"`,
      key: `flags.${MODULENAME}.smashable`,
    },
    cuttable: {
      label: `Destroyed by "Cut"`,
      key: `flags.${MODULENAME}.cuttable`,
    },
    whirlpool: {
      label: `Destroyed by "Whirlpool"`,
      key: `flags.${MODULENAME}.whirlpool`,
    },
    pushable: {
      label: `Movable by "Strength"`,
      key: `flags.${MODULENAME}.pushable`,
    }
  }
}