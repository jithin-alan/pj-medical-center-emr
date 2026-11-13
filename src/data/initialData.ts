/**
 * SINGLE SOURCE OF TRUTH for all clinic initial/demo data.
 *
 * The canonical dataset lives in `../../server/initialData.ts`, which is the
 * file actually loaded by the server at runtime (`server/dataStore.ts`).
 * This file exists only so that any frontend tooling or developer expecting to
 * find initial data under `src/data/` can import from here without duplicating
 * the dataset.
 *
 * Any new seed data MUST be added to `../../server/initialData.ts` first;
 * this file simply re-exports it.
 */
export * from '../../server/initialData';