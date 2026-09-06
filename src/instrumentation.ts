/**
 * Runs once when the server starts. Configuration that must be right in
 * production is checked here so the process fails loudly on boot, rather than
 * serving a login page that throws the moment anyone signs in.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;

  const problems: string[] = [];

  const secret = process.env.IH_SECRET;
  if (!secret) {
    problems.push('IH_SECRET is not set. Generate one with: openssl rand -hex 32');
  } else if (secret.length < 16) {
    problems.push('IH_SECRET is shorter than 16 characters.');
  } else if (secret === 'insurhelp-dev-secret-change-me') {
    problems.push('IH_SECRET is still the development value from the repository.');
  }

  const adminPassword = process.env.IH_ADMIN_PASSWORD ?? '';
  if (adminPassword && (adminPassword.length < 10 || !/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword))) {
    problems.push('IH_ADMIN_PASSWORD must be at least 10 characters with a letter and a number.');
  }
  if (adminPassword === '12345Abcdefg') {
    problems.push('IH_ADMIN_PASSWORD is the demo password from the repository.');
  }

  if (problems.length) {
    console.error(
      '\n  Insurhelp cannot start:\n' +
        problems.map((p) => `    - ${p}`).join('\n') +
        '\n\n  See DEPLOY.md.\n',
    );
    throw new Error(`Insurhelp configuration invalid: ${problems.join(' ')}`);
  }
}

/**
 * Every error a request produces, as one structured line on stderr — the
 * path, the kind of work, the digest the person was shown, and the message.
 * `pm2 logs` is then an answer to "the batch save did nothing", where it used
 * to be empty. Nothing from the request body is logged, so no client's data
 * ends up in a log file.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const e = error as { message?: string; digest?: string; name?: string };
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      level: 'error',
      method: request.method,
      path: request.path,
      route: context.routePath,
      kind: context.routeType,
      digest: e?.digest ?? null,
      error: e?.name ?? 'Error',
      message: e?.message ?? String(error),
    }),
  );
}
