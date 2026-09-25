// Gráficas "3D" reutilizables para los reportes PDF, en el mismo estilo
// visual (dona y barras extruidas) que los componentes Bars3D/Donut3D de
// three.js que ya usa el panel en pantalla — pero renderizadas con
// primitivas <Svg>/<Path> de @react-pdf/renderer, ya que @react-pdf no
// puede montar un canvas WebGL dentro del PDF. La técnica es la misma que
// usan los gráficos "3D" de Excel/PowerPoint: extruir cada dona/barra con
// una cara lateral y (para la dona) una pared frontal, en un tono más
// oscuro que la cara principal, para dar sensación de volumen.
import { Svg, Path, G } from "@react-pdf/renderer";

export type Chart3DDatum = { label: string; value: number; color: string };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Oscurece (factor < 0) o aclara (factor > 0) un color hex "#rrggbb". */
export function shade(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const mix = (c: number) => clamp(Math.round(factor >= 0 ? c + (255 - c) * factor : c + c * factor), 0, 255);
  r = mix(r);
  g = mix(g);
  b = mix(b);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function polar(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
}

/** Convierte valores en sectores angulares acumulados (a0..a1, en grados,
 * arrancando en -90° = 12 en punto). Vive fuera del componente para no
 * mutar una variable capturada dentro del render (incompatible con el
 * compilador de React). */
function sectoresAngulares<T extends Chart3DDatum>(data: T[]): (T & { a0: number; a1: number })[] {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const positivos = data.filter((d) => d.value > 0);
  const resultado: (T & { a0: number; a1: number })[] = [];
  let angle = -90;
  for (const d of positivos) {
    const sweep = (Math.max(d.value, 0) / total) * 360;
    resultado.push({ ...d, a0: angle, a1: angle + sweep });
    angle += sweep;
  }
  return resultado;
}

/** Dona 3D extruida: cada porción es un sector de anillo (cara superior,
 * vista desde arriba con leve inclinación elíptica) más una pared lateral
 * más oscura en la mitad frontal (donde la extrusión es visible desde el
 * ángulo de cámara). Devuelve además la lista de porciones con su
 * porcentaje, para pintar la leyenda fuera del SVG. */
export function Donut3DPdf({
  data,
  size = 150,
  depth = 16,
  innerRatio = 0.55,
}: {
  data: Chart3DDatum[];
  size?: number;
  depth?: number;
  innerRatio?: number;
}) {
  const cx = size / 2;
  const cy = (size - depth) / 2 + 2;
  const rx = size / 2 - 6;
  const ry = rx * 0.6;
  const irx = rx * innerRatio;
  const iry = ry * innerRatio;

  const sectores = sectoresAngulares(data);

  const walls = sectores
    .map((s) => {
      // Solo la parte del sector que cae en el hemisferio frontal/inferior
      // (ángulo entre 0° y 180° en este sistema, 0°=3 en punto) proyecta
      // pared visible — el resto queda "detrás" de la dona.
      const ca0 = clamp(s.a0, 0, 180);
      const ca1 = clamp(s.a1, 0, 180);
      if (ca1 <= ca0) return null;
      const p0 = polar(cx, cy, rx, ry, ca0);
      const p1 = polar(cx, cy, rx, ry, ca1);
      const largeArc = ca1 - ca0 > 180 ? 1 : 0;
      const d = `M ${p0.x} ${p0.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1.x} ${p1.y} L ${p1.x} ${p1.y + depth} A ${rx} ${ry} 0 ${largeArc} 0 ${p0.x} ${p0.y + depth} Z`;
      return { key: `${s.label}-wall`, d, color: shade(s.color, -0.4) };
    })
    .filter((w): w is { key: string; d: string; color: string } => w !== null);

  const caras = sectores.map((s) => {
    const outerA = polar(cx, cy, rx, ry, s.a0);
    const outerB = polar(cx, cy, rx, ry, s.a1);
    const innerA = polar(cx, cy, irx, iry, s.a0);
    const innerB = polar(cx, cy, irx, iry, s.a1);
    const largeArc = s.a1 - s.a0 > 180 ? 1 : 0;
    const d = `M ${outerA.x} ${outerA.y} A ${rx} ${ry} 0 ${largeArc} 1 ${outerB.x} ${outerB.y} L ${innerB.x} ${innerB.y} A ${irx} ${iry} 0 ${largeArc} 0 ${innerA.x} ${innerA.y} Z`;
    return { key: s.label, d, color: s.color };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {walls.map((w) => (
          <Path key={w.key} d={w.d} fill={w.color} />
        ))}
        {caras.map((c) => (
          <Path key={c.key} d={c.d} fill={c.color} />
        ))}
      </G>
    </Svg>
  );
}

/** Barras 3D extruidas: cada barra tiene cara frontal, cara superior
 * (paralelogramo, más clara) y cara lateral derecha (paralelogramo, más
 * oscura) — la misma sensación isométrica del componente Bars3D en
 * pantalla, sin depender de WebGL. */
export function Bars3DPdf({
  data,
  width = 240,
  height = 140,
  skew = 10,
}: {
  data: Chart3DDatum[];
  width?: number;
  height?: number;
  skew?: number;
}) {
  const max = Math.max(...data.map((d) => Math.max(d.value, 0)), 1);
  const usableW = width - skew;
  const barW = usableW / (data.length * 1.7);
  const gap = barW * 0.7;
  const baseY = height - skew - 4;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const h = (Math.max(d.value, 0) / max) * (baseY - 6);
        const x = skew + gap / 2 + i * (barW + gap);
        const y = baseY - h;
        const front = `M ${x} ${y} L ${x + barW} ${y} L ${x + barW} ${baseY} L ${x} ${baseY} Z`;
        const top = `M ${x} ${y} L ${x + skew} ${y - skew} L ${x + barW + skew} ${y - skew} L ${x + barW} ${y} Z`;
        const side = `M ${x + barW} ${y} L ${x + barW + skew} ${y - skew} L ${x + barW + skew} ${baseY - skew} L ${x + barW} ${baseY} Z`;
        return (
          <G key={d.label}>
            <Path d={side} fill={shade(d.color, -0.35)} />
            <Path d={top} fill={shade(d.color, 0.3)} />
            <Path d={front} fill={d.color} />
          </G>
        );
      })}
    </Svg>
  );
}
