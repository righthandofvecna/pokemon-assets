import { MODULENAME } from "./utils.mjs";

export function register() {

	game.settings.registerMenu(MODULENAME, "volume", {
		name: "Volume",
		label: "SFX Volume",
		icon: "fa-solid fa-volume",
		hint: "Volume settings for individual sound effects",
		restricted: false,
		type: VolumeSettings,
	});
	VolumeSettings.initSettings();

  game.settings.register(MODULENAME, "preloadAssets", {
		name: "Preload Assets",
		default: true,
		type: Boolean,
		scope: "client",
		requiresReload: false,
		config: true,
		hint: "Preload assets such as sound effects. Disable this if you are on a metered connection to save bandwidth."
	});

  game.settings.register(MODULENAME, "avoidBlur", {
		name: "Avoid Blur",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "Avoid blurring the canvas and tokens when they get scaled up."
	});

  game.settings.register(MODULENAME, "autoPlayAudio", {
		name: "Auto Play Audio",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Preload audio playlist when switching to a scene, and when a combat is completed, move to the next track."
	});

  game.settings.register(MODULENAME, "autoTrainerImage", {
		name: "Auto Set Trainer Profile Image",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Automatically set the profile image of a Trainer to a random trainer upon creation."
	});

  game.settings.register(MODULENAME, "autoSetTokenSprite", {
		name: "Auto Set Token Sprite",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Automatically set the token sprite of a Pokemon to one defined in this module when the actor is created."
	});

  game.settings.register(MODULENAME, "autoMatchTokenSprite", {
		name: "Auto Match Token Sprite",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Automatically set the token sprite of a Trainer to the matching overworld spritesheet when you set the trainer's profile sprite."
	});

	game.settings.register(MODULENAME, "autoOverrideMegaEvolutionSprite", {
		name: "Auto Override Mega Evolution Sprite",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: ["ptu"].includes(game.system.id),
		hint: "Automatically set the token sprite of a mega-evolved Pokemon to one defined in this module."
	}); // PTU only?

  game.settings.register(MODULENAME, "playDamageAnimation", {
		name: "Play Damage Animation",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "When a token takes damage, play a damage sound and animation."
	});

  game.settings.register(MODULENAME, "playCaptureAnimation", {
		name: "Play Capture Animation",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "When a capture attempt is made, play the Pokemon capture sounds and animations."
	});

  game.settings.register(MODULENAME, "playSummonAnimation", {
		name: "Play Summon Animation",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "When a Pokemon token is added to the scene, play either a Pokeball release animation, or a Tall Grass animation."
	});

  game.settings.register(MODULENAME, "playPokemonCryOnTurn", {
		name: "Play Pokemon Cry On Turn",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "When a Pokemon begins its turn in combat, play that Pokemon's cry."
	});

  game.settings.register(MODULENAME, "tokenCollision", {
		name: "Token Collisions",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "Treat tokens as walls for the purpose of movement."
	});

	game.settings.register(MODULENAME, "tokenCollisionAllied", {
		name: "Token Collisions (Allied)",
		default: false,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "Treat allied tokens as walls for the purpose of movement. Requires 'Token Collisions' to be enabled."
	});

	game.settings.register(MODULENAME, "tokenCollisionHidden", {
		name: "Token Collisions (Hidden)",
		default: false,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "Treat hidden tokens as walls for the purpose of movement. Requires 'Token Collisions' to be enabled."
	});

  game.settings.register(MODULENAME, "playCollisionSound", {
		name: "Play Collision Sound",
		default: true,
		type: Boolean,
		scope: "client",
		requiresReload: false,
		config: true,
		hint: "When you attempt to move into a wall or other obstruction using the keyboard, play the Pokemon \"bump\" sound."
	});

  game.settings.register(MODULENAME, "playInteractSound", {
		name: "Play Interact Sound",
		default: true,
		type: Boolean,
		scope: "client",
		requiresReload: false,
		config: true,
		hint: "When you interact with a Scene Region with a \"Token Interaction\" trigger, play the Pokemon \"interact\" sound."
	});

  game.settings.register(MODULENAME, "canUseRockSmash", {
		name: "Field Move: Can Use Rock Smash",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Rock Smash can use it as a field move to destroy destructible rocks."
	});

  game.settings.register(MODULENAME, "canUseCut", {
		name: "Field Move: Can Use Cut",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Cut can use it as a field move to destroy destructible plants."
	});

  game.settings.register(MODULENAME, "canUseWhirlpool", {
		name: "Field Move: Can Use Whirlpool",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Whirlpool can use it as a field move to destroy whirlpools."
	});

  game.settings.register(MODULENAME, "canUseStrength", {
		name: "Field Move: Can Use Strength",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Strength can use it as a field move to push movable boulders."
	});

  game.settings.register(MODULENAME, "canUseRockClimb", {
		name: "Field Move: Can Use Rock Climb",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Rock Climb can use it as a field move to climb rocky walls."
	});

  game.settings.register(MODULENAME, "canUseWaterfall", {
		name: "Field Move: Can Use Waterfall",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Waterfall can use it as a field move to climb waterfalls."
	});

	const BALL_IMG_DEFAULT = (()=>{
		switch (game.system.id) {
			case "ptu": return "systems/ptu/images/item_icons/basic ball.webp";
			case "ptr2e": return "systems/ptr2e/img/item-icons/basic ball.webp";
		}
		return "modules/pokemon-assets/img/items-overworld/pokeball.png";
	})();
  game.settings.register(MODULENAME, "defaultBallImage", {
		name: "Default Pokeball Image",
		default: BALL_IMG_DEFAULT,
		type: new foundry.data.fields.FilePathField({default: BALL_IMG_DEFAULT, categories: ["IMAGE"]}),
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "The default fallback Pokeball image to use if a Pokeball image is not set or cannot be found."
	});

  game.settings.register(MODULENAME, "homebrewCryFolder", {
		name: "Homebrew Cry Folder",
		default: "",
		type: String,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "The folder where cries for unofficial Pokemon are stored. They must be stored in that folder as '<custom dex number>.mp3'."
	});

};


export class VolumeSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

	static SFX = ["interact", "collide", "cry", "catch", "heal", "pc", "exit", "damage", "low-hp", "reaction-surprise", "rock-smash", "cut"];


	static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
			tag: "form",
      classes: ["sheet", "pokemon-assets", "settings", "volume"],
      position: {
        height: 'auto',
        width: 400,
      },
      window: {
        minimizable: false,
        resizable: false,
      },
			form: {
					closeOnSubmit: false,
					submitOnChange: true,
					handler: VolumeSettings.#submit,
			},
    },
    { inplace: false }
  );

	static PARTS = {
		modifiers: {
				id: "volume-settings",
				template: "modules/pokemon-assets/templates/volume-settings.hbs",
		},
	};

	async _prepareContext() {
		const sfx = {};
		for (const k of VolumeSettings.SFX) {
			sfx[k] = {
				key: `volume-${k}`,
				label: `POKEMON-ASSETS.Settings.Volume.${k}.label`,
				hint: `POKEMON-ASSETS.Settings.Volume.${k}.hint`,
				value: game.settings.get(MODULENAME, `volume-${k}`),
			}
		}
    return {
			sfx,
    }
  }

	static getVolume(k) {
		// Convert from "perceived volume" to "power" (which is what sequencer's volume settings use for some reason)
		// normalized to a range [0.0, 1.0]
		const perceivedToPower = (perceivedVolume) => 10**perceivedVolume / 9 - (1 / 9);
		try {
			const perceivedVolume = game.settings.get(MODULENAME, `volume-${k}`);
			return perceivedToPower(perceivedVolume);
		} catch (e) {
			return perceivedToPower(0.5);
		}
	}

	static getRawVolume(k) {
		try {
			return game.settings.get(MODULENAME, `volume-${k}`);
		} catch (e) {
			return 0.5;
		}
	}

	static async #submit(event, form, formData) {
		console.log("VolumeSettings.#submit", formData);
		for (const [key, value] of Object.entries(formData?.object ?? {})) {
			await game.settings.set(MODULENAME, key, value);
		}
	}

	static initSettings() {
		for (const k of VolumeSettings.SFX) {
			game.settings.register(MODULENAME, `volume-${k}`, {
				name: `SFX Volume: ${k}`,
				default: 0.5,
				type: Number,
				scope: "client",
				requiresReload: false,
				config: false,
				hint: `The volume of the ${k} sound effect.`
			});
		}
	}

}