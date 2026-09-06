import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { claudeAvailable } from '@/lib/extract';
import { readingFromDocument } from '@/lib/reading';
import { getDocument, getPolicy } from '@/lib/queries';
import type { UploadState } from '@/lib/policy-actions';
import { policyHref } from '@/lib/format';
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

  /*
   * A batch row that needs a look is sent here with its document id, so it
   * gets the same check screen a single upload gets. A reading already saved
   * to a policy has nothing left to check; it goes to the policy instead.
   */
  const docId = typeof sp.doc === 'string' ? sp.doc : '';
  let reopened: UploadState | null = null;
  if (docId) {
    const doc = getDocument(docId, user.org_id);
    if (doc?.policy_id) {
      const owner = getPolicy(doc.policy_id, user.org_id);
      redirect(owner ? policyHref(owner.policy.class as string, doc.policy_id) : `/insurance/${slug}`);
    }
    reopened = readingFromDocument(docId, user.org_id);
    if (!reopened) redirect(`/insurance/${slug}/upload?bulk=1&missing=1`);
  }

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: `/insurance/${slug}`, label: title }, { label: bulk ? 'Read a batch' : 'Upload PDF' }]} />
        <PageHeader
          title={bulk ? 'Read a batch' : reopened ? 'Check what was read' : 'Upload PDF'}
          subtitle={
            bulk
              ? 'Read a stack of policy documents in one sitting and add the clean ones together.'
              : reopened
                ? `${reopened.filename} was read in a batch and needs a look before it is saved.`
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
          <UploadWorkbench cls={cls} {...options} claudeReady={claudeAvailable()} initialState={reopened} />
        </div>
      )}
    </div>
  );
}
