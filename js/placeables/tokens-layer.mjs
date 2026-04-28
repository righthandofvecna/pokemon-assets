import { MODULENAME } from "../utils.mjs";

/**
 * Extended TokenLayer for handling token collision detection
 */
export function registerAfterDependencies() {
  class TokenLayerPokemonAssets extends CONFIG.Canvas.layers.tokens.layerClass {
    /**
     * Determine whether the provided grid space is being occupied by a token which should block the provided token
     * or the space is terrain that is currently impassable
     * @param {GridOffset3D} gridSpace            The grid space to check
     * @param {Token} token                       The token being moved
     * @param {object} [options]                  Additional options
     * @param {boolean} [options.preview=false]   Whether the movement in question is previewed
     * @returns {boolean} Whether the moving token should be blocked
     */
    isOccupiedGridSpaceBlocking(gridSpace, token, { preview=false }={}) {
      // Get all scene regions with a "Surf" behavior
      const surfRegions = canvas.scene.regions.contents.filter(r=>r.behaviors.contents.some(b=>b.type == `${MODULENAME}.surf` && !b.disabled));
      const grid = canvas.grid;
      const centerSpace = grid.getCenterPoint(gridSpace);
      const isInSurfRegion = surfRegions.some(region => region.testPoint(centerSpace));
      if (isInSurfRegion && !token?.surfing) {
        return true; // Always block movement in surf regions when not surfing
      }
      return super.isOccupiedGridSpaceBlocking(gridSpace, token, { preview });
    }
  }

  CONFIG.Canvas.layers.tokens.layerClass = TokenLayerPokemonAssets;
}
