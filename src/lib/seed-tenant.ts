import type { Database } from 'better-sqlite3';
import { PRINCIPALS, insertAll, type Row } from './seed';
import { DEFAULT_TEMPLATES } from './messaging';
import { hashPasswordSync } from './auth';
import { today } from './format';

/**
 * A new agency's database: the reference data every agency needs, one
 * organisation, one administrator, and nothing else.
 *
 * Deliberately not `seed()`, which builds the demo book — two organisations,
 * a hundred policies, claims, a commission statement. A real agency starts
 * with an empty register and fills it from its own schedules; a demo policy
 * that survived into a real book would be indistinguishable from a mistake.
 *
 * What it does put in is what the agency cannot work without: the Malaysian
 * insurers and their default commission rates, the four renewal reminders
 * with their wording, and the account that can sign in.
 */
export type NewAgency = {
  slug: string;
  name: string;
  admin: { name: string; email: string; password: string };
};

export function seedTenant(db: Database, agency: NewAgency): void {
  const orgId = `org-${agency.slug}`;
  const stamp = today();

  insertAll(db, 'organisation', [
    {
      id: orgId,
      name: agency.name,
      code: agency.slug.toUpperCase(),
      ssm_no: null, tin_no: null, sst_no: null,
      msic_code: '66221',
      business_desc: 'Activities of insurance agents and brokers',
      contact_person: agency.admin.name,
      email: agency.admin.email,
      phone: null,
      address1: null, address2: null, postcode: null, city: null, state: null,
      country: 'Malaysia',
      kick_start_date: stamp,
      plan_name: null, plan_price: 0, plan_sst_pct: 8,
      policy_quota: 0, storage_gb: 0, named_users: 1,
    },
  ]);

  insertAll(db, 'principal', PRINCIPALS);

  insertAll(db, 'app_user', [
    {
      id: `usr-${agency.slug}-admin`,
      org_id: orgId,
      email: agency.admin.email.toLowerCase(),
      password_hash: hashPasswordSync(agency.admin.password),
      name: agency.admin.name,
      role: 'admin',
      agent_code: null,
      phone: null,
      status: 'active',
    },
  ]);

  /*
   * The reminders an agency would otherwise have to write from scratch on its
   * first day: sixty, thirty, fourteen and seven days out, with the shipped
   * wording. Every one of them is editable, and the first two are the ones a
   * Malaysian motor book actually runs on.
   */
  const reminders: Row[] = [60, 30, 14, 7].map((days, i) => ({
    id: `rs-${agency.slug}-${i + 1}`,
    org_id: orgId,
    days_before: days,
    channel: days === 60 ? 'email' : 'whatsapp',
    name: DEFAULT_TEMPLATES[days].name,
    subject: DEFAULT_TEMPLATES[days].subject,
    template: DEFAULT_TEMPLATES[days].body,
    enabled: 1,
  }));
  insertAll(db, 'renewal_setting', reminders);

  // The rate card, at each insurer's own default, for the agency to correct.
  const rates: Row[] = [];
  for (const pr of PRINCIPALS) {
    rates.push({
      id: `cr-${orgId}-${pr.id}-m`, org_id: orgId, principal_id: pr.id as string,
      class: 'motor', rate: pr.motor_rate as number,
    });
    rates.push({
      id: `cr-${orgId}-${pr.id}-n`, org_id: orgId, principal_id: pr.id as string,
      class: 'non_motor', rate: pr.non_motor_rate as number,
    });
  }
  insertAll(db, 'commission_rate', rates);
}
