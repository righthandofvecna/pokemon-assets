

export class Migration {

  static MIGRATION_VERSION = "0.0.0";

  static async updateActor(actor, actorData) {
    return actorData;
  }

  static async updateItem(item, itemData) {
    return itemData;
  }

  static async updateToken(token, tokenData) {
    return tokenData;
  }
}