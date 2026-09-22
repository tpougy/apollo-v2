# Deferred items — Phase 27 (Robustez do job)

## Residual risk accepted: cross-runtime Unicode Mark-category drift in `_is_concluida`/`isConcluida`

**Status:** accepted, not fixed (3-iteration code-review fix cap reached)

`_is_concluida` (Python) and `isConcluida` (TS) both classify combining marks via
"Unicode General_Category = Mark", but each runtime's bundled Unicode Character
Database version differs (Python 3.12.12 → UCD 15.0.0, Node 20.20.2's `\p{M}` →
a newer UCD revision). An exhaustive enumeration during code review found 93
code points (all outside the Latin/Portuguese script — e.g. U+0897, U+1ACF–U+1AEB)
where the two runtimes disagree on Mark-category membership, which would make
`_is_concluida`/`isConcluida` return different booleans for the same string if
one of those code points appeared inside a `status` value.

**Why accepted rather than fixed:** the two originally-reported repro cases
(U+20D0 COMBINING LEFT HARPOON ABOVE, U+0E31 Thai MAI HAN-AKAT) are fixed and
covered by fixture cases — those were plausible, review-discoverable inputs.
The remaining 93-code-point set requires vendoring a pinned, identical Unicode
Mark-category table into both runtimes (the same pattern this project already
uses for the ANBIMA calendar, C-03) to fully close — a disproportionate fix
for code points that do not occur in Brazilian-Portuguese fund-controladoria
status text (`"concluida"`, `"em andamento"`, `"pendente"`, etc., all pure
ASCII plus the 5 standard Portuguese accented vowels/tilde/cedilla). No real
onboarding data or Portuguese-language status value has ever exercised this
divergence.

**What would force revisiting this:** any future requirement to accept
non-Portuguese/non-Latin status text, or a report of `_is_concluida`/
`isConcluida` disagreement in production data.
