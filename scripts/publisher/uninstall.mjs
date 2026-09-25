#!/usr/bin/env node
// Removes the publishing LaunchAgent (PLAN v2 §11.1 п. 7).
//
//   npm run publisher:uninstall [-- --purge]
//
// Unloads the job and deletes its plist. The clone, state.json and the log
// stay for inspection; --purge deletes them too.
import { rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { bootoutIfLoaded } from './launchctl.mjs';
import { LABEL, PROBE_LABEL, layout } from './layout.mjs';

async function uninstall() {
  const { values } = parseArgs({ options: { purge: { type: 'boolean', default: false } } });
  const paths = layout(process.env);
  await bootoutIfLoaded(LABEL);
  await bootoutIfLoaded(PROBE_LABEL);
  rmSync(paths.plist, { force: true });
  console.log(`agent:  ${LABEL} unloaded, ${paths.plist} removed`);
  if (!values.purge) {
    console.log(`kept:   ${paths.base} and ${paths.log} (add --purge to delete)`);
    return;
  }
  for (const path of [paths.base, paths.log, `${paths.log}.1`]) rmSync(path, { recursive: true, force: true });
  console.log(`purged: ${paths.base}, ${paths.log}`);
}

uninstall().catch((error) => {
  console.error(`publisher:uninstall failed: ${error.stderr?.trim() || error.message}`);
  process.exitCode = 1;
});
