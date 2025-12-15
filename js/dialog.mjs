import { MODULENAME } from "./utils.mjs";


/**
 * Custom DialogV2 wrapper that applies Pokemon styling
 */
class PokemonDialogV2 extends foundry.applications.api.DialogV2 {
  constructor(options = {}) {
    super(options);
  }

  /* -------------------------------------------- */

  /**
   * @override
   */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      classes: ["pokemon-dialog-v2"],
      window: {
        positioned: true,
      },
      position: {
        width: "auto",
        height: "auto",
      },
    },
    { inplace: false }
  );

  /* -------------------------------------------- */

  /**
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add dialog-prompt or dialog-choices class based on button count
    const buttonCount = Object.keys(this.options.buttons ?? {}).length;
    if (buttonCount <= 1) {
      this.element.classList.add("dialog-prompt");
    } else {
      this.element.classList.add("dialog-choices");
    }
  }

  /* -------------------------------------------- */

  /**
   * @override
   */
  async render(options={}, _options={}) {
    if ( typeof options === "boolean" ) options = Object.assign(_options, {force: options});
    return super.render({
      ...options,
      animate: false,
    });
  }

  /* -------------------------------------------- */

  /**
   * @override
   */
  async close(options={}) {
    return super.close({
      ...options,
      animate: false,
    });
  }
}

/**
 * Pokemon-styled prompt dialog
 */
async function PokemonPrompt({ title, content, label = "OK", callback, rejectClose = false, options = {} } = {}) {
  const dialogOptions = foundry.utils.mergeObject(
    {
      window: {
        title: title ?? "Prompt",
      },
      content: `<div class="dialog-content">${content}</div>`,
      buttons: [
        {
          action: "ok",
          label: label,
          icon: "fa-solid fa-arrow-right", // This will be styled in CSS
          default: true,
          callback: callback ?? ((event, button, dialog) => true),
        },
      ],
      rejectClose,
    },
    options
  );

  return PokemonDialogV2.wait(dialogOptions);
}

/**
 * Pokemon-styled confirm dialog
 */
async function PokemonConfirm({
  title,
  content,
  yes = () => true,
  no = () => false,
  defaultYes = true,
  rejectClose = true,
  options = {},
} = {}) {
  const dialogOptions = foundry.utils.mergeObject(
    {
      window: {
        title: title ?? "Confirm",
      },
      content: `<div class="dialog-content">${content}</div>`,
      buttons: [
        {
          action: "yes",
          label: "Yes",
          default: defaultYes,
          callback: (event, button, dialog) => {
            const result = yes instanceof Function ? yes(event, button, dialog) : yes;
            return result;
          },
        },
        {
          action: "no",
          label: "No",
          default: !defaultYes,
          callback: (event, button, dialog) => {
            const result = no instanceof Function ? no(event, button, dialog) : no;
            return result;
          },
        },
      ],
      rejectClose,
    },
    options
  );

  return PokemonDialogV2.wait(dialogOptions);
}

/**
 * Wrapper for backward compatibility with old Dialog.prompt API
 * Automatically uses Pokemon styling if options.pokemon === true
 */
async function Dialog_prompt_wrapper(wrapped, config = {}) {
  if (config.options?.pokemon !== true) return wrapped(config);

  const { title, content, label, callback, rejectClose, options } = config;
  
  // Handle the callback - in the old API it receives (html)
  const wrappedCallback = callback
    ? (event, button, dialog) => {
        // For compatibility, pass the form element like the old API
        return callback(button.form);
      }
    : undefined;

  return PokemonPrompt({ title, content, label, callback: wrappedCallback, rejectClose, options });
}

/**
 * Wrapper for backward compatibility with old Dialog.confirm API
 * Automatically uses Pokemon styling if options.pokemon === true
 */
async function Dialog_confirm_wrapper(wrapped, config = {}) {
  if (config.options?.pokemon !== true) return wrapped(config);

  const { title, content, yes, no, defaultYes, rejectClose, options } = config;
  return PokemonConfirm({ title, content, yes, no, defaultYes, rejectClose, options });
}

export function register() {
  libWrapper.register(MODULENAME, "Dialog.prompt", Dialog_prompt_wrapper, "MIXED");
  libWrapper.register(MODULENAME, "Dialog.confirm", Dialog_confirm_wrapper, "MIXED");
}

// Export for direct use
export { PokemonDialogV2, PokemonPrompt, PokemonConfirm };