import { MODULENAME } from "../utils.mjs";

// const fu = foundry.utils;

/**
 * The SurfRegionBehaviorType class defines a region behavior that requires surfing when a token enters or exits the region.
 */
class SurfRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  static _systemType = `${MODULENAME}.surf`;
  
  /** @override */
  static defineSchema() {
    return {};
  }

  /* ---------------------------------------- */

  // /** @override */
  // static events = {
  //   [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#onTokenEnter,
  //   [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
  // };

  // /* ---------------------------------------- */

  // static async #onTokenEnter(event) {
  //   const token = event?.data?.token;
  //   if (!token) return;
    
  //   console.log("SurfRegionBehaviorType: Token entered surf region", event, token);
  // }

  // /* ---------------------------------------- */

  // static async #onTokenExit(event) {
  //   const token = event?.data?.token;
  //   if (!token) return;
    
  //   console.log("SurfRegionBehaviorType: Token exited surf region", event, token);
  // }

}

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api; 



export function register() {
  const SurfRBT = SurfRegionBehaviorType;
  CONFIG.RegionBehavior.dataModels[SurfRBT._systemType] = SurfRBT;
  CONFIG.RegionBehavior.typeLabels[SurfRBT._systemType] = `TYPES.RegionBehavior.${SurfRBT._systemType}`;
  CONFIG.RegionBehavior.typeIcons[SurfRBT._systemType] = "fas fa-wave";
}