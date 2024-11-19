import { MODULENAME } from "./utils.mjs";

export function register() {

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

};