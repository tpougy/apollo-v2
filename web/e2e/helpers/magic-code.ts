import { execFileSync } from "node:child_process";

// PROJECT.md C-10: the only working channel to read the real InstantDB
// magic-code email on this machine is Outlook Classic (desktop) accessed via
// COM from WSL through the `orules.ps1 peek` command. This is read-only,
// subject-line only (`--body 0`), scoped to the Inbox.
//
// Deviation from C-10's literal example command (Rule 1 - bug fix): C-10's
// prose uses `--grep 'nstant'`, expecting it to match "instant" somewhere in
// the InstantDB magic-code email. Verified against orules.ps1's actual
// implementation (Peek.cs) and a real inbox: --grep matches ONLY subject+body
// (never the sender address), and the real subject line is literally
// "<code> is your verification code for apollo" — it does not contain
// "instant" anywhere, so `--grep 'nstant'` always reports zero matches and
// (per Peek.cs) an unmatched message is never added to the listed samples.
// `--grep 'verification code'` matches every observed InstantDB magic-code
// subject and is used here instead; the sender is still cross-checked below.
const ORULES_COMMAND =
  "Set-Location 'C:\\Users\\thomaz.pougy\\Documents\\RBR\\Sandbox\\outlook-rules'; " +
  ".\\orules.ps1 peek --folder Inbox --days 1 --grep 'verification code' --body 0 --max 5";

const CODE_RE = /\b(\d{6})\b/;
const INSTANTDB_SENDER = "instantdb.com";
// orules.ps1 separates each listed message with a "── " header line
// (see Peek.cs's Render()); messages are newest-first.
const BLOCK_SEPARATOR = /\n──\s/;

function peekOutlook(): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", ORULES_COMMAND], {
    encoding: "utf8",
  });
}

/**
 * Reads the Outlook Classic inbox via C-10's `orules.ps1 peek` channel and
 * extracts the 6-digit magic code from the newest message block whose sender
 * is InstantDB's magic-code sender (`verify@auth-pm.instantdb.com`) — not a
 * blind regex over the whole output, so a 6-digit run in an unrelated email
 * can never be mistaken for a magic code.
 */
export async function readLatestMagicCode(): Promise<string> {
  const output = peekOutlook();
  const blocks = output.split(BLOCK_SEPARATOR);
  for (const block of blocks) {
    if (!block.toLowerCase().includes(INSTANTDB_SENDER)) continue;
    const match = block.match(CODE_RE);
    if (match) return match[1];
  }
  throw new Error(
    `No InstantDB (${INSTANTDB_SENDER}) magic-code message with a 6-digit code found in orules.ps1 peek output:\n${output}`,
  );
}

/**
 * Polls `readLatestMagicCode` every 2s until it returns a code different from
 * `priorCode` (the code observed before the send was triggered), so a stale
 * code from an earlier run is never mistakenly reused. No pauses beyond the
 * poll interval itself — C-10 documents ~60-90s code expiry.
 */
export async function readMagicCodeAfter(
  _sentAtMs: number,
  priorCode: string | null,
  timeoutMs = 45_000,
): Promise<string> {
  const start = Date.now();
  for (;;) {
    let code: string | null = null;
    try {
      code = await readLatestMagicCode();
    } catch {
      // No matching message yet — keep polling until timeout.
    }
    if (code && code !== priorCode) {
      return code;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for a new magic code (prior: ${priorCode ?? "none"})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
