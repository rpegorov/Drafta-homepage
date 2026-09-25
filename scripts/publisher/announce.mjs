// What the owner is told after a run (PLAN v2 §11.1 п. 5). Pure: exporter JSON
// in, notifications out. Per-note problems repeat on every run until fixed, so
// they are announced once and again only after they disappeared and came back.

/** Exporter skip reasons that mean "meant to be published, but something is missing". */
const INTENT_SKIPS = {
  'no site block': 'нет site-блока',
  'no slug in site block': 'нет slug в site-блоке',
  'no description in site block': 'нет description в site-блоке',
};

const titled = (entry) => entry.title || entry.slug || 'без заголовка';

/** Published, updated and removed pages — only after the push went through. */
export function changeNotifications(result) {
  return [
    ...(result.created ?? []).map((e) => ({ title: `Опубликовано: ${titled(e)}`, body: e.url ?? '' })),
    ...(result.updated ?? []).map((e) => ({ title: `Обновлено: ${titled(e)}`, body: e.url ?? '' })),
    ...(result.deleted ?? []).map((e) => ({ title: `Снято с публикации: ${titled(e)}`, body: e.url ?? '' })),
  ];
}

/** Notes that wanted to go out and did not: exporter errors and intent-revealing skips. */
export function currentProblems(result) {
  const errors = (result.errors ?? []).map((e) => ({ title: titled(e), reason: e.message ?? 'ошибка' }));
  const skips = (result.skipped ?? [])
    .filter((e) => INTENT_SKIPS[e.reason])
    .map((e) => ({ title: titled(e), reason: INTENT_SKIPS[e.reason] }));
  return [...errors, ...skips];
}

const problemKey = ({ title, reason }) => `${title}\n${reason}`;

/**
 * @param {{title: string, reason: string}[]} problems
 * @param {string[]} announced keys announced by earlier runs
 * @returns {{notifications: {title: string, body: string}[], announced: string[]}}
 */
export function problemNotifications(problems, announced) {
  const before = new Set(announced);
  const fresh = problems.filter((p) => !before.has(problemKey(p)));
  return {
    notifications: fresh.map((p) => ({ title: `Не опубликовано: ${p.title}`, body: p.reason })),
    announced: problems.map(problemKey),
  };
}

export function summaryLine(result, { pushed }) {
  return (
    `run: created=${count(result.created)} updated=${count(result.updated)} deleted=${count(result.deleted)} ` +
    `skipped=${count(result.skipped)} errors=${count(result.errors)} pushed=${pushed ? 'yes' : 'no'}` +
    (result.sha ? ` sha=${result.sha}` : '')
  );
}

export const pendingChanges = (result) => count(result.created) + count(result.updated) + count(result.deleted);

function count(list) {
  return (list ?? []).length;
}
