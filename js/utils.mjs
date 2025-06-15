
export const MODULENAME = "pokemon-assets";

export const MYSTERY_MAN = "icons/svg/mystery-man.svg";

export function early_isGM() {
	const level = game.data.users.find(u => u._id == game.data.userId).role;
	const gmLevel = CONST.USER_ROLES.ASSISTANT;
	return level >= gmLevel;
}

export function isTheGM() {
	return game.user.isActiveGM;
}

export function isGMOnline() {
	return game.users.some(u=>u.active && u.isGM);
}

export async function sleep(ms) {
	return new Promise((resolve)=>setTimeout(resolve, ms))
}

export function snapToGrid({ x, y }, grid) {
	return {
		x: Math.floor(x / grid.sizeX) * grid.sizeX,
		y: Math.floor(y / grid.sizeY) * grid.sizeY,
	}
}

export function centerTokenMovement(token, movement) {
	return token?.parent?.grid?.getSnappedPoint(
		movement?.passed?.waypoints?.[0],
		{ mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER});
}

function _norm_angle(a) {
  return a < 0 ? a + 360 : (a >= 360 ? a - 360 : a);
}

export function angleDiff(a, b) {
	return Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
}

/**
 * 
 * @param {object} a the thing that has the rotation
 * @param {number} a.x
 * @param {number} a.y
 * @param {number} a.w
 * @param {number} a.h
 * @param {number} a.r
 * @param {object} b the thing we want to check for adjacency
 * @param {number} b.x
 * @param {number} b.y
 * @param {number} b.w
 * @param {number} b.h
 */
export function isFacing(a, b) {
	const direction = (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) - 90;
  return Math.floor(_norm_angle(direction + 22.5) / 8) == Math.floor(_norm_angle(a.r + 22.5) / 8);
}

export function tokenScene(token) {
	return token?.scene ?? token?.parent ?? game.scenes.active;
}


export function getUuidFromTableResult(result) {
	if (result.type === "pack") {
		return `Compendium.${result.documentCollection}.${result.documentId}`;
	}
	if (result.type === "document") {
		return `${result.documentCollection}.${result.documentId}`;
	}
	return null;
}

export function listenFilepickerChange(filepicker, onChange) {
	$(filepicker).on("change", "input[type='text']", function() {onChange(this.value)});
  // dumb workaround to listen on the filepicker button too
  $(filepicker).on("click", "button", function () {
    const filePicker = $(this).closest("file-picker")?.get(0)?.picker;
    if (!filePicker) return;
    filePicker.callback = ((callback)=>{
      return function () {
        if (callback) callback(...arguments);
        onChange(arguments[0]);
      }
    })(filePicker.callback);
  })
}


export function getCombatsForScene(sceneId) {
	const combats = game.combats.filter(c=>c?.active && c?.scene?.uuid === sceneId) ?? [];
	if (combats.length > 0) return combats;
	// PTR 2e automatically disconnects the combat from the scene, so let's check the participants' scene IDs instead
	return game.combats.contents.filter(c=>c?.active && c?.combatants?.contents?.some(p=>p.sceneId === sceneId)) ?? [];
}

