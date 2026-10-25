// Цель Яндекс.Метрики. Если счётчика нет — тихо ничего не делает.
export function goal(name) {
  if (typeof window.ym === 'function' && window.PMK_YM) window.ym(window.PMK_YM, 'reachGoal', name);
}
