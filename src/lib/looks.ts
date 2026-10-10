// 画面ごとに、6匹の今の見た目(頭飾り・体の色・目の色・身につけているもの)と呼び名を読み込む
import { useEffect, useState } from 'preact/hooks';
import { partnerName } from '../data/animals';
import { listPartners, listWorks, type AnimalId, type PartnerData, type Work } from './db';
import { lookOf, type Look } from './wardrobe';

export interface Looks {
  partners: Record<AnimalId, PartnerData>;
  works: Work[];
  look: (animal: AnimalId) => Look;
  name: (animal: AnimalId) => string;
}

export function makeLooks(partners: Record<AnimalId, PartnerData>, works: Work[]): Looks {
  return {
    partners,
    works,
    look: (a) => lookOf(partners[a], works),
    name: (a) => partnerName(a, partners[a]),
  };
}

/** 読み込むまでは null。key を変えると読み直す */
export function useLooks(key?: unknown): Looks | null {
  const [looks, setLooks] = useState<Looks | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([listPartners(), listWorks()]).then(([p, w]) => alive && setLooks(makeLooks(p, w)));
    return () => {
      alive = false;
    };
  }, [key]);
  return looks;
}

/** 部屋にいる子:最後に編んだ子(いちばん最近数えた作品の子)。持っているのはその子が今編んでいる作品 */
export function roomResident(looks: Looks): { animal: AnimalId; holding: Work | undefined; last: Work | null } {
  const last = looks.works.reduce<Work | null>((a, w) => (!a || w.updatedAt > a.updatedAt ? w : a), null);
  const animal = last?.partner ?? 'sheep';
  const holding = looks.works.find((w) => w.id === looks.partners[animal].knittingWorkId && w.status === 'wip');
  return { animal, holding, last };
}
