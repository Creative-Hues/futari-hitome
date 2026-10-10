// パートナーの絵。assets/ のSVGをそのまま重ねる(どうぶつの体の上に頭飾り)。
// フェーズ1はひつじと最初の頭飾り(チューリップ)だけ。
import sheepUrl from '../../assets/animals/sheep.svg';
import tulipUrl from '../../assets/decorations/tulip.svg';
import anchors from '../../assets/animals/anchors.json';

const VIEW = 240;
// 頭飾りの viewBox は -22 -40 44 44 で、(0,0) が頭に触れる点
const DECO = { x: -22, y: -40, size: 44 };

export function Partner({ label }: { label?: string }) {
  const a = anchors.anchors.sheep;
  const s = anchors.decorationScale;
  const pct = (v: number) => `${(v / VIEW) * 100}%`;
  return (
    <div class="partner" role={label ? 'img' : undefined} aria-label={label}>
      <img class="partner-body" src={sheepUrl} alt="" draggable={false} />
      <img
        src={tulipUrl}
        alt=""
        draggable={false}
        style={{
          left: pct(a.x + DECO.x * s),
          top: pct(a.y + DECO.y * s),
          width: pct(DECO.size * s),
          height: pct(DECO.size * s),
        }}
      />
    </div>
  );
}
