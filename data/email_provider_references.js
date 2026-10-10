/**
 * BeforeUClick - Email Provider / Display-Name Heuristic Data
 *
 * PURPOSE
 * Operational lists used by low-confidence sender-identity checks.
 *
 * IMPORTANT
 * - These are implementation heuristics, not a trust list.
 * - A free/consumer provider is not suspicious by itself.
 * - The signal is only used when an organisation-like display name is paired
 *   with a consumer mailbox, and it remains weaker than link/domain evidence.
 * - A user "known sender" preference may suppress only the generic
 *   organisation-keyword heuristic; it does not bypass brand, link, metadata,
 *   wording, or threat checks.
 *
 * Full source catalogue:
 * ./README_REFERENCES.md
 *
 * LAST REVIEWED
 * 2026-09-07
 */

const BUC_FREEMAIL_DOMAINS = [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "mail.com",
    "protonmail.com",
    "proton.me"
];

const BUC_ORGANISATION_DISPLAY_KEYWORDS = [
    "support",
    "security",
    "billing",
    "account",
    "service",
    "team",
    "verification",
    "alert",
    "notification",
    "department",
    "admin",
    "official",
    "helpdesk",
    "customer",
    "fraud",
    "payments"
];
