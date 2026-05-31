import { Migration } from './migration-base.mjs';
import { MODULENAME, DATNAME, DGANAME } from '../utils.mjs';

const SIGN_RE = /Dialog\.prompt\(\{ content: "(?<content>.*)", options: \{ pokemon: true \}\}\);/i;

export class Migration_1_0_2 extends Migration {

  static MIGRATION_VERSION = "1.0.2";

  static checkPrereqs() {
    if (!game.modules.get(DATNAME)?.active) {
      return false;
    }
    if (!game.modules.get(DGANAME)?.active) {
      return false;
    }
    return true;
  }

  static async updateTile(tile, tileData) {
    tileData.flags ??= {};
    if (tileData.flags?.[DGANAME]?.script) {
      const signMatch = SIGN_RE.exec(tileData.flags[DGANAME].script);
      if (!signMatch) return tileData;
      const { content } = signMatch.groups;
      tileData.flags[DGANAME].script = `game.modules.get("dylans-general-automations")?.api?.scripts?.FooterDialogPrompt({ content: "${content}"});`
      const { signMessage } = game.modules.get(DGANAME).api.crypto;
      const signature = JSON.stringify(await signMessage(tileData.flags[DGANAME].script));
      tileData.flags[DGANAME] ??= {};
      tileData.flags[DGANAME].signature = signature;
    }
    return tileData;
  }
}