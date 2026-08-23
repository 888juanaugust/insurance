import type { Database } from 'better-sqlite3';
import { DEFAULT_TEMPLATES } from './messaging';
import { calculateEndorsement } from './endorsements';
import { hashPassword } from './auth';
import { inferClassOfBusiness } from './classes';
import { today } from './format';

type Row = Record<string, string | number | null>;

function insertAll(db: Database, table: string, rows: Row[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const stmt = db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`,
  );
  const tx = db.transaction((batch: Row[]) => {
    for (const r of batch) stmt.run(r);
  });
  tx(rows);
}

/* ------------------------------------------------------------------ *
 * Organisations
 * ------------------------------------------------------------------ */

const ORGS: Row[] = [
  {
    id: 'org-exe',
    name: 'EXE Cheras',
    code: 'EXE-CHERAS',
    ssm_no: '201901004455 (1315678-V)',
    tin_no: 'C25845096070',
    sst_no: 'W10-1808-32000019',
    msic_code: '66221',
    business_desc: 'Activities of insurance agents and brokers',
    contact_person: 'EXE MASTER 3',
    email: 'exemaster3@gmail.com',
    phone: '03-9133 8820',
    address1: 'No 8-2, Jalan Cheras Perdana 3',
    address2: 'Taman Cheras Perdana',
    postcode: '43200',
    city: 'Cheras',
    state: 'Selangor',
    country: 'Malaysia',
    kick_start_date: '2025-01-06',
    plan_name: 'Insurhelp Standard',
    plan_price: 500,
    plan_sst_pct: 8,
    policy_quota: 350,
    storage_gb: 20,
    named_users: 2,
    logo_url: '',
    phone2: '03-9133 8821',
    email2: 'accounts@exeagency.my',
    website: 'www.exeagency.my',
    former_name: '',
    bank_name: 'Maybank Berhad',
    bank_account_name: 'EXE CHERAS AGENCY SDN BHD',
    bank_account_number: '5142 8890 1123',
    remark1: 'Please quote the policy number on every payment.',
    remark2: 'Cover is subject to premium being received within the credit term.',
    loc_prefix: 'LOC',
    pos_prefix: 'POS',
    invoice_template: 'Classic — Policy Summary / Amount Due',
  },
  {
    id: 'org-bs',
    name: 'BS Agency Sdn Bhd',
    code: 'SN50301',
    ssm_no: '200801019945 (823310-K)',
    tin_no: 'C20881137020',
    sst_no: '-',
    msic_code: '66221',
    business_desc: 'Activities of insurance agents',
    contact_person: 'BOON SENG',
    email: 'boonseng_agent@yahoo.com',
    phone: '06-601 3636',
    address1: 'No. 15, Taman Indah Jaya, Batu 5',
    address2: 'Jalan Seremban, Lukut',
    postcode: '71010',
    city: 'Port Dickson',
    state: 'Negeri Sembilan',
    country: 'Malaysia',
    kick_start_date: '2025-06-02',
    plan_name: 'Insurhelp Standard',
    plan_price: 500,
    plan_sst_pct: 8,
    policy_quota: 350,
    storage_gb: 20,
    named_users: 2,
    logo_url: '',
    phone2: '',
    email2: '',
    website: '',
    former_name: '',
    bank_name: 'Maybank Berhad',
    bank_account_name: 'BS AGENCY SDN BHD',
    bank_account_number: '8801 2233 4455',
    remark1: 'Please quote the policy number on every payment.',
    remark2: '',
    loc_prefix: 'LOC',
    pos_prefix: 'POS',
    invoice_template: 'Classic — Policy Summary / Amount Due',
  },
];

/* ------------------------------------------------------------------ *
 * Principals (insurance companies)
 * ------------------------------------------------------------------ */

const PRINCIPALS: Row[] = [
  { id: 'pr-aia',      name: 'AIA Bhd',                                            short_name: 'AIA',                    code: 'AIA-770213',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Distribution', phone: '1300 88 1899', status: 'active' },
  { id: 'pr-aig',      name: 'AIG Malaysia Insurance Berhad',                       short_name: 'AIG',                    code: 'AIG-455012',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Services',     phone: '1800 88 8811', status: 'active' },
  { id: 'pr-allianz',  name: 'Allianz General Insurance Company (Malaysia) Berhad', short_name: 'ALLIANZ',                code: 'SN50301-01',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Operations',   phone: '03-2264 0700', status: 'active' },
  { id: 'pr-sompo',    name: 'Berjaya Sompo Insurance Berhad',                      short_name: 'BERJAYA SOMPO',          code: 'BS-770145',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Channel',      phone: '03-2117 6688', status: 'active' },
  { id: 'pr-chubb',    name: 'Chubb Insurance Malaysia Berhad',                     short_name: 'CHUBB',                  code: 'CHB-220981',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Desk',         phone: '03-2058 3000', status: 'active' },
  { id: 'pr-etiqa',    name: 'Etiqa General Takaful Berhad',                        short_name: 'ETIQA GENERAL TAKAFUL',  code: 'ET-330512',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Support',      phone: '1300 13 8888', status: 'active' },
  { id: 'pr-generali', name: 'Generali Insurance Malaysia Berhad',                  short_name: 'GENERALI',               code: 'GN-660921',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Care',         phone: '03-2170 8282', status: 'active' },
  { id: 'pr-geg',      name: 'Great Eastern General Insurance (Malaysia) Berhad',   short_name: 'GREAT EASTERN GENERAL',  code: 'GEG-118220',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Distribution', phone: '1300 13 0088', status: 'active' },
  { id: 'pr-liberty',  name: 'Liberty General Insurance Berhad',                    short_name: 'LIBERTY',                code: 'A02100-00',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Kurnia Agency Desk',  phone: '1800 88 3833', status: 'active' },
  { id: 'pr-lonpac',   name: 'Lonpac Insurance Bhd',                                short_name: 'LONPAC',                 code: 'N15989SBN-5', motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Support Desk', phone: '03-2262 8688', status: 'active' },
  { id: 'pr-msig',     name: 'MSIG Insurance (Malaysia) Bhd',                       short_name: 'MSIG',                   code: 'MS-4471200',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Broker Services',     phone: '03-2050 8228', status: 'active' },
  { id: 'pr-po',       name: 'Pacific & Orient Insurance Co. Berhad',               short_name: 'P&O',                    code: 'PO-990312',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Channel',      phone: '03-2170 3000', status: 'active' },
  { id: 'pr-pacific',  name: 'The Pacific Insurance Berhad',                        short_name: 'PACIFIC',                code: 'PAC-660120',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Services',     phone: '03-2633 8999', status: 'active' },
  { id: 'pr-progress', name: 'Progressive Insurance Bhd',                           short_name: 'PROGRESSIVE',            code: 'PRG-441002',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Desk',         phone: '03-7876 8888', status: 'active' },
  { id: 'pr-qbe',      name: 'QBE Insurance (Malaysia) Berhad',                     short_name: 'QBE',                    code: 'QBE-118845',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Support',      phone: '03-2117 6000', status: 'active' },
  { id: 'pr-rhb',      name: 'RHB Insurance Berhad',                                short_name: 'RHB',                    code: 'RHB-201338',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Admin',        phone: '03-2180 3000', status: 'active' },
  { id: 'pr-ikhlas',   name: 'Takaful Ikhlas General Berhad',                       short_name: 'TAKAFUL IKHLAS',         code: 'TI-550231',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Distribution', phone: '03-2723 9999', status: 'active' },
  { id: 'pr-tokio',    name: 'Tokio Marine Insurans (Malaysia) Berhad',             short_name: 'TOKIO',                  code: 'TM-882014',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Distribution', phone: '03-2059 6188', status: 'active' },
  { id: 'pr-tune',     name: 'Tune Insurance Malaysia Berhad',                      short_name: 'TUNE',                   code: 'TUN-330984',  motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Care',         phone: '03-2117 5800', status: 'active' },
  { id: 'pr-zurich',   name: 'Zurich General Insurance Malaysia Berhad',            short_name: 'ZURICH',                 code: 'ZR-119803',   motor_rate: 10, non_motor_rate: 25, contact_person: 'Agency Distribution', phone: '1300 88 6222', status: 'active' },
];

/* ------------------------------------------------------------------ *
 * Claims
 *
 * Five against EXE Cheras policies, chosen to show the cases that behave
 * differently rather than five of the same thing: a windscreen claim that
 * keeps the discount, a third-party-at-fault claim that also keeps it, an
 * own-damage claim that does not, one still waiting on the police report,
 * and one the insurer declined.
 * ------------------------------------------------------------------ */

const CLAIMS: Row[] = [
  {
    id: 'clm-2026-0001', org_id: 'org-exe', policy_id: 'pol-j6519648',
    claim_no: 'CLM-2026-0001', insurer_claim_no: 'GEN/MT/26/114820',
    type: 'own_damage', status: 'repairing', fault: 'own',
    incident_date: '2026-06-11', incident_time: '18:40',
    location: 'Jalan Cheras, near the Taman Connaught traffic light',
    description: 'Rear-ended the car in front in slow traffic. Front bumper, bonnet and radiator support damaged. No injuries.',
    driver_name: 'POR CHEE KEONG', driver_nric: '810322-14-5119', driver_licence: 'D 8103221451',
    police_report_no: 'CHERAS/003821/26', police_report_date: '2026-06-11', police_station: 'IPD Cheras',
    workshop: 'Soon Seng Auto Sdn Bhd', workshop_panel: 1,
    adjuster: 'Perunding Adjusters (M) Sdn Bhd', survey_date: '2026-06-14',
    estimate_amount: 8420.00, approved_amount: 7650.00, settled_amount: 0, excess_borne: 400.00,
    affects_ncd: 1,
    notified_date: '2026-06-11', submitted_date: '2026-06-12', settled_date: null,
    closed_reason: null,
    remarks: 'Insured told the 30% NCD resets at renewal. Still chose to claim \u2014 repair is well above the excess.',
    created_at: '2026-06-11', updated_at: '2026-06-16',
  },
  {
    id: 'clm-2026-0002', org_id: 'org-exe', policy_id: 'pol-v7226410',
    claim_no: 'CLM-2026-0002', insurer_claim_no: 'TM/WS/26/88213',
    type: 'windscreen', status: 'settled', fault: null,
    incident_date: '2026-07-02', incident_time: '09:15',
    location: 'KL\u2013Seremban Expressway, KM24 northbound',
    description: 'Stone thrown up by a lorry cracked the windscreen across the driver\u2019s line of sight.',
    driver_name: 'QUAH SIEW LING', driver_nric: '900718-08-5442', driver_licence: 'D 9007180854',
    police_report_no: null, police_report_date: null, police_station: null,
    workshop: 'Autoglass Express Sri Petaling', workshop_panel: 1,
    adjuster: null, survey_date: null,
    estimate_amount: 1350.00, approved_amount: 1350.00, settled_amount: 1350.00, excess_borne: 0,
    affects_ncd: 0,
    notified_date: '2026-07-02', submitted_date: '2026-07-02', settled_date: '2026-07-09',
    closed_reason: null,
    remarks: 'Claimed under the windscreen extension, so the no-claim discount is untouched. No police report needed for glass only.',
    created_at: '2026-07-02', updated_at: '2026-07-09',
  },
  {
    id: 'clm-2026-0003', org_id: 'org-exe', policy_id: 'pol-t6169235',
    claim_no: 'CLM-2026-0003', insurer_claim_no: null,
    type: 'third_party', status: 'documents', fault: 'third_party',
    incident_date: '2026-08-14', incident_time: '07:50',
    location: 'Jalan Ampang, outside the Gleneagles entrance',
    description: 'Hit from the side by a van changing lanes. The van driver admitted fault at the scene and gave his details.',
    driver_name: 'ADAM HAKIMI BIN ROSLI', driver_nric: '950214-10-5533', driver_licence: 'D 9502141055',
    police_report_no: null, police_report_date: null, police_station: null,
    workshop: null, workshop_panel: 1,
    adjuster: null, survey_date: null,
    estimate_amount: 4900.00, approved_amount: 0, settled_amount: 0, excess_borne: 0,
    affects_ncd: 0,
    notified_date: '2026-08-14', submitted_date: null, settled_date: null,
    closed_reason: null,
    remarks: 'Chasing the police report \u2014 the 24-hour window has passed. Recovering from the third party\u2019s insurer, so our NCD is not touched.',
    created_at: '2026-08-14', updated_at: '2026-08-18',
  },
  {
    id: 'clm-2026-0004', org_id: 'org-exe', policy_id: 'pol-vb909032e3',
    claim_no: 'CLM-2026-0004', insurer_claim_no: 'GEN/MT/26/109774',
    type: 'flood', status: 'settled', fault: null,
    incident_date: '2026-04-07', incident_time: '22:30',
    location: 'Basement car park, Pandan Indah',
    description: 'Flash flood after heavy rain. Water reached the sills; engine did not restart.',
    driver_name: 'LOOK MEI YIN', driver_nric: '870909-14-5228', driver_licence: 'D 8709091452',
    police_report_no: 'PANDAN/001129/26', police_report_date: '2026-04-08', police_station: 'IPD Ampang Jaya',
    workshop: 'Kuan Motor Works', workshop_panel: 0,
    adjuster: 'Perunding Adjusters (M) Sdn Bhd', survey_date: '2026-04-11',
    estimate_amount: 12800.00, approved_amount: 11200.00, settled_amount: 11200.00, excess_borne: 500.00,
    affects_ncd: 1,
    notified_date: '2026-04-08', submitted_date: '2026-04-09', settled_date: '2026-05-02',
    closed_reason: null,
    remarks: 'Covered by the special perils extension. Off-panel workshop, so betterment on the replaced parts was charged to the insured.',
    created_at: '2026-04-08', updated_at: '2026-05-02',
  },
  {
    id: 'clm-2026-0005', org_id: 'org-exe', policy_id: 'pol-kg-l0031',
    claim_no: 'CLM-2026-0005', insurer_claim_no: 'BS/MT/26/44120',
    type: 'own_damage', status: 'rejected', fault: 'own',
    incident_date: '2026-05-19', incident_time: '23:05',
    location: 'Jalan Kuching, southbound',
    description: 'Single-vehicle collision with the central divider.',
    driver_name: 'NOT THE NAMED DRIVER', driver_nric: null, driver_licence: null,
    police_report_no: 'SENTUL/000774/26', police_report_date: '2026-05-22', police_station: 'IPD Sentul',
    workshop: null, workshop_panel: 1,
    adjuster: 'Perunding Adjusters (M) Sdn Bhd', survey_date: '2026-05-25',
    estimate_amount: 15600.00, approved_amount: 0, settled_amount: 0, excess_borne: 0,
    affects_ncd: 0,
    notified_date: '2026-05-20', submitted_date: '2026-05-21', settled_date: null,
    closed_reason: 'Declined: the driver was not covered under the policy, and the police report was made three days after the incident.',
    remarks: 'Both grounds were enough on their own. Insured has been advised of the appeal route to the Ombudsman for Financial Services.',
    created_at: '2026-05-20', updated_at: '2026-06-04',
  },
];

/* ------------------------------------------------------------------ *
 * Users and sub agents
 * ------------------------------------------------------------------ */

const USERS = [
  { id: 'usr-exe3',   org_id: 'org-exe', email: 'exemaster3@gmail.com', password: '12345Abcdefg', name: 'EXE MASTER 3',  role: 'admin', agent_code: 'EXE-M3',   phone: '012-576 2417', status: 'active' },
  { id: 'usr-exe1',   org_id: 'org-exe', email: 'exemaster1@gmail.com', password: '12345Abcdefg', name: 'EXE MASTER 1',  role: 'admin', agent_code: 'EXE-M1',   phone: '012-576 2418', status: 'active' },
  { id: 'usr-bs',     org_id: 'org-bs',  email: 'boonseng_agent@yahoo.com', password: '12345Abcdefg', name: 'BOON SENG AGENT', role: 'admin', agent_code: 'A02100-00', phone: '014-994 4313', status: 'active' },
];

const SUB_AGENTS: Row[] = [
  { id: 'sa-exe-01', org_id: 'org-exe', name: 'LIM WEI SHENG',        email: 'weisheng.lim@exeagency.my', phone: '012-338 7761', nric: '890214-14-5533', agent_code: 'EXE-A01', rank: 'Senior Agent',    motor_rate: 8,  non_motor_rate: 18, override_rate: 2, bank_name: 'Maybank Berhad',   bank_account: '5644 7712 0091', einvoice_tin: 'IG18455211070', self_billed: 1, join_date: '2023-03-14', status: 'active' },
  { id: 'sa-exe-02', org_id: 'org-exe', name: 'NURUL AIN BINTI AZMI', email: 'nurul.ain@exeagency.my',    phone: '013-772 4410', nric: '920907-10-6642', agent_code: 'EXE-A02', rank: 'Agent',           motor_rate: 7,  non_motor_rate: 15, override_rate: 0, bank_name: 'CIMB Bank Berhad', bank_account: '8007 3321 4456', einvoice_tin: 'IG20114788010', self_billed: 1, join_date: '2024-01-08', status: 'active' },
  { id: 'sa-exe-03', org_id: 'org-exe', name: 'ARUL SELVAM A/L RAJAN',email: 'arul.selvam@exeagency.my',  phone: '016-220 9987', nric: '860519-08-5271', agent_code: 'EXE-A03', rank: 'Agent',           motor_rate: 7,  non_motor_rate: 15, override_rate: 0, bank_name: 'Public Bank',      bank_account: '3199 0084 5522', einvoice_tin: 'IG19338004120', self_billed: 0, join_date: '2024-07-22', status: 'active' },
  { id: 'sa-exe-04', org_id: 'org-exe', name: 'TAN CHIN HOCK',        email: 'chinhock.tan@exeagency.my', phone: '017-661 2038', nric: '780412-06-5019', agent_code: 'EXE-A04', rank: 'Unit Manager',    motor_rate: 9,  non_motor_rate: 20, override_rate: 3, bank_name: 'Hong Leong Bank', bank_account: '2210 5567 8890', einvoice_tin: 'IG17552090330', self_billed: 1, join_date: '2022-11-02', status: 'active' },
  { id: 'sa-exe-05', org_id: 'org-exe', name: 'SITI ZAHARAH BINTI IDRIS', email: 'siti.zaharah@exeagency.my', phone: '011-2288 4471', nric: '950122-03-5588', agent_code: 'EXE-A05', rank: 'Agent',   motor_rate: 6,  non_motor_rate: 14, override_rate: 0, bank_name: 'Bank Islam',       bank_account: '1204 9987 0031', einvoice_tin: 'IG21009855440', self_billed: 0, join_date: '2025-02-17', status: 'inactive' },
  { id: 'sa-bs-01',  org_id: 'org-bs',  name: 'MADAM SIM',            email: 'madamsim@bsagency.my',      phone: '014-994 4313', nric: '751130-05-5442', agent_code: 'A02100-01', rank: 'Senior Agent',  motor_rate: 8,  non_motor_rate: 18, override_rate: 2, bank_name: 'Maybank Berhad',   bank_account: '8801 2233 4455', einvoice_tin: 'IG16220447080', self_billed: 1, join_date: '2021-05-03', status: 'active' },
];

/* ------------------------------------------------------------------ *
 * Client groups + clients
 * ------------------------------------------------------------------ */

const GROUPS: Row[] = [
  { id: 'grp-okbb',    org_id: 'org-exe', name: 'OKBB Group of Companies', description: 'Fleet and commercial lines for OKBB subsidiaries', pic_name: 'Ms. Ooi Kim Bee',   pic_phone: '012-330 4477' },
  { id: 'grp-moomoo',  org_id: 'org-exe', name: 'Moomoo Holdings',         description: 'Security services group — fleet, PA and fire',    pic_name: 'Mr. Danny Foong',   pic_phone: '019-887 2210' },
  { id: 'grp-tanfam',  org_id: 'org-exe', name: 'Tan Family Account',      description: 'Household motor and personal lines',              pic_name: 'Mr. Adam Tan',      pic_phone: '012-990 1188' },
  { id: 'grp-sunrise', org_id: 'org-exe', name: 'Sunrise Hardware Chain',  description: 'Retail outlets — fire, burglary and PA',          pic_name: 'Mr. Lau Kok Wai',   pic_phone: '016-442 3390' },
];

type ClientSeed = {
  id: string; org: string; group?: string; name: string; type: 'individual' | 'company';
  nric?: string; reg?: string; email: string; phone: string;
  a1: string; a2?: string; post: string; city: string; state: string;
  dob?: string; occ?: string; portal?: number; created: string;
};

const CLIENTS: ClientSeed[] = [
  { id: 'cl-por',      org: 'org-exe', name: 'POR POR POR',            type: 'individual', nric: '770318-14-5129', email: 'por.porpor@gmail.com',      phone: '012-334 8891', a1: 'No 21, Jalan Cheras Utama 2',     a2: 'Taman Cheras Utama',   post: '43200', city: 'Cheras',       state: 'Selangor',        dob: '1977-03-18', occ: 'Contractor',        portal: 1, created: '2026-01-12' },
  { id: 'cl-quah',     org: 'org-exe', name: 'QUAH KEE POON',          type: 'individual', nric: '820711-08-5533', email: 'quahkp@gmail.com',          phone: '016-227 5540', a1: 'No 8, Lorong Bukit Serdang 4',   a2: 'Seri Kembangan',       post: '43300', city: 'Seri Kembangan', state: 'Selangor',       dob: '1982-07-11', occ: 'Engineer',          portal: 1, created: '2026-06-08' },
  { id: 'cl-quote',    org: 'org-exe', name: 'Quotation Insured Party',type: 'individual', nric: '-',              email: 'pending@exeagency.my',      phone: '-',            a1: 'Pending KYC submission',          post: '-',     city: '-',            state: '-',               occ: 'Pending',           portal: 0, created: '2026-02-04' },
  { id: 'cl-adam',     org: 'org-exe', group: 'grp-tanfam', name: 'ADAM TAN', type: 'individual', nric: '900425-10-5877', email: 'adam.tan@gmail.com', phone: '012-990 1188', a1: 'No 33, Jalan SS2/24',            a2: 'Petaling Jaya',        post: '47300', city: 'Petaling Jaya', state: 'Selangor',       dob: '1990-04-25', occ: 'Business Owner',    portal: 1, created: '2026-05-26' },
  { id: 'cl-look',     org: 'org-exe', name: 'LOOK CHUN CHUN',         type: 'individual', nric: '751208-05-5261', email: 'lookcc@yahoo.com',          phone: '019-334 7712', a1: 'No 12, Jalan Bukit Indah 5',     a2: 'Taman Bukit Indah',    post: '43000', city: 'Kajang',       state: 'Selangor',        dob: '1975-12-08', occ: 'Teacher',           portal: 0, created: '2026-02-28' },
  { id: 'cl-moomoo',   org: 'org-exe', group: 'grp-moomoo', name: 'MOOMOO SECURITY SDN BHD', type: 'company', reg: '201501022114 (1145223-A)', email: 'admin@moomoosecurity.com.my', phone: '03-9054 7712', a1: 'Lot 5-3, Jalan Perindustrian Balakong 8', a2: 'Balakong Jaya', post: '43300', city: 'Seri Kembangan', state: 'Selangor', occ: 'Security services', portal: 1, created: '2026-03-16' },
  { id: 'cl-wong',     org: 'org-exe', name: 'WONG CHI LEI',           type: 'individual', nric: '880902-14-5019', email: 'wongchilei@gmail.com',      phone: '017-228 9931', a1: 'No 45, Jalan Desa Aman 3',       a2: 'Cheras',               post: '56100', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', dob: '1988-10-02', occ: 'Accountant',    portal: 1, created: '2026-08-18' },
  { id: 'cl-limkok',   org: 'org-exe', name: 'LIM KOK YONG',           type: 'individual', nric: '791105-07-5443', email: 'limky79@gmail.com',         phone: '012-448 2277', a1: 'No 2, Jalan Sungai Long 12',     a2: 'Bandar Sungai Long',   post: '43000', city: 'Kajang',       state: 'Selangor',        dob: '1979-11-05', occ: 'Sales Manager',     portal: 0, created: '2026-08-12' },
  { id: 'cl-leong',    org: 'org-exe', name: 'LEONG SEONG KING',       type: 'individual', nric: '681220-08-5177', email: 'leongsk@gmail.com',         phone: '016-889 3320', a1: 'No 77, Jalan Bandar Tasik Selatan 4', a2: 'Bandar Tasik Selatan', post: '57000', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', dob: '1968-12-20', occ: 'Retired',    portal: 0, created: '2026-07-29' },
  { id: 'cl-thin',     org: 'org-exe', name: 'THIN KIM YUEN',          type: 'individual', nric: '830614-06-5288', email: 'thinky@gmail.com',          phone: '013-220 5567', a1: 'No 19, Jalan Bukit Anggerik 9',  a2: 'Taman Bukit Anggerik', post: '56000', city: 'Cheras',       state: 'Wilayah Persekutuan', dob: '1983-06-14', occ: 'Nurse',      portal: 1, created: '2026-07-15' },
  { id: 'cl-ching',    org: 'org-exe', name: 'CHING BOON PING',        type: 'individual', nric: '910328-04-5615', email: 'chingbp@gmail.com',         phone: '011-3388 7742', a1: 'No 6, Jalan Perdana 7/12',      a2: 'Taman Perdana',        post: '43200', city: 'Cheras',       state: 'Selangor',        dob: '1991-03-28', occ: 'IT Executive',      portal: 1, created: '2026-07-02' },
  { id: 'cl-limlay',   org: 'org-exe', name: 'LIM LAY GNOH',           type: 'individual', nric: '660419-10-5324', email: 'limlg66@gmail.com',         phone: '012-770 4418', a1: 'No 15A, Jalan Puchong Permai 2', a2: 'Puchong',              post: '47100', city: 'Puchong',      state: 'Selangor',        dob: '1966-04-19', occ: 'Housewife',         portal: 0, created: '2026-06-19' },
  { id: 'cl-tey',      org: 'org-exe', name: 'TEY SIONG CHUAN',        type: 'individual', nric: '870730-05-5197', email: 'teysc@gmail.com',           phone: '019-224 6680', a1: 'No 88, Jalan Semenyih Indah 3',  a2: 'Semenyih',             post: '43500', city: 'Semenyih',     state: 'Selangor',        dob: '1987-07-30', occ: 'Lorry Operator',    portal: 0, created: '2026-05-12' },
  { id: 'cl-okbb',     org: 'org-exe', group: 'grp-okbb', name: 'OKBB SDN BHD', type: 'company', reg: '201201009982 (984411-M)', email: 'finance@okbb.com.my', phone: '03-8961 2200', a1: 'No 3, Jalan Teknologi 3/5', a2: 'Taman Sains Selangor', post: '81100', city: 'Kota Damansara', state: 'Selangor', occ: 'Food manufacturing', portal: 1, created: '2026-04-28' },
  { id: 'cl-cheah',    org: 'org-exe', name: 'CHEAH BOON HOCK',        type: 'individual', nric: '740215-07-5081', email: 'cheahbh@gmail.com',         phone: '012-556 8890', a1: 'No 27, Jalan Bukit Jalil 2',     a2: 'Bukit Jalil',          post: '57000', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', dob: '1974-02-15', occ: 'Chef',       portal: 0, created: '2026-04-04' },
  { id: 'cl-ngsiew',   org: 'org-exe', name: 'NG SIEW LAN',            type: 'individual', nric: '810523-14-5662', email: 'ngsl81@gmail.com',          phone: '016-334 2219', a1: 'No 9, Jalan Serdang Raya 4',     a2: 'Seri Kembangan',       post: '43300', city: 'Seri Kembangan', state: 'Selangor',      dob: '1981-05-23', occ: 'Clerk',             portal: 1, created: '2026-04-14' },
  { id: 'cl-simch',    org: 'org-exe', name: 'SIM CHOON HUAT',         type: 'individual', nric: '691107-08-5013', email: 'simch69@gmail.com',         phone: '013-889 0021', a1: 'No 41, Jalan Ampang Hilir 6',    a2: 'Ampang',               post: '55000', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', dob: '1969-11-07', occ: 'Trader',     portal: 0, created: '2026-04-21' },
  { id: 'cl-tanmei',   org: 'org-exe', group: 'grp-tanfam', name: 'TAN MEI LING', type: 'individual', nric: '850128-10-5748', email: 'tanml85@gmail.com', phone: '012-118 7745', a1: 'No 33, Jalan SS2/24', a2: 'Petaling Jaya', post: '47300', city: 'Petaling Jaya', state: 'Selangor', dob: '1985-01-28', occ: 'Pharmacist', portal: 1, created: '2025-12-30' },
  { id: 'cl-faizal',   org: 'org-exe', name: 'MOHD FAIZAL BIN OSMAN',  type: 'individual', nric: '840917-03-5321', email: 'faizal.osman@gmail.com',    phone: '019-660 3311', a1: 'No 14, Jalan Setia Alam U13/2',  a2: 'Setia Alam',           post: '40170', city: 'Shah Alam',    state: 'Selangor',        dob: '1984-09-30', occ: 'Technician',        portal: 0, created: '2026-01-24' },
  { id: 'cl-chong',    org: 'org-exe', name: 'CHONG WAI KEONG',        type: 'individual', nric: '930211-05-5460', email: 'chongwk@gmail.com',         phone: '017-880 4425', a1: 'No 52, Jalan Kajang Perdana 8',  a2: 'Kajang',               post: '43000', city: 'Kajang',       state: 'Selangor',        dob: '1993-02-11', occ: 'Designer',          portal: 1, created: '2026-03-02' },
  { id: 'cl-sunrise',  org: 'org-exe', group: 'grp-sunrise', name: 'SUNRISE HARDWARE SDN BHD', type: 'company', reg: '199801007733 (462119-D)', email: 'accounts@sunrisehw.com.my', phone: '03-9200 4471', a1: 'No 1 & 3, Jalan Perdagangan 5', a2: 'Taman Universiti', post: '43650', city: 'Bandar Baru Bangi', state: 'Selangor', occ: 'Hardware retail', portal: 1, created: '2026-04-08' },
  { id: 'cl-rajesh',   org: 'org-exe', name: 'RAJESH A/L MUNIANDY',    type: 'individual', nric: '800605-10-5559', email: 'rajesh.m@gmail.com',        phone: '012-441 9987', a1: 'No 7, Jalan Sri Petaling 12',    a2: 'Sri Petaling',         post: '57000', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', dob: '1980-06-05', occ: 'Lorry Driver', portal: 0, created: '2026-04-16' },
  { id: 'cl-leepoh',   org: 'org-exe', name: 'LEE POH CHOO',           type: 'individual', nric: '720729-14-5286', email: 'leepc72@gmail.com',         phone: '016-772 3348', a1: 'No 62, Jalan Taman Midah 3',     a2: 'Taman Midah',          post: '56000', city: 'Cheras',       state: 'Wilayah Persekutuan', dob: '1972-07-29', occ: 'Tailor',     portal: 0, created: '2026-04-22' },
  { id: 'cl-kamarudin',org: 'org-exe', name: 'KAMARUDIN BIN HASSAN',   type: 'individual', nric: '760310-06-5117', email: 'kamarudin.h@gmail.com',     phone: '013-447 2260', a1: 'No 25, Jalan Bangi Perdana 4',   a2: 'Bandar Baru Bangi',    post: '43650', city: 'Bandar Baru Bangi', state: 'Selangor',   dob: '1976-03-10', occ: 'Supervisor',        portal: 0, created: '2026-04-25' },
  { id: 'cl-gohswee',  org: 'org-exe', name: 'GOH SWEE LAN',           type: 'individual', nric: '890416-07-5904', email: 'gohsl89@gmail.com',         phone: '011-2244 8870', a1: 'No 18, Jalan Cheras Idaman 2',  a2: 'Cheras',               post: '43200', city: 'Cheras',       state: 'Selangor',        dob: '1989-04-16', occ: 'Insurance Executive', portal: 1, created: '2026-04-27' },

  { id: 'cl-bolton',   org: 'org-bs', name: 'BOLTON VISIONCARE SDN BHD', type: 'company', reg: '614614-H', email: 'admin@boltonvisioncare.com.my', phone: '03-9058 2211', a1: 'No 35 Jalan 8/146', a2: 'Bandar Tasik Selatan', post: '57000', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', occ: 'Optical retail', portal: 1, created: '2025-06-20' },
  { id: 'cl-surendran',org: 'org-bs', name: 'SURENDRAN A/L TANCHONTUAN', type: 'individual', nric: '841011-04-5105', email: 'surendran.t@gmail.com', phone: '012-663 8890', a1: '12 PT 23 Jalan Batu 8, Taman Baru', a2: 'Kemang Si Rusa', post: '71250', city: 'Port Dickson', state: 'Negeri Sembilan', dob: '1984-10-11', occ: 'Businessman', portal: 1, created: '2025-06-12' },
  { id: 'cl-hoo',      org: 'org-bs', name: 'HOO XING YU', type: 'individual', nric: '980413-59-5062', email: 'hooxy98@gmail.com', phone: '016-662 2230', a1: 'No 30 Jalan Bukit Chemara', a2: 'Bukit Chemara', post: '70200', city: 'Seremban', state: 'Negeri Sembilan', dob: '1998-04-13', occ: 'Others', portal: 0, created: '2025-09-09' },
  { id: 'cl-limhong',  org: 'org-bs', name: 'LIM HONG NGOR', type: 'individual', nric: '650616-05-5056', email: 'limhn65@gmail.com', phone: '012-338 7790', a1: 'Lot 2638/1A Kg Sri Parit', a2: 'Lukut', post: '71960', city: 'Port Dickson', state: 'Negeri Sembilan', dob: '1965-06-16', occ: 'Retired', portal: 0, created: '2025-09-19' },
];

/* ------------------------------------------------------------------ *
 * Policies
 * ------------------------------------------------------------------ */

/** Split a gross-inclusive total into premium / 8% service tax / stamp duty. */
function fromTotal(total: number, stamp = 10) {
  const gross = Math.round(((total - stamp) / 1.08) * 100) / 100;
  const tax = Math.round((total - stamp - gross) * 100) / 100;
  return { gross, tax, stamp, total };
}

type Ext = { name: string; si?: number; premium: number };

type PolicySeed = {
  id: string; org: string; client: string; principal: string; agent?: string;
  policyNo: string; coverNote?: string;
  cls: 'motor' | 'non_motor'; product: string; cover: string;
  status: 'active' | 'quotation' | 'expired' | 'cancelled';
  caseType: 'new' | 'renewal';
  created: string; effective: string; expiry: string; issue: string;
  sumInsured: number;
  /** Either an explicit breakdown, or a total the breakdown is derived from. */
  total?: number;
  basic?: number; ncdPct?: number; ncdAmt?: number; extra?: number;
  gross?: number; tax?: number; stamp?: number;
  excess?: number;
  ncd?: number;
  referralFee?: number;
  consultantCommission?: number;
  sourceFile?: string;
  motor?: {
    vehicleNo: string; makeModel: string; bodyType?: string; engineNo: string; chassisNo: string;
    cc: string; year: string; seating: number; hp?: string; windscreen?: number;
    drivers?: string; extensions?: string; rtd?: string;
  };
  nonMotor?: { riskType: string; riskAddress: string; occupancy: string; periodDesc: string; benefits: string; classOfBusiness?: string };
  exts?: Ext[];
  /** Client-side settlement */
  clientDue: string; clientPaid?: string; clientMethod?: string; clientRef?: string;
  /** Agency -> principal settlement */
  principalDue: string; principalPaid?: string;
  remarks?: string;
};

const POLICIES: PolicySeed[] = [
  /* --- EXE Cheras: outstanding client premium (17) --------------------- */
  { id: 'pol-j6519648', org: 'org-exe', client: 'cl-por', principal: 'pr-generali', agent: 'sa-exe-01',
    policyNo: 'J6519648', coverNote: 'CN-J6519648', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-01-15', effective: '2026-01-20', expiry: '2027-01-19', issue: '2026-01-15',
    sumInsured: 62000, total: 1845.20, ncd: 30, excess: 400,
    motor: { vehicleNo: 'JLB 5521', makeModel: 'TOYOTA HILUX 2.4G', bodyType: '4D PICKUP', engineNo: '2GD1188432', chassisNo: 'MR0FZ29G1L0552118', cc: '2393', year: '2020', seating: 5, hp: 'PUBLIC BANK BERHAD', windscreen: 2000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    exts: [{ name: 'Windscreen Damage', si: 2000, premium: 300 }, { name: 'Strike, Riot & Civil Commotion', premium: 186 }],
    clientDue: '2026-02-14', principalDue: '2026-02-20', remarks: 'Client requested staggered settlement.' },

  { id: 'pol-v7226410', org: 'org-exe', client: 'cl-quah', principal: 'pr-tokio', agent: 'sa-exe-02',
    policyNo: 'V7226410', coverNote: 'CN-V7226410', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-06-10', effective: '2026-06-15', expiry: '2027-06-14', issue: '2026-06-10',
    sumInsured: 48000, total: 1320.55, ncd: 55, excess: 0,
    motor: { vehicleNo: 'VDS 7712', makeModel: 'HONDA CITY 1.5E', bodyType: '4D SEDAN', engineNo: 'L15Z11002233', chassisNo: 'PADGM6670KV110223', cc: '1497', year: '2019', seating: 5, hp: 'NONE', windscreen: 1500, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    exts: [{ name: 'Windscreen Damage', si: 1500, premium: 225 }],
    clientDue: '2026-06-25', principalDue: '2026-07-05' },

  { id: 'pol-pp717086', org: 'org-exe', client: 'cl-quote', principal: 'pr-allianz', agent: 'sa-exe-01',
    policyNo: 'PP717086', coverNote: 'QT-PP717086', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'quotation', caseType: 'new', created: '2026-02-06', effective: '2026-07-01', expiry: '2027-06-30', issue: '2026-02-06',
    sumInsured: 35000, total: 988.40, ncd: 25, excess: 400,
    motor: { vehicleNo: 'PPQ 7086', makeModel: 'PERODUA MYVI 1.5 AV', bodyType: '5D HATCHBACK', engineNo: '2NR3390021', chassisNo: 'PM2M900S1J1002233', cc: '1496', year: '2018', seating: 5, hp: 'NONE', windscreen: 1000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-07-01', principalDue: '2026-07-10', remarks: 'Quotation issued — pending client confirmation and KYC.' },

  { id: 'pol-t6169235', org: 'org-exe', client: 'cl-adam', principal: 'pr-generali', agent: 'sa-exe-04',
    policyNo: 'T6169235', coverNote: 'CN-T6169235', cls: 'non_motor', product: 'Houseowner', cover: 'Fire & Allied Perils',
    status: 'active', caseType: 'renewal', created: '2026-05-28', effective: '2026-06-05', expiry: '2027-06-04', issue: '2026-05-28',
    sumInsured: 480000, total: 742.00, excess: 0,
    nonMotor: { riskType: 'Houseowner / Householder', riskAddress: 'No 33, Jalan SS2/24, 47300 Petaling Jaya, Selangor', occupancy: 'Private dwelling — double storey terrace', periodDesc: '12 months', benefits: 'Building RM380,000; Contents RM100,000; Public liability RM50,000' },
    clientDue: '2026-07-06', principalDue: '2026-07-15' },

  { id: 'pol-vb909032e3', org: 'org-exe', client: 'cl-look', principal: 'pr-generali', agent: 'sa-exe-03',
    policyNo: 'VB909032E3', coverNote: 'CN-VB909032E3', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'new', created: '2026-03-03', effective: '2026-03-10', expiry: '2027-03-09', issue: '2026-03-03',
    sumInsured: 88000, total: 2164.30, ncd: 25, excess: 0, consultantCommission: 64.93,
    motor: { vehicleNo: 'VBB 9032', makeModel: 'MAZDA CX-5 2.0G', bodyType: '5D SUV', engineNo: 'PEVPS221144', chassisNo: 'JM0KF4W600100223', cc: '1998', year: '2022', seating: 5, hp: 'MAYBANK BERHAD', windscreen: 3000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    exts: [{ name: 'Windscreen Damage', si: 3000, premium: 450 }, { name: 'Special Perils / Convulsions of Nature', premium: 202.4 }],
    clientDue: '2026-07-12', principalDue: '2026-07-20' },

  { id: 'pol-kg-l0031', org: 'org-exe', client: 'cl-moomoo', principal: 'pr-sompo', agent: 'sa-exe-04',
    policyNo: '2026-KG-L0031', coverNote: 'CN-KGL0031', cls: 'non_motor', product: 'Fire & Perils', cover: 'Fire — Industrial All Risks',
    status: 'active', caseType: 'renewal', created: '2026-03-20', effective: '2026-04-01', expiry: '2027-03-31', issue: '2026-03-20',
    sumInsured: 2400000, total: 3180.00, excess: 5000, referralFee: 120.00,
    nonMotor: { riskType: 'Industrial All Risks', riskAddress: 'Lot 5-3, Jalan Perindustrian Balakong 8, 43300 Seri Kembangan, Selangor', occupancy: 'Security services office and equipment store', periodDesc: '12 months', benefits: 'Building RM1,600,000; Machinery & equipment RM600,000; Stock RM200,000' },
    clientDue: '2026-07-15', principalDue: '2026-07-25' },

  { id: 'pol-a6817996', org: 'org-exe', client: 'cl-wong', principal: 'pr-lonpac', agent: 'sa-exe-01',
    policyNo: 'A6817996-9', coverNote: 'A6817996-9', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'new', created: '2026-08-20', effective: '2026-08-25', expiry: '2027-08-24', issue: '2026-08-20',
    sumInsured: 72000, total: 1913.44, ncd: 30, excess: 400,
    motor: { vehicleNo: 'WCL 8899', makeModel: 'TOYOTA VIOS 1.5G', bodyType: '4D SEDAN', engineNo: '2NR8890021', chassisNo: 'MR2B29F3XN1002211', cc: '1496', year: '2023', seating: 5, hp: 'HONG LEONG BANK', windscreen: 2500, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    exts: [{ name: 'Windscreen Damage', si: 2500, premium: 375 }],
    clientDue: '2026-08-20', principalDue: '2026-09-05' },

  { id: 'pol-v7716458', org: 'org-exe', client: 'cl-limkok', principal: 'pr-tokio', agent: 'sa-exe-02',
    policyNo: 'V7716458', coverNote: 'CN-V7716458', cls: 'motor', product: 'Private Car', cover: 'Third Party, Fire & Theft',
    status: 'active', caseType: 'renewal', created: '2026-08-14', effective: '2026-08-20', expiry: '2027-08-19', issue: '2026-08-14',
    sumInsured: 26000, total: 876.15, ncd: 45, excess: 0,
    motor: { vehicleNo: 'VKY 7716', makeModel: 'PROTON X50 1.5T', bodyType: '5D SUV', engineNo: 'JLH3G15TD0221', chassisNo: 'PL1XM5610M2001122', cc: '1477', year: '2021', seating: 5, hp: 'NONE', windscreen: 0, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-08-16', principalDue: '2026-09-01' },

  { id: 'pol-pg97408527', org: 'org-exe', client: 'cl-leong', principal: 'pr-msig', agent: 'sa-exe-03',
    policyNo: 'PG-97408527-MPC', coverNote: 'CN-PG97408527', cls: 'non_motor', product: 'Medical Card', cover: 'Hospitalisation & Surgical',
    status: 'active', caseType: 'new', created: '2026-08-01', effective: '2026-08-10', expiry: '2027-08-09', issue: '2026-08-01',
    sumInsured: 150000, total: 1450.00, excess: 0, referralFee: 45.00,
    nonMotor: { riskType: 'Medical & Health', riskAddress: 'No 77, Jalan Bandar Tasik Selatan 4, 57000 Kuala Lumpur', occupancy: 'Individual medical card — Plan 200', periodDesc: '12 months', benefits: 'Annual limit RM150,000; Room & board RM200/day; Lifetime limit RM1,500,000' },
    clientDue: '2026-08-11', principalDue: '2026-08-25' },

  { id: 'pol-me512807', org: 'org-exe', client: 'cl-thin', principal: 'pr-sompo', agent: 'sa-exe-02',
    policyNo: 'ME512807', coverNote: 'CN-ME512807', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-07-18', effective: '2026-07-25', expiry: '2027-07-24', issue: '2026-07-18',
    sumInsured: 21000, total: 693.80, ncd: 55, excess: 0,
    motor: { vehicleNo: 'MEK 5128', makeModel: 'PERODUA AXIA 1.0G', bodyType: '5D HATCHBACK', engineNo: '1KRB5122087', chassisNo: 'PM2M300S1H1000221', cc: '998', year: '2017', seating: 5, hp: 'NONE', windscreen: 1000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-08-08', principalDue: '2026-08-20' },

  { id: 'pol-d26atsm', org: 'org-exe', client: 'cl-ching', principal: 'pr-rhb', agent: 'sa-exe-01',
    policyNo: 'D26ATSM8200393 PG', coverNote: 'CN-D26ATSM82', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'new', created: '2026-07-05', effective: '2026-07-12', expiry: '2027-07-11', issue: '2026-07-05',
    sumInsured: 45000, total: 1102.60, ncd: 25, excess: 400,
    motor: { vehicleNo: 'DAT 8200', makeModel: 'NISSAN ALMERA 1.0T', bodyType: '4D SEDAN', engineNo: 'HR10DET00221', chassisNo: 'PN1N1770XM7001122', cc: '999', year: '2021', seating: 5, hp: 'RHB BANK BERHAD', windscreen: 1800, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-08-04', principalDue: '2026-08-18' },

  { id: 'pol-26pbt5008060', org: 'org-exe', client: 'cl-limlay', principal: 'pr-allianz', agent: 'sa-exe-05',
    policyNo: '26PBT5008060-00', coverNote: 'CN-26PBT5008060', cls: 'non_motor', product: 'Personal Accident', cover: 'PA — Plan B',
    status: 'active', caseType: 'renewal', created: '2026-06-22', effective: '2026-07-01', expiry: '2027-06-30', issue: '2026-06-22',
    sumInsured: 100000, total: 560.00, excess: 0,
    nonMotor: { riskType: 'Personal Accident', riskAddress: 'No 15A, Jalan Puchong Permai 2, 47100 Puchong, Selangor', occupancy: 'Class 1 occupation', periodDesc: '12 months', benefits: 'Accidental death RM100,000; Permanent disablement RM100,000; Medical expenses RM5,000' },
    clientDue: '2026-08-01', principalDue: '2026-08-15' },

  { id: 'pol-xa082816', org: 'org-exe', client: 'cl-tey', principal: 'pr-sompo', agent: 'sa-exe-03',
    policyNo: 'XA082816', coverNote: 'CN-XA082816', cls: 'motor', product: 'Commercial Vehicle', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-05-16', effective: '2026-05-25', expiry: '2027-05-24', issue: '2026-05-16',
    sumInsured: 55000, total: 1024.75, ncd: 25, excess: 500,
    motor: { vehicleNo: 'XAS 8281', makeModel: 'ISUZU D-MAX 2.5', bodyType: '2D PICKUP', engineNo: '4JK1990022', chassisNo: 'MPATFS85J8T001122', cc: '2499', year: '2019', seating: 3, hp: 'AFFIN BANK BERHAD', windscreen: 1200, drivers: 'ANY AUTHORISED DRIVER', rtd: '10' },
    clientDue: '2026-07-30', principalDue: '2026-08-10' },

  { id: 'pol-kgz0137577', org: 'org-exe', client: 'cl-okbb', principal: 'pr-sompo', agent: 'sa-exe-04',
    policyNo: 'KG_Z0137577', coverNote: 'CN-KGZ0137577', cls: 'non_motor', product: 'Fire Consequential Loss', cover: 'Fire — Consequential Loss',
    status: 'active', caseType: 'renewal', created: '2026-05-02', effective: '2026-05-15', expiry: '2027-05-14', issue: '2026-05-02',
    sumInsured: 1800000, total: 2050.00, excess: 2500, consultantCommission: 94.44,
    nonMotor: { riskType: 'Consequential Loss (Fire)', riskAddress: 'No 3, Jalan Teknologi 3/5, Taman Sains Selangor, Kota Damansara', occupancy: 'Food manufacturing plant', periodDesc: '12 months — indemnity period 12 months', benefits: 'Gross profit RM1,800,000; Auditors fees RM25,000' },
    clientDue: '2026-07-26', principalDue: '2026-08-05' },

  { id: 'pol-v6621188', org: 'org-exe', client: 'cl-cheah', principal: 'pr-tokio', agent: 'sa-exe-02',
    policyNo: 'V6621188', coverNote: 'CN-V6621188', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-04-08', effective: '2026-04-15', expiry: '2027-04-14', issue: '2026-04-08',
    sumInsured: 28000, total: 815.30, ncd: 55, excess: 0,
    motor: { vehicleNo: 'VBH 6621', makeModel: 'PROTON SAGA 1.3 PREMIUM', bodyType: '4D SEDAN', engineNo: 'S4PH1120033', chassisNo: 'PL1BT4SN9L2001188', cc: '1332', year: '2020', seating: 5, hp: 'NONE', windscreen: 1000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-07-17', principalDue: '2026-07-28' },

  { id: 'pol-g7710244', org: 'org-exe', client: 'cl-ngsiew', principal: 'pr-generali', agent: 'sa-exe-05',
    policyNo: 'G7710244', coverNote: 'CN-G7710244', cls: 'motor', product: 'Motorcycle', cover: 'Comprehensive',
    status: 'active', caseType: 'new', created: '2026-04-16', effective: '2026-04-22', expiry: '2027-04-21', issue: '2026-04-16',
    sumInsured: 9500, total: 448.85, ncd: 15, excess: 0,
    motor: { vehicleNo: 'GSL 7710', makeModel: 'YAMAHA NVX 155', bodyType: 'MOTORCYCLE', engineNo: 'B65E0011220', chassisNo: 'PMYB65E10M1002211', cc: '155', year: '2021', seating: 2, hp: 'NONE', windscreen: 0, drivers: 'ALL RIDERS', rtd: '20' },
    clientDue: '2026-07-21', principalDue: '2026-08-02' },

  { id: 'pol-ms202600817', org: 'org-exe', client: 'cl-simch', principal: 'pr-msig', agent: 'sa-exe-03',
    policyNo: 'MS-2026-00817', coverNote: 'CN-MS0081726', cls: 'non_motor', product: 'Personal Accident', cover: 'PA — Plan A',
    status: 'active', caseType: 'new', created: '2026-04-24', effective: '2026-05-01', expiry: '2027-04-30', issue: '2026-04-24',
    sumInsured: 50000, total: 200.30, excess: 0,
    nonMotor: { riskType: 'Personal Accident', riskAddress: 'No 41, Jalan Ampang Hilir 6, 55000 Kuala Lumpur', occupancy: 'Class 1 occupation', periodDesc: '12 months', benefits: 'Accidental death RM50,000; Permanent disablement RM50,000; Medical expenses RM2,500' },
    clientDue: '2026-07-24', principalDue: '2026-08-08' },

  /* --- EXE Cheras: collected in 2026 (8) ------------------------------- */
  { id: 'pol-sr8812445', org: 'org-exe', client: 'cl-tanmei', principal: 'pr-etiqa', agent: 'sa-exe-01',
    policyNo: 'SR8812445', coverNote: 'CN-SR8812445', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-01-05', effective: '2026-01-12', expiry: '2027-01-11', issue: '2026-01-05',
    sumInsured: 41000, total: 1120.40, ncd: 38.33, excess: 0,
    motor: { vehicleNo: 'SRT 8812', makeModel: 'HONDA JAZZ 1.5V', bodyType: '5D HATCHBACK', engineNo: 'L15Z66001122', chassisNo: 'PADGK3860JV002211', cc: '1497', year: '2018', seating: 5, hp: 'NONE', windscreen: 1500, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-01-15', clientPaid: '2026-01-15', clientMethod: 'Online transfer', clientRef: 'FPX-20260115-8812',
    principalDue: '2026-01-31' },

  { id: 'pol-zg2201887', org: 'org-exe', client: 'cl-faizal', principal: 'pr-zurich', agent: 'sa-exe-02',
    policyNo: 'ZG2201887', coverNote: 'CN-ZG2201887', cls: 'motor', product: 'Private Car', cover: 'Third Party',
    status: 'active', caseType: 'renewal', created: '2026-01-28', effective: '2026-02-05', expiry: '2027-02-04', issue: '2026-01-28',
    sumInsured: 30000, total: 845.60, ncd: 25, excess: 0,
    motor: { vehicleNo: 'ZGF 2201', makeModel: 'PERODUA BEZZA 1.3', bodyType: '4D SEDAN', engineNo: '1NRB2201887', chassisNo: 'PM2M600S1J1001887', cc: '1329', year: '2019', seating: 5, hp: 'NONE', windscreen: 0, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-02-08', clientPaid: '2026-02-08', clientMethod: 'Cash', clientRef: 'RCP-2026-00214',
    principalDue: '2026-02-20' },

  { id: 'pol-a6712330', org: 'org-exe', client: 'cl-chong', principal: 'pr-lonpac', agent: 'sa-exe-03',
    policyNo: 'A6712330-4', coverNote: 'A6712330-4', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'new', created: '2026-03-06', effective: '2026-03-15', expiry: '2027-03-14', issue: '2026-03-06',
    sumInsured: 52000, total: 1342.00, ncd: 25, excess: 400,
    motor: { vehicleNo: 'CWK 6712', makeModel: 'TOYOTA COROLLA ALTIS 1.8E', bodyType: '4D SEDAN', engineNo: '2ZR6712330', chassisNo: 'MR2BZ9F30M1006712', cc: '1798', year: '2021', seating: 5, hp: 'CIMB BANK BERHAD', windscreen: 2000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-03-19', clientPaid: '2026-03-19', clientMethod: 'Online transfer', clientRef: 'FPX-20260319-6712',
    principalDue: '2026-04-02' },

  { id: 'pol-nm20260114', org: 'org-exe', client: 'cl-sunrise', principal: 'pr-msig', agent: 'sa-exe-04',
    policyNo: 'NM-2026-0114', coverNote: 'CN-NM20260114', cls: 'non_motor', product: 'Fire & Burglary', cover: 'Fire — Standard & Burglary',
    status: 'active', caseType: 'renewal', created: '2026-04-12', effective: '2026-04-20', expiry: '2027-04-19', issue: '2026-04-12',
    sumInsured: 350000, total: 612.35, excess: 1000,
    nonMotor: { riskType: 'Fire & Burglary', riskAddress: 'No 1 & 3, Jalan Perdagangan 5, 43650 Bandar Baru Bangi, Selangor', occupancy: 'Hardware retail shop lot', periodDesc: '12 months', benefits: 'Stock RM250,000; Fixtures & fittings RM100,000' },
    clientDue: '2026-04-27', clientPaid: '2026-04-27', clientMethod: 'Cheque', clientRef: 'CHQ-004471',
    principalDue: '2026-05-10' },

  { id: 'pol-v6980221', org: 'org-exe', client: 'cl-rajesh', principal: 'pr-tokio', agent: 'sa-exe-01',
    policyNo: 'V6980221', coverNote: 'CN-V6980221', cls: 'motor', product: 'Commercial Vehicle', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-04-20', effective: '2026-04-28', expiry: '2027-04-27', issue: '2026-04-20',
    sumInsured: 38000, total: 978.20, ncd: 30, excess: 500,
    motor: { vehicleNo: 'VRM 6980', makeModel: 'TOYOTA HIACE 2.5', bodyType: 'PANEL VAN', engineNo: '2KD6980221', chassisNo: 'JTFSX23P3K0006980', cc: '2494', year: '2019', seating: 3, hp: 'NONE', windscreen: 1200, drivers: 'ANY AUTHORISED DRIVER', rtd: '10' },
    clientDue: '2026-05-05', clientPaid: '2026-05-14', clientMethod: 'Online transfer', clientRef: 'FPX-20260514-6980',
    principalDue: '2026-05-20', principalPaid: '2026-05-22' },

  { id: 'pol-t6088190', org: 'org-exe', client: 'cl-leepoh', principal: 'pr-generali', agent: 'sa-exe-05',
    policyNo: 'T6088190', coverNote: 'CN-T6088190', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2026-04-25', effective: '2026-05-02', expiry: '2027-05-01', issue: '2026-04-25',
    sumInsured: 24000, total: 755.51, ncd: 55, excess: 0,
    motor: { vehicleNo: 'TPC 6088', makeModel: 'PERODUA MYVI 1.3G', bodyType: '5D HATCHBACK', engineNo: '1NR6088190', chassisNo: 'PM2M900S1G1006088', cc: '1329', year: '2016', seating: 5, hp: 'NONE', windscreen: 1000, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-05-10', clientPaid: '2026-06-30', clientMethod: 'Cash', clientRef: 'RCP-2026-00918',
    principalDue: '2026-05-25', principalPaid: '2026-07-04' },

  { id: 'pol-xb071559', org: 'org-exe', client: 'cl-kamarudin', principal: 'pr-sompo', agent: 'sa-exe-02',
    policyNo: 'XB071559', coverNote: 'CN-XB071559', cls: 'motor', product: 'Private Car', cover: 'Third Party, Fire & Theft',
    status: 'active', caseType: 'new', created: '2026-04-28', effective: '2026-05-06', expiry: '2027-05-05', issue: '2026-04-28',
    sumInsured: 18000, total: 579.50, ncd: 20, excess: 0,
    motor: { vehicleNo: 'XBK 0715', makeModel: 'PROTON IRIZ 1.3', bodyType: '5D HATCHBACK', engineNo: 'S4PH0715590', chassisNo: 'PL1BR4SN8H2000715', cc: '1332', year: '2017', seating: 5, hp: 'NONE', windscreen: 0, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2026-05-12', clientPaid: '2026-07-11', clientMethod: 'Online transfer', clientRef: 'FPX-20260711-0715',
    principalDue: '2026-05-28', principalPaid: '2026-07-18' },

  { id: 'pol-26pbt4990012', org: 'org-exe', client: 'cl-gohswee', principal: 'pr-allianz', agent: 'sa-exe-03',
    policyNo: '26PBT4990012-00', coverNote: 'CN-26PBT4990012', cls: 'non_motor', product: 'Personal Accident', cover: 'PA — Plan A',
    status: 'active', caseType: 'renewal', created: '2026-04-30', effective: '2026-05-08', expiry: '2027-05-07', issue: '2026-04-30',
    sumInsured: 80000, total: 429.23, excess: 0,
    nonMotor: { riskType: 'Personal Accident', riskAddress: 'No 18, Jalan Cheras Idaman 2, 43200 Cheras, Selangor', occupancy: 'Class 1 occupation', periodDesc: '12 months', benefits: 'Accidental death RM80,000; Permanent disablement RM80,000; Medical expenses RM4,000' },
    clientDue: '2026-05-15', clientPaid: '2026-08-03', clientMethod: 'Online transfer', clientRef: 'FPX-20260803-4990',
    principalDue: '2026-05-30', principalPaid: '2026-08-08' },

  /* --- EXE Cheras: written last year, so falling due now --------------- */
  { id: 'pol-v7340021', org: 'org-exe', client: 'cl-ngsiew', principal: 'pr-tokio', agent: 'sa-exe-02',
    policyNo: 'V7340021', coverNote: 'CN-V7340021', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2025-08-28', effective: '2025-09-11', expiry: '2026-09-10', issue: '2025-08-28',
    sumInsured: 33000, total: 942.60, ncd: 38.33, excess: 0,
    motor: { vehicleNo: 'NSL 7340', makeModel: 'PERODUA ATIVA 1.0 AV', bodyType: '5D SUV', engineNo: '1KRB7340021', chassisNo: 'PM2M700S1M1007340', cc: '998', year: '2021', seating: 5, hp: 'NONE', windscreen: 1500, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2025-09-11', clientPaid: '2025-09-08', clientMethod: 'Online transfer', clientRef: 'FPX-20250908-7340',
    principalDue: '2025-09-25', principalPaid: '2025-09-24' },

  { id: 'pol-a6655120', org: 'org-exe', client: 'cl-chong', principal: 'pr-lonpac', agent: 'sa-exe-03',
    policyNo: 'A6655120-2', coverNote: 'A6655120-2', cls: 'motor', product: 'Private Car', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2025-09-20', effective: '2025-10-06', expiry: '2026-10-05', issue: '2025-09-20',
    sumInsured: 58000, total: 1436.90, ncd: 30, excess: 400,
    motor: { vehicleNo: 'CWK 6655', makeModel: 'HONDA CR-V 1.5 TC', bodyType: '5D SUV', engineNo: 'L15BE6655120', chassisNo: 'PADRW2870LV006655', cc: '1498', year: '2020', seating: 5, hp: 'CIMB BANK BERHAD', windscreen: 2500, drivers: 'ANY AUTHORISED DRIVER', rtd: '08' },
    clientDue: '2025-10-06', clientPaid: '2025-10-02', clientMethod: 'Cheque', clientRef: 'CHQ-006655',
    principalDue: '2025-10-20', principalPaid: '2025-10-18' },

  { id: 'pol-t6790455', org: 'org-exe', client: 'cl-limlay', principal: 'pr-generali', agent: 'sa-exe-04',
    policyNo: 'T6790455', coverNote: 'CN-T6790455', cls: 'motor', product: 'Commercial Vehicle', cover: 'Comprehensive',
    status: 'active', caseType: 'renewal', created: '2025-10-30', effective: '2025-11-15', expiry: '2026-11-14', issue: '2025-10-30',
    sumInsured: 72000, total: 2018.35, ncd: 25, excess: 500,
    motor: { vehicleNo: 'LLG 6790', makeModel: 'TOYOTA HILUX 2.8 ROGUE', bodyType: '4D PICKUP', engineNo: '1GD6790455', chassisNo: 'MR0FZ29G6N0006790', cc: '2755', year: '2022', seating: 5, hp: 'PUBLIC BANK BERHAD', windscreen: 3000, drivers: 'ANY AUTHORISED DRIVER', rtd: '10' },
    clientDue: '2025-11-15', clientPaid: '2025-11-12', clientMethod: 'Online transfer', clientRef: 'FPX-20251112-6790',
    principalDue: '2025-11-30', principalPaid: '2025-11-28' },

  /* --- BS Agency: the four scanned policy documents -------------------- */
  { id: 'pol-wqk100', sourceFile: 'WQK100POLICY.pdf', org: 'org-bs', client: 'cl-bolton', principal: 'pr-liberty', agent: 'sa-bs-01',
    policyNo: 'Y0029038', coverNote: 'JME1063847 01-C2', cls: 'motor', product: 'Private Car Ex Goods', cover: 'Comprehensive Plus (Agreed Value)',
    status: 'active', caseType: 'renewal', created: '2025-06-20', effective: '2025-06-20', expiry: '2026-06-19', issue: '2025-06-20',
    sumInsured: 47000, basic: 1533.31, ncd: 55, ncdAmt: 843.32, extra: 1072.45, gross: 1762.44, tax: 141.00, stamp: 10.00, total: 1913.44, excess: 0,
    motor: { vehicleNo: 'WQK100', makeModel: 'TOYOTA ALPHARD', bodyType: '4D VAN', engineNo: '1MZ1229608', chassisNo: 'MNH10-0105515', cc: '2994', year: '2005', seating: 7, hp: '-', windscreen: 4000, drivers: 'ALL DRIVERS', extensions: '2, 100, 25, 57, 72, 89, 87 (Agreed Value), MPCCO002', rtd: '08' },
    exts: [
      { name: 'Strike, Riot and Civil Commotion', premium: 141.00 },
      { name: 'Inclusion of Special Perils / Convulsions of Nature', premium: 108.10 },
      { name: 'Legal Liability of Passengers', premium: 7.50 },
      { name: 'Legal Liability to Passengers', premium: 61.85 },
      { name: 'Windscreen Damage (Tempered/Laminated Glass incl. labour)', si: 4000, premium: 600.00 },
      { name: 'Private Car 365 Plan 2', premium: 154.00 },
    ],
    clientDue: '2025-06-20', clientPaid: '2025-06-20', clientMethod: 'Online transfer', clientRef: 'SST-06-25-17137016',
    principalDue: '2025-07-05', principalPaid: '2025-07-03',
    remarks: 'Liberty auto365 Comprehensive Plus. Agent account A02100-00.' },

  { id: 'pol-dds7898', sourceFile: 'DDS7898POLICY.pdf', org: 'org-bs', client: 'cl-surendran', principal: 'pr-lonpac', agent: 'sa-bs-01',
    policyNo: 'A6179198-0', coverNote: 'A6179198-0', cls: 'motor', product: 'Private Car Secure & E-Assist', cover: 'Comprehensive — Smart Driver (Plan 1)',
    status: 'active', caseType: 'renewal', created: '2025-06-12', effective: '2025-06-17', expiry: '2026-06-16', issue: '2025-06-12',
    sumInsured: 145000, total: 2383.41, ncd: 55, excess: 400,
    motor: { vehicleNo: 'DDS 7898', makeModel: 'TOYOTA ALPHARD', bodyType: 'MPV', engineNo: '2ARH575828', chassisNo: 'AGH300022342', cc: '2493', year: '2015', seating: 7, hp: 'NONE', windscreen: 3500, drivers: 'ANY AUTHORISED DRIVERS', rtd: '11' },
    exts: [{ name: 'Windscreen', si: 3500, premium: 525.00 }],
    clientDue: '2025-06-17', clientPaid: '2025-06-16', clientMethod: 'Online transfer', clientRef: 'LON-25-0619198',
    principalDue: '2025-07-01', principalPaid: '2025-06-30',
    remarks: 'Renewal of policy N/24/VZ96/022298/SBN. Compulsory excess RM400.' },

  { id: 'pol-mdw9185', sourceFile: 'MDW9185POLICY.pdf', org: 'org-bs', client: 'cl-hoo', principal: 'pr-allianz', agent: 'sa-bs-01',
    policyNo: 'AESN0766516', coverNote: 'AESN0766516', cls: 'motor', product: 'Private Car Excluding Goods', cover: 'Comprehensive (Agreed Value)',
    status: 'active', caseType: 'new', created: '2025-09-09', effective: '2025-09-18', expiry: '2026-09-17', issue: '2025-09-09',
    sumInsured: 100000, basic: 2674.38, ncd: 25, ncdAmt: 668.60, extra: 119.00, gross: 2124.79, tax: 169.98, stamp: 10.00, total: 2304.77, excess: 0,
    motor: { vehicleNo: 'MDW9185', makeModel: 'HONDA WR-V 1.5L RS', bodyType: 'WAGON (A) 4D', engineNo: 'L15ZF9307373', chassisNo: 'PMHDG4880PD847374', cc: '1498', year: '2024', seating: 5, hp: 'NA', windscreen: 0, drivers: '1. THE POLICYHOLDER', extensions: 'ENDT.PAB-ERW, ENDT.A200, ENDT.1, ENDT.113, ENDT.87 (Agreed Value)', rtd: '13' },
    exts: [
      { name: 'Motor Enhanced Road Warrior (Plan A) — towing unlimited', premium: 99.00 },
      { name: 'Unnamed Driver', premium: 20.00 },
    ],
    clientDue: '2025-09-18', clientPaid: '2025-09-15', clientMethod: 'Online transfer', clientRef: 'ALPHA-2550301-003017317-2',
    principalDue: '2025-10-01', principalPaid: '2025-09-29',
    remarks: 'Amount payable rounded to RM2,304.75. Agent code SN50301-01.' },

  { id: 'pol-ncf9240', sourceFile: 'NCF9240POLICY.pdf', org: 'org-bs', client: 'cl-limhong', principal: 'pr-liberty', agent: 'sa-bs-01',
    policyNo: 'JME1499237', coverNote: 'JME1499237 01-C2', cls: 'motor', product: 'Private Car Ex Goods', cover: 'Comprehensive Plus (Agreed Value)',
    status: 'active', caseType: 'renewal', created: '2025-09-19', effective: '2025-09-28', expiry: '2026-09-27', issue: '2025-09-19',
    sumInsured: 10000, basic: 759.16, ncd: 55, ncdAmt: 417.54, extra: 83.00, gross: 424.62, tax: 33.97, stamp: 10.00, total: 468.59, excess: 0,
    motor: { vehicleNo: 'NCF9240', makeModel: 'PROTON SAGA BASE LINE', bodyType: '4D SEDAN', engineNo: 'S4PEPW8986', chassisNo: 'PL1BT3SNRAB110914', cc: '1332', year: '2009', seating: 5, hp: '-', windscreen: 0, drivers: 'ANY AUTHORISED DRIVER', extensions: '2, 87 (Agreed Value), MPCCO001', rtd: '08' },
    exts: [{ name: 'Private Car 365 Plan 1', premium: 83.00 }],
    clientDue: '2025-09-28', clientPaid: '2025-09-26', clientMethod: 'Cash', clientRef: 'SBM008914/24-01',
    principalDue: '2025-10-10', principalPaid: '2025-10-08',
    remarks: 'Renewal of policy SBM008914/24-01.' },
];

/* ------------------------------------------------------------------ *
 * Life / client planning, notifications, settings
 * ------------------------------------------------------------------ */

const LIFE_PLANS: Row[] = [
  { id: 'lp-01', org_id: 'org-exe', client_id: 'cl-adam',    plan_name: 'Legacy Protector 100',   provider: 'Great Eastern Life',   plan_type: 'Whole Life',         sum_assured: 500000, premium: 4800,  frequency: 'Annual',      start_date: '2021-03-01', maturity_date: '2071-03-01', status: 'in force', notes: 'Rider: 36 critical illness, waiver of premium.' },
  { id: 'lp-02', org_id: 'org-exe', client_id: 'cl-tanmei',  plan_name: 'SmartLink Invest',        provider: 'Prudential Assurance', plan_type: 'Investment Linked',  sum_assured: 300000, premium: 3600,  frequency: 'Annual',      start_date: '2022-07-15', maturity_date: '2062-07-15', status: 'in force', notes: 'Medical card attached — Plan 150.' },
  { id: 'lp-03', org_id: 'org-exe', client_id: 'cl-wong',    plan_name: 'Education Saver 18',      provider: 'AIA Bhd',              plan_type: 'Endowment',          sum_assured: 150000, premium: 250,   frequency: 'Monthly',     start_date: '2024-01-10', maturity_date: '2042-01-10', status: 'in force', notes: 'For dependant — maturity aligned to tertiary education.' },
  { id: 'lp-04', org_id: 'org-exe', client_id: 'cl-quah',    plan_name: 'Term Shield 30',          provider: 'Hong Leong Assurance', plan_type: 'Term',               sum_assured: 750000, premium: 1980,  frequency: 'Annual',      start_date: '2023-05-20', maturity_date: '2053-05-20', status: 'in force', notes: 'Mortgage protection — assigned to Public Bank.' },
  { id: 'lp-05', org_id: 'org-exe', client_id: 'cl-limlay',  plan_name: 'Retire Bright Annuity',   provider: 'Etiqa Life',           plan_type: 'Annuity',            sum_assured: 200000, premium: 6000,  frequency: 'Annual',      start_date: '2019-11-02', maturity_date: '2031-11-02', status: 'in force', notes: 'Payout commences at age 65.' },
  { id: 'lp-06', org_id: 'org-exe', client_id: 'cl-chong',   plan_name: 'Medical Guard Plus',      provider: 'Allianz Life',         plan_type: 'Medical',            sum_assured: 1500000, premium: 2100, frequency: 'Annual',      start_date: '2025-02-18', maturity_date: '2065-02-18', status: 'lapsed',   notes: 'Premium unpaid since Feb 2026 — follow up for reinstatement.' },
  { id: 'lp-07', org_id: 'org-bs',  client_id: 'cl-surendran', plan_name: 'Family Cover 20',       provider: 'Great Eastern Life',   plan_type: 'Term',               sum_assured: 400000, premium: 1450,  frequency: 'Annual',      start_date: '2022-10-11', maturity_date: '2042-10-11', status: 'in force', notes: 'Spouse rider included.' },
];

const NOTIFICATIONS: Row[] = [
  { id: 'nt-01', org_id: 'org-exe', title: 'Renewal notice batch scheduled',  body: '14 motor policies expiring in the next 60 days have been queued for the renewal reminder broadcast.', audience: 'client',    channel: 'email',    scheduled_at: '2026-08-25 09:00', status: 'scheduled', read_flag: 0, created_at: '2026-08-21' },
  { id: 'nt-02', org_id: 'org-exe', title: 'Commission payout awaiting approval', body: 'RM 3,480.62 in sub agent commission is pending your approval in Accounting.', audience: 'all',       channel: 'in-app',   scheduled_at: '2026-08-20 17:30', status: 'sent',      read_flag: 0, created_at: '2026-08-20' },
  { id: 'nt-03', org_id: 'org-exe', title: 'Outstanding premium reminder',    body: 'Reminder sent to 17 clients with premium outstanding beyond the credit term.', audience: 'client',    channel: 'whatsapp', scheduled_at: '2026-08-15 10:00', status: 'sent',      read_flag: 1, created_at: '2026-08-15' },
  { id: 'nt-04', org_id: 'org-exe', title: 'Sub agent briefing — Q3 targets', body: 'Quarterly briefing on 30 Aug 2026, 3.00 pm at the Cheras office.', audience: 'sub_agent', channel: 'email',    scheduled_at: '2026-08-28 08:00', status: 'scheduled', read_flag: 1, created_at: '2026-08-12' },
  { id: 'nt-05', org_id: 'org-bs',  title: 'Policy expiring — MDW9185',       body: 'Allianz private car policy AESN0766516 expires on 17 Sep 2026.', audience: 'client',    channel: 'email',    scheduled_at: '2026-08-18 09:00', status: 'sent',      read_flag: 0, created_at: '2026-08-18' },
];

const RENEWAL_SETTINGS: Row[] = [
  { id: 'rs-01', org_id: 'org-exe', days_before: 60, channel: 'email',
    name: DEFAULT_TEMPLATES[60].name, subject: DEFAULT_TEMPLATES[60].subject,
    template: DEFAULT_TEMPLATES[60].body, enabled: 1 },
  { id: 'rs-02', org_id: 'org-exe', days_before: 30, channel: 'whatsapp',
    name: DEFAULT_TEMPLATES[30].name, subject: DEFAULT_TEMPLATES[30].subject,
    template: DEFAULT_TEMPLATES[30].body, enabled: 1 },
  { id: 'rs-05', org_id: 'org-exe', days_before: 14, channel: 'whatsapp',
    name: DEFAULT_TEMPLATES[14].name, subject: DEFAULT_TEMPLATES[14].subject,
    template: DEFAULT_TEMPLATES[14].body, enabled: 1 },
  { id: 'rs-03', org_id: 'org-exe', days_before: 7,  channel: 'whatsapp',
    name: DEFAULT_TEMPLATES[7].name, subject: DEFAULT_TEMPLATES[7].subject,
    template: DEFAULT_TEMPLATES[7].body, enabled: 1 },
  { id: 'rs-04', org_id: 'org-bs',  days_before: 45, channel: 'email',
    name: 'Six weeks before expiry', subject: 'Renewal due on {expiry_date}',
    template: 'Dear {client_name}, your policy {policy_no} expires on {expiry_date}.\n\n{agency_name}', enabled: 1 },
];

const QUOTATIONS: Row[] = [
  { id: 'qt-01', org_id: 'org-exe', client_id: 'cl-quote',  principal_id: 'pr-allianz', policy_id: null, quote_no: 'QT-2026-0041', class: 'motor',     product: 'Private Car',       status: 'sent',      total_payable: 988.40,  valid_until: '2026-09-05', created_at: '2026-08-06', updated_at: '2026-08-06', note: 'Awaiting client confirmation and KYC.' },
  { id: 'qt-02', org_id: 'org-exe', client_id: 'cl-wong',   principal_id: 'pr-lonpac',  policy_id: 'pol-a6817996', quote_no: 'QT-2026-0038', class: 'motor', product: 'Private Car', status: 'converted', total_payable: 1913.44, valid_until: '2026-08-25', created_at: '2026-08-12', updated_at: '2026-08-20', note: 'Converted to policy A6817996-9.' },
  { id: 'qt-03', org_id: 'org-exe', client_id: 'cl-cheah',  principal_id: 'pr-tokio',   policy_id: null, quote_no: 'QT-2026-0044', class: 'motor',     product: 'Private Car',       status: 'draft',     total_payable: 842.00,  valid_until: '2026-09-12', created_at: '2026-08-19', updated_at: '2026-08-19', note: 'Pending sum insured confirmation.' },
  { id: 'qt-04', org_id: 'org-exe', client_id: 'cl-okbb',   principal_id: 'pr-msig',    policy_id: null, quote_no: 'QT-2026-0035', class: 'non_motor', product: 'Fire & Perils',     status: 'accepted',  total_payable: 4120.00, valid_until: '2026-09-01', created_at: '2026-08-02', updated_at: '2026-08-15', note: 'Client accepted — awaiting cover note from principal.' },
  { id: 'qt-05', org_id: 'org-exe', client_id: 'cl-simch',  principal_id: 'pr-qbe',     policy_id: null, quote_no: 'QT-2026-0029', class: 'non_motor', product: 'Personal Accident', status: 'rejected',  total_payable: 615.00,  valid_until: '2026-07-20', created_at: '2026-07-04', updated_at: '2026-07-22', note: 'Client renewed with the incumbent insurer.' },
  { id: 'qt-06', org_id: 'org-exe', client_id: 'cl-moomoo', principal_id: 'pr-zurich',  policy_id: null, quote_no: 'QT-2026-0046', class: 'non_motor', product: 'Liability',         status: 'sent',      total_payable: 2280.00, valid_until: '2026-09-18', created_at: '2026-08-21', updated_at: '2026-08-21', note: 'Public liability for the Balakong site.' },
  { id: 'qt-07', org_id: 'org-exe', client_id: 'cl-tey',    principal_id: 'pr-sompo',   policy_id: null, quote_no: 'QT-2026-0042', class: 'motor',     product: 'Commercial Vehicle', status: 'draft',    total_payable: 1180.00, valid_until: '2026-09-08', created_at: '2026-08-14', updated_at: '2026-08-16', note: null },
  { id: 'qt-08', org_id: 'org-bs',  client_id: 'cl-hoo',    principal_id: 'pr-allianz', policy_id: null, quote_no: 'QT-BS-0012',   class: 'motor',     product: 'Private Car',       status: 'sent',      total_payable: 2410.00, valid_until: '2026-10-01', created_at: '2026-08-18', updated_at: '2026-08-18', note: 'Renewal quotation for MDW9185.' },
];

const RENEWAL_REQUESTS: Row[] = [
  { id: 'rr-01', org_id: 'org-exe', policy_id: 'pol-kgz0137577',   status: 'inbox',      source: 'Home',           requested_at: '2026-08-19', note: 'Client asked to review sum insured before renewing.' },
  { id: 'rr-02', org_id: 'org-exe', policy_id: 'pol-xa082816',     status: 'inbox',      source: 'Client portal',  requested_at: '2026-08-17', note: null },
  { id: 'rr-03', org_id: 'org-exe', policy_id: 'pol-v6621188',     status: 'processing', source: 'Agent',          requested_at: '2026-08-11', note: 'Quotation requested from Tokio.' },
  { id: 'rr-04', org_id: 'org-exe', policy_id: 'pol-t6088190',     status: 'completed',  source: 'Scheduler',      requested_at: '2026-07-02', note: 'Renewed on 2 May 2026.' },
  { id: 'rr-05', org_id: 'org-exe', policy_id: 'pol-g7710244',     status: 'rejected',   source: 'Home',           requested_at: '2026-06-28', note: 'Client sold the motorcycle.' },
  { id: 'rr-06', org_id: 'org-bs',  policy_id: 'pol-mdw9185',      status: 'inbox',      source: 'Scheduler',      requested_at: '2026-08-18', note: 'Expires 17 Sep 2026.' },
];

/* ------------------------------------------------------------------ *
 * Seed
 * ------------------------------------------------------------------ */

export function seed(db: Database) {
  insertAll(db, 'organisation', ORGS);
  insertAll(db, 'principal', PRINCIPALS);

  insertAll(
    db,
    'app_user',
    USERS.map((u) => ({
      id: u.id, org_id: u.org_id, email: u.email, password_hash: hashPassword(u.password),
      name: u.name, role: u.role, agent_code: u.agent_code, phone: u.phone, status: u.status,
    })),
  );

  insertAll(db, 'sub_agent', SUB_AGENTS);
  insertAll(db, 'client_group', GROUPS);

  insertAll(
    db,
    'client',
    CLIENTS.map((c) => ({
      id: c.id, org_id: c.org, group_id: c.group ?? null, name: c.name, client_type: c.type,
      nric: c.nric ?? null, business_reg: c.reg ?? null, email: c.email, phone: c.phone,
      address1: c.a1, address2: c.a2 ?? null, postcode: c.post, city: c.city, state: c.state,
      country: 'MALAYSIA', dob: c.dob ?? null, occupation: c.occ ?? null,
      portal_enabled: c.portal ?? 0, created_at: c.created,
    })),
  );

  const principalById = new Map(PRINCIPALS.map((p) => [p.id as string, p]));

  let locSeq = 1;
  const policyRows: Row[] = [];
  const motorRows: Row[] = [];
  const nonMotorRows: Row[] = [];
  const extRows: Row[] = [];
  const paymentRows: Row[] = [];
  const commissionRows: Row[] = [];

  for (const p of POLICIES) {
    const extra = p.extra ?? (p.exts ? round2(p.exts.reduce((s, e) => s + e.premium, 0)) : 0);

    let gross: number, tax: number, stamp: number, total: number;
    if (p.gross !== undefined) {
      gross = p.gross;
      tax = p.tax ?? round2(gross * 0.08);
      stamp = p.stamp ?? 10;
      total = p.total ?? round2(gross + tax + stamp);
    } else {
      ({ gross, tax, stamp, total } = fromTotal(p.total!));
    }

    const ncdPct = p.ncd ?? 0;
    const basic = p.basic ?? round2((gross - extra) / (1 - ncdPct / 100));
    const ncdAmt = p.ncdAmt ?? round2(basic - (gross - extra));

    const principal = principalById.get(p.principal)!;
    const commRate = (p.cls === 'motor' ? principal.motor_rate : principal.non_motor_rate) as number;
    const commAmt = round2(gross * (commRate / 100));

    const subAgentSeed = SUB_AGENTS.find((s) => s.id === p.agent);
    const subRateSeed = subAgentSeed
      ? ((p.cls === 'motor' ? subAgentSeed.motor_rate : subAgentSeed.non_motor_rate) as number)
      : 0;
    const agentCommission = round2(
      gross * (subRateSeed / 100) + gross * (((subAgentSeed?.override_rate as number) ?? 0) / 100),
    );
    // Referral fees are the exception rather than the rule — most cases carry none.
    const referralFee = p.referralFee ?? 0;
    // Where a salaried consultant closed the case, part of the agency's
    // commission is theirs rather than the servicing agent's.
    const consultantCommission = p.consultantCommission ?? 0;
    // Letter of collection, issued when premium is billed to the client.
    const locNo = p.clientPaid ? null : `LOC${String(locSeq++).padStart(5, '0')}`;

    policyRows.push({
      id: p.id, org_id: p.org, client_id: p.client, principal_id: p.principal,
      sub_agent_id: p.agent ?? null, policy_no: p.policyNo, cover_note_no: p.coverNote ?? null,
      class: p.cls, product: p.product, type_of_cover: p.cover, status: p.status, case_type: p.caseType,
      effective_date: p.effective, expiry_date: p.expiry, issue_date: p.issue, created_date: p.created,
      sum_insured: p.sumInsured, basic_premium: basic, ncd_pct: ncdPct, ncd_amount: ncdAmt,
      extra_premium: extra, gross_premium: gross, service_tax: tax, stamp_duty: stamp,
      total_premium: total, commission_rate: commRate, commission_amt: commAmt,
      excess: p.excess ?? 0, referral_fee: referralFee, agent_commission: agentCommission,
      consultant_commission: consultantCommission, loc_no: locNo,
      uploaded_at: p.created, source_file: p.sourceFile ?? null, remarks: p.remarks ?? null,
    });

    if (p.motor) {
      motorRows.push({
        policy_id: p.id, vehicle_no: p.motor.vehicleNo, make_model: p.motor.makeModel,
        body_type: p.motor.bodyType ?? null, engine_no: p.motor.engineNo, chassis_no: p.motor.chassisNo,
        engine_cc: p.motor.cc, year_make: p.motor.year, seating: p.motor.seating,
        hire_purchase: p.motor.hp ?? null, windscreen_si: p.motor.windscreen ?? 0,
        named_drivers: p.motor.drivers ?? null, extensions: p.motor.extensions ?? null,
        rtd_code: p.motor.rtd ?? null,
      });
    }

    if (p.nonMotor) {
      nonMotorRows.push({
        policy_id: p.id, risk_type: p.nonMotor.riskType,
        class_of_business:
          p.nonMotor.classOfBusiness ??
          inferClassOfBusiness(`${p.product} ${p.cover} ${p.nonMotor.riskType}`) ??
          'Property',
        risk_address: p.nonMotor.riskAddress, occupancy: p.nonMotor.occupancy,
        period_desc: p.nonMotor.periodDesc, benefits: p.nonMotor.benefits,
      });
    }

    (p.exts ?? []).forEach((e, i) => {
      extRows.push({ id: `${p.id}-ext-${i + 1}`, policy_id: p.id, name: e.name, sum_insured: e.si ?? 0, premium: e.premium });
    });

    paymentRows.push({
      id: `${p.id}-pay-c`, policy_id: p.id, kind: 'client', amount: total,
      paid_amount: p.clientPaid ? total : 0, due_date: p.clientDue, paid_date: p.clientPaid ?? null,
      method: p.clientMethod ?? null, reference: p.clientRef ?? null,
      status: p.clientPaid ? 'paid' : 'outstanding',
    });

    const dueToPrincipal = round2(total - commAmt);
    paymentRows.push({
      id: `${p.id}-pay-p`, policy_id: p.id, kind: 'principal', amount: dueToPrincipal,
      paid_amount: p.principalPaid ? dueToPrincipal : 0, due_date: p.principalDue,
      paid_date: p.principalPaid ?? null, method: p.principalPaid ? 'Bank transfer' : null,
      reference: p.principalPaid ? `REM-${p.id.slice(-6).toUpperCase()}` : null,
      status: p.principalPaid ? 'paid' : 'outstanding',
    });

    // Sub agent share of the agency commission; nothing has been paid out yet
    // for EXE Cheras, which is why "commission received YTD" reads RM 0.00.
    const subGross = round2(gross * (subRateSeed / 100));
    const override = round2(gross * (((subAgentSeed?.override_rate as number) ?? 0) / 100));
    const isBs = p.org === 'org-bs';
    commissionRows.push({
      id: `${p.id}-comm`, policy_id: p.id, sub_agent_id: p.agent ?? null,
      gross_amount: subGross, override_amt: override, net_amount: round2(subGross + override),
      status: isBs ? 'paid' : p.clientPaid ? 'approved' : 'pending',
      approved_date: p.clientPaid ?? null,
      payout_date: isBs ? p.principalPaid ?? p.clientPaid ?? null : null,
    });
  }

  /*
   * Two adjustments so the renewal machinery has something to show on a fresh
   * database, both relative to `today()` rather than a fixed date — otherwise
   * the demo stops demonstrating anything a month after it was written.
   *
   * One policy is moved to expire in exactly 30 days, which is when the second
   * reminder fires; and the oldest expired one is marked as renewed by the
   * newest, so the retention report has both a kept and a lapsed case.
   */
  const shift = (id: string, days: number) => {
    const d = new Date(today());
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().slice(0, 10);
    const row = policyRows.find((r) => r.id === id);
    if (row) row.expiry_date = iso;
  };
  shift('pol-v7226410', 30);
  shift('pol-t6169235', 7);

  insertAll(db, 'policy', policyRows);
  insertAll(db, 'motor_detail', motorRows);
  insertAll(db, 'non_motor_detail', nonMotorRows);
  insertAll(db, 'policy_extension', extRows);
  insertAll(db, 'payment', paymentRows);
  insertAll(db, 'commission', commissionRows);
  insertAll(db, 'life_plan', LIFE_PLANS);
  insertAll(db, 'notification', NOTIFICATIONS);
  insertAll(db, 'renewal_setting', RENEWAL_SETTINGS);

  // A renewed pair, so the retention report shows both outcomes rather than
  // an empty table until the agency has been running a year.
  db.prepare('UPDATE policy SET renewed_from_policy_id = ? WHERE id = ?')
    .run('pol-wqk100', 'pol-mdw9185');
  insertAll(db, 'quotation', QUOTATIONS);
  insertAll(db, 'renewal_request', RENEWAL_REQUESTS);
  insertAll(db, 'claim', CLAIMS);

  /*
   * Endorsements are seeded from their inputs and costed with the same
   * function the application uses, so the stored figures can never drift from
   * what the screen would calculate for them.
   */
  const policyById = new Map(policyRows.map((r) => [r.id as string, r]));
  const endorsementSeeds = [
    {
      id: 'end-2026-0001', no: 'END-2026-0001', policy: 'pol-j6519648',
      insurerRef: 'GEN/END/26/33108', type: 'sum_insured', status: 'issued',
      effective: '2026-05-01', annualDifference: 420,
      description: 'Sum insured increased from RM 62,000 to RM 68,000 following the market valuation.',
      remarks: 'Client asked for the higher figure after a valuation for the hire purchase company.',
    },
    {
      id: 'end-2026-0002', no: 'END-2026-0002', policy: 'pol-t6169235',
      insurerRef: null, type: 'extension', status: 'submitted',
      effective: '2026-07-01', annualDifference: 186,
      description: 'Strike, Riot and Civil Commotion extension added at the client\u2019s request.',
      remarks: 'Waiting on the insurer to issue.',
    },
    {
      id: 'end-2026-0003', no: 'END-2026-0003', policy: 'pol-kg-l0031',
      insurerRef: 'BS/END/26/09912', type: 'cancellation', status: 'issued',
      effective: '2026-06-20', annualDifference: 0,
      description: 'Policy cancelled from 20 June 2026 \u2014 the vehicle was sold.',
      remarks: 'Refund is on the short-period scale, not pro-rata. Client was told the figure before cancelling.',
    },
    {
      id: 'end-2026-0004', no: 'END-2026-0004', policy: 'pol-v7226410',
      insurerRef: null, type: 'address', status: 'draft',
      effective: '2026-08-01', annualDifference: 0,
      description: 'Correspondence address changed to 14 Jalan SS15/4D, Subang Jaya.',
      remarks: null,
    },
  ];

  insertAll(
    db,
    'endorsement',
    endorsementSeeds.map((e) => {
      const pol = policyById.get(e.policy)!;
      const working = calculateEndorsement({
        type: e.type,
        effectiveDate: e.effective,
        policyStart: String(pol.effective_date),
        policyEnd: String(pol.expiry_date),
        annualDifference: e.annualDifference,
        annualPremium: Number(pol.gross_premium),
      });
      return {
        id: e.id, org_id: 'org-exe', policy_id: e.policy, endorsement_no: e.no,
        insurer_ref: e.insurerRef, type: e.type, status: e.status,
        effective_date: e.effective, description: e.description,
        annual_difference: e.annualDifference, basis: working.basis,
        days_on_risk: working.daysOnRisk, days_unexpired: working.daysUnexpired,
        cover_days: working.coverDays, gross_amount: working.gross,
        service_tax: working.serviceTax, stamp_duty: working.stampDuty,
        total_amount: working.total,
        issued_date: e.status === 'issued' ? e.effective : null,
        remarks: e.remarks, created_at: e.effective, updated_at: e.effective,
      };
    }),
  );

  const rates: Row[] = [];
  for (const org of ORGS) {
    for (const pr of PRINCIPALS) {
      rates.push({ id: `cr-${org.id}-${pr.id}-m`, org_id: org.id as string, principal_id: pr.id as string, class: 'motor', rate: pr.motor_rate as number });
      rates.push({ id: `cr-${org.id}-${pr.id}-n`, org_id: org.id as string, principal_id: pr.id as string, class: 'non_motor', rate: pr.non_motor_rate as number });
    }
  }
  insertAll(db, 'commission_rate', rates);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
