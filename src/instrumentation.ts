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

  if (problems.length) {
    console.error(
      '\n  Insurhelp cannot start:\n' +
        problems.map((p) => `    - ${p}`).join('\n') +
        '\n\n  See DEPLOY.md.\n',
    );
    throw new Error(`Insurhelp configuration invalid: ${problems.join(' ')}`);
  }
}
