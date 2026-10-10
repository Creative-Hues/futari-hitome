// 設定:部屋の模様替えへの入り口と、音声で数える言葉
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { getSettings, saveSettings, type Settings as SettingsData } from '../lib/db';
import { routes } from '../lib/router';
import { cleanWord } from '../lib/voiceWords';

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [text, setText] = useState('');

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
      </div>
    </main>
  );
}
