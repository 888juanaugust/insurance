import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { claudeAvailable } from '@/lib/extract';
import { Crumb, PageHeader } from '@/components/ui';
import UploadWorkbench from '@/components/UploadWorkbench';
import BulkUpload from '@/components/BulkUpload';

export const dynamic = 'force-dynamic';

export default async function UploadPage({
  params, searchParams,
}: {
  params: Promise<{ cls: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireAdmin();

  const { cls: slug } = await params;
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) notFound();

  const sp = await searchParams;
  const bulk = sp.bulk === '1';
  const options = policyFormOptions(user.org_id);
  const title = cls === 'motor' ? 'General Motor' : 'General Non-Motor';

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: `/insurance/${slug}`, label: title }, { label: bulk ? 'Read a batch' : 'Upload PDF' }]} />
        <PageHeader
          title={bulk ? 'Read a batch' : 'Upload PDF'}
          subtitle={
            bulk
              ? 'Read a stack of policy documents in one sitting and add the clean ones together.'
              : 'Read one policy document and add it to the register.'
          }
          actions={
            <Link
              href={`/insurance/${slug}/upload${bulk ? '' : '?bulk=1'}`}
              className="btn btn-ghost"
            >
              {bulk ? 'One at a time' : 'Read a whole batch'}
            </Link>
          }
        />
      </div>

      {bulk ? (
        <BulkUpload cls={cls} />
      ) : (
        <div className="panel px-6 py-6">
          <UploadWorkbench cls={cls} {...options} claudeReady={claudeAvailable()} />
        </div>
      )}
    </div>
  );
}
