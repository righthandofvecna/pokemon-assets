import { MODULENAME } from "./utils.mjs";


class PokemonDialog extends Dialog {
  /* -------------------------------------------- */

  /**
   * @override
   * @returns {DialogOptions}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dialog", "pokemon-dialog"],
    });
  }
}


async function Dialog_wait(wrapped, data={}, options={}, renderOptions={}) {
  if ( options.pokemon !== true ) return wrapped(data, options, renderOptions);

  return new Promise((resolve, reject) => {
    // Wrap buttons with Promise resolution.
    const buttons = foundry.utils.deepClone(data.buttons);
    for ( const [id, button] of Object.entries(buttons) ) {
      const cb = button.callback;
      function callback(html, event) {
        const result = cb instanceof Function ? cb.call(PokemonDialog, html, event) : undefined;
        resolve(result === undefined ? id : result);
      }
      button.callback = callback;
    }

    // Wrap close with Promise resolution or rejection.
    const originalClose = data.close;
    const close = () => {
      const result = originalClose instanceof Function ? originalClose() : undefined;
      if ( result !== undefined ) resolve(result);
      else reject(new Error("The Dialog was closed without a choice being made."));
    };

    // Construct the dialog.
    const dialog = new PokemonDialog({ ...data, buttons, close }, options);
    dialog.render(true, renderOptions);
  });
}


export function register() {
  libWrapper.register(MODULENAME, "Dialog.wait", Dialog_wait, "MIXED");
}