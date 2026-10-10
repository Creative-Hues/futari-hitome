import { describe, expect, it } from 'vitest';
import type { PartnerData, Work } from './db';
import { knitOnResume, partnerAfterDelete, paused, pausedWorks, releaseKnitting, resumed, roomAfterDelete } from './lifecycle';
import { newPartner, newRoom } from './migrate';

type W = Pick<Work, 'id' | 'partner' | 'status' | 'updatedAt' | 'order'>;
const w = (id: string, extra: Partial<W> = {}): W => ({
  id,
  partner: 'sheep',
  status: 'wip',
  updatedAt: '2026-10-01',
  order: 0,
  ...extra,
});
const sheep = (extra: Partial<PartnerData> = {}): PartnerData => ({ ...newPartner('sheep'), met: true, ...extra });

describe('お休みにする', () => {
  it('状態とお休みにした日だけが変わる(数・履歴・数えた時刻はそのまま)', () => {
    const work = { id: 'a', status: 'wip', pausedAt: null, count: { row: 4, stitch: 1 }, history: [{ row: 4, stitch: 0 }], updatedAt: 'x', lastCountAt: 5 } as unknown as Work;
    expect(paused(work, '2026-10-11')).toEqual({ ...work, status: 'paused', pausedAt: '2026-10-11' });
  });

  it('今編んでいる作品なら、その子のほかの編みかけ(最後に数えたもの)に移す', () => {
    const works = [w('a'), w('b', { updatedAt: '2026-10-03' }), w('c', { updatedAt: '2026-10-05', status: 'done' }), w('d', { partner: 'cat', updatedAt: '2026-10-09' })];
    expect(releaseKnitting(sheep({ knittingWorkId: 'a' }), 'a', works).knittingWorkId).toBe('b');
  });

  it('ほかに編みかけがなければ「なし」', () => {
    const works = [w('a'), w('b', { status: 'paused' }), w('d', { partner: 'cat' })];
    expect(releaseKnitting(sheep({ knittingWorkId: 'a' }), 'a', works).knittingWorkId).toBeNull();
  });

  it('今編んでいる作品でなければ変えない', () => {
    const p = sheep({ knittingWorkId: 'b' });
    expect(releaseKnitting(p, 'a', [w('a'), w('b')])).toBe(p);
  });
});

describe('再開する', () => {
  it('編みかけに戻り、一覧の一番上に入る', () => {
    const work = { id: 'a', status: 'paused', pausedAt: '2026-10-10', order: 5 } as unknown as Work;
    const works = [w('x', { order: -2 }), w('y', { order: 3 }), w('z', { order: -9, status: 'done' })];
    expect(resumed(work, works)).toMatchObject({ status: 'wip', pausedAt: null, order: -3 });
  });

  it('その子が何も編んでいなければ、この作品を編む', () => {
    expect(knitOnResume(sheep({ knittingWorkId: null }), 'a', [w('a', { status: 'paused' })]).knittingWorkId).toBe('a');
    // 今編んでいる作品が編みかけでなくなっていても、この作品にする
    expect(knitOnResume(sheep({ knittingWorkId: 'b' }), 'a', [w('a'), w('b', { status: 'done' })]).knittingWorkId).toBe('a');
  });

  it('ほかの編みかけを編んでいれば、そのまま', () => {
    const p = sheep({ knittingWorkId: 'b' });
    expect(knitOnResume(p, 'a', [w('a', { status: 'paused' }), w('b')])).toBe(p);
  });
});

describe('消す', () => {
  it('身につけていれば外し、今編んでいる作品ならほかへ移す', () => {
    const p = sheep({ wearing: { head: 'h', neck: 'n' }, knittingWorkId: 'n' });
    const out = partnerAfterDelete(p, 'h', [w('h', { status: 'done' }), w('n')]);
    expect(out.wearing).toEqual({ neck: 'n' });
    expect(out.knittingWorkId).toBe('n');
    expect(partnerAfterDelete(sheep({ knittingWorkId: 'n' }), 'n', [w('n')]).knittingWorkId).toBeNull();
  });

  it('飾っていればはずし、あとの作品は前に詰める', () => {
    const room = { ...newRoom(), displayed: ['a', 'b', 'c'] };
    expect(roomAfterDelete(room, 'a').displayed).toEqual(['b', 'c']);
    expect(roomAfterDelete(room, 'z')).toBe(room);
  });
});

describe('お休み中の並び', () => {
  it('お休みにした日の新しい順。お休みでない作品は入らない', () => {
    const list = [
      { id: 'a', status: 'paused' as const, pausedAt: '2026-10-01' },
      { id: 'b', status: 'wip' as const, pausedAt: null },
      { id: 'c', status: 'paused' as const, pausedAt: '2026-10-09' },
    ];
    expect(pausedWorks(list).map((x) => x.id)).toEqual(['c', 'a']);
  });
});
