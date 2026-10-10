import { describe, expect, it } from 'vitest';
import { countFromTranscript, kanaToNumber, kanjiToNumber } from './voiceParse';

describe('countFromTranscript', () => {
  it('「あみ」の回数だけ数える', () => {
    expect(countFromTranscript('あみ')).toBe(1);
    expect(countFromTranscript('あみ あみ あみ')).toBe(3);
    expect(countFromTranscript('アミ')).toBe(1);
    expect(countFromTranscript('編み')).toBe(1);
  });
  it('「10目」などは一気に進める', () => {
    expect(countFromTranscript('10目')).toBe(10);
    expect(countFromTranscript('１０目')).toBe(10);
    expect(countFromTranscript('十目')).toBe(10);
    expect(countFromTranscript('二十五目')).toBe(25);
    expect(countFromTranscript('じゅうめ')).toBe(10);
    expect(countFromTranscript('にじゅうごめ')).toBe(25);
  });
  it('混ざっていても合計する', () => {
    expect(countFromTranscript('あみ 10目')).toBe(11);
  });
  it('関係ない言葉は数えない', () => {
    expect(countFromTranscript('こんにちは')).toBe(0);
    expect(countFromTranscript('ごめんね')).toBe(0);
    expect(countFromTranscript('')).toBe(0);
  });
});

describe('number helpers', () => {
  it('漢数字', () => {
    expect(kanjiToNumber('百二十')).toBe(120);
    expect(kanjiToNumber('三')).toBe(3);
  });
  it('ひらがなの数', () => {
    expect(kanaToNumber('さんじゅう')).toBe(30);
    expect(kanaToNumber('きゅう')).toBe(9);
    expect(kanaToNumber('あ')).toBeNull();
  });
});
