// Renders plist.template.xml. Values are XML-escaped; a placeholder left
// without a value is an error, not an empty string in a launchd job.
import { readFileSync } from 'node:fs';

export const TEMPLATE = new URL('./plist.template.xml', import.meta.url);

function xmlEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Extra EnvironmentVariables entries, already as plist XML. */
function envEntries(extraEnv) {
  return Object.entries(extraEnv)
    .map(([key, value]) => `    <key>${xmlEscape(key)}</key>\n    <string>${xmlEscape(value)}</string>\n`)
    .join('');
}

/**
 * @param {Record<string, string>} values LABEL, NODE, SCRIPT, CLONE, NOTES, HOME, LIBRARY, BRANCH, GIT_SSH_COMMAND, LOG
 * @param {Record<string, string>} [extraEnv]
 */
export function renderPlist(values, extraEnv = {}, template = readFileSync(TEMPLATE, 'utf8')) {
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) => {
    if (name === 'EXTRA_ENV') return envEntries(extraEnv);
    if (values[name] === undefined) throw new Error(`plist template: no value for ${placeholder}`);
    return xmlEscape(values[name]);
  });
  return rendered;
}
