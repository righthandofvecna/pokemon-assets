import { MODULENAME } from "./utils.mjs";


function FilePicker_favorites(wrapped) {
  const favorites = wrapped();
  return {
    ...Object.fromEntries(Object.entries(favorites).filter(([k,d])=>!d.auto)),
    "data-modules/pokemon-assets/img/pmd-overworld/": {
      label: "PMD Overworld",
      source: "data",
      path: "modules/pokemon-assets/img/pmd-overworld/",
      auto: true,
    },
    "data-modules/pokemon-assets/img/trainers-profile/": {
      label: "Trainer Profile",
      source: "data",
      path: "modules/pokemon-assets/img/trainers-profile/",
      auto: true,
    },
  }
}

export function register() {
  libWrapper.register(MODULENAME, "foundry.applications.apps.FilePicker.implementation.prototype.favorites", FilePicker_favorites, "WRAPPER");
}
