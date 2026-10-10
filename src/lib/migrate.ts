// データのバージョン番号と、古い形のデータを新しい形に直す仕組み。
// データの形を変えるときは CURRENT_DATA_VERSION を1つ上げ、STEPS に「前の番号 → 次の番号」の直し方を足す。
import type { IDBPDatabase } from 'idb';

export const CURRENT_DATA_VERSION = 1;

type AnyDB = IDBPDatabase<any>;

/** STEPS[n] は、バージョン n のデータを n+1 に直す */
const STEPS: Record<number, (db: AnyDB) => Promise<void>> = {
  // 例:
  // 1: async (db) => {
  //   for (const w of await db.getAll('works')) await db.put('works', { ...w, newField: 0 });
  // },
};

export async function migrate(db: AnyDB): Promise<void> {
  const settings = await db.get('settings', 'app');
  if (!settings) {
    // 初めて開いたとき
    await db.put('settings', { key: 'app', dataVersion: CURRENT_DATA_VERSION, quickAdds: [10] });
    return;
  }
  let version: number = settings.dataVersion ?? 1;
  while (version < CURRENT_DATA_VERSION) {
    const step = STEPS[version];
    if (!step) throw new Error(`データのバージョン ${version} を直す方法がありません`);
    await step(db);
    version += 1;
  }
  if (version !== settings.dataVersion) {
    await db.put('settings', { ...(await db.get('settings', 'app')), dataVersion: version });
  }
}
