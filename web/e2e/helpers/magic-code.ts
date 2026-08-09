import { execFileSync } from "node:child_process";

// PROJECT.md C-10: the only working channel to read the real InstantDB
// magic-code email on this machine is Outlook Classic (desktop) accessed via
// COM from WSL through the `orules.ps1 peek` command. This is read-only,
// subject-line only (`--body 0`), scoped to the Inbox and to messages whose
// subject/body contains "nstant" (InstantDB's magic-code sender). Codes
// expire in ~60-90s — callers must invoke this immediately after triggering
// a send, with no pauses beyond the poll interval below.
const ORULES_COMMAND =
  "Set-Location 'C:\\Users\\thomaz.pougy\\Documents\\RBR\\Sandbox\\outlook-rules'; " +
  ".\\orules.ps1 peek --folder Inbox --days 1 --grep 'nstant' --body 0 --max 5";

const CODE_RE = /\b(\d{6})\b/;

function peekOutlook(): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", ORULES_COMMAND], {
    encoding: "utf8",
  });
}

/**
 * Reads the Outlook Classic inbox via C-10's `orules.ps1 peek` channel and
 * extracts the 6-digit magic code from the most recent matching message's
 * subject line (the InstantDB magic-code email embeds the code directly in
 * the subject, e.g. "423630 is your verification code for apollo").
 */
export async function readLatestMagicCode(): Promise<string> {
  const output = peekOutlook();
  const match = output.match(CODE_RE);
  if (!match) {
    throw new Error(`No 6-digit magic code found in orules.ps1 peek output:\n${output}`);
  }
  return match[1];
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
