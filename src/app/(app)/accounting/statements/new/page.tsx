import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { listPrincipals } from '@/lib/queries';
import { PageHeader } from '@/components/ui';
import StatementImport from '@/components/StatementImport';

export const dynamic = 'force-dynamic';

export default async function NewStatementPage() {
  await requireAdmin({ action: 'statement.import', entity: 'statement' });
  const principals = listPrincipals().filter((p) => p.status === 'active');

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Check a statement"
          subtitle="Set what the insurer says it paid against what the register says it owes, line by line."
          actions={<Link href="/accounting/statements" className="btn btn-ghost">All statements</Link>}
        />
      </div>
      <StatementImport
        principals={principals.map((p) => ({ id: p.id, short_name: p.short_name, name: p.name }))}
      />
    </div>
  );
}
