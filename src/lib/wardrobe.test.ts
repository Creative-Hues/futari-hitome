import { describe, expect, it } from 'vitest';
import { defaultInteriorShape } from '../data/wear';
import { countWordsFor } from './voiceWords';
import { newPartner, newRoom, partnerToV4, workToV4 } from './migrate';
import {
  displayOnComplete,
  initialDisplay,
  initialWearing,
  lookOf,
  undisplay,
  unwear,
  wearOnComplete,
} from './wardrobe';
import type { DepartmentId } from './db';

const done = (id: string, department: DepartmentId, finishedAt: string, giftedTo = 'cat' as const) => ({
  id,
  department,
  status: 'done' as const,
  giftedTo,
  finishedAt,
  color: '#e8505c',
});

describe('部屋に飾るときの絵の決め方', () => {
  it('種類名がクッション/ブランケット/あみぐるみならその絵、それ以外はクッション', () => {
    expect(defaultInteriorShape('クッション')).toBe('cushion');
    expect(defaultInteriorShape('ブランケット')).toBe('blanket');
    expect(defaultInteriorShape('あみぐるみ')).toBe('amigurumi');
    expect(defaultInteriorShape('コースター')).toBe('cushion');
    expect(defaultInteriorShape('ミトン')).toBe('cushion');
  });
});

describe('データのバージョン 3 → 4', () => {
  it('小物やインテリアの作品だけに絵が入る', () => {
    expect(workToV4({ department: 'interior', kind: 'ブランケット' }).interiorShape).toBe('blanket');
    expect(workToV4({ department: 'interior', kind: 'ポーチ' }).interiorShape).toBe('cushion');
    expect(workToV4({ department: 'neck', kind: 'マフラー' }).interiorShape).toBeNull();
    // すでに入っていれば上書きしない
    expect(workToV4({ department: 'interior', kind: 'ポーチ', interiorShape: 'amigurumi' }).interiorShape).toBe(
      'amigurumi',
    );
  });

  it('同じ部門が2つ以上なら完成した日がいちばん新しい作品を身につける', () => {
    const works = [
      done('a', 'neck', '2026-09-01'),
      done('b', 'neck', '2026-10-01'),
      done('c', 'paw', '2026-08-01'),
      done('d', 'neck', '2026-11-01', 'stoat' as never),
    ];
    expect(initialWearing('cat', works)).toEqual({ neck: 'b', paw: 'c' });
  });

  it('wearingWorkId をなくして、部門ごとの形にする', () => {
    const { wearing: _w, ...base } = newPartner('cat');
    const p = partnerToV4({ ...base, wearingWorkId: null }, [done('a', 'paw', '2026-09-01')]);
    expect(p.wearing).toEqual({ paw: 'a' });
    expect('wearingWorkId' in p).toBe(false);
  });

  it('飾る作品は新しい順に3つまで(いちばん新しい作品が床の右)', () => {
    const works = [
      done('a', 'interior', '2026-09-01'),
      done('b', 'interior', '2026-10-04'),
      done('c', 'interior', '2026-10-02'),
      done('d', 'interior', '2026-10-03'),
      done('e', 'neck', '2026-10-05'),
    ];
    expect(initialDisplay(works)).toEqual(['b', 'd', 'c']);
  });

  it('最初の部屋は「はじめの部屋」', () => {
    expect(newRoom()).toEqual({
      key: 'room',
      wall: '#f8efe3',
      floor: '#e3c39d',
      curtain: '#f6c3cf',
      rug: '#f2a6b4',
      yarn1: '#5aa3df',
      yarn2: '#f2a6b4',
      flower: 'daisy',
      displayed: [],
    });
  });
});

describe('完成したとき・編みかけに戻したとき', () => {
  it('その部門が空いていれば身につける。空いていなければそのまま', () => {
    const p = wearOnComplete(newPartner('cat'), { id: 'a', department: 'neck' });
    expect(p.wearing).toEqual({ neck: 'a' });
    expect(wearOnComplete(p, { id: 'b', department: 'neck' }).wearing).toEqual({ neck: 'a' });
    expect(wearOnComplete(p, { id: 'c', department: 'paw' }).wearing).toEqual({ neck: 'a', paw: 'c' });
  });

  it('小物やインテリアは空いている置き場所に飾る(3つまで)', () => {
    let room = newRoom();
    for (const id of ['a', 'b', 'c', 'd']) room = displayOnComplete(room, { id, department: 'interior' });
    expect(room.displayed).toEqual(['a', 'b', 'c']);
    expect(displayOnComplete(room, { id: 'x', department: 'neck' })).toBe(room);
  });

  it('編みかけに戻すと外す・はずす(あとの作品は前に詰める)', () => {
    const p = { ...newPartner('cat'), wearing: { neck: 'a', paw: 'b' } };
    expect(unwear(p, 'a').wearing).toEqual({ paw: 'b' });
    const room = { ...newRoom(), displayed: ['x', 'y', 'z'] };
    expect(undisplay(room, 'x').displayed).toEqual(['y', 'z']);
  });

  it('見た目には、完成していてその子がもらった作品だけが出る', () => {
    const p = { ...newPartner('cat'), wearing: { neck: 'a', paw: 'b' } };
    const look = lookOf(p, [done('a', 'neck', '2026-10-01'), { ...done('b', 'paw', ''), status: 'wip' as const }]);
    expect(look.wear).toEqual([{ dept: 'neck', color: '#e8505c' }]);
  });
});

describe('音声で数える言葉', () => {
  it('「あみ」は今までの読み替えも数え、ほかの言葉はカタカナも数える', () => {
    const words = countWordsFor(['あみ', 'はい']);
    expect(words).toEqual(expect.arrayContaining(['あみ', 'アミ', '編み', '網', 'はい', 'ハイ']));
  });

  it('長い言葉から先に探す', () => {
    expect(countWordsFor(['あみ', 'あみあみ'])[0]).toBe('あみあみ');
  });
});
