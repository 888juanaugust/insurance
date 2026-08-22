import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { listRegister } from '@/lib/queries';
import { CLASS_BY_SLUG } from '@/lib/form-data';

const HEADERS = [
  ['issue_date', 'Issue Date'], ['policy_no', 'Policy No'], ['cover_note_no', 'Cover Note'],
  ['principal', 'Principal'], ['vehicle_no', 'Veh.No'], ['make_model', 'Make & Model'],
  ['insured', 'Insured Name'], ['ident', 'NRIC / Passport / BRN'],
  ['effective_date', 'Effective Date'], ['expiry_date', 'Expiry Date'],
  ['sum_insured', 'Sum Insured (MYR)'], ['gross_premium', 'Gross Premium (MYR)'],
  ['service_tax', 'Service Tax (MYR)'], ['stamp_duty', 'Stamp Duty (MYR)'],
  ['total_premium', 'Total Payable (MYR)'], ['referral_fee', 'Referral Fee (MYR)'],
  ['commission_amt', 'Total Commission (MYR)'], ['agent_commission', 'Agent/Broker Commission (MYR)'],
  ['agent_name', 'Servicing Agent'], ['status', 'Status'],
  ['client_paid', 'Client Payment'], ['principal_paid', 'Principal Payment'],
] as const;

/** Quote a CSV cell, and stop a leading =/+/-/@ being run as a spreadsheet formula. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request, { params }: { params: Promise<{ cls: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { cls: slug } = await params;
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) return NextResponse.json({ error: 'Unknown register' }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  const get = (k: string) => sp.get(k) ?? '';

  const rows = listRegister(user.org_id, {
    cls,
    principal: get('principal'),
    agent: get('agent'),
    status: get('status'),
    dateField: (get('dateField') || 'uploaded_at') as 'uploaded_at' | 'issue_date' | 'effective_date',
    from: get('from'),
    to: get('to'),
    vehicle: get('vehicle'),
    insured: get('insured'),
    nric: get('nric'),
    sort: get('sort'),
    dir: get('dir') === 'asc' ? 'asc' : 'desc',
  });

  const lines = [
    HEADERS.map(([, label]) => cell(label)).join(','),
    ...rows.map((r) => HEADERS.map(([key]) => cell(r[key])).join(',')),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="insurance-helper-${slug}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
