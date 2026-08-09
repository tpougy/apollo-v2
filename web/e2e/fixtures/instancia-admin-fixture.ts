import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { init } from "@instantdb/admin";
import { parse } from "dotenv";

// TEST FIXTURE ONLY — never a runtime path. `@instantdb/admin` and
// `INSTANT_APP_ADMIN_TOKEN` never reach `web/src` (grep-verified by Task 2's
// acceptance criteria and by the built-bundle grep below); this module lives
// under `web/e2e/`, is never imported by anything under `web/src/`, and is
// therefore never bundled into the shipped browser app (`web/dist`).
//
// Its sole purpose: `instanciasRotina` has NO create path anywhere by design
// — neither the SPA (capabilities.create: false, see
// web/src/lib/entities/defs/instanciasRotina.ts) nor the CLI
// (cli/apollo_cli/entities/rotina.py has no `instancia criar`) may create an
// instance, because C-06's idempotency guarantee depends on instances being
// minted exclusively by Phase 5's dedupeKey-keyed generation job. To exercise
// the status-only UPDATE path in Test 2 below, a single instance must exist;
// this fixture seeds and tears down exactly one record via the InstantDB
// admin API, deliberately bypassing both forbidden channels rather than
// adding a create affordance to either.
//
// `listInstancesByTemplate`/`deleteInstancesByTemplate` (plan 05-03) extend
// this same rationale to the live idempotency spec (`routine-job.spec.ts`):
// instances have no delete path on either channel by design, so admin-only
// teardown is the only way that spec avoids leaving permanent debris (real
// `instanciasRotina` rows) in the live app after asserting on job-generated
// server state.
const envPath = fileURLToPath(new URL("../../../.env.instantdb", import.meta.url));
const parsed = parse(readFileSync(envPath));
const appId = parsed.NEXT_PUBLIC_INSTANT_APP_ID ?? parsed.INSTANT_APP_ID;
const adminToken = parsed.INSTANT_APP_ADMIN_TOKEN;

if (!appId || !adminToken) {
  throw new Error(
    `Missing InstantDB admin credentials: expected NEXT_PUBLIC_INSTANT_APP_ID (or INSTANT_APP_ID) and INSTANT_APP_ADMIN_TOKEN in ${envPath}`,
  );
}

const adminDb = init({ appId, adminToken });

export interface SeedInstanceFields {
  dedupeKey: string;
  dataPrevista: string; // ISO date string
  competencia: string;
  tipoPrazo: string;
  status: string;
}

/**
 * Seeds exactly one `instanciasRotina` record, owned by `ownerEmail` (must be
 * an existing InstantDB user — the auth.setup.ts `authed` project user in
 * this suite), via the admin API. Returns the new record's id.
 */
export async function seedInstance(
  fields: SeedInstanceFields,
  ownerEmail: string,
): Promise<string> {
  const owner = await adminDb.auth.getUser({ email: ownerEmail });
  const newId = crypto.randomUUID();
  await adminDb.transact(
    adminDb.tx.instanciasRotina[newId].update({
      ...fields,
      donoId: owner.id,
    }),
  );
  return newId;
}

/** Reads a seeded instance's current server state via the admin API. */
export async function readInstance(eid: string): Promise<Record<string, unknown> | null> {
  const result = (await adminDb.query({
    instanciasRotina: { $: { where: { id: eid } } },
  } as never)) as { instanciasRotina: Record<string, unknown>[] };
  return result.instanciasRotina[0] ?? null;
}

/** Deletes a seeded instance via the admin API. Tolerates "already gone". */
export async function deleteInstance(eid: string): Promise<void> {
  try {
    await adminDb.transact(adminDb.tx.instanciasRotina[eid].delete());
  } catch {
    // Already deleted — fine (mirrors the CLI-cleanup tolerance pattern used
    // throughout this phase's other e2e specs).
  }
}

/**
 * TEST-CLEANUP-ONLY escape hatch: deletes an arbitrary record by etype/id via
 * the admin API. Used exclusively to sweep `phase04-e2e-` test leftovers from
 * `logInferenciaClaude` after Test 3 — that entity has NO `deletar` command
 * on the CLI and NO delete capability in the SPA by design (append-only
 * audit trail, PROJECT.md threat T-03-26), so this admin-only path is the
 * only way an automated test can avoid leaving permanent debris in the live
 * app. This is never invoked from `web/src`, never wired to any UI or CLI
 * command, and exists solely so this spec file's own leftovers do not
 * accumulate forever.
 */
export async function deleteAdminRecord(etype: string, eid: string): Promise<void> {
  try {
    const tx = adminDb.tx as unknown as Record<string, Record<string, { delete: () => unknown }>>;
    await adminDb.transact(tx[etype][eid].delete() as never);
  } catch {
    // Already deleted — fine.
  }
}

/**
 * Reads every `instanciasRotina` record linked to `templateId`, via the
 * admin API. Used by `routine-job.spec.ts` to assert on server state
 * produced by the live generation job without going through the SPA's
 * reactive query layer (which could mask a stale read).
 */
export async function listInstancesByTemplate(
  templateId: string,
): Promise<Record<string, unknown>[]> {
  const result = (await adminDb.query({
    instanciasRotina: { $: { where: { "template.id": templateId } } },
  } as never)) as { instanciasRotina: Record<string, unknown>[] };
  return result.instanciasRotina;
}

/**
 * TEST-ONLY teardown: deletes every `instanciasRotina` record linked to
 * `templateId` via the admin API. `instanciasRotina` has no delete path on
 * either the SPA or the CLI by design (C-06) — this is the only way
 * `routine-job.spec.ts` can avoid leaving permanent debris in the live app
 * after proving the job's idempotent-generation behavior.
 */
export async function deleteInstancesByTemplate(templateId: string): Promise<void> {
  const records = await listInstancesByTemplate(templateId);
  for (const record of records) {
    await deleteAdminRecord("instanciasRotina", record.id as string);
  }
}
