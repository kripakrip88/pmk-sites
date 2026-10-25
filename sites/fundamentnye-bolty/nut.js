// Шестигранная гайка сбоку: видимые грани при повороте theta (рад), верх гайки на высоте y.
// Общая для разметки (последний кадр) и анимации затяжки в BoltEnd.astro.
export const NUT = { cx: 80, R: 23, H: 20, C: 3.2, PITCH: 3.2, TURNS: 9, Y: 80, THETA: 0.35 };

export function nutFaces(theta, y) {
  const { cx, R, H, C } = NUT;
  const faces = [];
  for (let k = 0; k < 6; k++) {
    const a1 = theta + (k * Math.PI) / 3;
    const a2 = a1 + Math.PI / 3;
    const n = a1 + Math.PI / 6; // нормаль грани
    const depth = Math.cos(n);
    if (depth <= 0.02) continue; // грань смотрит от нас
    const x1 = cx + R * Math.sin(a1);
    const x2 = cx + R * Math.sin(a2);
    const xl = Math.min(x1, x2), xr = Math.max(x1, x2), xm = (xl + xr) / 2;
    const c = Math.min(C, (xr - xl) * 0.25); // узкой грани — мелкая фаска, иначе торчит «ушко»
    const v = Math.round(120 + Math.max(0, Math.cos(n + 0.6)) * 110); // свет слева сверху
    const f = (x) => x.toFixed(2);
    faces.push({
      depth,
      fill: `rgb(${v - 8},${v},${v + 6})`,
      d: `M${f(xl)} ${f(y + c)}Q${f(xm)} ${f(y - c * 0.35)} ${f(xr)} ${f(y + c)}L${f(xr)} ${f(y + H - c)}Q${f(xm)} ${f(y + H + c * 0.35)} ${f(xl)} ${f(y + H - c)}Z`,
    });
  }
  return faces.sort((a, b) => a.depth - b.depth);
}
