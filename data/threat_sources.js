/**
 * BeforeUClick - Threat Intelligence Source Definitions (Reference Dataset v1.0)
 *
 * This file defines possible known-bad sources.
 * It does not bundle live malicious URLs.
 */

const BUC_THREAT_SOURCE_DEFINITIONS = [
    {
        id: "ncsc-nz-pds",
        name: "NCSC New Zealand Phishing Disruption Service",
        category: "phishing",
        reference: 5,
        evidenceClass: "KNOWN_PHISHING",
        affectsScore: true,
        integrationStatus: "research-only",
        updateModel: "API / subscriber service",
        geographicFocus: "New Zealand"
    },
    {
        id: "phishtank",
        name: "PhishTank",
        category: "phishing",
        reference: 28,
        evidenceClass: "KNOWN_PHISHING",
        affectsScore: true,
        integrationStatus: "not-integrated",
        updateModel: "downloadable verified online-phish database; hourly updates"
    },
    {
        id: "openphish",
        name: "OpenPhish Community Feed",
        category: "phishing",
        reference: 29,
        evidenceClass: "KNOWN_PHISHING",
        affectsScore: true,
        integrationStatus: "not-integrated",
        updateModel: "community feed; approximately 12-hour updates"
    },
    {
        id: "urlhaus",
        name: "URLhaus",
        category: "malware-distribution",
        reference: 30,
        evidenceClass: "KNOWN_MALWARE",
        affectsScore: true,
        integrationStatus: "not-integrated",
        updateModel: "API / downloadable datasets; authentication key required"
    },
    {
        id: "spamhaus-dbl",
        name: "Spamhaus Domain Blocklist (DBL)",
        category: "domain-reputation",
        reference: 31,
        evidenceClass: "DOMAIN_BLOCKLIST_STRONG",
        affectsScore: true,
        integrationStatus: "not-integrated",
        updateModel: "real-time DNS/service"
    },
    {
        id: "google-safe-browsing",
        name: "Google Safe Browsing v5 Local List Mode",
        category: "threat-intelligence",
        reference: 32,
        evidenceClass: "KNOWN_PHISHING",
        affectsScore: true,
        integrationStatus: "future-research",
        updateModel: "local hash-prefix lists plus server confirmation"
    }
];
