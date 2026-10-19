import Link from 'next/link';
import {notFound} from 'next/navigation';
import {API_ROUTES, FaqSchema} from '@me-palnadu/contracts';
import {Badge, Button, ButtonLink} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../../lib/api';
import {getAuthenticatedAdmin} from '../../../../lib/session';
import {formatDateTime} from '../../../../lib/format';
import {FaqForm} from '../../../../components/dashboard/faq-form';
import {ConfirmButton} from '../../../../components/dashboard/confirm-button';
import {Notice, PageHeader, StatusBadge} from '../../../../components/dashboard/ui';
import {
  deleteFaqAction,
  transitionFaqAction,
  updateFaqAction,
} from '../../../../lib/content-actions';

export const metadata = {title: 'Edit FAQ entry'};

interface PageProps {
  params: Promise<{id: string}>;
}

export default async function EditFaqPage({params}: PageProps) {
  const {id} = await params;
  const admin = await getAuthenticatedAdmin();

  let faq;
  try {
    faq = await adminApiFetch(`${API_ROUTES.faqAdmin}/${id}`, FaqSchema);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'NOT_FOUND') notFound();
    return (
      <>
        <PageHeader title="Edit FAQ entry" description="The entry could not be loaded." />
        <Notice tone="error">{describeActionError(error)}</Notice>
        <ButtonLink href="/dashboard/faq" variant="secondary" size="sm">
          Back to FAQ
        </ButtonLink>
      </>
    );
  }

  const update = updateFaqAction.bind(null, faq.id);

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/faq"
          className="inline-flex min-h-6 items-center text-body-sm text-accent-text underline-offset-2 hover:underline"
        >
          ← All FAQ entries
        </Link>
        <PageHeader title={faq.question} description="Edit the answer, category, or order." />
        <div className="flex flex-wrap items-center gap-3 text-meta text-text-tertiary">
          <StatusBadge status={faq.status} />
          <Badge tone="accent">{faq.category.replaceAll('_', ' ')}</Badge>
          <span>Order {faq.sortIndex}</span>
          <span>Updated {formatDateTime(faq.updatedAt)}</span>
          {faq.publishedAt !== undefined && (
            <span>Published {formatDateTime(faq.publishedAt)}</span>
          )}
        </div>
      </div>

      <FaqForm action={update} faq={faq} submitLabel="Save changes" />

      <section
        aria-labelledby="faq-publication"
        className="flex max-w-3xl flex-col gap-4 border-t border-border-subtle pt-8"
      >
        <h2 id="faq-publication" className="text-h3 font-semibold text-text-primary">
          Publication
        </h2>
        <p className="text-body-sm text-text-secondary">
          Publishing includes the answer on /faq and invalidates that page&apos;s cache.
        </p>
        <div className="flex flex-wrap gap-3">
          {faq.status !== 'published' && (
            <form action={transitionFaqAction.bind(null, faq.id, 'publish')}>
              <Button type="submit">Publish</Button>
            </form>
          )}
          {faq.status === 'published' && (
            <>
              <form action={transitionFaqAction.bind(null, faq.id, 'unpublish')}>
                <Button type="submit" variant="secondary">
                  Unpublish
                </Button>
              </form>
              <form action={transitionFaqAction.bind(null, faq.id, 'archive')}>
                <Button type="submit" variant="secondary">
                  Archive
                </Button>
              </form>
            </>
          )}
          {faq.status === 'archived' && (
            <form action={transitionFaqAction.bind(null, faq.id, 'publish')}>
              <Button type="submit">Publish again</Button>
            </form>
          )}
        </div>
      </section>

      {admin?.role === 'owner' && (
        <section
          aria-labelledby="delete-faq"
          className="flex max-w-3xl flex-col gap-3 rounded-lg border border-border-default p-5"
        >
          <h2 id="delete-faq" className="text-body font-semibold text-text-primary">
            Delete FAQ entry
          </h2>
          <p className="text-body-sm text-text-secondary">
            Deletion is permanent. The audit entry describing the write remains.
          </p>
          <form action={deleteFaqAction.bind(null, faq.id)}>
            <ConfirmButton message={`Delete “${faq.question}”? This cannot be undone.`}>
              Delete permanently
            </ConfirmButton>
          </form>
        </section>
      )}
    </>
  );
}
