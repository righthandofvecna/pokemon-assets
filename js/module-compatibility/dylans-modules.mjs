
import { MODULENAME, DGANAME } from "../utils.mjs";

export function registerAfterDependencies() {
  const MODULE = game.modules.get(MODULENAME);
  const DGA = game.modules.get(DGANAME);
  MODULE.api ??= {};
  MODULE.api.PokemonDialogV2 ??= DGA?.api?.FooterDialog;
}