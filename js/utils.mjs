
export function early_isGM() {
	const level = game.data.users.find(u => u._id == game.data.userId).role;
	const gmLevel = CONST.USER_ROLES.ASSISTANT;
	return level >= gmLevel;
}

export function isTheGM() {
	return game.users.find(u=>u.active && u.isGM)?.id === game.user.id;
}

export async function sleep(ms) {
	return new Promise((resolve)=>setTimeout(resolve, ms))
}
