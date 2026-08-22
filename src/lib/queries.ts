import { getDb } from './db';
import { today } from './format';

/* ---------------------------------------------------------------- types */

export type Org = {
  id: string; name: string; code: string; ssm_no: string; tin_no: string; sst_no: string;
  msic_code: string; business_desc: string; contact_person: string; email: string; phone: string;
  address1: string; address2: string; postcode: string; city: string; state: string; country: string;
  kick_start_date: string; plan_name: string; plan_price: number; plan_sst_pct: number;
  policy_quota: number; storage_gb: number; named_users: number;
};

export type PolicyRow = {
  id: string; policy_no: string; cover_note_no: string | null; class: string; product: string;
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

export function setCommissionStatus(id: string, status: string) {
  const t = today();
  const db = getDb();
  if (status === 'approved') {
    db.prepare('UPDATE commission SET status = ?, approved_date = ? WHERE id = ?').run(status, t, id);
  } else if (status === 'paid') {
    db.prepare(
      `UPDATE commission SET status = ?, payout_date = ?, approved_date = COALESCE(approved_date, ?) WHERE id = ?`,
    ).run(status, t, t, id);
  } else {
    db.prepare('UPDATE commission SET status = ?, approved_date = NULL, payout_date = NULL WHERE id = ?').run(status, id);
  }
}

export function recordPayment(paymentId: string, amount: number, method: string, reference: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM payment WHERE id = ?').get(paymentId) as
    | { amount: number; paid_amount: number }
    | undefined;
  if (!row) return;
  const paid = Math.min(row.amount, Math.round((row.paid_amount + amount) * 100) / 100);
  const status = paid >= row.amount - 0.005 ? 'paid' : paid > 0 ? 'partial' : 'outstanding';
  db.prepare(
    `UPDATE payment SET paid_amount = ?, status = ?, paid_date = ?, method = ?, reference = ? WHERE id = ?`,
  ).run(paid, status, status === 'paid' ? today() : null, method || null, reference || null, paymentId);
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
