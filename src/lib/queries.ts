import { getDb } from './db';
import { today } from './format';

/* ---------------------------------------------------------------- types */

export type Org = {
  id: string; name: string; code: string; ssm_no: string; tin_no: string; sst_no: string;
  msic_code: string; business_desc: string; contact_person: string; email: string; phone: string;
  address1: string; address2: string; postcode: string; city: string; state: string; country: string;
  kick_start_date: string; plan_name: string; plan_price: number; plan_sst_pct: number;
  policy_quota: number; storage_gb: number; named_users: number;
  logo_url: string; phone2: string; email2: string; website: string; former_name: string;
  bank_name: string; bank_account_name: string; bank_account_number: string;
  remark1: string; remark2: string; loc_prefix: string; pos_prefix: string;
  invoice_template: string;
};

export type PolicyRow = {
  id: string; org_id: string; policy_no: string; cover_note_no: string | null; class: string; product: string;
  type_of_cover: string; status: string; case_type: string; effective_date: string;
  expiry_date: string; issue_date: string; created_date: string; sum_insured: number;
  basic_premium: number; ncd_pct: number; ncd_amount: number; extra_premium: number;
  gross_premium: number; service_tax: number; stamp_duty: number; total_premium: number;
  commission_rate: number; commission_amt: number; excess: number; remarks: string | null;
  client_name: string; client_id: string; principal: string; principal_id: string;
  agent_name: string | null; sub_agent_id: string | null; vehicle_no: string | null;
  make_model: string | null;
};

/* ------------------------------------------------------------ reference */

export function listOrgs(): Org[] {
  return getDb().prepare('SELECT * FROM organisation ORDER BY name').all() as Org[];
}

export function getOrg(id: string): Org | undefined {
  return getDb().prepare('SELECT * FROM organisation WHERE id = ?').get(id) as Org | undefined;
}

export function listPrincipals() {
  return getDb().prepare('SELECT * FROM principal ORDER BY short_name').all() as Array<{
    id: string; name: string; short_name: string; code: string; motor_rate: number;
    non_motor_rate: number; contact_person: string; phone: string; status: string;
  }>;
}

export function listSubAgents(orgId: string) {
  return getDb()
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM policy p WHERE p.sub_agent_id = s.id)          AS policy_count,
              (SELECT COALESCE(SUM(p.total_premium),0) FROM policy p WHERE p.sub_agent_id = s.id) AS premium_total,
              (SELECT COALESCE(SUM(c.net_amount),0) FROM commission c WHERE c.sub_agent_id = s.id) AS commission_total
         FROM sub_agent s WHERE s.org_id = ? ORDER BY s.name`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

export function listAgentOptions(orgId: string) {
  return getDb()
    .prepare('SELECT id, name FROM sub_agent WHERE org_id = ? ORDER BY name')
    .all(orgId) as Array<{ id: string; name: string }>;
}

/* --------------------------------------------------------------- clients */

export function listClients(orgId: string, search = '', type = '') {
  const like = `%${search.toLowerCase()}%`;
  return getDb()
    .prepare(
      `SELECT c.*, g.name AS group_name,
              (SELECT COUNT(*) FROM policy p WHERE p.client_id = c.id) AS policy_count,
              (SELECT COALESCE(SUM(pay.amount - pay.paid_amount),0)
                 FROM payment pay JOIN policy p ON p.id = pay.policy_id
                WHERE p.client_id = c.id AND pay.kind = 'client' AND pay.status != 'paid') AS outstanding
         FROM client c
         LEFT JOIN client_group g ON g.id = c.group_id
        WHERE c.org_id = ?
          AND (? = '' OR lower(c.name) LIKE ? OR lower(COALESCE(c.nric,'')) LIKE ?
               OR lower(COALESCE(c.business_reg,'')) LIKE ? OR lower(COALESCE(c.phone,'')) LIKE ?)
          AND (? = '' OR c.client_type = ?)
        ORDER BY c.name`,
    )
    .all(orgId, search, like, like, like, like, type, type) as Array<Record<string, any>>;
}

export function getClient(id: string) {
  return getDb()
    .prepare(
      `SELECT c.*, g.name AS group_name FROM client c
       LEFT JOIN client_group g ON g.id = c.group_id WHERE c.id = ?`,
    )
    .get(id) as Record<string, any> | undefined;
}

export function listGroups(orgId: string) {
  return getDb()
    .prepare(
      `SELECT g.*,
              (SELECT COUNT(*) FROM client c WHERE c.group_id = g.id) AS member_count,
              (SELECT COUNT(*) FROM policy p JOIN client c ON c.id = p.client_id WHERE c.group_id = g.id) AS policy_count,
              (SELECT COALESCE(SUM(p.total_premium),0) FROM policy p JOIN client c ON c.id = p.client_id WHERE c.group_id = g.id) AS premium_total
         FROM client_group g WHERE g.org_id = ? ORDER BY g.name`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

export function listGroupMembers(orgId: string) {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.client_type, c.group_id, c.phone, c.email
         FROM client c WHERE c.org_id = ? ORDER BY c.name`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

export function listLifePlans(orgId: string) {
  return getDb()
    .prepare(
      `SELECT l.*, c.name AS client_name, c.dob, c.phone
         FROM life_plan l JOIN client c ON c.id = l.client_id
        WHERE l.org_id = ? ORDER BY c.name, l.plan_name`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

/* -------------------------------------------------------------- policies */

const POLICY_SELECT = `
  SELECT p.*, c.name AS client_name, c.id AS client_id, pr.short_name AS principal,
         pr.id AS principal_id, s.name AS agent_name, m.vehicle_no, m.make_model
    FROM policy p
    JOIN client c    ON c.id  = p.client_id
    JOIN principal pr ON pr.id = p.principal_id
    LEFT JOIN sub_agent s ON s.id = p.sub_agent_id
    LEFT JOIN motor_detail m ON m.policy_id = p.id`;

export function listPolicies(
  orgId: string,
  opts: { cls?: string; search?: string; status?: string; principal?: string; agent?: string } = {},
): PolicyRow[] {
  const { cls = '', search = '', status = '', principal = '', agent = '' } = opts;
  const like = `%${search.toLowerCase()}%`;
  return getDb()
    .prepare(
      `${POLICY_SELECT}
        WHERE p.org_id = ?
          AND (? = '' OR p.class = ?)
          AND (? = '' OR p.status = ?)
          AND (? = '' OR p.principal_id = ?)
          AND (? = '' OR p.sub_agent_id = ?)
          AND (? = '' OR lower(p.policy_no) LIKE ? OR lower(c.name) LIKE ?
               OR lower(COALESCE(m.vehicle_no,'')) LIKE ? OR lower(COALESCE(p.cover_note_no,'')) LIKE ?)
        ORDER BY p.created_date DESC, p.policy_no`,
    )
    .all(orgId, cls, cls, status, status, principal, principal, agent, agent, search, like, like, like, like) as PolicyRow[];
}

export function getPolicy(id: string) {
  const db = getDb();
  const policy = db.prepare(`${POLICY_SELECT} WHERE p.id = ?`).get(id) as PolicyRow | undefined;
  if (!policy) return undefined;
  return {
    policy,
    motor: db.prepare('SELECT * FROM motor_detail WHERE policy_id = ?').get(id) as Record<string, any> | undefined,
    nonMotor: db.prepare('SELECT * FROM non_motor_detail WHERE policy_id = ?').get(id) as Record<string, any> | undefined,
    extensions: db.prepare('SELECT * FROM policy_extension WHERE policy_id = ? ORDER BY id').all(id) as Array<Record<string, any>>,
    payments: db.prepare('SELECT * FROM payment WHERE policy_id = ? ORDER BY kind').all(id) as Array<Record<string, any>>,
    commission: db.prepare('SELECT * FROM commission WHERE policy_id = ?').get(id) as Record<string, any> | undefined,
    client: db.prepare('SELECT * FROM client WHERE id = ?').get(policy.client_id) as Record<string, any>,
    principalRow: db.prepare('SELECT * FROM principal WHERE id = ?').get(policy.principal_id) as Record<string, any>,
  };
}

export function listClientPolicies(clientId: string): PolicyRow[] {
  return getDb().prepare(`${POLICY_SELECT} WHERE p.client_id = ? ORDER BY p.created_date DESC`).all(clientId) as PolicyRow[];
}

/* ------------------------------------------------------------- dashboard */

export type Kpis = {
  collection30: number;
  cases30: number;
  premiumYtd: number;
  commissionYtd: number;
};

function agentClause(agentId: string) {
  return agentId ? ' AND p.sub_agent_id = @agent' : '';
}

export function getKpis(orgId: string, agentId = ''): Kpis {
  const db = getDb();
  const t = today();
  const year = t.slice(0, 4);
  const params = { org: orgId, agent: agentId, t, yr: `${year}%` };

  const collection30 = db
    .prepare(
      `SELECT COALESCE(SUM(pay.paid_amount),0) v FROM payment pay JOIN policy p ON p.id = pay.policy_id
        WHERE p.org_id = @org AND pay.kind = 'client' AND pay.status = 'paid'
          AND pay.paid_date > date(@t,'-30 day') AND pay.paid_date <= @t${agentClause(agentId)}`,
    )
    .get(params) as { v: number };

  const cases30 = db
    .prepare(
      `SELECT COUNT(*) v FROM policy p WHERE p.org_id = @org
          AND p.created_date > date(@t,'-30 day') AND p.created_date <= @t${agentClause(agentId)}`,
    )
    .get(params) as { v: number };

  const premiumYtd = db
    .prepare(
      `SELECT COALESCE(SUM(pay.paid_amount),0) v FROM payment pay JOIN policy p ON p.id = pay.policy_id
        WHERE p.org_id = @org AND pay.kind = 'client' AND pay.status = 'paid'
          AND pay.paid_date LIKE @yr${agentClause(agentId)}`,
    )
    .get(params) as { v: number };

  const commissionYtd = db
    .prepare(
      `SELECT COALESCE(SUM(cm.net_amount),0) v FROM commission cm JOIN policy p ON p.id = cm.policy_id
        WHERE p.org_id = @org AND cm.status = 'paid' AND cm.payout_date LIKE @yr${agentClause(agentId)}`,
    )
    .get(params) as { v: number };

  return {
    collection30: collection30.v,
    cases30: cases30.v,
    premiumYtd: premiumYtd.v,
    commissionYtd: commissionYtd.v,
  };
}

export function listOutstanding(orgId: string, kind: 'client' | 'principal', agentId = '', search = '') {
  const like = `%${search.toLowerCase()}%`;
  return getDb()
    .prepare(
      `SELECT p.id, p.policy_no, p.class, c.name AS insured, pr.short_name AS principal,
              pay.amount - pay.paid_amount AS outstanding, pay.due_date,
              CAST(julianday(@t) - julianday(pay.due_date) AS INTEGER) AS days,
              s.name AS agent_name, m.vehicle_no
         FROM payment pay
         JOIN policy p     ON p.id  = pay.policy_id
         JOIN client c     ON c.id  = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN sub_agent s ON s.id = p.sub_agent_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
        WHERE p.org_id = @org AND pay.kind = @kind AND pay.status != 'paid'
          ${agentId ? 'AND p.sub_agent_id = @agent' : ''}
          AND (@q = '' OR lower(p.policy_no) LIKE @like OR lower(c.name) LIKE @like
               OR lower(pr.short_name) LIKE @like OR lower(COALESCE(m.vehicle_no,'')) LIKE @like)
        ORDER BY days DESC, outstanding DESC`,
    )
    .all({ org: orgId, kind, agent: agentId, t: today(), q: search, like }) as Array<Record<string, any>>;
}

export function recentSales(orgId: string, agentId = '', limit = 10) {
  return getDb()
    .prepare(
      `SELECT p.id, p.policy_no, p.class, p.total_premium, p.created_date, p.issue_date,
              pr.short_name AS principal, c.name AS insured
         FROM policy p
         JOIN principal pr ON pr.id = p.principal_id
         JOIN client c     ON c.id  = p.client_id
        WHERE p.org_id = @org ${agentId ? 'AND p.sub_agent_id = @agent' : ''}
        ORDER BY p.created_date DESC, p.issue_date DESC
        LIMIT @lim`,
    )
    .all({ org: orgId, agent: agentId, lim: limit }) as Array<Record<string, any>>;
}

/** Clients whose birthday falls within the next `days` days, handling year wrap. */
export function upcomingBirthdays(orgId: string, days = 30) {
  const rows = getDb()
    .prepare(`SELECT id, name, dob, phone, email FROM client WHERE org_id = ? AND dob IS NOT NULL AND dob != ''`)
    .all(orgId) as Array<{ id: string; name: string; dob: string; phone: string; email: string }>;

  const t = today();
  const start = new Date(`${t}T00:00:00Z`);
  const out: Array<{ id: string; name: string; dob: string; phone: string; in_days: number; turning: number }> = [];

  for (const r of rows) {
    const [by, bm, bd] = r.dob.slice(0, 10).split('-').map(Number);
    for (const yr of [start.getUTCFullYear(), start.getUTCFullYear() + 1]) {
      const next = Date.UTC(yr, bm - 1, bd);
      const diff = Math.round((next - start.getTime()) / 86400000);
      if (diff >= 0 && diff <= days) {
        out.push({ id: r.id, name: r.name, dob: r.dob, phone: r.phone, in_days: diff, turning: yr - by });
        break;
      }
    }
  }
  return out.sort((a, b) => a.in_days - b.in_days);
}

export function unreadNotifications(orgId: string) {
  return getDb()
    .prepare('SELECT COUNT(*) v FROM notification WHERE org_id = ? AND read_flag = 0')
    .get(orgId) as { v: number };
}

export function listNotifications(orgId: string) {
  return getDb()
    .prepare('SELECT * FROM notification WHERE org_id = ? ORDER BY created_at DESC')
    .all(orgId) as Array<Record<string, any>>;
}

/* --------------------------------------------------------------- reports */

export function reportAgentCommission(orgId: string, year: string) {
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.agent_code, s.rank,
              COUNT(p.id) AS cases,
              COALESCE(SUM(p.gross_premium),0) AS gross_premium,
              COALESCE(SUM(cm.gross_amount),0) AS commission,
              COALESCE(SUM(cm.override_amt),0) AS override_amt,
              COALESCE(SUM(cm.net_amount),0)   AS net_amount,
              COALESCE(SUM(CASE WHEN cm.status='paid'     THEN cm.net_amount ELSE 0 END),0) AS paid,
              COALESCE(SUM(CASE WHEN cm.status='approved' THEN cm.net_amount ELSE 0 END),0) AS approved,
              COALESCE(SUM(CASE WHEN cm.status='pending'  THEN cm.net_amount ELSE 0 END),0) AS pending
         FROM sub_agent s
         LEFT JOIN policy p     ON p.sub_agent_id = s.id AND substr(p.created_date,1,4) = @yr
         LEFT JOIN commission cm ON cm.policy_id = p.id
        WHERE s.org_id = @org
        GROUP BY s.id ORDER BY net_amount DESC, s.name`,
    )
    .all({ org: orgId, yr: year }) as Array<Record<string, any>>;
}

export function reportMonthlySales(orgId: string, year: string) {
  const rows = getDb()
    .prepare(
      `SELECT substr(p.created_date,6,2) AS mth, p.class,
              COUNT(*) AS cases, COALESCE(SUM(p.total_premium),0) AS premium,
              COALESCE(SUM(p.commission_amt),0) AS commission
         FROM policy p
        WHERE p.org_id = @org AND substr(p.created_date,1,4) = @yr
        GROUP BY mth, p.class ORDER BY mth`,
    )
    .all({ org: orgId, yr: year }) as Array<Record<string, any>>;

  const months = Array.from({ length: 12 }, (_, i) => ({
    mth: String(i + 1).padStart(2, '0'),
    motorCases: 0, motorPremium: 0, nonMotorCases: 0, nonMotorPremium: 0,
    cases: 0, premium: 0, commission: 0,
  }));
  for (const r of rows) {
    const m = months[Number(r.mth) - 1];
    if (!m) continue;
    if (r.class === 'motor') { m.motorCases = r.cases; m.motorPremium = r.premium; }
    else { m.nonMotorCases = r.cases; m.nonMotorPremium = r.premium; }
    m.cases += r.cases; m.premium += r.premium; m.commission += r.commission;
  }
  return months;
}

export function reportCompanyBreakdown(orgId: string, year: string) {
  return getDb()
    .prepare(
      `SELECT pr.short_name, pr.name,
              COUNT(p.id) AS cases,
              COALESCE(SUM(CASE WHEN p.class='motor'     THEN 1 ELSE 0 END),0) AS motor_cases,
              COALESCE(SUM(CASE WHEN p.class='non_motor' THEN 1 ELSE 0 END),0) AS non_motor_cases,
              COALESCE(SUM(p.gross_premium),0)  AS gross_premium,
              COALESCE(SUM(p.total_premium),0)  AS total_premium,
              COALESCE(SUM(p.commission_amt),0) AS commission
         FROM principal pr
         JOIN policy p ON p.principal_id = pr.id AND p.org_id = @org AND substr(p.created_date,1,4) = @yr
        GROUP BY pr.id ORDER BY total_premium DESC`,
    )
    .all({ org: orgId, yr: year }) as Array<Record<string, any>>;
}

export function reportOutstandingAging(orgId: string) {
  const rows = listOutstanding(orgId, 'client');
  const buckets = [
    { label: 'Current (not yet due)', min: -99999, max: -1, cases: 0, amount: 0 },
    { label: '0 – 30 days',   min: 0,   max: 30,    cases: 0, amount: 0 },
    { label: '31 – 60 days',  min: 31,  max: 60,    cases: 0, amount: 0 },
    { label: '61 – 90 days',  min: 61,  max: 90,    cases: 0, amount: 0 },
    { label: 'Over 90 days',  min: 91,  max: 99999, cases: 0, amount: 0 },
  ];
  for (const r of rows) {
    const b = buckets.find((x) => r.days >= x.min && r.days <= x.max);
    if (b) { b.cases += 1; b.amount += r.outstanding; }
  }
  return { rows, buckets };
}

export function renewalsDue(orgId: string, days = 60) {
  return getDb()
    .prepare(
      `SELECT p.id, p.policy_no, p.class, p.product, p.expiry_date, p.total_premium,
              c.name AS insured, c.phone, c.email, pr.short_name AS principal, m.vehicle_no,
              CAST(julianday(p.expiry_date) - julianday(@t) AS INTEGER) AS days_left
         FROM policy p
         JOIN client c     ON c.id  = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
        WHERE p.org_id = @org AND p.status = 'active'
          AND julianday(p.expiry_date) - julianday(@t) BETWEEN 0 AND @days
        ORDER BY days_left`,
    )
    .all({ org: orgId, t: today(), days }) as Array<Record<string, any>>;
}

/* ------------------------------------------------------------ accounting */

export function listCommissions(orgId: string, status = '') {
  return getDb()
    .prepare(
      `SELECT cm.*, p.policy_no, p.class, p.gross_premium, p.created_date,
              s.name AS agent_name, s.agent_code, s.bank_name, s.bank_account,
              s.einvoice_tin, s.self_billed, c.name AS insured, pr.short_name AS principal
         FROM commission cm
         JOIN policy p     ON p.id = cm.policy_id
         JOIN client c     ON c.id = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN sub_agent s ON s.id = cm.sub_agent_id
        WHERE p.org_id = @org AND (@st = '' OR cm.status = @st)
        ORDER BY CASE cm.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                 p.created_date DESC`,
    )
    .all({ org: orgId, st: status }) as Array<Record<string, any>>;
}

export function commissionTotals(orgId: string) {
  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN cm.status='pending'  THEN cm.net_amount ELSE 0 END),0) AS pending,
              COALESCE(SUM(CASE WHEN cm.status='approved' THEN cm.net_amount ELSE 0 END),0) AS approved,
              COALESCE(SUM(CASE WHEN cm.status='paid'     THEN cm.net_amount ELSE 0 END),0) AS paid
         FROM commission cm JOIN policy p ON p.id = cm.policy_id WHERE p.org_id = ?`,
    )
    .get(orgId) as { pending: number; approved: number; paid: number };
}

/**
 * Commission rows carry no org_id of their own — they hang off a policy — so
 * the organisation has to be reached through the join. Without it the id
 * posted by the form is the only thing deciding which agency's money moves.
 */
export function getCommissionForOrg(id: string, orgId: string) {
  return getDb()
    .prepare(
      `SELECT cm.*, p.policy_no, s.name AS agent_name
         FROM commission cm
         JOIN policy p ON p.id = cm.policy_id
         LEFT JOIN sub_agent s ON s.id = cm.sub_agent_id
        WHERE cm.id = ? AND p.org_id = ?`,
    )
    .get(id, orgId) as
    | { id: string; status: string; net_amount: number; policy_no: string; agent_name: string | null }
    | undefined;
}

export function setCommissionStatus(id: string, status: string, orgId: string): boolean {
  const t = today();
  const db = getDb();
  const scope = "AND policy_id IN (SELECT id FROM policy WHERE org_id = ?)";

  if (status === 'approved') {
    return db
      .prepare(`UPDATE commission SET status = ?, approved_date = ? WHERE id = ? ${scope}`)
      .run(status, t, id, orgId).changes > 0;
  }
  if (status === 'paid') {
    return db
      .prepare(
        `UPDATE commission SET status = ?, payout_date = ?, approved_date = COALESCE(approved_date, ?)
          WHERE id = ? ${scope}`,
      )
      .run(status, t, t, id, orgId).changes > 0;
  }
  return db
    .prepare(`UPDATE commission SET status = ?, approved_date = NULL, payout_date = NULL WHERE id = ? ${scope}`)
    .run(status, id, orgId).changes > 0;
}

/** Payments hang off a policy too, so the same join decides whose money it is. */
export function getPaymentForOrg(paymentId: string, orgId: string) {
  return getDb()
    .prepare(
      `SELECT pm.*, p.policy_no, p.class FROM payment pm
         JOIN policy p ON p.id = pm.policy_id
        WHERE pm.id = ? AND p.org_id = ?`,
    )
    .get(paymentId, orgId) as
    | {
        id: string; kind: string; amount: number; paid_amount: number;
        status: string; policy_no: string; class: string;
      }
    | undefined;
}

export function recordPayment(
  paymentId: string, amount: number, method: string, reference: string, orgId: string,
): { paid: number; status: string } | null {
  const db = getDb();
  const row = getPaymentForOrg(paymentId, orgId);
  if (!row) return null;
  const paid = Math.min(row.amount, Math.round((row.paid_amount + amount) * 100) / 100);
  const status = paid >= row.amount - 0.005 ? 'paid' : paid > 0 ? 'partial' : 'outstanding';
  db.prepare(
    `UPDATE payment SET paid_amount = ?, status = ?, paid_date = ?, method = ?, reference = ? WHERE id = ?`,
  ).run(paid, status, status === 'paid' ? today() : null, method || null, reference || null, paymentId);
  return { paid, status };
}

/* -------------------------------------------------------------- settings */

export function listCommissionRates(orgId: string) {
  return getDb()
    .prepare(
      `SELECT cr.*, pr.short_name, pr.name FROM commission_rate cr
         JOIN principal pr ON pr.id = cr.principal_id
        WHERE cr.org_id = ? ORDER BY pr.short_name, cr.class DESC`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

export function listRenewalSettings(orgId: string) {
  return getDb()
    .prepare('SELECT * FROM renewal_setting WHERE org_id = ? ORDER BY days_before DESC')
    .all(orgId) as Array<Record<string, any>>;
}

export function orgUsage(orgId: string) {
  const db = getDb();
  const t = today();
  const monthPolicies = db
    .prepare(
      `SELECT COUNT(*) v FROM policy WHERE org_id = ? AND substr(created_date,1,7) = substr(?,1,7)`,
    )
    .get(orgId, t) as { v: number };
  const total = db.prepare('SELECT COUNT(*) v FROM policy WHERE org_id = ?').get(orgId) as { v: number };
  const clients = db.prepare('SELECT COUNT(*) v FROM client WHERE org_id = ?').get(orgId) as { v: number };
  const agents = db.prepare('SELECT COUNT(*) v FROM sub_agent WHERE org_id = ?').get(orgId) as { v: number };
  const users = db.prepare('SELECT COUNT(*) v FROM app_user WHERE org_id = ?').get(orgId) as { v: number };
  return {
    monthPolicies: monthPolicies.v, totalPolicies: total.v,
    clients: clients.v, agents: agents.v, users: users.v,
  };
}

/* ------------------------------------------------------- policy write path */

export type PolicyInput = {
  org_id: string;
  client_id: string;
  principal_id: string;
  sub_agent_id: string | null;
  policy_no: string;
  cover_note_no: string | null;
  class: 'motor' | 'non_motor';
  product: string;
  type_of_cover: string;
  status: string;
  case_type: string;
  effective_date: string;
  expiry_date: string;
  issue_date: string;
  sum_insured: number;
  basic_premium: number;
  ncd_pct: number;
  ncd_amount: number;
  extra_premium: number;
  gross_premium: number;
  service_tax: number;
  stamp_duty: number;
  total_premium: number;
  commission_rate: number;
  commission_amt: number;
  agent_commission: number;
  referral_fee: number;
  excess: number;
  remarks: string | null;
  source_file: string | null;
  motor?: {
    vehicle_no: string; make_model: string; body_type: string | null; engine_no: string;
    chassis_no: string; engine_cc: string; year_make: string; seating: number;
    hire_purchase: string | null; windscreen_si: number; named_drivers: string | null;
    extensions: string | null; rtd_code: string | null;
  };
  nonMotor?: {
    risk_type: string; risk_address: string; occupancy: string;
    period_desc: string; benefits: string;
  };
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a policy plus its class detail and the two payment records. */
export function createPolicy(input: PolicyInput, opts: { uploadedAt?: string } = {}): string {
  const db = getDb();
  const id = newId('pol');
  const dueToPrincipal = Math.round((input.total_premium - input.commission_amt) * 100) / 100;
  const created = today();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO policy (
         id, org_id, client_id, principal_id, sub_agent_id, policy_no, cover_note_no,
         class, product, type_of_cover, status, case_type, effective_date, expiry_date,
         issue_date, created_date, sum_insured, basic_premium, ncd_pct, ncd_amount,
         extra_premium, gross_premium, service_tax, stamp_duty, total_premium,
         commission_rate, commission_amt, excess, referral_fee, agent_commission,
         uploaded_at, source_file, remarks
       ) VALUES (
         @id, @org_id, @client_id, @principal_id, @sub_agent_id, @policy_no, @cover_note_no,
         @class, @product, @type_of_cover, @status, @case_type, @effective_date, @expiry_date,
         @issue_date, @created_date, @sum_insured, @basic_premium, @ncd_pct, @ncd_amount,
         @extra_premium, @gross_premium, @service_tax, @stamp_duty, @total_premium,
         @commission_rate, @commission_amt, @excess, @referral_fee, @agent_commission,
         @uploaded_at, @source_file, @remarks
       )`,
    ).run({
      ...input,
      id,
      created_date: created,
      uploaded_at: opts.uploadedAt ?? created,
    });

    if (input.class === 'motor' && input.motor) {
      db.prepare(
        `INSERT INTO motor_detail (policy_id, vehicle_no, make_model, body_type, engine_no,
           chassis_no, engine_cc, year_make, seating, hire_purchase, windscreen_si,
           named_drivers, extensions, rtd_code)
         VALUES (@policy_id, @vehicle_no, @make_model, @body_type, @engine_no, @chassis_no,
           @engine_cc, @year_make, @seating, @hire_purchase, @windscreen_si, @named_drivers,
           @extensions, @rtd_code)`,
      ).run({ policy_id: id, ...input.motor });
    }

    if (input.class === 'non_motor' && input.nonMotor) {
      db.prepare(
        `INSERT INTO non_motor_detail (policy_id, risk_type, risk_address, occupancy, period_desc, benefits)
         VALUES (@policy_id, @risk_type, @risk_address, @occupancy, @period_desc, @benefits)`,
      ).run({ policy_id: id, ...input.nonMotor });
    }

    const payment = db.prepare(
      `INSERT INTO payment (id, policy_id, kind, amount, paid_amount, due_date, paid_date, method, reference, status)
       VALUES (@id, @policy_id, @kind, @amount, 0, @due_date, NULL, NULL, NULL, 'outstanding')`,
    );
    payment.run({ id: `${id}-pay-c`, policy_id: id, kind: 'client', amount: input.total_premium, due_date: input.effective_date });
    payment.run({ id: `${id}-pay-p`, policy_id: id, kind: 'principal', amount: dueToPrincipal, due_date: input.effective_date });

    db.prepare(
      `INSERT INTO commission (id, policy_id, sub_agent_id, gross_amount, override_amt, net_amount, status)
       VALUES (@id, @policy_id, @sub_agent_id, @gross, 0, @gross, 'pending')`,
    ).run({ id: `${id}-comm`, policy_id: id, sub_agent_id: input.sub_agent_id, gross: input.agent_commission });
  });

  tx();
  return id;
}

export function updatePolicy(id: string, orgId: string, input: PolicyInput) {
  const db = getDb();
  const owned = db.prepare('SELECT id FROM policy WHERE id = ? AND org_id = ?').get(id, orgId);
  if (!owned) return false;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE policy SET client_id=@client_id, principal_id=@principal_id, sub_agent_id=@sub_agent_id,
         policy_no=@policy_no, cover_note_no=@cover_note_no, product=@product,
         type_of_cover=@type_of_cover, status=@status, case_type=@case_type,
         effective_date=@effective_date, expiry_date=@expiry_date, issue_date=@issue_date,
         sum_insured=@sum_insured, basic_premium=@basic_premium, ncd_pct=@ncd_pct,
         ncd_amount=@ncd_amount, extra_premium=@extra_premium, gross_premium=@gross_premium,
         service_tax=@service_tax, stamp_duty=@stamp_duty, total_premium=@total_premium,
         commission_rate=@commission_rate, commission_amt=@commission_amt, excess=@excess,
         referral_fee=@referral_fee, agent_commission=@agent_commission, remarks=@remarks
       WHERE id=@id`,
    ).run({ ...input, id });

    if (input.class === 'motor' && input.motor) {
      db.prepare(
        `UPDATE motor_detail SET vehicle_no=@vehicle_no, make_model=@make_model, body_type=@body_type,
           engine_no=@engine_no, chassis_no=@chassis_no, engine_cc=@engine_cc, year_make=@year_make,
           seating=@seating, hire_purchase=@hire_purchase, windscreen_si=@windscreen_si,
           named_drivers=@named_drivers WHERE policy_id=@policy_id`,
      ).run({ policy_id: id, ...input.motor });
    }

    // Keep the client-side amount in step with a corrected premium.
    db.prepare(
      `UPDATE payment SET amount = @amount WHERE policy_id = @id AND kind = 'client' AND status != 'paid'`,
    ).run({ id, amount: input.total_premium });
  });

  tx();
  return true;
}

/**
 * Why a policy cannot be deleted, or null when it can be.
 *
 * Once a client has paid, or the agency has remitted, or commission has moved
 * past pending, the policy is the record of that money. Deleting it destroys
 * the only proof the payment relates to anything, so those policies are
 * cancelled instead — the schedule stays, the status says what happened.
 */
export function policyDeleteBlock(id: string, orgId: string): string | null {
  const db = getDb();
  const policy = db
    .prepare('SELECT id FROM policy WHERE id = ? AND org_id = ?')
    .get(id, orgId) as { id: string } | undefined;
  if (!policy) return 'That policy is not on file.';

  const paid = db
    .prepare("SELECT kind, paid_amount FROM payment WHERE policy_id = ? AND paid_amount > 0")
    .all(id) as Array<{ kind: string; paid_amount: number }>;
  if (paid.length) {
    const legs = paid.map((p) => (p.kind === 'client' ? 'the client has paid' : 'the principal has been remitted'));
    return `Money has moved on this policy — ${[...new Set(legs)].join(' and ')}. Cancel it instead, so the payment record keeps something to point at.`;
  }

  const commission = db
    .prepare("SELECT status FROM commission WHERE policy_id = ? AND status != 'pending'")
    .get(id) as { status: string } | undefined;
  if (commission) {
    return `Commission on this policy is already ${commission.status}. Cancel it instead of deleting it.`;
  }

  return null;
}

/**
 * Removes the policy and everything hanging off it. The schema declares the
 * cascades, but they only fire while `PRAGMA foreign_keys` is on, and an
 * orphaned commission row still counts towards its agent's total on /team —
 * so the children go explicitly rather than on trust.
 */
export function deletePolicy(id: string, orgId: string): boolean {
  if (policyDeleteBlock(id, orgId)) return false;

  const db = getDb();
  let removed = false;
  const tx = db.transaction(() => {
    for (const table of [
      'payment', 'commission', 'motor_detail', 'non_motor_detail',
      'policy_extension', 'policy_document', 'renewal_request',
    ]) {
      db.prepare(`DELETE FROM ${table} WHERE policy_id = ?`).run(id);
    }
    // A quotation outlives the policy it converted into — it keeps its own
    // history, it just no longer points anywhere.
    db.prepare('UPDATE quotation SET policy_id = NULL WHERE policy_id = ?').run(id);
    removed = db.prepare('DELETE FROM policy WHERE id = ? AND org_id = ?').run(id, orgId).changes > 0;
  });
  tx();
  return removed;
}

/** Mark every outstanding payment of a kind as settled, for the given policies. */
export function bulkMarkPaid(policyIds: string[], orgId: string, kind: 'client' | 'principal'): number {
  if (policyIds.length === 0) return 0;
  const db = getDb();
  const placeholders = policyIds.map(() => '?').join(',');
  const info = db
    .prepare(
      `UPDATE payment SET paid_amount = amount, status = 'paid', paid_date = ?
        WHERE kind = ? AND status != 'paid'
          AND policy_id IN (
            SELECT id FROM policy WHERE org_id = ? AND id IN (${placeholders})
          )`,
    )
    .run(today(), kind, orgId, ...policyIds);
  return info.changes;
}

export function recordUpload(row: {
  org_id: string; policy_id: string | null; filename: string; byte_size: number;
  page_count: number; principal_detected: string | null; used_claude: number;
  field_count: number; warnings: string; extracted_json: string; uploaded_by: string;
  storage_key: string | null; content_type: string | null; sha256: string | null;
  kind: string; note: string | null;
}): string {
  const id = newId('doc');
  getDb()
    .prepare(
      `INSERT INTO policy_document (id, org_id, policy_id, filename, byte_size, page_count,
         principal_detected, used_claude, field_count, warnings, extracted_json, uploaded_by,
         uploaded_at, storage_key, content_type, sha256, kind, note)
       VALUES (@id, @org_id, @policy_id, @filename, @byte_size, @page_count, @principal_detected,
         @used_claude, @field_count, @warnings, @extracted_json, @uploaded_by, @uploaded_at,
         @storage_key, @content_type, @sha256, @kind, @note)`,
    )
    .run({ ...row, id, uploaded_at: today() });
  return id;
}

export type DocumentRow = {
  id: string; org_id: string; policy_id: string | null; filename: string;
  byte_size: number; page_count: number; uploaded_by: string | null; uploaded_at: string;
  storage_key: string | null; content_type: string | null; sha256: string | null;
  kind: string | null; note: string | null; used_claude: number;
};

export function getDocument(id: string, orgId: string): DocumentRow | undefined {
  return getDb()
    .prepare('SELECT * FROM policy_document WHERE id = ? AND org_id = ?')
    .get(id, orgId) as DocumentRow | undefined;
}

/** The documents held against one policy, newest first. */
export function listPolicyDocuments(policyId: string, orgId: string) {
  return getDb()
    .prepare(
      `SELECT d.*, u.name AS uploaded_by_name FROM policy_document d
         LEFT JOIN app_user u ON u.id = d.uploaded_by
        WHERE d.policy_id = ? AND d.org_id = ? AND d.storage_key IS NOT NULL
        ORDER BY d.uploaded_at DESC, d.rowid DESC`,
    )
    .all(policyId, orgId) as Array<DocumentRow & { uploaded_by_name: string | null }>;
}

/**
 * A document read out of a PDF starts life with no policy — the policy does
 * not exist until the review is confirmed — so saving the policy is what ties
 * the two together.
 */
export function attachDocumentToPolicy(docId: string, policyId: string, orgId: string): boolean {
  return getDb()
    .prepare('UPDATE policy_document SET policy_id = ? WHERE id = ? AND org_id = ? AND policy_id IS NULL')
    .run(policyId, docId, orgId).changes > 0;
}

/**
 * The same file uploaded twice is a common and expensive mistake — it is how
 * one policy ends up on the register as two. Matching on the content hash
 * catches it even when the file has been renamed.
 */
export function findDocumentByHash(orgId: string, hash: string, excludeId = '') {
  return getDb()
    .prepare(
      `SELECT d.id, d.filename, d.uploaded_at, d.policy_id, p.policy_no
         FROM policy_document d
         LEFT JOIN policy p ON p.id = d.policy_id
        WHERE d.org_id = ? AND d.sha256 = ? AND d.id != ?
        ORDER BY d.uploaded_at LIMIT 1`,
    )
    .get(orgId, hash, excludeId) as
    | { id: string; filename: string; uploaded_at: string; policy_id: string | null; policy_no: string | null }
    | undefined;
}

/** Storage keys for everything held against a policy, so the files can go with it. */
export function policyStorageKeys(policyId: string): string[] {
  return (
    getDb()
      .prepare('SELECT storage_key FROM policy_document WHERE policy_id = ? AND storage_key IS NOT NULL')
      .all(policyId) as Array<{ storage_key: string }>
  ).map((r) => r.storage_key);
}

export function deleteDocumentRow(id: string, orgId: string): DocumentRow | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM policy_document WHERE id = ? AND org_id = ?')
    .get(id, orgId) as DocumentRow | undefined;
  if (!row) return undefined;
  db.prepare('DELETE FROM policy_document WHERE id = ? AND org_id = ?').run(id, orgId);
  return row;
}

export function listUploads(orgId: string, limit = 30) {
  return getDb()
    .prepare(
      `SELECT d.*, p.policy_no FROM policy_document d
       LEFT JOIN policy p ON p.id = d.policy_id
       WHERE d.org_id = ? ORDER BY d.uploaded_at DESC, d.id DESC LIMIT ?`,
    )
    .all(orgId, limit) as Array<Record<string, any>>;
}

/** Find an existing client by name or identification, for upload matching. */
export function findClientByIdentity(orgId: string, name: string | null, nric: string | null) {
  const db = getDb();
  if (nric) {
    const byId = db
      .prepare(
        `SELECT * FROM client WHERE org_id = ?
          AND (replace(COALESCE(nric,''),'-','') = ? OR replace(COALESCE(business_reg,''),'-','') = ?)`,
      )
      .get(orgId, nric.replace(/-/g, ''), nric.replace(/-/g, '')) as Record<string, any> | undefined;
    if (byId) return byId;
  }
  if (name) {
    return db
      .prepare('SELECT * FROM client WHERE org_id = ? AND upper(name) = upper(?)')
      .get(orgId, name.trim()) as Record<string, any> | undefined;
  }
  return undefined;
}

export type ClientInput = {
  name: string;
  client_type: 'individual' | 'company';
  nric: string | null;
  business_reg: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  postcode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dob: string | null;
  occupation: string | null;
  group_id: string | null;
  portal_enabled: number;
};

const CLIENT_COLUMNS = [
  'name', 'client_type', 'nric', 'business_reg', 'email', 'phone', 'address1', 'address2',
  'postcode', 'city', 'state', 'country', 'dob', 'occupation', 'group_id', 'portal_enabled',
] as const;

export function createClient(orgId: string, input: ClientInput): string {
  const id = newId('cl');
  getDb()
    .prepare(
      `INSERT INTO client (id, org_id, created_at, ${CLIENT_COLUMNS.join(', ')})
       VALUES (@id, @org_id, @created_at, ${CLIENT_COLUMNS.map((c) => '@' + c).join(', ')})`,
    )
    .run({ ...input, id, org_id: orgId, created_at: today() });
  return id;
}

export function updateClient(id: string, orgId: string, input: ClientInput): boolean {
  const info = getDb()
    .prepare(
      `UPDATE client SET ${CLIENT_COLUMNS.map((c) => `${c} = @${c}`).join(', ')}
        WHERE id = @id AND org_id = @org_id`,
    )
    .run({ ...input, id, org_id: orgId });
  return info.changes > 0;
}

/**
 * Another client in the same agency already carrying this identification.
 * Two records for one person is how a book quietly goes wrong, so this is
 * checked on the way in rather than cleaned up later.
 */
export function findClientByIdentification(
  orgId: string,
  identification: string,
  excludeId?: string,
): { id: string; name: string } | undefined {
  const bare = identification.replace(/[^A-Za-z0-9]/g, '');
  if (!bare) return undefined;
  return getDb()
    .prepare(
      `SELECT id, name FROM client
        WHERE org_id = ?
          AND (? = '' OR id != ?)
          AND (
            replace(replace(COALESCE(nric,''), '-', ''), ' ', '') = ?
            OR replace(replace(COALESCE(business_reg,''), '-', ''), ' ', '') = ?
          )
        LIMIT 1`,
    )
    .get(orgId, excludeId ?? '', excludeId ?? '', bare, bare) as
    | { id: string; name: string }
    | undefined;
}

/** Policies stop a client being deleted — the history has to go somewhere. */
export function clientPolicyCount(id: string): number {
  const row = getDb().prepare('SELECT COUNT(*) n FROM policy WHERE client_id = ?').get(id) as { n: number };
  return row.n;
}

export function deleteClient(id: string, orgId: string): boolean {
  if (clientPolicyCount(id) > 0) return false;
  const info = getDb().prepare('DELETE FROM client WHERE id = ? AND org_id = ?').run(id, orgId);
  return info.changes > 0;
}

export function listGroupOptions(orgId: string) {
  return getDb()
    .prepare('SELECT id, name FROM client_group WHERE org_id = ? ORDER BY name')
    .all(orgId) as Array<{ id: string; name: string }>;
}

/** Names that look like a company, so an upload can pick the right type. */
const COMPANY_HINT = /\b(SDN|BHD|BERHAD|ENTERPRISE|TRADING|HOLDINGS?|GROUP|LTD|PLT|RESOURCES|SERVICES|VENTURES?)\b/i;

export function looksLikeCompany(name: string): boolean {
  return COMPANY_HINT.test(name);
}

/** Used by the policy upload, which knows only what the document stated. */
export function createClientFromPolicy(
  orgId: string,
  name: string,
  nric: string | null,
  address: string | null,
  occupation: string | null,
): string {
  const isCompany = looksLikeCompany(name);
  return createClient(orgId, {
    name: name.trim(),
    client_type: isCompany ? 'company' : 'individual',
    nric: isCompany ? null : nric,
    business_reg: isCompany ? nric : null,
    email: null,
    phone: null,
    address1: address,
    address2: null,
    postcode: null,
    city: null,
    state: null,
    country: 'MALAYSIA',
    dob: !isCompany && nric ? dobFromNric(nric) : null,
    occupation,
    group_id: null,
    portal_enabled: 0,
  });
}

/**
 * A Malaysian NRIC opens with the date of birth as YYMMDD. Two digits cannot
 * say which century, so a date that would still be in the future belongs to
 * the previous one.
 */
export function dobFromNric(nric: string): string | null {
  const m = nric.replace(/[^0-9]/g, '');
  if (m.length !== 12) return null;

  const yy = Number(m.slice(0, 2));
  const mm = Number(m.slice(2, 4));
  const dd = Number(m.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const iso = (year: number) =>
    `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  const thisCentury = iso(2000 + yy);
  const candidate = thisCentury > today() ? iso(1900 + yy) : thisCentury;

  const d = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== dd) return null;
  return candidate;
}

export function findPolicyByNumber(orgId: string, policyNo: string) {
  return getDb()
    .prepare('SELECT id, policy_no FROM policy WHERE org_id = ? AND upper(policy_no) = upper(?)')
    .get(orgId, policyNo) as { id: string; policy_no: string } | undefined;
}

export function findPrincipalByName(short: string | null) {
  if (!short) return undefined;
  return getDb()
    .prepare('SELECT * FROM principal WHERE upper(short_name) = upper(?) OR upper(name) LIKE upper(?)')
    .get(short, `%${short}%`) as Record<string, any> | undefined;
}

/* ------------------------------------------------ register (screenshot view) */

export type RegisterFilters = {
  cls: string;
  principal?: string;   // principal short name, '' = all
  agent?: string;
  dateField?: 'uploaded_at' | 'issue_date' | 'effective_date';
  from?: string;
  to?: string;
  vehicle?: string;
  insured?: string;
  nric?: string;
  status?: string;
  /** Non-motor class of business tab. */
  cob?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
};

const SORTABLE: Record<string, string> = {
  issue_date: 'p.issue_date',
  policy_no: 'p.policy_no',
  principal: 'pr.short_name',
  vehicle_no: 'm.vehicle_no',
  insured: 'c.name',
  nric: 'ident',
  sum_insured: 'p.sum_insured',
  gross_premium: 'p.gross_premium',
  service_tax: 'p.service_tax',
  stamp_duty: 'p.stamp_duty',
  total_premium: 'p.total_premium',
  referral_fee: 'p.referral_fee',
  commission_amt: 'p.commission_amt',
  agent_commission: 'p.agent_commission',
  consultant_commission: 'p.consultant_commission',
  nett_amount: 'nett_amount',
  principal_nett_amount: 'principal_nett_amount',
  effective_date: 'p.effective_date',
  expiry_date: 'p.expiry_date',
  status: 'p.status',
  uploaded_at: 'uploaded_at',
};

export function listRegister(orgId: string, f: RegisterFilters) {
  const dateCol =
    f.dateField === 'issue_date' ? 'p.issue_date'
    : f.dateField === 'effective_date' ? 'p.effective_date'
    : 'COALESCE(p.uploaded_at, p.created_date)';

  const sortCol = SORTABLE[f.sort ?? ''] ?? 'p.issue_date';
  const dir = f.dir === 'asc' ? 'ASC' : 'DESC';

  const rows = getDb()
    .prepare(
      `SELECT p.id, p.policy_no, p.cover_note_no, p.class, p.product, p.type_of_cover, p.status,
              p.issue_date, p.effective_date, p.expiry_date, p.created_date, p.uploaded_at,
              p.sum_insured, p.gross_premium, p.service_tax, p.stamp_duty, p.total_premium,
              p.commission_amt, p.agent_commission, p.consultant_commission,
              p.referral_fee, p.loc_no, p.source_file,
              -- What the agency keeps once every share is paid away, and what
              -- it owes the principal after retaining its commission.
              ROUND(p.commission_amt - p.agent_commission - p.consultant_commission - p.referral_fee, 2) AS nett_amount,
              ROUND(p.total_premium - p.commission_amt, 2) AS principal_nett_amount,
              c.name AS insured, c.id AS client_id,
              COALESCE(NULLIF(c.nric,''), c.business_reg, '') AS ident,
              pr.short_name AS principal, s.name AS agent_name,
              m.vehicle_no, m.make_model, nm.class_of_business,
              cp.status AS client_paid, pp.status AS principal_paid
         FROM policy p
         JOIN client c     ON c.id  = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN sub_agent s    ON s.id = p.sub_agent_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
         LEFT JOIN non_motor_detail nm ON nm.policy_id = p.id
         LEFT JOIN payment cp ON cp.policy_id = p.id AND cp.kind = 'client'
         LEFT JOIN payment pp ON pp.policy_id = p.id AND pp.kind = 'principal'
        WHERE p.org_id = @org
          AND (@cls = '' OR p.class = @cls)
          AND (@principal = '' OR pr.short_name = @principal)
          AND (@agent = '' OR p.sub_agent_id = @agent)
          AND (@status = '' OR p.status = @status)
          AND (@cob = '' OR nm.class_of_business = @cob)
          AND (@from = '' OR ${dateCol} >= @from)
          AND (@to = '' OR ${dateCol} <= @to)
          AND (@vehicle = '' OR upper(COALESCE(m.vehicle_no,'')) LIKE upper(@vehicleLike))
          AND (@insured = '' OR upper(c.name) LIKE upper(@insuredLike))
          AND (@nric = '' OR replace(COALESCE(c.nric,''),'-','') LIKE replace(@nricLike,'-','')
               OR upper(COALESCE(c.business_reg,'')) LIKE upper(@nricLike))
        ORDER BY ${sortCol} ${dir}, p.policy_no`,
    )
    .all({
      org: orgId,
      cls: f.cls ?? '',
      principal: f.principal ?? '',
      agent: f.agent ?? '',
      status: f.status ?? '',
      cob: f.cob ?? '',
      from: f.from ?? '',
      to: f.to ?? '',
      vehicle: f.vehicle ?? '',
      vehicleLike: `%${f.vehicle ?? ''}%`,
      insured: f.insured ?? '',
      insuredLike: `%${f.insured ?? ''}%`,
      nric: f.nric ?? '',
      nricLike: `%${f.nric ?? ''}%`,
    }) as Array<Record<string, any>>;

  return rows;
}

/** Principals that actually carry business, for the filter chips. */
export function principalChipCounts(orgId: string, cls: string) {
  return getDb()
    .prepare(
      `SELECT pr.short_name, COUNT(p.id) AS n
         FROM principal pr
         LEFT JOIN policy p ON p.principal_id = pr.id AND p.org_id = ? AND (? = '' OR p.class = ?)
        GROUP BY pr.id ORDER BY pr.short_name`,
    )
    .all(orgId, cls, cls) as Array<{ short_name: string; n: number }>;
}


/** Policy counts per non-motor class, for the register tabs. */
export function classOfBusinessCounts(orgId: string) {
  const rows = getDb()
    .prepare(
      `SELECT nm.class_of_business AS cob, COUNT(*) AS n
         FROM policy p JOIN non_motor_detail nm ON nm.policy_id = p.id
        WHERE p.org_id = ? GROUP BY nm.class_of_business`,
    )
    .all(orgId) as Array<{ cob: string; n: number }>;
  return new Map(rows.map((r) => [r.cob, r.n]));
}

/* ------------------------------------------------------------- quotations */

export const QUOTE_TABS = ['draft', 'sent', 'accepted', 'rejected', 'converted'] as const;

export function listQuotations(orgId: string, status = '') {
  return getDb()
    .prepare(
      `SELECT q.*, c.name AS client_name, pr.short_name AS principal
         FROM quotation q
         JOIN client c     ON c.id  = q.client_id
         JOIN principal pr ON pr.id = q.principal_id
        WHERE q.org_id = @org AND (@st = '' OR q.status = @st)
        ORDER BY q.updated_at DESC, q.quote_no`,
    )
    .all({ org: orgId, st: status }) as Array<Record<string, any>>;
}

export function quotationCounts(orgId: string) {
  const rows = getDb()
    .prepare('SELECT status, COUNT(*) n FROM quotation WHERE org_id = ? GROUP BY status')
    .all(orgId) as Array<{ status: string; n: number }>;
  return new Map(rows.map((r) => [r.status, r.n]));
}

/* --------------------------------------------------------------- renewals */

export function listRenewalRequests(orgId: string, tab: 'inbox' | 'expiring' | 'history') {
  const db = getDb();

  if (tab === 'expiring') {
    return renewalsDue(orgId, 60).map((r) => ({
      id: r.id, policy_id: r.id, policy_no: r.policy_no, client_name: r.insured,
      principal: r.principal, requested_at: null, source: 'Expiry watch',
      note: `Expires in ${r.days_left} days`, status: 'expiring', class: r.class,
    }));
  }

  const statuses = tab === 'inbox' ? "('inbox','processing')" : "('completed','rejected')";
  return db
    .prepare(
      `SELECT rr.*, p.policy_no, p.class, c.name AS client_name, pr.short_name AS principal
         FROM renewal_request rr
         JOIN policy p     ON p.id  = rr.policy_id
         JOIN client c     ON c.id  = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
        WHERE rr.org_id = ? AND rr.status IN ${statuses}
        ORDER BY rr.requested_at DESC`,
    )
    .all(orgId) as Array<Record<string, any>>;
}

export function renewalCounts(orgId: string) {
  const db = getDb();
  const inbox = db
    .prepare("SELECT COUNT(*) v FROM renewal_request WHERE org_id = ? AND status IN ('inbox','processing')")
    .get(orgId) as { v: number };
  const history = db
    .prepare("SELECT COUNT(*) v FROM renewal_request WHERE org_id = ? AND status IN ('completed','rejected')")
    .get(orgId) as { v: number };
  return { inbox: inbox.v, expiring: renewalsDue(orgId, 60).length, history: history.v };
}

export function setRenewalStatus(id: string, orgId: string, status: string) {
  getDb()
    .prepare('UPDATE renewal_request SET status = ? WHERE id = ? AND org_id = ?')
    .run(status, id, orgId);
}

export function requestRenewal(orgId: string, policyId: string, source = 'Home') {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM renewal_request WHERE org_id = ? AND policy_id = ? AND status IN ('inbox','processing')")
    .get(orgId, policyId);
  if (existing) return false;
  db.prepare(
    `INSERT INTO renewal_request (id, org_id, policy_id, status, source, requested_at, note)
     VALUES (@id, @org, @policy, 'inbox', @source, @at, NULL)`,
  ).run({ id: `rr-${Date.now().toString(36)}`, org: orgId, policy: policyId, source, at: today() });
  return true;
}

/* ------------------------------------------------- accounting: monthly runs */

export function commissionByAgent(orgId: string) {
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.agent_code, s.einvoice_tin, s.self_billed,
              COUNT(cm.id) AS policies,
              COALESCE(SUM(cm.net_amount),0) AS total_amount,
              COALESCE(SUM(CASE WHEN cm.status='paid'     THEN cm.net_amount ELSE 0 END),0) AS paid,
              COALESCE(SUM(CASE WHEN cm.status='approved' THEN cm.net_amount ELSE 0 END),0) AS scheduled,
              COALESCE(SUM(CASE WHEN cm.status='pending'  THEN cm.net_amount ELSE 0 END),0) AS pending,
              MAX(cm.approved_date) AS last_generated
         FROM sub_agent s
         LEFT JOIN commission cm ON cm.sub_agent_id = s.id
         LEFT JOIN policy p ON p.id = cm.policy_id AND p.org_id = @org
        WHERE s.org_id = @org
        GROUP BY s.id ORDER BY total_amount DESC`,
    )
    .all({ org: orgId }) as Array<Record<string, any>>;
}

export function bulkSetCommissionStatus(orgId: string, from: string, to: string): number {
  const t = today();
  const info = getDb()
    .prepare(
      `UPDATE commission SET status = @to,
              approved_date = CASE WHEN @to IN ('approved','paid') THEN COALESCE(approved_date, @t) ELSE NULL END,
              payout_date   = CASE WHEN @to = 'paid' THEN @t ELSE payout_date END
        WHERE status = @from
          AND policy_id IN (SELECT id FROM policy WHERE org_id = @org)`,
    )
    .run({ org: orgId, from, to, t });
  return info.changes;
}

/* --------------------------------------------- per-user e-Invoice billing */

export function getBillingProfile(userId: string) {
  return getDb()
    .prepare('SELECT * FROM billing_profile WHERE user_id = ?')
    .get(userId) as Record<string, any> | undefined;
}

export function saveBillingProfile(userId: string, fields: Record<string, string>) {
  const db = getDb();
  const cols = [
    'name', 'person_name', 'tin_number', 'brn', 'nric_number', 'state', 'city',
    'postal_code', 'address_line0', 'address_line1', 'address_line2', 'country',
    'email', 'contact', 'sst_registration_number',
  ];
  const row: Record<string, string> = { user_id: userId };
  for (const c of cols) row[c] = fields[c] ?? '';

  const exists = db.prepare('SELECT user_id FROM billing_profile WHERE user_id = ?').get(userId);
  if (exists) {
    db.prepare(
      `UPDATE billing_profile SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE user_id = @user_id`,
    ).run(row);
  } else {
    db.prepare(
      `INSERT INTO billing_profile (user_id, ${cols.join(', ')})
       VALUES (@user_id, ${cols.map((c) => '@' + c).join(', ')})`,
    ).run(row);
  }
}

export function changePassword(userId: string, hash: string) {
  getDb().prepare('UPDATE app_user SET password_hash = ? WHERE id = ?').run(hash, userId);
}

export function getUserPasswordHash(userId: string): string | undefined {
  const row = getDb().prepare('SELECT password_hash FROM app_user WHERE id = ?').get(userId) as
    | { password_hash: string }
    | undefined;
  return row?.password_hash;
}

/* ------------------------------------------------------- home: production */

/** Cases, premium and the full commission split, by month of creation. */
export function productionSummary(orgId: string, year: string, agentId = '') {
  const rows = getDb()
    .prepare(
      `SELECT substr(p.created_date,1,7) AS period, p.class,
              COUNT(*) AS cases,
              COALESCE(SUM(p.gross_premium),0)         AS gross_premium,
              COALESCE(SUM(p.total_premium),0)         AS total_premium,
              COALESCE(SUM(p.commission_amt),0)        AS total_commission,
              COALESCE(SUM(p.agent_commission),0)      AS agent_commission,
              COALESCE(SUM(p.consultant_commission),0) AS consultant_commission
         FROM policy p
        WHERE p.org_id = @org AND substr(p.created_date,1,4) = @yr
          ${agentId ? 'AND p.sub_agent_id = @agent' : ''}
        GROUP BY period, p.class ORDER BY period DESC`,
    )
    .all({ org: orgId, yr: year, agent: agentId }) as Array<Record<string, any>>;

  const byPeriod = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const acc = byPeriod.get(r.period) ?? {
      period: r.period, motorCases: 0, nonMotorCases: 0, motorPremium: 0, nonMotorPremium: 0,
      totalPremium: 0, grossPremium: 0, totalCommission: 0, agentCommission: 0, consultantCommission: 0,
    };
    if (r.class === 'motor') {
      acc.motorCases = (acc.motorCases as number) + r.cases;
      acc.motorPremium = (acc.motorPremium as number) + r.total_premium;
    } else {
      acc.nonMotorCases = (acc.nonMotorCases as number) + r.cases;
      acc.nonMotorPremium = (acc.nonMotorPremium as number) + r.total_premium;
    }
    acc.totalPremium = (acc.totalPremium as number) + r.total_premium;
    acc.grossPremium = (acc.grossPremium as number) + r.gross_premium;
    acc.totalCommission = (acc.totalCommission as number) + r.total_commission;
    acc.agentCommission = (acc.agentCommission as number) + r.agent_commission;
    acc.consultantCommission = (acc.consultantCommission as number) + r.consultant_commission;
    byPeriod.set(r.period, acc);
  }
  return [...byPeriod.values()];
}

/** Motor policies with their statutory compliance dates, for the tracker. */
export function motorCompliance(orgId: string, limit = 12) {
  return getDb()
    .prepare(
      `SELECT p.id, p.class, p.expiry_date, m.vehicle_no, m.make_model, c.name AS insured,
              p.effective_date,
              CAST(julianday(p.expiry_date) - julianday(@t) AS INTEGER) AS days_left
         FROM policy p
         JOIN motor_detail m ON m.policy_id = p.id
         JOIN client c ON c.id = p.client_id
        WHERE p.org_id = @org AND p.status = 'active'
        ORDER BY days_left LIMIT @lim`,
    )
    .all({ org: orgId, t: today(), lim: limit }) as Array<Record<string, any>>;
}

/**
 * Counts shown against the navigation, so a person can see where the work is
 * without opening each screen.
 */
export function navCounts(orgId: string) {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get(orgId) as { v: number }).v;

  return {
    renewals: one(
      "SELECT COUNT(*) v FROM renewal_request WHERE org_id = ? AND status IN ('inbox','processing')",
    ),
    accounts: one(
      `SELECT COUNT(*) v FROM commission cm JOIN policy p ON p.id = cm.policy_id
        WHERE p.org_id = ? AND cm.status = 'pending'`,
    ),
    quotations: one(
      "SELECT COUNT(*) v FROM quotation WHERE org_id = ? AND status IN ('draft','sent')",
    ),
    claims: one(
      "SELECT COUNT(*) v FROM claim WHERE org_id = ? AND status NOT IN ('settled','rejected','withdrawn')",
    ),
    notifications: one('SELECT COUNT(*) v FROM notification WHERE org_id = ? AND read_flag = 0'),
  };
}

/* ------------------------------------------------------------- sub agents */

export type SubAgentInput = {
  name: string;
  email: string | null;
  phone: string | null;
  nric: string | null;
  agent_code: string | null;
  rank: string | null;
  motor_rate: number;
  non_motor_rate: number;
  override_rate: number;
  bank_name: string | null;
  bank_account: string | null;
  einvoice_tin: string | null;
  self_billed: number;
  join_date: string | null;
  status: string;
};

const SUB_AGENT_COLUMNS = [
  'name', 'email', 'phone', 'nric', 'agent_code', 'rank', 'motor_rate', 'non_motor_rate',
  'override_rate', 'bank_name', 'bank_account', 'einvoice_tin', 'self_billed', 'join_date', 'status',
] as const;

export function getSubAgent(id: string) {
  return getDb().prepare('SELECT * FROM sub_agent WHERE id = ?').get(id) as Record<string, any> | undefined;
}

export function createSubAgent(orgId: string, input: SubAgentInput): string {
  const id = newId('sa');
  getDb()
    .prepare(
      `INSERT INTO sub_agent (id, org_id, ${SUB_AGENT_COLUMNS.join(', ')})
       VALUES (@id, @org_id, ${SUB_AGENT_COLUMNS.map((c) => '@' + c).join(', ')})`,
    )
    .run({ ...input, id, org_id: orgId });
  return id;
}

export function updateSubAgent(id: string, orgId: string, input: SubAgentInput): boolean {
  const info = getDb()
    .prepare(
      `UPDATE sub_agent SET ${SUB_AGENT_COLUMNS.map((c) => `${c} = @${c}`).join(', ')}
        WHERE id = @id AND org_id = @org_id`,
    )
    .run({ ...input, id, org_id: orgId });
  return info.changes > 0;
}

export function setSubAgentStatus(id: string, orgId: string, status: string): boolean {
  const info = getDb()
    .prepare('UPDATE sub_agent SET status = ? WHERE id = ? AND org_id = ?')
    .run(status, id, orgId);
  return info.changes > 0;
}

/** An agent code has to be unique within the agency, or payouts get misfiled. */
export function findSubAgentByCode(orgId: string, code: string, excludeId?: string) {
  return getDb()
    .prepare(
      `SELECT id, name FROM sub_agent
        WHERE org_id = ? AND (? = '' OR id != ?) AND upper(COALESCE(agent_code,'')) = upper(?)
        LIMIT 1`,
    )
    .get(orgId, excludeId ?? '', excludeId ?? '', code) as { id: string; name: string } | undefined;
}

export function subAgentPolicyCount(id: string): number {
  const row = getDb().prepare('SELECT COUNT(*) n FROM policy WHERE sub_agent_id = ?').get(id) as { n: number };
  return row.n;
}

export function deleteSubAgent(id: string, orgId: string): boolean {
  if (subAgentPolicyCount(id) > 0) return false;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM commission WHERE sub_agent_id = ?').run(id);
    db.prepare('DELETE FROM sub_agent WHERE id = ? AND org_id = ?').run(id, orgId);
  });
  tx();
  return true;
}

/**
 * The agency is paid a percentage by the insurer and passes part of it on. A
 * rate above what any insurer pays would lose money on every single policy.
 */
export function principalRateCeiling(cls: 'motor' | 'non_motor') {
  const column = cls === 'motor' ? 'motor_rate' : 'non_motor_rate';
  const row = getDb()
    .prepare(`SELECT MIN(${column}) lo, MAX(${column}) hi FROM principal WHERE status = 'active'`)
    .get() as { lo: number | null; hi: number | null };
  return { lo: row.lo ?? 0, hi: row.hi ?? 0 };
}

/* ---------------------------------------------------- organisation edits */

/**
 * Which columns each panel on /organisation owns. The panels overlap — name,
 * phone, email, SSM and SST show on more than one — so each save writes only
 * its own list and a shared field edited in either place lands in the same
 * column. Anything not on a list is never written, so a stray form field
 * cannot reach the table.
 */
export const ORG_FIELDS = {
  profile: [
    'name', 'ssm_no', 'tin_no', 'sst_no', 'msic_code', 'business_desc',
    'contact_person', 'email', 'phone', 'address1', 'address2', 'postcode',
    'city', 'state', 'country',
  ],
  invoice: [
    'name', 'former_name', 'logo_url', 'website', 'phone', 'phone2',
    'email', 'email2', 'ssm_no', 'sst_no',
  ],
  bank: [
    'bank_name', 'bank_account_name', 'bank_account_number', 'remark1',
    'remark2', 'loc_prefix', 'pos_prefix', 'invoice_template',
  ],
} as const;

export type OrgPanel = keyof typeof ORG_FIELDS;

export function updateOrg(orgId: string, panel: OrgPanel, values: Record<string, string>): void {
  const cols = ORG_FIELDS[panel].filter((c) => c in values);
  if (!cols.length) return;
  const set = cols.map((c) => `${c} = @${c}`).join(', ');
  const params: Record<string, string> = { id: orgId };
  for (const c of cols) params[c] = values[c];
  getDb().prepare(`UPDATE organisation SET ${set} WHERE id = @id`).run(params);
}

/* ------------------------------------------------- commission rate edits */

/**
 * The rate the agency earns for one principal and class. The principal's own
 * rate is the ceiling: the agency cannot be paid more than the insurer pays
 * out, so a higher figure here would book commission that never arrives.
 */
export function listCommissionRatesWithCeiling(orgId: string) {
  return getDb()
    .prepare(
      `SELECT cr.id, cr.class, cr.rate, cr.principal_id,
              pr.short_name, pr.name, pr.status,
              CASE cr.class WHEN 'motor' THEN pr.motor_rate ELSE pr.non_motor_rate END AS ceiling
         FROM commission_rate cr
         JOIN principal pr ON pr.id = cr.principal_id
        WHERE cr.org_id = ? ORDER BY pr.short_name, cr.class DESC`,
    )
    .all(orgId) as Array<{
      id: string; class: string; rate: number; principal_id: string;
      short_name: string; name: string; status: string; ceiling: number;
    }>;
}

export function updateCommissionRates(orgId: string, rates: Array<{ id: string; rate: number }>): number {
  const db = getDb();
  const stmt = db.prepare('UPDATE commission_rate SET rate = ? WHERE id = ? AND org_id = ?');
  let changed = 0;
  const tx = db.transaction(() => {
    for (const r of rates) changed += stmt.run(r.rate, r.id, orgId).changes;
  });
  tx();
  return changed;
}

/**
 * Policies already written keep the rate they were written at — the rate
 * table is the default applied when the next policy is created, not a
 * retrospective correction. This counts what would be misread as re-rated so
 * the screen can say so plainly.
 */
export function policiesAtRate(orgId: string, principalId: string, cls: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) n FROM policy WHERE org_id = ? AND principal_id = ? AND class = ?')
    .get(orgId, principalId, cls) as { n: number };
  return row.n;
}

/* ------------------------------------------------------------ audit trail */

export type AuditRow = {
  id: string; at: string; user_id: string | null; user_name: string; user_role: string;
  action: string; entity: string; entity_id: string | null; entity_label: string | null;
  outcome: string; summary: string; changes: string | null; ip: string | null;
};

export type AuditFilter = {
  user?: string;      // user_id, '' = everyone
  entity?: string;    // '' = every kind
  outcome?: string;   // ok | denied | refused
  from?: string;      // yyyy-mm-dd
  to?: string;
  search?: string;
};

export function listAuditEvents(orgId: string, f: AuditFilter = {}, limit = 100, offset = 0) {
  const params = {
    org: orgId,
    user: f.user ?? '',
    entity: f.entity ?? '',
    outcome: f.outcome ?? '',
    // `at` holds a full ISO timestamp, so the upper bound has to cover the
    // whole day rather than stopping at midnight.
    from: f.from ? `${f.from}T00:00:00.000Z` : '',
    to: f.to ? `${f.to}T23:59:59.999Z` : '',
    search: f.search ?? '',
    like: `%${(f.search ?? '').toLowerCase()}%`,
    limit,
    offset,
  };
  const where = `
     WHERE org_id = @org
       AND (@user    = '' OR user_id = @user)
       AND (@entity  = '' OR entity  = @entity)
       AND (@outcome = '' OR outcome = @outcome)
       AND (@from    = '' OR at >= @from)
       AND (@to      = '' OR at <= @to)
       AND (@search  = '' OR lower(summary) LIKE @like OR lower(user_name) LIKE @like
                          OR lower(action) LIKE @like OR lower(COALESCE(entity_label,'')) LIKE @like)`;

  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM audit_event ${where} ORDER BY at DESC, rowid DESC LIMIT @limit OFFSET @offset`)
    .all(params) as AuditRow[];
  const total = (db.prepare(`SELECT COUNT(*) n FROM audit_event ${where}`).get(params) as { n: number }).n;
  return { rows, total };
}

/** The distinct actors and entity kinds actually present, for the filter menus. */
export function auditFacets(orgId: string) {
  const db = getDb();
  return {
    users: db
      .prepare(
        `SELECT user_id AS id, user_name AS name, COUNT(*) n FROM audit_event
          WHERE org_id = ? AND user_id IS NOT NULL AND user_id != ''
          GROUP BY user_id, user_name ORDER BY name`,
      )
      .all(orgId) as Array<{ id: string; name: string; n: number }>,
    entities: db
      .prepare(
        `SELECT entity, COUNT(*) n FROM audit_event WHERE org_id = ? GROUP BY entity ORDER BY entity`,
      )
      .all(orgId) as Array<{ entity: string; n: number }>,
  };
}

/**
 * A document is stored the moment the PDF is read, before the policy it
 * describes exists — the review has to be able to show it. Reviews get
 * abandoned, and without this those files would sit on disk for good:
 * unbounded storage, and somebody's personal data kept with nothing pointing
 * at it. Anything still unattached after a week goes.
 */
export function abandonedUploads(days = 7): Array<{ id: string; storage_key: string }> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  return getDb()
    .prepare(
      `SELECT id, storage_key FROM policy_document
        WHERE policy_id IS NULL AND storage_key IS NOT NULL AND uploaded_at < ?`,
    )
    .all(cutoff) as Array<{ id: string; storage_key: string }>;
}

export function deleteDocumentRows(ids: string[]): number {
  if (!ids.length) return 0;
  const marks = ids.map(() => '?').join(',');
  return getDb().prepare(`DELETE FROM policy_document WHERE id IN (${marks})`).run(...ids).changes;
}

export function setDocumentStorageKey(id: string, orgId: string, key: string): void {
  getDb()
    .prepare('UPDATE policy_document SET storage_key = ? WHERE id = ? AND org_id = ?')
    .run(key, id, orgId);
}

/* ----------------------------------------------------------------- claims */

export type ClaimRow = {
  id: string; org_id: string; policy_id: string; claim_no: string;
  insurer_claim_no: string | null; type: string; status: string; fault: string | null;
  incident_date: string | null; incident_time: string | null; location: string | null;
  description: string | null; driver_name: string | null; driver_nric: string | null;
  driver_licence: string | null; police_report_no: string | null;
  police_report_date: string | null; police_station: string | null;
  workshop: string | null; workshop_panel: number; adjuster: string | null;
  survey_date: string | null; estimate_amount: number; approved_amount: number;
  settled_amount: number; excess_borne: number; affects_ncd: number;
  notified_date: string | null; submitted_date: string | null; settled_date: string | null;
  closed_reason: string | null; remarks: string | null; created_at: string; updated_at: string | null;
};

export type ClaimListRow = ClaimRow & {
  policy_no: string; class: string; vehicle_no: string | null;
  client_name: string; client_id: string; principal: string; ncd_pct: number;
};

export function listClaims(
  orgId: string,
  f: { status?: string; type?: string; search?: string; open?: string } = {},
): ClaimListRow[] {
  const params = {
    org: orgId,
    status: f.status ?? '',
    type: f.type ?? '',
    // Only 'open' and 'closed' filter; anything else — including 'all' — means
    // no filter. Matching on 'all' as a fourth value returned nothing at all.
    open: f.open === 'open' || f.open === 'closed' ? f.open : '',
    search: f.search ?? '',
    like: `%${(f.search ?? '').toLowerCase()}%`,
  };
  return getDb()
    .prepare(
      `SELECT cl.*, p.policy_no, p.class, p.ncd_pct, m.vehicle_no,
              c.name AS client_name, c.id AS client_id, pr.short_name AS principal
         FROM claim cl
         JOIN policy p     ON p.id = cl.policy_id
         JOIN client c     ON c.id = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
        WHERE cl.org_id = @org
          AND (@status = '' OR cl.status = @status)
          AND (@type   = '' OR cl.type   = @type)
          AND (@open   = ''
               OR (@open = 'open'   AND cl.status NOT IN ('settled','rejected','withdrawn'))
               OR (@open = 'closed' AND cl.status IN ('settled','rejected','withdrawn')))
          AND (@search = ''
               OR lower(cl.claim_no) LIKE @like
               OR lower(COALESCE(cl.insurer_claim_no,'')) LIKE @like
               OR lower(p.policy_no) LIKE @like
               OR lower(COALESCE(m.vehicle_no,'')) LIKE @like
               OR lower(c.name) LIKE @like
               OR lower(COALESCE(cl.police_report_no,'')) LIKE @like)
        ORDER BY cl.incident_date DESC, cl.rowid DESC`,
    )
    .all(params) as ClaimListRow[];
}

export function getClaim(id: string, orgId: string) {
  const db = getDb();
  const claim = db
    .prepare(
      `SELECT cl.*, p.policy_no, p.class, p.ncd_pct, p.expiry_date, p.excess AS policy_excess,
              p.gross_premium, p.total_premium,
              m.vehicle_no, m.make_model, m.windscreen_si,
              c.name AS client_name, c.id AS client_id, c.phone AS client_phone,
              pr.short_name AS principal, pr.name AS principal_name
         FROM claim cl
         JOIN policy p     ON p.id = cl.policy_id
         JOIN client c     ON c.id = p.client_id
         JOIN principal pr ON pr.id = p.principal_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
        WHERE cl.id = ? AND cl.org_id = ?`,
    )
    .get(id, orgId) as (ClaimListRow & Record<string, any>) | undefined;
  return claim;
}

export function claimsForPolicy(policyId: string, orgId: string): ClaimRow[] {
  return getDb()
    .prepare('SELECT * FROM claim WHERE policy_id = ? AND org_id = ? ORDER BY incident_date DESC, rowid DESC')
    .all(policyId, orgId) as ClaimRow[];
}

export type ClaimInput = Omit<ClaimRow, 'id' | 'org_id' | 'created_at' | 'updated_at'>;

export function createClaim(orgId: string, input: ClaimInput): string {
  const id = newId('clm');
  getDb()
    .prepare(
      `INSERT INTO claim (id, org_id, policy_id, claim_no, insurer_claim_no, type, status, fault,
         incident_date, incident_time, location, description, driver_name, driver_nric, driver_licence,
         police_report_no, police_report_date, police_station, workshop, workshop_panel, adjuster,
         survey_date, estimate_amount, approved_amount, settled_amount, excess_borne, affects_ncd,
         notified_date, submitted_date, settled_date, closed_reason, remarks, created_at, updated_at)
       VALUES (@id, @org_id, @policy_id, @claim_no, @insurer_claim_no, @type, @status, @fault,
         @incident_date, @incident_time, @location, @description, @driver_name, @driver_nric, @driver_licence,
         @police_report_no, @police_report_date, @police_station, @workshop, @workshop_panel, @adjuster,
         @survey_date, @estimate_amount, @approved_amount, @settled_amount, @excess_borne, @affects_ncd,
         @notified_date, @submitted_date, @settled_date, @closed_reason, @remarks, @created_at, @updated_at)`,
    )
    .run({ ...input, id, org_id: orgId, created_at: today(), updated_at: today() });
  return id;
}

export function updateClaim(id: string, orgId: string, input: ClaimInput): boolean {
  return getDb()
    .prepare(
      `UPDATE claim SET policy_id=@policy_id, claim_no=@claim_no, insurer_claim_no=@insurer_claim_no,
         type=@type, status=@status, fault=@fault, incident_date=@incident_date,
         incident_time=@incident_time, location=@location, description=@description,
         driver_name=@driver_name, driver_nric=@driver_nric, driver_licence=@driver_licence,
         police_report_no=@police_report_no, police_report_date=@police_report_date,
         police_station=@police_station, workshop=@workshop, workshop_panel=@workshop_panel,
         adjuster=@adjuster, survey_date=@survey_date, estimate_amount=@estimate_amount,
         approved_amount=@approved_amount, settled_amount=@settled_amount, excess_borne=@excess_borne,
         affects_ncd=@affects_ncd, notified_date=@notified_date, submitted_date=@submitted_date,
         settled_date=@settled_date, closed_reason=@closed_reason, remarks=@remarks,
         updated_at=@updated_at
       WHERE id=@id AND org_id=@org_id`,
    )
    .run({ ...input, id, org_id: orgId, updated_at: today() }).changes > 0;
}

export function deleteClaim(id: string, orgId: string): ClaimRow | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM claim WHERE id = ? AND org_id = ?').get(id, orgId) as ClaimRow | undefined;
  if (!row) return undefined;
  db.prepare('DELETE FROM claim WHERE id = ? AND org_id = ?').run(id, orgId);
  return row;
}

export function findClaimByNumber(orgId: string, claimNo: string, excludeId = '') {
  return getDb()
    .prepare('SELECT id, claim_no FROM claim WHERE org_id = ? AND upper(claim_no) = upper(?) AND id != ?')
    .get(orgId, claimNo, excludeId) as { id: string; claim_no: string } | undefined;
}

/** The next reference in the agency's own sequence, e.g. CLM-2026-0007. */
export function nextClaimNo(orgId: string): string {
  const year = today().slice(0, 4);
  const row = getDb()
    .prepare("SELECT claim_no FROM claim WHERE org_id = ? AND claim_no LIKE ? ORDER BY claim_no DESC LIMIT 1")
    .get(orgId, `CLM-${year}-%`) as { claim_no: string } | undefined;
  const last = row ? Number(row.claim_no.split('-')[2]) || 0 : 0;
  return `CLM-${year}-${String(last + 1).padStart(4, '0')}`;
}

export function claimCounts(orgId: string) {
  const db = getDb();
  const open = db
    .prepare("SELECT COUNT(*) n FROM claim WHERE org_id = ? AND status NOT IN ('settled','rejected','withdrawn')")
    .get(orgId) as { n: number };
  const awaitingReport = db
    .prepare("SELECT COUNT(*) n FROM claim WHERE org_id = ? AND status = 'documents'")
    .get(orgId) as { n: number };
  const settledValue = db
    .prepare("SELECT COALESCE(SUM(settled_amount),0) v FROM claim WHERE org_id = ? AND status = 'settled'")
    .get(orgId) as { v: number };
  return { open: open.n, awaitingReport: awaitingReport.n, settledValue: settledValue.v };
}

/** Documents filed against a claim rather than a policy. */
export function listClaimDocuments(claimId: string, orgId: string) {
  return getDb()
    .prepare(
      `SELECT d.*, u.name AS uploaded_by_name FROM policy_document d
         LEFT JOIN app_user u ON u.id = d.uploaded_by
        WHERE d.claim_id = ? AND d.org_id = ? AND d.storage_key IS NOT NULL
        ORDER BY d.uploaded_at DESC, d.rowid DESC`,
    )
    .all(claimId, orgId) as Array<DocumentRow & { uploaded_by_name: string | null; claim_id: string }>;
}

export function claimStorageKeys(claimId: string): string[] {
  return (
    getDb()
      .prepare('SELECT storage_key FROM policy_document WHERE claim_id = ? AND storage_key IS NOT NULL')
      .all(claimId) as Array<{ storage_key: string }>
  ).map((r) => r.storage_key);
}

/** Policies a claim can be made against, newest cover first. */
export function claimPolicyOptions(orgId: string) {
  return getDb()
    .prepare(
      `SELECT p.id, p.policy_no, p.effective_date, p.expiry_date, p.ncd_pct,
              c.name AS client_name, m.vehicle_no
         FROM policy p
         JOIN client c ON c.id = p.client_id
         LEFT JOIN motor_detail m ON m.policy_id = p.id
        WHERE p.org_id = ? AND p.status != 'quotation'
        ORDER BY p.effective_date DESC, p.policy_no`,
    )
    .all(orgId) as Array<{
      id: string; policy_no: string; effective_date: string | null; expiry_date: string | null;
      ncd_pct: number; client_name: string; vehicle_no: string | null;
    }>;
}

export function setDocumentClaim(id: string, orgId: string, claimId: string): void {
  getDb()
    .prepare('UPDATE policy_document SET claim_id = ? WHERE id = ? AND org_id = ?')
    .run(claimId, id, orgId);
}
