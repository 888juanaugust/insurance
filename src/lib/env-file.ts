import fs from 'node:fs';

/**
 * `.env.production`, for code that does not run inside Next.
 *
 * Next reads the file itself when the application starts; the command-line
 * scripts (`npm run tenant`) do not, and so the documented flow — put
 * IH_TENANTS_DIR in .env.production, then run the command — failed with
 * "IH_TENANTS_DIR is not set" on any real server. This reads the same file
 * the same way, without overriding anything the shell already set, so an
 * operator who exported a value on purpose keeps it.
 *
 * Deliberately small: KEY=value lines, optional quotes, # comments. Anything
 * fancier belongs in the shell, not in a secrets file.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = /^(["']).*\1$/.test(value);
    if (quoted) value = value.slice(1, -1);
    else {
      // An unquoted value ends at the first " #" — a trailing comment.
      const hash = value.search(/\s#/);
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out[key] = value;
  }
  return out;
}

/** Loads a file into process.env for every key the environment does not already carry. */
export function loadEnvFile(path: string): number {
  let text: string;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch {
    return 0;
  }
  let loaded = 0;
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }
  return loaded;
}
