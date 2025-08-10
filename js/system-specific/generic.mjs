import { MODULENAME } from "../utils.mjs";
import { _getTokenChangesForSpritesheet } from "../actor.mjs";


export function register() {
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

  api.logic.ActorCry ??= (actor)=>null;
  api.logic.ActorCatchable ??= (actor)=>true;
  api.logic.ActorCatchKey ??= (actor)=>null;
  api.logic.ActorCaught ??= null;
  api.logic.isPokemon ??= (token)=>token?.texture?.src?.includes("/pmd-overworld/") ?? false;
  
  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= (slug)=>function (actor){ return true };
  api.scripts.AwardItems ??= (actor, item)=>actor.createEmbeddedDocuments("Item", item instanceof Array ? item : [item]);

  api.scripts.GetUuidFromTableResult ??= (result)=>result.documentUuid;
  api.scripts.GetTokenChangesForSpritesheet ??= _getTokenChangesForSpritesheet;
}