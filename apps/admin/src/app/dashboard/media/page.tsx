import Image from 'next/image';
import {
  API_ROUTES,
  MediaAssetSchema,
  MediaStatusSchema,
  PaginatedResponseSchema,
  type MediaAsset,
} from '@me-palnadu/contracts';
import {Badge} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../lib/api';
import {getAuthenticatedAdmin} from '../../../lib/session';
import {formatBytes, formatDateTime} from '../../../lib/format';
import {deleteMediaAction} from '../../../lib/media-actions';
import {ConfirmButton} from '../../../components/dashboard/confirm-button';
import {MediaUploader} from '../../../components/dashboard/media-uploader';
import {EmptyState, Notice, PageHeader} from '../../../components/dashboard/ui';

export const metadata = {title: 'Media'};

interface PageProps {
  searchParams: Promise<{error?: string; page?: string}>;
}

export default async function MediaPage({searchParams}: PageProps) {
  const params = await searchParams;
  const admin = await getAuthenticatedAdmin();

  let status;
  let items: MediaAsset[] = [];
  let error: string | null = params.error ?? null;
  try {
    [status, items] = await Promise.all([
      adminApiFetch(`${API_ROUTES.media}/status`, MediaStatusSchema),
      adminApiFetch(
        `${API_ROUTES.media}?page=${encodeURIComponent(params.page ?? '1')}`,
        PaginatedResponseSchema(MediaAssetSchema),
      ).then((response) => response.items),
    ]);
  } catch (caught) {
    error = describeActionError(caught);
  }

  return (
    <>
      <PageHeader
        title="Media"
        description="Assets are uploaded directly from this browser to Cloudinary. The API stores metadata and a short-lived signature, never the file."
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      {status === undefined ? null : status.configured ? (
        <section aria-labelledby="upload" className="flex flex-col gap-4">
          <h2 id="upload" className="text-h3 font-semibold text-text-primary">
            Upload
          </h2>
          <MediaUploader status={status} />
        </section>
      ) : (
        <section
          aria-labelledby="media-setup"
          className="flex max-w-2xl flex-col gap-3 rounded-lg border border-border-default bg-surface p-5"
        >
          <h2 id="media-setup" className="text-body font-semibold text-text-primary">
            Setup required
          </h2>
          <p className="text-body-sm text-text-secondary">
            The media library is not configured for this deployment. Set the three Cloudinary
            variables on the API service, then restart it:
          </p>
          <ul className="list-disc pl-5 font-mono text-meta text-text-secondary">
            <li>CLOUDINARY_CLOUD_NAME</li>
            <li>CLOUDINARY_API_KEY</li>
            <li>CLOUDINARY_API_SECRET</li>
          </ul>
          <p className="text-meta text-text-tertiary">
            The secret is read only by the API. It is never returned to this page.
          </p>
        </section>
      )}

      <section aria-labelledby="library" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="library" className="text-h3 font-semibold text-text-primary">
            Library
          </h2>
          <span className="text-meta text-text-tertiary">{items.length} shown</span>
        </div>

        {items.length === 0 ? (
          <EmptyState>No assets registered yet.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4"
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-surface-subtle">
                  {asset.resourceType === 'image' ? (
                    <Image
                      src={asset.secureUrl}
                      alt={asset.alt}
                      width={asset.width ?? 640}
                      height={asset.height ?? 360}
                      className="h-full w-full object-cover"
                      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
                    />
                  ) : (
                    <span className="text-meta uppercase tracking-wider text-text-tertiary">
                      {asset.format}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <p
                    className="truncate text-body-sm font-medium text-text-primary"
                    title={asset.originalFilename}
                  >
                    {asset.originalFilename}
                  </p>
                  <p className="text-meta text-text-tertiary">
                    {formatBytes(asset.bytes)} · {asset.format.toUpperCase()} ·{' '}
                    <time dateTime={asset.createdAt}>{formatDateTime(asset.createdAt)}</time>
                  </p>
                  {asset.alt.length > 0 && (
                    <p className="text-meta text-text-secondary">Alt: {asset.alt}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={asset.resourceType === 'image' ? 'accent' : 'neutral'}>
                    {asset.resourceType}
                  </Badge>
                  <a
                    href={asset.secureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-meta text-accent-text underline underline-offset-2"
                  >
                    Open asset
                  </a>
                  {admin?.role === 'owner' && (
                    <form action={deleteMediaAction.bind(null, asset.id)} className="ml-auto">
                      <ConfirmButton
                        message={`Delete ${asset.originalFilename} from Cloudinary and the library?`}
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
