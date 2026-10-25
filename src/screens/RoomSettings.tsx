// 部屋の模様替え:おすすめ・色・鉢植えの花・飾る作品(最大3つ。長押しで動かして置き場所を入れ替える)。
// 上の部屋の絵にすぐ反映し、その場で保存する
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ColorDots } from '../components/ColorDots';
import { BackButton } from '../components/BackButton';
import { InteriorThumb } from '../components/InteriorShapePicker';
import { Partner } from '../components/Partner';
import { Scene, displayedWorks } from '../components/Scene';
import { POT_FLOWERS, ROOM_PALETTES, ROOM_PARTS, ROOM_SWATCHES, type RoomPalette } from '../config/room';
import { DECORATION_NAMES, decorationIcon, type DecorationId } from '../data/animals';
import { MAX_DISPLAY, ROOM_SPOT_NAMES, defaultInteriorShape } from '../data/wear';
import { overallProgress } from '../lib/parts';
import { getRoom, saveRoom, type RoomData, type Work } from '../lib/db';
import { roomResident, useLooks } from '../lib/looks';
import { routes } from '../lib/router';
import { useDragSort } from '../lib/useDragSort';
import { displayableWorks } from '../lib/wardrobe';

const samePalette = (room: RoomData, p: RoomPalette) =>
  ROOM_PARTS.every(({ id }) => room[id].toLowerCase() === p[id].toLowerCase()) && room.flower === p.flower;

export function RoomSettings() {
  const looks = useLooks();
  const [room, setRoom] = useState<RoomData | null>(null);
  const latest = useRef<RoomData | null>(null);

  useEffect(() => {
    getRoom().then((r) => {
      latest.current = r;
      setRoom(r);
    });
  }, []);

  const update = (patch: Partial<RoomData>) => {
    const r = latest.current;
    if (!r) return;
    const next = { ...r, ...patch };
    latest.current = next;
    setRoom(next);
    saveRoom(next);
  };

  const works = looks?.works ?? [];
  const shown = room ? displayedWorks(room, works) : [];
  const others = displayableWorks(works).filter((w) => !shown.some((s) => s.id === w.id));
  // 飾っている作品は長押しで並び替え(1つ目=床の右、2つ目=ラグの左手前、3つ目=窓辺)
  const drag = useDragSort(shown, (w) => w.id, (next) => update({ displayed: next.map((w) => w.id) }));
  const resident = looks ? roomResident(looks) : null;

  return (
    <main class="screen">
      <div class="top-bar">
        <BackButton fallback={routes.settings()} />
        <h1>部屋の模様替え</h1>
      </div>

      {room && looks && resident && (
        <>
          <div class="room-preview-wrap">
            <section class="room room-preview" aria-label="部屋の見本">
              <Scene kind="room" room={room} works={works} />
              <Partner
                animal={resident.animal}
                look={looks.look(resident.animal)}
                name={looks.name(resident.animal)}
                color={resident.holding?.color ?? resident.last?.color}
                tool={resident.holding?.tool}
                progress={resident.holding ? overallProgress(resident.holding) : 0}
                live
              />
            </section>
          </div>

          <div class="room-settings">
            <section class="field">
              <h2 class="field-title">おすすめ</h2>
              <div class="palette-grid">
                {ROOM_PALETTES.map((p) => (
                  <button
                    type="button"
                    class="palette card"
                    aria-pressed={samePalette(room, p)}
                    onClick={() => {
                      const { name: _name, ...colors } = p;
                      update(colors);
                    }}
                  >
                    <span class="palette-dots" aria-hidden="true">
                      {ROOM_PARTS.map(({ id }) => (
                        <span style={{ background: p[id] }} />
                      ))}
                    </span>
                    <span class="name">{p.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {ROOM_PARTS.map(({ id, name }) => (
              <section class="field">
                <h2 class="field-title">{name}</h2>
                <ColorDots
                  label={name}
                  options={ROOM_SWATCHES[id].map((v) => ({ value: v, name: v }))}
                  value={room[id]}
                  free
                  onChange={(v) => v && update({ [id]: v })}
                />
              </section>
            ))}

            <section class="field">
              <h2 class="field-title">鉢植えの花</h2>
              <div class="deco-grid">
                {POT_FLOWERS.map((f) => (
                  <FlowerChoice id={f} selected={room.flower === f} onPick={() => update({ flower: f })} />
                ))}
              </div>
            </section>

            <section class="field">
              <h2 class="field-title">
                飾る作品(最大{MAX_DISPLAY}つ)
              </h2>
              {shown.length === 0 && others.length === 0 && (
                <p class="field-note">小物やインテリアの作品を完成させると、ここで部屋に飾れます</p>
              )}
              {drag.items.map((w, i) => (
                <DisplayRow
                  key={w.id}
                  work={w}
                  spot={ROOM_SPOT_NAMES[i]}
                  bind={drag.bind(w.id)}
                  action="はずす"
                  onAction={() => update({ displayed: room.displayed.filter((x) => x !== w.id) })}
                />
              ))}
              {shown.length > 1 && <p class="field-note">長押しして動かすと、置き場所を入れ替えられます</p>}
              {others.length > 0 && (
                <>
                  <span class="deco-group-name">飾っていない作品</span>
                  {others.map((w) => (
                    <DisplayRow
                      work={w}
                      action="飾る"
                      disabled={shown.length >= MAX_DISPLAY}
                      onAction={() => update({ displayed: shown.map((s) => s.id).concat(w.id) })}
                    />
                  ))}
                  {shown.length >= MAX_DISPLAY && (
                    <p class="field-note">飾れるのは{MAX_DISPLAY}つまでです。飾っている作品をはずすと飾れます</p>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function DisplayRow({
  work,
  spot,
  bind,
  action,
  disabled = false,
  onAction,
}: {
  work: Work;
  spot?: string;
  bind?: object;
  action: string;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div class="interior-row card" {...bind}>
      <InteriorThumb shape={work.interiorShape ?? defaultInteriorShape(work.kind)} color={work.color} />
      <span class="name">
        {work.name}
        {spot && <span class="sub">{spot}</span>}
      </span>
      <button
        type="button"
        class={action === '飾る' ? 'primary-button small' : 'secondary-button small'}
        data-no-drag
        disabled={disabled}
        onClick={onAction}
      >
        {action}
      </button>
    </div>
  );
}

function FlowerChoice({ id, selected, onPick }: { id: DecorationId; selected: boolean; onPick: () => void }) {
  const markup = useMemo(() => decorationIcon(id), [id]);
  return (
    <button type="button" class="deco-choice card" aria-pressed={selected} onClick={onPick}>
      <span class="deco-pic" dangerouslySetInnerHTML={{ __html: markup }} />
      <span class="name">{DECORATION_NAMES[id]}</span>
    </button>
  );
}
