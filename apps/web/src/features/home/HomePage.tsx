// SPDX-License-Identifier: GPL-3.0-only
import { useId, useRef, useState, type DragEvent } from 'react';
import { isSharedOrigin, sharedOriginWarning } from '../../app/origin.ts';
import { Icon } from '../../ui/Icon.tsx';

/**
 * Web first run (DESIGN §6, SPEC §11): open a .zwallet file from the phone, or start fresh.
 * Import and the local database arrive in M1; for now the choices are acknowledged only.
 */
export function HomePage() {
  const input = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);

  const pick = (file: File | undefined) => {
    if (file) setStatus(`${file.name} is ready. Opening .zwallet files arrives with import.`);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  const shared = isSharedOrigin(window.location, import.meta.env.BASE_URL);

  return (
    <div className="flex flex-col items-center gap-6 py-8 expanded:py-16">
      {shared && (
        <div
          role="alert"
          className="flex w-full max-w-xl items-start gap-3 rounded-md border border-outline bg-error-container p-4 text-body-sm text-on-error-container"
        >
          <Icon name="info" className="size-5 shrink-0" />
          <p>{sharedOriginWarning(window.location.hostname)}</p>
        </div>
      )}
      <section
        aria-labelledby="first-run-title"
        className="w-full max-w-xl rounded-lg bg-surface-raised p-6 medium:p-8"
      >
        <h1 id="first-run-title" className="text-headline">
          Open your zwallet file
        </h1>
        <p className="mt-2 text-body text-ink-secondary">
          Export a <span className="font-semibold">.zwallet</span> file on your phone, then open it
          here to see your money on a bigger screen.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={onDrop}
          className={`mt-6 flex flex-col items-center gap-3 rounded-md border-2 border-dashed px-4 py-8 text-center ${
            dragging ? 'border-primary bg-primary-container/40' : 'border-outline'
          }`}
        >
          <Icon name="upload" className="size-8 text-primary" />
          <p className="text-body-sm text-ink-secondary">Drop a .zwallet file here</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-describedby={statusId}
            className="min-h-12 rounded-md bg-primary px-6 text-label text-on-primary"
          >
            Choose file…
          </button>
          <input
            ref={input}
            type="file"
            accept=".zwallet,application/octet-stream"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              pick(e.target.files?.[0]);
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus('Starting fresh arrives with the ledger. Nothing was created yet.');
          }}
          className="mt-4 min-h-12 w-full rounded-md border border-outline text-label text-ink-primary hover:bg-surface-sunken"
        >
          Start fresh
        </button>
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="mt-3 min-h-5 text-body-sm text-ink-secondary"
        >
          {status}
        </p>
        <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-muted">
          <Icon name="lock" className="size-5 shrink-0" />
          Your file is opened in this browser only — nothing is uploaded.
        </p>
      </section>
    </div>
  );
}
