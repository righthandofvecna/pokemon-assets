import { sleep } from "../utils.mjs";

function registerLocalAnimation() {
  class LocalAnimation extends Sequencer.BaseSection {
    constructor(inSequence) {
      super(inSequence);
      this._target = null;
      this._opacity = null;
    }

    on(target) {
      this._target = target;
      return this;
    }

    opacity(opacity) {
      this._opacity = opacity ?? 1;
      return this;
    }

    async run() {
      if (!this._target) return;
      if (this._opacity !== null) this._target.object.localOpacity = this._opacity;

      if ((this._duration ?? 0) <= 0) return;
      return sleep(this._duration);
    }

    async _serialize() {
      return {
        ...(await super._serialize()),
        target: this._target ? this._target.uuid : null,
        opacity: this._opacity,
      };
    }

    _deserialize(data) {
      super._deserialize(data);
      this._target = fromUuidSync(data.target);
      this._opacity = data.opacity;
      return this;
    }

  }
  Sequencer.SectionManager.registerSection("pokemon-assets", "localAnimation", LocalAnimation);
}


export function register() {
  if (!game.modules.get("sequencer")?.active) {
    ui.notifications.error(`"Pokemon Assets": The "Sequencer" module is not active. Please activate it, or many of this module's animations will not function.`);
    return;
  }

  Hooks.on("ready", ()=>registerLocalAnimation(), { once: true });
}