# Pairwise exploration review flags

- Signals: **19**
- Unique pairs: **171**
- Single-signal review flags: **1**
- Pair review flags: **0**

These are **review prompts, not pass/fail labels**. They encode only a few broad calibration expectations so the bot can point humans toward potentially noisy or under-sensitive combinations without deciding the final scoring policy.

## Single-signal flags

| Signal | State | Score | Review reason |
| --- | --- | ---: | --- |
| punycode-link | caution | 35 | medium structural signal alone reaches Caution; human calibration review requested |

## Pair flags

None.

A flag means the case deserves a realistic whole-email scenario before a weight, evidence strength or breakpoint is changed. The script never edits production scoring automatically.
