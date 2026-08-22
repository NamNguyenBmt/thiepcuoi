/**
 * Gọi API của apps/web.
 *
 * Editor chạy ở cổng 5173 còn web ở 3000, nên vite proxy `/api` sang web (xem
 * vite.config.ts). Nhờ vậy không phải bật CORS, và khi hai app được deploy
 * chung một domain thì code này không đổi.
 */

import { packDoc, unpackDoc } from '@thiepcuoi/schema';
import type { TemplateDoc } from '@thiepcuoi/schema';

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  thumbnail: string | null;
  usageCount: number;
}

export interface LoadedTemplate {
  id: string;
  name: string;
  revision: number;
  doc: TemplateDoc;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown = null,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  return json(await fetch('/api/templates'));
}

export async function loadTemplate(id: string): Promise<LoadedTemplate> {
  const row = await json<{ id: string; name: string; revision: number; docPacked: string }>(
    await fetch(`/api/templates/${id}`),
  );
  return { id: row.id, name: row.name, revision: row.revision, doc: unpackDoc(row.docPacked) };
}

export async function saveTemplate(
  id: string,
  doc: TemplateDoc,
  revision: number,
): Promise<{ revision: number }> {
  return json(
    await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docPacked: packDoc(doc), name: doc.name, revision }),
    }),
  );
}

export async function createTemplate(name: string, fromTemplateId?: string): Promise<TemplateSummary> {
  return json(
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, ...(fromTemplateId ? { fromTemplateId } : {}) }),
    }),
  );
}
