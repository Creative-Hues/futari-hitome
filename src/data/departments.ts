// 部門と作品の例(SPEC.md「パートナーとジャンル」の表)
import type { AnimalId, DepartmentId } from '../lib/db';

export interface Department {
  id: DepartmentId;
  name: string;
  examples: string[];
  /** 担当の2匹 */
  partners: [AnimalId, AnimalId];
}

export const DEPARTMENTS: Department[] = [
  { id: 'head', name: '頭', examples: ['帽子', '耳当て', 'ヘアバンド'], partners: ['sheep', 'seal'] },
  { id: 'neck', name: '首', examples: ['マフラー', 'スヌード', 'ストール'], partners: ['stoat', 'cat'] },
  { id: 'body', name: '胴体', examples: ['セーター', 'ベスト', '腹巻き'], partners: ['axolotl', 'seal'] },
  { id: 'paw', name: '前足', examples: ['手袋', 'アームウォーマー', 'バッグ'], partners: ['otter', 'cat'] },
  {
    id: 'wear',
    name: '身につけるもの',
    examples: ['靴下', 'レッグウォーマー', 'ルームシューズ'],
    partners: ['stoat', 'otter'],
  },
  {
    id: 'interior',
    name: '小物やインテリア',
    examples: ['ブランケット', 'コースター', 'クッション', 'あみぐるみ', 'ポーチ'],
    partners: ['sheep', 'axolotl'],
  },
];

export const departmentName = (id: DepartmentId) => DEPARTMENTS.find((d) => d.id === id)?.name ?? '';

/** 作品の色(先頭がメインの青) */
export const WORK_COLORS = [
  { value: '#5aa3df', name: 'そらいろ' },
  { value: '#f2a6b4', name: 'さくら' },
  { value: '#e8505c', name: 'いちご' },
  { value: '#f4b860', name: 'たまご' },
  { value: '#8fc79a', name: 'わかば' },
  { value: '#a99ad6', name: 'ラベンダー' },
  { value: '#c9a46a', name: 'くるみ' },
  { value: '#8a8192', name: 'ねずみ' },
];
