// 音声入力の試作(Web Speech API)。iPhoneでは不安定なので、動かなくても他に影響しない作りにする。
// 数えるのは確定した文字(最終結果)だけ。途中の文字は確かめ用に表示するだけ。
import { VOICE_RESTART_MS } from '../config/tuning';
import { countFromTranscript } from './voiceParse';

type Recognition = any;

export type VoiceStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'listening' }
  | { kind: 'restarting' }
  | { kind: 'error'; message: string };

export interface VoiceCallbacks {
  /** 確定した文字から読み取った数だけ進める */
  onCount: (n: number) => void;
  onStatus: (status: VoiceStatus) => void;
  /** 確かめ用:確定した文字と、途中の文字 */
  onTranscript: (finalText: string, interimText: string) => void;
}

function recognitionClass(): (new () => Recognition) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  return recognitionClass() !== null;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'マイクが許可されていません',
  'service-not-allowed': '音声認識が許可されていません',
  'audio-capture': 'マイクが使えません',
  network: '音声認識につながりません',
  'language-not-supported': '日本語の音声認識が使えません',
};

/** これらのエラーは、つなぎ直しても直らないので止める */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);

export class VoiceSession {
  private recognition: Recognition | null = null;
  private wanted = false;
  private restartTimer: number | undefined;

  constructor(private cb: VoiceCallbacks) {}

  start(): void {
    const Ctor = recognitionClass();
    if (!Ctor) {
      this.cb.onStatus({ kind: 'error', message: 'この端末では使えません' });
      return;
    }
    this.wanted = true;
    this.cb.onStatus({ kind: 'starting' });
    this.open(Ctor);
  }

  stop(): void {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    const r = this.recognition;
    this.recognition = null;
    try {
      r?.abort();
    } catch {
      /* もう止まっている */
    }
    this.cb.onStatus({ kind: 'idle' });
  }

  private open(Ctor: new () => Recognition): void {
    const r = new Ctor();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    // つなぎ直すたびに結果の番号は0から始まるので、この1回の中で数えた番号を覚える
    const counted = new Set<number>();

    r.onstart = () => this.cb.onStatus({ kind: 'listening' });

    r.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text: string = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += text;
          if (!counted.has(i)) {
            counted.add(i);
            const n = countFromTranscript(text);
            if (n > 0) this.cb.onCount(n);
          }
        } else {
          interimText += text;
        }
      }
      this.cb.onTranscript(finalText, interimText);
    };

    r.onerror = (event: any) => {
      const code: string = event.error ?? 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;
      if (FATAL_ERRORS.has(code)) this.wanted = false;
      this.cb.onStatus({ kind: 'error', message: ERROR_MESSAGES[code] ?? `止まりました(${code})` });
    };

    r.onend = () => {
      if (this.recognition !== r) return;
      if (!this.wanted) {
        this.recognition = null;
        return;
      }
      // 勝手に止まったら、少し待ってつなぎ直す
      this.cb.onStatus({ kind: 'restarting' });
      this.restartTimer = window.setTimeout(() => {
        if (this.wanted) this.open(Ctor);
      }, VOICE_RESTART_MS);
    };

    this.recognition = r;
    try {
      r.start();
    } catch (e) {
      this.wanted = false;
      this.cb.onStatus({ kind: 'error', message: `始められません(${(e as Error).message})` });
    }
  }
}
