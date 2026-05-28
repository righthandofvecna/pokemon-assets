

export class Migration {

  static MIGRATION_VERSION = "0.0.0";

  static checkPrereqs() {}

  static async updateActor(actor, actorData) {}

  static async updateItem(item, itemData) {}

  static async updateToken(token, tokenData) {}

  static async updateTile(tile, tileData) {}

  static async updateRegionBehavior(regionBehavior, regionBehaviorData) {}

  static async updateScene(scene, sceneData) {}

  static async updateSettings() {}
}