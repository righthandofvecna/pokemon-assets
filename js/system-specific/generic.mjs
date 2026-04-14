import { MODULENAME } from "../utils.mjs";
import { _getTokenChangesForSpritesheet } from "../actor.mjs";


async function OnCreateToken(token, options) {
  const api = game.modules.get(MODULENAME).api;
  if (!game.settings.get(MODULENAME, "playSummonAnimation")) return;
  if (options.teleport || options.keepId) return;
  if (token.hidden) return;

  const actor = token.actor;
  if (!actor || !api.logic.isPokemon(token)) return;

  const summonSource = await api.logic.GetSummonSource(token);
  const isTrained = summonSource !== null;
  const shiny = api.logic.ActorShiny(actor) ?? false;

  let sequence = null;
  if (isTrained) {
    if (token.object) token.object.localOpacity = 0;
    if (summonSource.source) {
      sequence = api.scripts.ThrowPokeball(summonSource.source, token, summonSource.ballImg, true);
    }
    sequence = await api.scripts.SummonPokemon(token, shiny, sequence);
  } else {
    sequence = await api.scripts.SummonWildPokemon(token, shiny, sequence);
  }
  await sequence.play();
}


export function register() {
  Hooks.on("createToken", OnCreateToken);
  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;
  api.logic ??= {};
  api.logic.FieldMoveParty ??= (token)=>[token.actor];
  api.logic.CanUseRockSmash ??= (actor)=>true;
  api.logic.CanUseCut ??= (actor)=>true;
  api.logic.CanUseStrength ??= (actor)=>true;
  api.logic.CanUseRockClimb ??= (actor)=>true;
  api.logic.CanUseWaterfall ??= (actor)=>true;
  api.logic.CanUseWhirlpool ??= (actor)=>true;
  api.logic.CanUseSurf ??= (actor)=>true;

  api.logic.HealParty ??= async (actors) => {};

  api.logic.GetSummonSource ??= async (token) => null; // no trainer by default (wild)

  api.logic.ActorCry ??= async (actor)=>null;
  api.logic.ActorCatchable ??= (actor)=>true;
  api.logic.ActorCatchKey ??= (actor)=>null;
  api.logic.ActorCaught ??= null;
  api.logic.ActorShiny ??= (actor)=>false;
  api.logic.IsUncatchable ??= (token)=>token?.actor?.effects?.contents?.some(e=>e.name === "Uncatchable") ?? false;
  api.logic.isPokemon ??= (token)=>token?.texture?.src?.includes("/pmd-overworld/") ?? false;
  
  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= (slug)=>function (actor){ return true };
  api.scripts.AwardItems ??= (actor, item)=>actor.createEmbeddedDocuments("Item", item instanceof Array ? item : [item]);
  api.scripts.AssignPokemonToActor ??= async (pokemon, actor)=>{
    if (!pokemon || !actor) return;
    // upgrade ownership of pokemon to the same as actor
    const ownership = foundry.utils.deepClone(pokemon.ownership);
    for (const playerId of Object.keys(actor.ownership)) {
      ownership[playerId] = Math.max(ownership[playerId] ?? 0, actor.ownership[playerId]);
    }
    await pokemon.update({ ownership });
  };

  api.scripts.GetUuidFromTableResult ??= (result)=>result.documentUuid;
  api.scripts.GetTokenChangesForSpritesheet ??= _getTokenChangesForSpritesheet;
}