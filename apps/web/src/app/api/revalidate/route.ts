import {createHash, timingSafeEqual} from 'node:crypto';
import {revalidatePath, revalidateTag} from 'next/cache';
import {
  REVALIDATE_SECRET_HEADER,
  RevalidateRequestSchema,
  RevalidateResponseSchema,
} from '@me-palnadu/contracts';

export const runtime = 'nodejs';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/** Constant-time comparison; hashing first removes the length side channel. */
const secretsMatch = (provided: string, expected: string): boolean =>
  timingSafeEqual(digest(provided), digest(expected));

export const POST = async (request: Request): Promise<Response> => {
  const expected = process.env['REVALIDATE_SECRET'];
  if (expected === undefined || expected.length === 0) {
    return Response.json(
      {error: 'revalidation is not configured on this deployment'},
      {status: 503, headers: {'Cache-Control': 'no-store'}},
    );
  }

  const provided = request.headers.get(REVALIDATE_SECRET_HEADER);
  if (provided === null || !secretsMatch(provided, expected)) {
    return Response.json(
      {error: 'unauthorized'},
      {status: 401, headers: {'Cache-Control': 'no-store'}},
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = RevalidateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {error: 'invalid request'},
      {status: 400, headers: {'Cache-Control': 'no-store'}},
    );
  }

  for (const tag of parsed.data.tags) revalidateTag(tag, 'max');
  for (const path of parsed.data.paths) revalidatePath(path);

  return Response.json(
    RevalidateResponseSchema.parse({
      revalidated: true,
      tags: parsed.data.tags,
      paths: parsed.data.paths,
    }),
    {status: 200, headers: {'Cache-Control': 'no-store'}},
  );
};
