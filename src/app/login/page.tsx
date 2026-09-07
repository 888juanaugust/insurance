import { requestAgency, NO_AGENCY, SUSPENDED_MESSAGE } from '@/lib/tenant';
import { getOrgName } from '@/lib/queries';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

/**
 * The sign-in page names the agency whose address this is.
 *
 * With a database per agency the address decides which book a person is
 * signing in to, so an address that belongs to no agency has to say so —
 * otherwise a correct password at the wrong address looks like a wrong
 * password.
 */
export default async function LoginPage() {
  const resolved = await requestAgency();
  /*
   * Three states, not two. A named agency; a single-agency install, which has
   * no name to show but is perfectly valid (the empty string); and an address
   * that belongs to no agency at all, which is null and gets the warning.
   * Collapsing the empty string to null told every user of a single-agency
   * install that their own address was wrong.
   */
  const agency: string | null = resolved.ok
    ? getOrgName()
    : resolved.reason === 'single-tenant'
      ? ''
      : null;
  const message = !resolved.ok && resolved.reason === 'suspended' ? SUSPENDED_MESSAGE : NO_AGENCY;
  return <LoginForm agency={agency} noAgencyMessage={message} />;
}
