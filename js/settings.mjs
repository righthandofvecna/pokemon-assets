import { MODULENAME } from "./utils.mjs";

export function register() {

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
		requiresReload: false,
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

  game.settings.register(MODULENAME, "autoSetTokenSprite", {
		name: "Auto Set Token Sprite",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Automatically set the token sprite of a Pokemon to one defined in this module when the actor is created."
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

  game.settings.register(MODULENAME, "tokenCollision", {
		name: "Token Collisions",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: true,
		config: true,
		hint: "Treat tokens as walls for the purpose of movement."
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

  game.settings.register(MODULENAME, "canUseStrength", {
		name: "Field Move: Can Use Strength",
		default: true,
		type: Boolean,
		scope: "world",
		requiresReload: false,
		config: true,
		hint: "Whether or not a character that knows Strength can use it as a field move to push movable boulders."
	});

};