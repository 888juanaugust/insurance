import { requireAdmin } from '@/lib/guard';
import { PageHeader } from '@/components/ui';
import ImportWorkbench from '@/components/ImportWorkbench';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Import"
          subtitle="Bring an existing book across from a spreadsheet. Nothing is written until you have seen what would happen."
        />
      </div>
      <ImportWorkbench />
    </div>
  );
}
