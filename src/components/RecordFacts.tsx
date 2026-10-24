// 完成記録のうち、自動で入るもの(日付・日数・編んだ時間・最終の数)
import { departmentName } from '../data/departments';
import type { Part, Work } from '../lib/db';
import { daysBetween, formatDate, formatKnitTime } from '../lib/knitTime';
import { hasParts, partLabel, totalKnitMs } from '../lib/parts';

/** 「20段 ・ 0目 ・ 模様 3回」 */
function lastCount(p: Part): string {
  return [
    `${p.count.row}段`,
    p.stitchesPerRow ? `${p.count.stitch}目` : '',
    p.pattern ? `${p.pattern.name} ${p.pattern.count}回` : '',
  ]
    .filter(Boolean)
    .join(' ・ ');
}

export const TOOL_NAMES: Record<Work['tool'], string> = { knit: '棒針', crochet: 'かぎ針' };

export function RecordFacts({ work }: { work: Work }) {
  const end = work.finishedAt ?? work.updatedAt;
  // パーツがあれば、パーツごとに1行ずつ
  const last: [string, string][] = hasParts(work)
    ? work.parts.map((p) => [partLabel(p), lastCount(p)])
    : [['最後の数', lastCount(work.parts[0])]];

  const rows: [string, string][] = [
    ['作品', `${departmentName(work.department)} ・ ${work.kind} ・ ${TOOL_NAMES[work.tool]}`],
    ['始めた日', formatDate(work.startedAt)],
    ['完成した日', work.finishedAt ? formatDate(work.finishedAt) : '—'],
    ['かかった日数', `${daysBetween(work.startedAt, end)}日`],
    ['編んだ時間', formatKnitTime(totalKnitMs(work))],
    ...last,
  ];

  return (
    <dl class="facts card">
      {rows.map(([k, v]) => (
        <div class="fact">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
