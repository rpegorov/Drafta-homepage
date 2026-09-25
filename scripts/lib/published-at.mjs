// When a post was published, as the owner reckons time (Europe/Moscow): the
// site orders posts by this instant, not by day. The site block may name the
// day, or the day and the minute; whatever it leaves out comes from the note's
// createdAt, read in the owner's zone.
const OWNER_TIME_ZONE = 'Europe/Moscow';
const MINUTE_MS = 60_000;

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: OWNER_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const pad = (n) => String(n).padStart(2, '0');

/** Wall-clock fields of `date` in the owner's zone. */
function ownerClock(date) {
  const fields = Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  return { day: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}`, second: fields.second };
}

/** `+03:00` — the zone's UTC offset at `date` (the zone has had no DST since 2014, but this does not assume it). */
function ownerOffset(date) {
  const { day, time, second } = ownerClock(date);
  const asUtc = Date.parse(`${day}T${time}:${second}Z`);
  const minutes = Math.round((asUtc - date.getTime()) / MINUTE_MS);
  const sign = minutes < 0 ? '-' : '+';
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

/** The owner's calendar day of an instant: the default `date` of a post. */
export function ownerDay(instant) {
  return ownerClock(new Date(instant)).day;
}

/**
 * ISO-8601 with offset, e.g. `2026-09-25T18:00:00+03:00`.
 * @param {{date?: string, time?: string}} site `YYYY-MM-DD` and `HH:MM` from the site block, either optional
 * @param {string} createdAt the note's creation instant
 */
export function publishedAt(site, createdAt) {
  const created = new Date(createdAt);
  const clock = ownerClock(created);
  const day = site.date ?? clock.day;
  const time = site.time ?? clock.time;
  const second = site.time ? '00' : clock.second;
  // The offset is read at the named wall-clock time: exact for a fixed-offset zone.
  const offset = ownerOffset(new Date(`${day}T${time}:${second}Z`));
  return `${day}T${time}:${second}${offset}`;
}
