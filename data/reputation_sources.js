/**
 * BeforeUClick - Optional Reputation Source Definitions (Reference Dataset v1.0)
 *
 * These are possible future sources for weak reassuring evidence.
 * None should be treated as proof that a site is safe.
 */

const BUC_REPUTATION_SOURCE_DEFINITIONS = [
    {
        id: "tranco",
        name: "Tranco",
        reference: 55,
        evidenceClass: "ESTABLISHED_DOMAIN",
        affectsScore: true,
        integrationStatus: "future",
        notes: "Popularity/establishment signal only; compromised or malicious popular domains still exist."
    },
    {
        id: "cloudflare-radar-ranking",
        name: "Cloudflare Radar Domain Rankings",
        reference: 56,
        evidenceClass: "ESTABLISHED_DOMAIN",
        affectsScore: true,
        integrationStatus: "future",
        notes: "Weak popularity/establishment signal only."
    },
    {
        id: "icann-rdap",
        name: "ICANN RDAP",
        reference: 57,
        evidenceClass: "LONG_REGISTRATION_HISTORY",
        affectsScore: true,
        integrationStatus: "future-network",
        notes: "Domain age is weak evidence; attackers can buy old domains and compromise established sites."
    },
    {
        id: "hsts-preload",
        name: "Chromium HSTS Preload List",
        reference: 58,
        evidenceClass: "HSTS_PRELOAD",
        affectsScore: true,
        integrationStatus: "future-local-snapshot",
        notes: "Security/maturity signal only; HTTPS/HSTS does not prove legitimacy."
    },
    {
        id: "dnssec",
        name: "DNSSEC",
        reference: 59,
        evidenceClass: "DNSSEC_PRESENT",
        affectsScore: false,
        integrationStatus: "future-network",
        notes: "Authenticates DNS data integrity, not the trustworthiness of the organisation."
    }
];
