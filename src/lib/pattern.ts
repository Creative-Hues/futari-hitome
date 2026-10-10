// 2つ目のカウンター(模様の繰り返し回数など)。画面とは切り離して、ここだけでテストできるようにしている。

export interface Pattern {
  /** 名前(最初は「模様」) */
  name: string;
  /** 数えた回数 */
  count: number;
  /** ○段ごとに1回自動で進める。null は手で数える */
  everyRows: number | null;
  /** 自動で進め始めたときの段(ここから○段ごとに1回) */
  baseRow: number;
}

export function newPattern(row: number): Pattern {
  return { name: '模様', count: 0, everyRows: null, baseRow: row };
}

/** 段が oldRow → newRow に変わったときの回数。段が戻れば回数も戻る。0より下にはならない */
export function advancePattern(p: Pattern, oldRow: number, newRow: number): Pattern {
  if (!p.everyRows || oldRow === newRow) return p;
  const k = p.everyRows;
  const steps = Math.floor((newRow - p.baseRow) / k) - Math.floor((oldRow - p.baseRow) / k);
  if (steps === 0) return p;
  return { ...p, count: Math.max(0, p.count + steps) };
}
