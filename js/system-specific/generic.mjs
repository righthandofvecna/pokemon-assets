


export function register() {
  const module = game.modules.get(MODULENAME);
  module.api ??= {};
  module.api.logic ??= {};
  module.api.logic.FieldMoveParty ??= (token)=>token.actor;
  module.api.logic.CanUseRockSmash ??= (actor)=>true;
  module.api.logic.CanUseCut ??= (actor)=>true;
  module.api.logic.CanUseStrength ??= (actor)=>true;
}