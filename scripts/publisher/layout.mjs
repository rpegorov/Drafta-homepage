// Where the publisher keeps its files (PLAN v2 §11.1 п. 2, 6, 7). Everything
// derives from HOME, so a test with a fake HOME never touches the real Mac.
import { join } from 'node:path';

export const LABEL = 'org.drafta.site-publisher';
export const PROBE_LABEL = `${LABEL}.probe`;

/** Same default as scripts/import-from-drafta.mjs; DRAFTA_LIBRARY overrides it. */
export function libraryDir(env) {
  return env.DRAFTA_LIBRARY || join(env.HOME, 'Library/Application Support/Drafta/Library');
}

export function layout(env) {
  const base = join(env.HOME, 'Library/Application Support/Drafta/site-publisher');
  const library = libraryDir(env);
  return {
    base,
    clone: join(base, 'repo'),
    state: join(base, 'state.json'),
    lock: join(base, 'run.lock'),
    probePlist: join(base, 'probe.plist'),
    probeLog: join(base, 'probe.log'),
    library,
    notes: join(library, 'notes'),
    log: join(env.HOME, 'Library/Logs/drafta-site-publisher.log'),
    plist: join(env.HOME, `Library/LaunchAgents/${LABEL}.plist`),
  };
}
