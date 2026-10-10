// 完成記録のうち、自動で入るもの(日付・日数・編んだ時間・最終の数)
import { departmentName } from '../data/departments';
import type { Work } from '../lib/db';
import { daysBetween, formatDate, formatKnitTime } from '../lib/knitTime';

export function RecordFacts({ work }: { work: Work }) {
  const end = work.finishedAt ?? work.updatedAt;
  const last = [
    `${work.count.row}段`,
    work.stitchesPerRow ? `${work.count.stitch}目` : '',
    work.pattern ? `${work.pattern.name} ${work.pattern.count}回` : '',
  ]
    .filter(Boolean)
    .join(' ・ ');

  const rows: [string, string][] = [
    ['作品', `${departmentName(work.department)} ・ ${work.kind}`],
    ['始めた日', formatDate(work.startedAt)],
    ['完成した日', work.finishedAt ? formatDate(work.finishedAt) : '—'],
    ['かかった日数', `${daysBetween(work.startedAt, end)}日`],
    ['編んだ時間', formatKnitTime(work.knitMs)],
    ['最後の数', last],
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
