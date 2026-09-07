/**
 * PM2 process definitions.
 *
 * One agency, one process. Each reads its own database under IH_TENANTS_DIR,
 * listens on the port recorded in that agency's directory, and knows nothing
 * of the others: separate memory, separate sign-in throttle, separate crash.
 * Adding an agency (`npm run tenant -- create`) then `pm2 start` again picks
 * it up; nothing about the existing ones moves.
 *
 * With IH_TENANTS_DIR unset this is the single application it always was.
 *
 * One instance each: the sign-in throttle and the SQLite connection are both
 * per-process, so clustering needs those moved out first.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = '/var/www/insurhelp';
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

function base(name, port, env) {
  return {
    name,
    cwd: ROOT,
    script: 'node_modules/next/dist/bin/next',
    args: `start -p ${port}`,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production', ...env },
    env_file: '.env.production',
    out_file: `/var/log/insurhelp/${name}.out.log`,
    error_file: `/var/log/insurhelp/${name}.error.log`,
    time: true,
  };
}

/*
 * The tenants directory is read from .env.production rather than the
 * environment PM2 happens to be started with, so `pm2 start` behaves the same
 * from any shell.
 */
function tenantsDir() {
  if (process.env.IH_TENANTS_DIR) return process.env.IH_TENANTS_DIR;
  try {
    const line = fs
      .readFileSync(path.join(ROOT, '.env.production'), 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('IH_TENANTS_DIR='));
    return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

function portIn(dir, who) {
  const portFile = path.join(dir, 'port');
  const port = Number(fs.readFileSync(portFile, 'utf8').trim());
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Insurhelp: ${who} has no usable port in ${portFile}.`);
  }
  return port;
}

function agencies(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SLUG.test(e.name) && e.name !== 'landlord')
    .map((e) => e.name)
    .filter((slug) => fs.existsSync(path.join(dir, slug, 'insurhelp.db')))
    // A suspended agency has no process: its address is answered by nginx
    // with a page that says so, and its memory is free for the others.
    .filter((slug) => !fs.existsSync(path.join(dir, slug, 'suspended')))
    .sort()
    .map((slug) => base(`insurhelp-${slug}`, portIn(path.join(dir, slug), `the agency "${slug}"`), { IH_TENANT: slug, IH_TENANTS_DIR: dir }));
}

/*
 * The landlord's console, when one has been created: the same application,
 * pinned to the landlord's own database and served at the base domain.
 */
function landlord(dir) {
  const home = path.join(dir, 'landlord');
  if (!fs.existsSync(path.join(home, 'landlord.db'))) return [];
  return [base('insurhelp-landlord', portIn(home, 'the landlord console'), { IH_LANDLORD: '1', IH_TENANTS_DIR: dir })];
}

const dir = tenantsDir();
const apps = dir && fs.existsSync(dir) ? [...landlord(dir), ...agencies(dir)] : [base('insurhelp', 3000, {})];

module.exports = { apps };
