'use client';

import {useRef, useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {MEDIA_MAX_BYTES, type MediaRegisterInput, type MediaStatus} from '@me-palnadu/contracts';
import {Button, Field, TextInput} from '@me-palnadu/ui';
import {registerMediaAction, requestMediaSignature} from '../../lib/media-actions';

/**
 * Direct-to-Cloudinary upload.
 *
 * The API signs a short-lived upload; the bytes go from this browser to the provider
 * and never through the API (ADR-0010 §4). Registration happens afterwards, so the
 * library's metadata always follows a successful provider upload.
 */
interface CloudinaryUpload {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
  original_filename: string;
}

const isUpload = (value: unknown): value is CloudinaryUpload => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['secure_url'] === 'string' &&
    typeof record['public_id'] === 'string' &&
    typeof record['format'] === 'string' &&
    typeof record['resource_type'] === 'string' &&
    typeof record['bytes'] === 'number' &&
    typeof record['original_filename'] === 'string'
  );
};

export const MediaUploader = ({status}: {status: MediaStatus}) => {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const fileInput = event.currentTarget.elements.namedItem('file');
    if (!(fileInput instanceof HTMLInputElement) || fileInput.files === null) {
      return;
    }
    const file = fileInput.files[0];
    if (file === undefined) {
      setError('Choose a file first.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!status.allowedFormats.includes(extension as (typeof status.allowedFormats)[number])) {
      setError(`Allowed formats: ${status.allowedFormats.join(', ')}.`);
      return;
    }
    if (file.size > Math.min(status.maxBytes, MEDIA_MAX_BYTES)) {
      setError(`The file must be at most ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }

    const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
    setBusy(true);
    try {
      const signed = await requestMediaSignature(resourceType);
      if (!signed.ok) {
        setError(signed.error);
        return;
      }

      const body = new FormData();
      body.set('file', file);
      body.set('api_key', signed.data.apiKey);
      body.set('timestamp', String(signed.data.timestamp));
      body.set('signature', signed.data.signature);
      body.set('signature_algorithm', 'sha256');
      body.set('folder', signed.data.folder);
      body.set('allowed_formats', signed.data.allowedFormats.join(','));

      const response = await fetch(signed.data.uploadUrl, {method: 'POST', body});
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isUpload(payload)) {
        setError('The upload was refused by the media provider.');
        return;
      }

      const register: MediaRegisterInput = {
        publicId: payload.public_id,
        secureUrl: payload.secure_url,
        format: payload.format as MediaRegisterInput['format'],
        resourceType: payload.resource_type as MediaRegisterInput['resourceType'],
        bytes: payload.bytes,
        ...(payload.width === undefined ? {} : {width: payload.width}),
        ...(payload.height === undefined ? {} : {height: payload.height}),
        originalFilename: payload.original_filename,
        alt: alt.trim(),
      };

      const registered = await registerMediaAction(register);
      if (!registered.ok) {
        setError(registered.error);
        return;
      }

      setNotice('Uploaded and registered.');
      setAlt('');
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError('The upload could not be completed. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      {error !== null && (
        <div
          role="alert"
          className="rounded-md border border-danger bg-surface px-4 py-3 text-body-sm text-danger"
        >
          {error}
        </div>
      )}
      {notice !== null && (
        <div
          role="status"
          className="rounded-md border border-border-default bg-surface px-4 py-3 text-body-sm text-text-secondary"
        >
          {notice}
        </div>
      )}

      <Field
        id="file"
        label="File"
        hint={`${status.allowedFormats.join(', ')} · maximum ${Math.round(status.maxBytes / (1024 * 1024))} MB`}
      >
        <TextInput
          id="file"
          name="file"
          type="file"
          accept={status.allowedFormats.map((format) => `.${format}`).join(',')}
          required
        />
      </Field>

      <Field
        id="alt"
        label="Alternative text"
        hint="Describe the asset for a reader who cannot see it."
      >
        <TextInput
          id="alt"
          name="alt"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          maxLength={300}
        />
      </Field>

      <Button type="submit" disabled={busy} className="self-start">
        {busy ? 'Uploading…' : 'Upload asset'}
      </Button>
    </form>
  );
};
