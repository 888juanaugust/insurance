import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { claudeAvailable } from '@/lib/extract';
import { Crumb, PageHeader } from '@/components/ui';
import UploadWorkbench from '@/components/UploadWorkbench';

export const dynamic = 'force-dynamic';

export default async function UploadPage({ params }: { params: Promise<{ cls: string }> }) {
  const user = await requireAdmin();

  const { cls: slug } = await params;
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) notFound();

  const options = policyFormOptions(user.org_id);
  const title = cls === 'motor' ? 'General Motor' : 'General Non-Motor';

  return (
    <div className="panel px-6 py-6">
      <Crumb items={[{ href: `/insurance/${slug}`, label: title }, { label: 'Upload PDF' }]} />
      <PageHeader
        title="Upload PDF"
        subtitle="Read a policy document and add it to the register."
      />
      <UploadWorkbench cls={cls} {...options} claudeReady={claudeAvailable()} />
    </div>
  );
}
