#!/usr/bin/env bun
// Proves InstantDB's live donoId permission rules reject an unauthenticated
// ("guest") write, per SETUP-08 / threat T-01-13.
//
// Why a write and not a read: InstantDB's `view` rule denials are evaluated
// per-row and silently filter disallowed rows out of a query result — on an
// empty table (as this app always is outside a real user's own data) a
// guest read is indistinguishable from an enforced one (both return `[]`
// with exit 0). Only a `create`/`update`/`delete` attempt can produce a
// real pass/fail signal, since InstantDB rejects the whole transaction when
// permissions fail. This mirrors the methodology established in
// 01-01-SUMMARY.md ("Substituted a write-based guest-rejection test").
//
// Invoked from web/ so `@instantdb/admin` resolves from web/node_modules.
// Never logs the app id or admin token — only pass/fail plus the server's
// own (non-secret) rejection message.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { init, id, tx } from "@instantdb/admin";

const envPath = fileURLToPath(new URL("../../../.env.instantdb", import.meta.url));
const parsed = parse(readFileSync(envPath));

const appId = parsed.NEXT_PUBLIC_INSTANT_APP_ID ?? parsed.INSTANT_APP_ID;
const adminToken = parsed.INSTANT_APP_ADMIN_TOKEN;

if (!appId || !adminToken) {
  console.error("RESULT=CONFIG_ERROR");
  console.error("MESSAGE=Missing app id or admin token in .env.instantdb");
  process.exit(1);
}

const db = init({ appId, adminToken });
const guestDb = db.asUser({ guest: true });
const probeId = id();

try {
  await guestDb.transact(
    tx.fundos[probeId].update({
      nome: "guest-denial-probe",
      codigo: "GUEST-PROBE",
      ativo: false,
      donoId: "guest-denial-probe",
      createdAt: new Date().toISOString(),
    }),
  );
  console.error("RESULT=UNEXPECTED_SUCCESS");
  console.error("MESSAGE=Guest write was NOT rejected — permission rules regressed");
  // Best-effort cleanup if the write somehow succeeded.
  await db.transact(tx.fundos[probeId].delete());
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log("RESULT=EXPECTED_REJECTION");
  console.log(`MESSAGE=${message}`);
  process.exit(0);
}
