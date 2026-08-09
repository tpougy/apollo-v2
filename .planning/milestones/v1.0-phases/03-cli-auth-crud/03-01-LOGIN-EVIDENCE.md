# 03-01 Login Evidence — CLI-01 real magic-code round trip

Recorded by the executor agent on 2026-08-09, from `/home/thomaz/pessoal/apollo-v2/cli`.

## Mechanism used to read the magic-code email

PROJECT.md constraint C-10 authorizes the executor to read the real InstantDB
magic-code email from `tp@rbrasset.com.br`'s inbox. On this machine (WSL2
under Windows, with Outlook Classic logged into `tp@rbrasset.com.br`), the
`mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool named in
PROJECT.md and in this plan's `<action>` block was **not reachable** by this
agent. The orchestrator identified a working equivalent already present on
this machine: a local C# COM automation tool (`orules.ps1`) that reads the
same real Outlook Classic inbox via PowerShell, invoked from WSL as:

```
powershell.exe -NoProfile -Command "Set-Location 'C:\Users\thomaz.pougy\Documents\RBR\Sandbox\outlook-rules'; .\orules.ps1 peek --folder Inbox --days 1 --grep 'nstant' --body 0 --max 5"
```

This reads the real inbox over COM — it is the same non-mocked, human-possession
channel C-10 authorizes, just a different tool than the one named in the
constraint's prose. **Discrepancy for the orchestrator to reconcile in
PROJECT.md**: C-10 currently names
`mcp__claude_ai_Microsoft_365__outlook_email_search` specifically; on this
machine the equivalent authorized channel is the `orules.ps1 peek` PowerShell/COM
tool. No unrelated mail was read or acted upon — only the subject lines of the
most recent InstantDB sender (`verify@auth-pm.instantdb.com`) were inspected,
and the magic code is contained directly in the subject line (no body needed).

## Sequence performed (fresh round trip, not reusing any prior session)

1. `apollo auth logout` → `{"status": "logged_out", "removed": true}` — cleared a prior manual proof-of-concept session so this round trip is first-hand.
2. `apollo auth login --email tp@rbrasset.com.br` (no `--code`), at `2026-08-09T12:44:49Z`:
   ```json
   {"status": "code_sent", "email": "tp@rbrasset.com.br", "next": "apollo auth login --email tp@rbrasset.com.br --code <codigo-do-email>"}
   ```
   Exit 0. Confirmed no session file existed immediately after (`ls ~/.config/apollo-cli/session` → No such file or directory).
3. Waited ~22 seconds for delivery.
4. Peeked the real Outlook Classic inbox via the PowerShell/COM tool above. Newest matching message (2026-08-09 09:44 local Outlook time, sender `verify@auth-pm.instantdb.com`, subject `****** is your verification code for apollo`) — code extracted immediately, masked here.
5. `apollo auth login --email tp@rbrasset.com.br --code ******` — verified against the live InstantDB app:
   ```json
   {"status": "logged_in", "user_id": "adf0d402-06df-4406-a5c7-ce82ee1bcb7e", "email": "tp@rbrasset.com.br", "created": false, "session_file": "/home/thomaz/.config/apollo-cli/session"}
   ```
   Exit 0. `created: false` — this InstantDB `$users` record already existed from an earlier login.
6. Restart + cwd-independence proof, from `/tmp` in a brand-new process:
   ```
   cd /tmp && uv run --project /home/thomaz/pessoal/apollo-v2/cli apollo auth whoami
   {"user_id": "adf0d402-06df-4406-a5c7-ce82ee1bcb7e", "email": "tp@rbrasset.com.br", "session_file": "/home/thomaz/.config/apollo-cli/session"}
   ```
   Exit 0. `user_id` matches step 5 exactly.
7. File hardening:
   ```
   $ stat -c '%a %n' ~/.config/apollo-cli/session ~/.config/apollo-cli
   600 /home/thomaz/.config/apollo-cli/session
   700 /home/thomaz/.config/apollo-cli
   ```
8. No-leakage check: grepped the captured stdout of steps 2 and 5 for the literal 6-digit code and for the persisted `refresh_token` value. Zero matches in both cases for both values.

## Result

- **Real `user_id` (the `donoId` all later plans assert on):** `adf0d402-06df-4406-a5c7-ce82ee1bcb7e`
- **Email:** `tp@rbrasset.com.br`
- **`created`:** `false` (existing InstantDB user)
- Refresh token: never recorded here, per the plan's prohibition — it lives only in `~/.config/apollo-cli/session` at mode `600`.

The code used above was read from the real inbox via the PowerShell/COM
mechanism described above at approximately `2026-08-09T12:45:11Z` (peek
immediately followed the wait, verify immediately followed the peek).
