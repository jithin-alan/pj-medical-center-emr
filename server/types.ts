/**
 * SINGLE SOURCE OF TRUTH for all clinic data types.
 *
 * The canonical type definitions live in `../src/types.ts` (the frontend
 * module). This file exists only so that server-side code can keep importing
 * from `./types` / `./server/types` without changing its import paths.
 *
 * Any new type or field MUST be added to `../src/types.ts` first; this file
 * simply re-exports it.
 */
export * from '../src/types';