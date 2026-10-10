// 設定:部屋の模様替えへの入り口、音声で数える言葉、データの書き出し・読み込み、遊び方のヘルプ
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { backupParts, exportFileName, parseBackup, type BackupSummary } from '../lib/backup';
import { getSettings, readAll, replaceAll, saveSettings, type Settings as SettingsData, type Snapshot } from '../lib/db';
import { requestPersist } from '../lib/persist';
import { go, routes } from '../lib/router';
import { saveFile } from '../lib/share';
import { cleanWord } from '../lib/voiceWords';

/** 2026年10月11日 */
function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [text, setText] = useState('');
  /** 書き出し:作っている途中 / できたファイル(「保存する」で共有シートへ) */
  const [making, setMaking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  /** 読み込み:読んでいる途中 / 確かめたファイルの中身(置き換えるかの確認) / 置き換え終わった */
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<{ snapshot: Snapshot; summary: BackupSummary } | null>(null);
  const [imported, setImported] = useState(false);
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const save = (s: SettingsData) => {
    setSettings(s);
    saveSettings(s);
  };

  const word = cleanWord(text);
  const exists = !!word && !!settings?.voiceWords.includes(word);

  const add = (e: Event) => {
    e.preventDefault();
    if (!settings || !word || exists) return;
    save({ ...settings, voiceWords: settings.voiceWords.concat(word) });
    setText('');
  };

  // 1回目:ファイルを作る(写真が多いと少しかかる)
  const makeFile = async () => {
    setNotice(null);
    setMaking(true);
    try {
      const parts = await backupParts(await readAll(), new Date().toISOString());
      setFile(new File(parts, exportFileName(), { type: 'application/json' }));
    } catch (e) {
      setNotice({ text: `書き出せませんでした(${(e as Error)?.message || 'わからない理由'})`, warn: true });
    } finally {
      setMaking(false);
    }
  };

  // 2回目:共有シート(使えなければダウンロード)。押した直後に開く
  const saveMade = async () => {
    if (!file || !settings) return;
    setNotice(null);
    try {
      const result = await saveFile(file);
      if (result === 'cancelled') return;
      save({ ...settings, lastExportedAt: new Date().toISOString() });
      setFile(null);
      setNotice({ text: '書き出しました', warn: false });
    } catch (e) {
      setNotice({
        text: `保存できませんでした。もう一度「保存する」を押してください(${(e as Error)?.message || 'わからない理由'})`,
        warn: true,
      });
    }
  };

  const pickFile = async (picked: File | undefined) => {
    if (!picked) return;
    setNotice(null);
    setReading(true);
    try {
      const result = await parseBackup(await picked.text());
      if (result.ok) setPending(result);
      else setNotice({ text: result.reason, warn: true });
    } catch {
      setNotice({ text: 'このファイルは読み込めません。ふたりひとめで書き出したファイル(.json)を選んでください', warn: true });
    } finally {
      setReading(false);
    }
  };

  const replace = async () => {
    if (!pending) return;
    try {
      await replaceAll(pending.snapshot);
      setPending(null);
      setImported(true);
      setSettings(await getSettings());
      requestPersist();
    } catch {
      setPending(null);
      setNotice({ text: '読み込めませんでした。今のデータはそのままです', warn: true });
    }
  };

  return (
    <main class="screen">
      <div class="top-bar">
        <a class="round-button" href={routes.home()} aria-label="ホームへ戻る">
          <Icon name="back" />
        </a>
        <h1>設定</h1>
      </div>

      <div class="settings">
        <a class="settings-link card" href={routes.roomSettings()}>
          <span>
            <span class="title">部屋の模様替え</span>
            <span class="sub">壁・床・カーテンなどの色、鉢植えの花、飾る作品</span>
          </span>
          <Icon name="next" />
        </a>

        {settings && (
          <section class="settings-card card">
            <h2 class="field-title">音声で数える言葉</h2>
            <p class="field-note">
              編む画面の「音声」をオンにしているとき、この言葉で1つ数えます。「10目」のような言い方は、今までどおりまとめて数えます
            </p>
            <div class="chips">
              {settings.voiceWords.map((w) => (
                <span class="quick word-chip">
                  <span class="chip static">{w}</span>
                  {settings.voiceWords.length > 1 && (
                    <button
                      class="remove"
                      aria-label={`「${w}」を消す`}
                      onClick={() => save({ ...settings, voiceWords: settings.voiceWords.filter((x) => x !== w) })}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {settings.voiceWords.includes('あみ') && (
              <p class="field-note">「あみ」は「アミ」「編み」「網」と聞き取られても数えます</p>
            )}
            <form class="row word-add" onSubmit={add}>
              <input
                class="text-input"
                type="text"
                aria-label="足す言葉"
                placeholder="例:はい"
                value={text}
                onInput={(e) => setText(e.currentTarget.value)}
              />
              <button class="primary-button small" type="submit" disabled={!word || exists}>
                {exists ? '入っています' : '足す'}
              </button>
            </form>
            <p class="field-note">ひらがなで入れると、カタカナで聞き取られたときも数えます</p>
          </section>
        )}

        {settings && (
          <section class="settings-card card">
            <h2 class="field-title">データの書き出し・読み込み</h2>
            <p class="field-note">
              写真も含めたすべてのデータを1つのファイルにします。ほかの端末や、アプリを入れ直したあとに読み込めます
            </p>
            <div class="data-buttons">
              {file ? (
                <button class="primary-button small" onClick={saveMade}>
                  <Icon name="export" size={20} />
                  保存する
                </button>
              ) : (
                <button class="secondary-button small" onClick={makeFile} disabled={making || reading}>
                  <Icon name="export" size={20} />
                  {making ? '作っています…' : '書き出す'}
                </button>
              )}
              <label class="secondary-button small" data-disabled={making || reading || undefined}>
                <input
                  type="file"
                  class="visually-hidden"
                  disabled={making || reading}
                  onChange={(e) => {
                    pickFile(e.currentTarget.files?.[0]);
                    e.currentTarget.value = '';
                  }}
                />
                <Icon name="import" size={20} />
                {reading ? '読んでいます…' : '読み込む'}
              </label>
            </div>
            {file && <p class="field-note">ファイルができました。「保存する」を押して、保存する場所を選んでください</p>}
            {notice && <p class={`field-note${notice.warn ? ' warn' : ''}`}>{notice.text}</p>}
            <p class="field-note">
              {settings.lastExportedAt
                ? `最後に書き出した日:${formatDay(settings.lastExportedAt)}`
                : 'まだ書き出していません'}
            </p>
          </section>
        )}

        <a class="settings-link card" href={routes.help()}>
          <span>
            <span class="title">遊び方のヘルプ</span>
            <span class="sub">数え方や、パートナー・部屋・データのこと</span>
          </span>
          <Icon name="next" />
        </a>
      </div>

      {pending && (
        <Sheet title="このファイルを読み込みますか?" onClose={() => setPending(null)}>
          <ul class="import-summary">
            {pending.summary.exportedAt && <li>書き出した日:{formatDay(pending.summary.exportedAt)}</li>}
            <li>
              編みかけ {pending.summary.wip}つ ・ お休み {pending.summary.paused}つ ・ 完成 {pending.summary.done}つ
            </li>
            <li>
              写真 {pending.summary.photos}枚 ・ 会ったなかま {pending.summary.met}匹
            </li>
          </ul>
          <p class="sheet-message">
            今のデータはすべて、このファイルの中身に置き換わります。元には戻せません。今のデータを残したいときは、先に書き出してください
          </p>
          <div class="actions">
            <button class="secondary-button" onClick={() => setPending(null)}>
              やめる
            </button>
            <button class="primary-button danger" onClick={replace}>
              置き換える
            </button>
          </div>
        </Sheet>
      )}

      {imported && (
        <Sheet title="読み込みました" onClose={() => go(routes.home())}>
          <p class="sheet-message">ファイルの中身に置き換わりました。</p>
          <button class="primary-button" onClick={() => go(routes.home())}>
            ホームへ
          </button>
        </Sheet>
      )}
    </main>
  );
}
