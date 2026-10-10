// パートナーの画面:名前・頭飾り・体の色・目の色・身につけるもの・部屋に飾るもの・一緒に編んだ作品。
// 変えたものはその場で保存し、上の大きな絵にすぐ反映する
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ColorDots } from '../components/ColorDots';
import { Icon } from '../components/Icon';
import { InteriorThumb } from '../components/InteriorShapePicker';
import { Partner } from '../components/Partner';
import { BODY_COLORS, EYE_COLORS, SHEEP_EYE_COLORS } from '../config/room';
import {
  ANIMALS,
  ANIMAL_NAMES,
  DECORATION_GROUPS,
  DECORATION_NAMES,
  decorationIcon,
  partnerName,
  type DecorationId,
} from '../data/animals';
import { DEPARTMENTS } from '../data/departments';
import { MAX_DISPLAY, defaultInteriorShape, type WearDept } from '../data/wear';
import { workProgress } from '../lib/counter';
import {
  getPartner,
  getRoom,
  listWorks,
  savePartner,
  saveRoom,
  type AnimalId,
  type PartnerData,
  type RoomData,
  type Work,
} from '../lib/db';
import { formatDate } from '../lib/knitTime';
import { pausedWorks } from '../lib/lifecycle';
import { routes } from '../lib/router';
import { displayableWorks, lookOf, wearableWorks } from '../lib/wardrobe';
import { partsOf } from './Partners';

export function PartnerDetail({ animal }: { animal: string }) {
  const valid = (ANIMALS as string[]).includes(animal) ? (animal as AnimalId) : null;
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [notice, setNotice] = useState('');
  const latest = useRef<PartnerData | null>(null);

  useEffect(() => {
    if (!valid) return;
    getPartner(valid).then((p) => {
      latest.current = p;
      setPartner(p);
    });
    listWorks().then(setWorks);
    getRoom().then(setRoom);
  }, [valid]);

  /** その場で保存 */
  const update = (patch: Partial<PartnerData>) => {
    const p = latest.current;
    if (!p) return;
    const next = { ...p, ...patch };
    latest.current = next;
    setPartner(next);
    savePartner(next);
  };

  if (!valid) {
    return (
      <main class="screen">
        <TopBar title="なかま" />
        <p>見つかりませんでした</p>
      </main>
    );
  }
  if (!partner) return <main class="screen" />;

  const look = lookOf(partner, works);
  const name = partnerName(valid, partner);

  // まだ会っていないとき
  if (!partner.met) {
    return (
      <main class="screen">
        <TopBar title={ANIMAL_NAMES[valid]} />
        <div class="partner-page">
          <div class="partner-hero card" data-unmet>
            <Partner animal={valid} look={look} name={name} progress={0.5} live />
          </div>
          <p class="unmet-note">
            まだ会っていません。
            <br />
            {partsOf(valid)}の作品を編むと会えます
          </p>
        </div>
      </main>
    );
  }

  const wearDepts = DEPARTMENTS.filter((d) => d.partners.includes(valid) && d.id !== 'interior');
  const hasInterior = DEPARTMENTS.some((d) => d.id === 'interior' && d.partners.includes(valid));
  const interiors = displayableWorks(works).filter((w) => w.giftedTo === valid);
  const together = works.filter((w) => (w.giftedTo ?? w.partner) === valid);
  const wip = together.filter((w) => w.status === 'wip');
  const resting = pausedWorks(together);
  const done = together
    .filter((w) => w.status === 'done')
    .sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? 1 : -1));

  const wear = (dept: WearDept, id: string | null) => {
    const wearing = { ...partner.wearing };
    if (id) wearing[dept] = id;
    else delete wearing[dept];
    update({ wearing });
  };

  const toggleDisplay = (id: string) => {
    if (!room) return;
    setNotice('');
    const shown = room.displayed.includes(id);
    if (!shown && room.displayed.length >= MAX_DISPLAY) {
      setNotice(`部屋に飾れるのは${MAX_DISPLAY}つまでです。部屋の模様替えで、はずす作品を選んでください`);
      return;
    }
    const next = { ...room, displayed: shown ? room.displayed.filter((x) => x !== id) : room.displayed.concat(id) };
    setRoom(next);
    saveRoom(next);
  };

  return (
    <main class="screen">
      <TopBar title={name} />

      <div class="partner-page">
        <div class="partner-hero card">
          <Partner animal={valid} look={look} name={name} progress={0.5} live interactive />
        </div>

        <div class="field">
          <label for="partner-name">名前</label>
          <input
            id="partner-name"
            class="text-input"
            type="text"
            maxLength={16}
            placeholder={`入れなければ「${ANIMAL_NAMES[valid]}」`}
            value={partner.name}
            onInput={(e) => update({ name: e.currentTarget.value })}
          />
        </div>

        <section class="field">
          <h2 class="field-title">頭飾り</h2>
          {DECORATION_GROUPS.map((g) => (
            <div class="deco-group">
              <span class="deco-group-name">{g.name}</span>
              <div class="deco-grid">
                {g.items.map((d) => (
                  <DecorationChoice id={d} selected={partner.decoration === d} onPick={() => update({ decoration: d })} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section class="field">
          <h2 class="field-title">体の色</h2>
          <ColorDots
            label="体の色"
            options={BODY_COLORS}
            value={partner.bodyColor}
            original="#fbf7f4"
            onChange={(bodyColor) => update({ bodyColor })}
          />
        </section>

        <section class="field">
          <h2 class="field-title">目の色</h2>
          <ColorDots
            label="目の色"
            options={valid === 'sheep' ? SHEEP_EYE_COLORS : EYE_COLORS}
            value={partner.eyeColor}
            original={valid === 'sheep' ? '#fdfbff' : '#1a1620'}
            onChange={(eyeColor) => update({ eyeColor })}
          />
        </section>

        <section class="field">
          <h2 class="field-title">身につける</h2>
          {wearDepts.map((d) => {
            const list = wearableWorks(valid, d.id as WearDept, works);
            const current = look.wear.some((x) => x.dept === d.id) ? partner.wearing[d.id as WearDept] : undefined;
            return (
              <div class="wear-dept">
                <span class="deco-group-name">{d.name}</span>
                {list.length === 0 ? (
                  <p class="field-note">{d.name}の作品を完成させると、ここで身につけられます</p>
                ) : (
                  <div class="wear-list">
                    <button
                      type="button"
                      class="wear-choice card"
                      aria-pressed={!current}
                      onClick={() => wear(d.id as WearDept, null)}
                    >
                      <span class="dot none" />
                      <span class="name">なし</span>
                    </button>
                    {list.map((w) => (
                      <button
                        type="button"
                        class="wear-choice card"
                        aria-pressed={current === w.id}
                        onClick={() => wear(d.id as WearDept, w.id)}
                      >
                        <span class="dot" style={{ background: w.color }} />
                        <span class="name">{w.name}</span>
                        <span class="sub">{w.finishedAt ? formatDate(w.finishedAt) : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {hasInterior && (
          <section class="field">
            <h2 class="field-title">部屋に飾る</h2>
            {interiors.length === 0 ? (
              <p class="field-note">小物やインテリアの作品を完成させると、ホームの部屋に飾れます</p>
            ) : (
              <div class="interior-list">
                {interiors.map((w) => {
                  const shown = !!room?.displayed.includes(w.id);
                  return (
                    <div class="interior-row card">
                      <InteriorThumb shape={w.interiorShape ?? defaultInteriorShape(w.kind)} color={w.color} />
                      <span class="name">{w.name}</span>
                      <button
                        type="button"
                        class={shown ? 'secondary-button small' : 'primary-button small'}
                        onClick={() => toggleDisplay(w.id)}
                      >
                        {shown ? 'はずす' : '飾る'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {notice && <p class="field-note warn">{notice}</p>}
          </section>
        )}

        <section class="field">
          <h2 class="field-title">一緒に編んだ作品</h2>
          {together.length === 0 && <p class="field-note">まだありません</p>}
          {[...wip, ...resting, ...done].map((w) => (
            <a
              class="together card"
              href={
                w.status === 'wip' ? routes.knit(w.id) : w.status === 'paused' ? routes.pausedHome() : routes.albumWork(w.id)
              }
            >
              <span class="dot" style={{ background: w.color }} />
              <span class="name">{w.name}</span>
              <span class="sub">
                {w.status === 'wip'
                  ? `編みかけ ${Math.round(workProgress(w) * 100)}%`
                  : w.status === 'paused'
                  ? `お休み中 ${Math.round(workProgress(w) * 100)}%`
                  : `完成 ${w.finishedAt ? formatDate(w.finishedAt) : ''}`}
              </span>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <div class="top-bar">
      <a class="round-button" href={routes.partners()} aria-label="なかまへ戻る">
        <Icon name="back" />
      </a>
      <h1>{title}</h1>
    </div>
  );
}

function DecorationChoice({ id, selected, onPick }: { id: DecorationId; selected: boolean; onPick: () => void }) {
  const markup = useMemo(() => decorationIcon(id), [id]);
  return (
    <button type="button" class="deco-choice card" aria-pressed={selected} onClick={onPick}>
      <span class="deco-pic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
      <span class="name">{DECORATION_NAMES[id]}</span>
    </button>
  );
}
