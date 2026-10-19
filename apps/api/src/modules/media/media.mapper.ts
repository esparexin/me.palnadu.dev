import {createHash} from 'node:crypto';
import {
  MediaFormatSchema,
  MediaResourceTypeSchema,
  type MediaAsset,
  type MediaFormat,
  type MediaResourceType,
} from '@me-palnadu/contracts';
import {ApiError} from '../../common/api-error.js';

export interface MediaRow {
  id: string;
  publicId: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalFilename: string;
  alt: string;
  createdAt: Date;
}

export const DEFAULT_FOLDER = 'me-palnadu/media';

export interface DeploymentAsset {
  cloudName: string;
  folder: string;
  publicId: string;
  secureUrl: string;
  format: MediaFormat;
  resourceType: MediaResourceType;
}

/**
 * Proves that a registration names an asset this deployment could have uploaded.
 *
 * The URL is not merely checked for the Cloudinary hostname: its path must resolve
 * to the submitted public id, format, resource type and cloud.
 */
export const isDeploymentAsset = ({
  cloudName,
  folder,
  publicId,
  secureUrl,
  format,
  resourceType,
}: DeploymentAsset): boolean => {
  if (!publicId.startsWith(`${folder}/`)) return false;
  const segments = publicId.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(secureUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return false;
  if (url.port !== '' || url.username !== '' || url.password !== '') return false;
  if (url.search !== '' || url.hash !== '') return false;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }

  const prefix = `/${cloudName}/${resourceType}/upload/`;
  if (!pathname.startsWith(prefix)) return false;
  const expected = `${publicId}.${format}`;
  const remainder = pathname.slice(prefix.length);
  if (remainder === expected) return true;

  const versioned = /^v\d+\/(.+)$/u.exec(remainder);
  return versioned?.[1] === expected;
};

/**
 * Cloudinary's documented signing recipe: SHA-1 over alphabetically sorted
 * `key=value` pairs joined with `&`, followed by the API secret.
 */
export const signParams = (params: Record<string, string>, apiSecret: string): string => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};

export const destroyCloudinaryAsset = async (params: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  publicId: string;
  resourceType: string;
}): Promise<void> => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams(
    {public_id: params.publicId, timestamp: String(timestamp)},
    params.apiSecret,
  );
  const body = new URLSearchParams({
    public_id: params.publicId,
    timestamp: String(timestamp),
    api_key: params.apiKey,
    signature,
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${params.cloudName}/${params.resourceType}/destroy`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw ApiError.dependencyUnavailable(
      'The media provider could not be reached; the asset was not deleted.',
    );
  }

  if (response.status === 404) return;
  if (!response.ok) {
    throw ApiError.dependencyUnavailable(
      'The media provider refused the deletion; the asset was not deleted.',
    );
  }
};

/** Database row to contract type. */
export const toContract = (row: MediaRow): MediaAsset => ({
  id: row.id,
  publicId: row.publicId,
  secureUrl: row.secureUrl,
  format: MediaFormatSchema.parse(row.format),
  resourceType: MediaResourceTypeSchema.parse(row.resourceType),
  bytes: row.bytes,
  ...(row.width === null ? {} : {width: row.width}),
  ...(row.height === null ? {} : {height: row.height}),
  originalFilename: row.originalFilename,
  alt: row.alt,
  createdAt: row.createdAt.toISOString(),
});

export const __testing = {signParams, toContract};
