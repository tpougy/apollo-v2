"""Real-inbox magic-code reader — a line-for-line Python port of
`web/e2e/helpers/magic-code.ts`, not a re-implementation from scratch.

PROJECT.md C-10: the only working channel to read the real InstantDB
magic-code email on this machine is Outlook Classic (desktop) accessed via
COM from WSL through the `orules.ps1 peek` command. This is read-only,
subject-line only (`--body 0`), scoped to the Inbox.

This module copies `web/e2e/helpers/magic-code.ts`'s command string, 6-digit
regex, sender substring, and block-separator regex verbatim (RESEARCH.md's
Don't Hand-Roll table) rather than re-deriving them from PROJECT.md C-10's
own prose, which that TS file's comments document as stale and buggy (C-10's
literal example `--grep 'nstant'` never matches the real subject line,
"<code> is your verification code for apollo" — `--grep 'verification code'`
is the corrected phrase, already fixed once in the TS source; re-deriving it
here would risk reintroducing that exact bug).

See `web/e2e/helpers/magic-code.ts` (`readLatestMagicCode`/`readMagicCodeAfter`)
for the original TypeScript implementation this file mirrors.
"""

from __future__ import annotations

import re
import subprocess
import time
from typing import Final

# Source: web/e2e/helpers/magic-code.ts's ORULES_COMMAND, copied verbatim.
ORULES_COMMAND: Final[str] = (
    "Set-Location 'C:\\Users\\thomaz.pougy\\Documents\\RBR\\Sandbox\\outlook-rules'; "
    ".\\orules.ps1 peek --folder Inbox --days 1 --grep 'verification code' --body 0 --max 5"
)

_CODE_RE: Final[re.Pattern[str]] = re.compile(r"\b(\d{6})\b")
_INSTANTDB_SENDER: Final[str] = "instantdb.com"
# orules.ps1 separates each listed message with a "── " header line
# (see Peek.cs's Render()); messages are newest-first.
_BLOCK_SEPARATOR: Final[re.Pattern[str]] = re.compile(r"\n──\s")


def _peek_outlook() -> str:
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", ORULES_COMMAND],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def read_latest_magic_code() -> str | None:
    """Read the Outlook Classic inbox via C-10's `orules.ps1 peek` channel and
    extract the 6-digit magic code from the newest message block whose sender
    is InstantDB's magic-code sender (`verify@auth-pm.instantdb.com`) — not a
    blind regex over the whole output, so a 6-digit run in an unrelated email
    can never be mistaken for a magic code.

    Returns `None` (never raises) when no matching block/code is found. This
    intentionally differs from the TS original's `throw` here: the caller
    (a live round-trip test) needs a "no code seen yet" baseline read to
    succeed even when the inbox currently has no InstantDB message at all
    (e.g. the very first run in a fresh environment).
    """
    output = _peek_outlook()
    blocks = _BLOCK_SEPARATOR.split(output)
    for block in blocks:
        if _INSTANTDB_SENDER not in block.lower():
            continue
        match = _CODE_RE.search(block)
        if match:
            return match.group(1)
    return None


def read_magic_code_after(prior_code: str | None, timeout_s: float = 45.0) -> str:
    """Poll `read_latest_magic_code()` every 2s until it returns a code
    different from `prior_code` (the code observed before the send was
    triggered), so a stale code from an earlier run is never mistakenly
    reused. No pauses beyond the poll interval itself — C-10 documents
    ~60-90s code expiry, so the loop must not itself introduce needless
    delay.

    Raises `TimeoutError` (naming `prior_code`) if `timeout_s` elapses first.
    """
    start = time.monotonic()
    while True:
        code = read_latest_magic_code()
        if code is not None and code != prior_code:
            return code
        if time.monotonic() - start > timeout_s:
            msg = (
                f"Timed out after {timeout_s}s waiting for a new magic code (prior: {prior_code!r})"
            )
            raise TimeoutError(msg)
        time.sleep(2)
