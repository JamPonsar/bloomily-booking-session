import { randomUUID } from 'node:crypto';

export type IdPrefix = 'par' | 'chd' | 'ses' | 'bkg';

/** Prefixed ids make it obvious which table a value belongs to (e.g. "ses_3f9a1c2b7d10"). */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
