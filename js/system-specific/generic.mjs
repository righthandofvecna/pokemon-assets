import { MODULENAME } from "../utils.mjs";


export function register() {
  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  const api = module.api;
  api.logic ??= {};
  api.logic.FieldMoveParty ??= (token)=>token.actor;
  api.logic.CanUseRockSmash ??= (actor)=>true;
  api.logic.CanUseCut ??= (actor)=>true;
  api.logic.CanUseStrength ??= (actor)=>true;
  api.logic.CanUseRockClimb ??= (actor)=>true;
  api.logic.CanUseWaterfall ??= (actor)=>true;
  api.logic.CanUseWhirlpool ??= (actor)=>true;
  
  api.scripts ??= {};
  api.scripts.HasMoveFunction ??= (actor, slug)=>true;
  api.scripts.AwardItems ??= (actor, item)=>actor.createEmbeddedDocuments("Item", item instanceof Array ? item : [item]);
}