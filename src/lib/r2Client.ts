import type { S3Client as S3ClientType } from '@aws-sdk/client-s3';

/**
 * Direct browser -> Cloudflare R2 uploads (school-pulse style).
 *
 * The S3 client runs in the browser and signs requests with the R2 token, so
 * the file goes straight to the bucket without passing through the API.
 *
 * NOTE: `VITE_*` values are embedded in the built JavaScript bundle. The token
 * should therefore be scoped to a single bucket and rotated if it leaks.
 */

const accountId = (import.meta.env.VITE_R2_ACCOUNT_ID as string | undefined)?.trim() || '';
const accessKeyId = (import.meta.env.VITE_R2_ACCESS_KEY_ID as string | undefined)?.trim() || '';
const secretAccessKey = (import.meta.env.VITE_R2_SECRET_ACCESS_KEY as string | undefined)?.trim() || '';
const bucket = (import.meta.env.VITE_R2_BUCKET_NAME as string | undefined)?.trim() || '';
const publicBase = ((import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined) || '')
  .trim()
  .replace(/\/+$/, '');
const endpoint =
  (import.meta.env.VITE_R2_S3_ENDPOINT as string | undefined)?.trim() ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

let client: S3ClientType | null = null;

export function isR2UploadConfigured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicBase);
}

async function getClient(): Promise<S3ClientType> {
  if (client) return client;
  if (!isR2UploadConfigured() || !endpoint) {
    throw new Error(
      'R2 upload is not configured. Add VITE_R2_ACCOUNT_ID, VITE_R2_ACCESS_KEY_ID, VITE_R2_SECRET_ACCESS_KEY, VITE_R2_BUCKET_NAME and VITE_R2_PUBLIC_BASE_URL to kib-ERP/.env.local'
    );
  }
  // Loaded on demand so the S3 SDK becomes its own chunk, not part of the app shell.
  const { S3Client } = await import('@aws-sdk/client-s3');
  client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9.-]/g, '_');
  return cleaned.slice(-120) || 'file';
}

/**
 * Upload a file straight to R2 and return its public URL.
 * The caller then persists that URL (the API never receives the file).
 */
export async function uploadFileToR2(file: File, folder = 'uploads'): Promise<string> {
  const prefix = folder.replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const body = new Uint8Array(await file.arrayBuffer());

  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getClient();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.type || 'application/octet-stream',
    })
  );

  return `${publicBase}/${key}`;
}
