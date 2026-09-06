/**
 * What counts as a password.
 *
 * One rule, in one place, for the three forms that take one — a person
 * changing their own, an administrator adding an account, an administrator
 * resetting one. A minimum that differs between screens is a minimum that
 * gets argued about and then lowered.
 *
 * DB-free on purpose: browser forms read the minimum to say it up front, and
 * anything a client component imports comes with it into the bundle.
 */
export const MIN_PASSWORD = 10;

/** The seeded demo password, so an account still using it can be pointed out. */
export const DEMO_PASSWORD = '12345Abcdefg';

/** A sentence about what is wrong with it, or null when it will do. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `The password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'The password needs at least one letter and one number.';
  }
  if (password === DEMO_PASSWORD) {
    return 'That is the demo password everyone who has seen the code knows. Choose another.';
  }
  return null;
}
