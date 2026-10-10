/**
 * BeforeUClick - Evidence Classes (Reference Dataset v1.0)
 *
 * PURPOSE
 * Centralises the type of evidence that data entries can emit.
 *
 * IMPORTANT
 * These are suggested starting weights for calibration.
 * They are NOT probabilities and should be tuned against the test corpus.
 *
 * Baseline uncertainty score remains 15 in the main scoring engine.
 * Reassuring evidence reduces uncertainty; it is intentionally not symmetrical with concern evidence.
 */

const BUC_REFERENCE_EVIDENCE_CLASSES = Object.freeze({
    // Reassuring evidence
    OFFICIAL_SENDER_DOMAIN: {
        direction: "reassuring",
        suggestedPoints: -4,
        strength: "positive",
        affectsScore: true,
        description: "Visible sender uses a sourced official organisation email domain."
    },
    OFFICIAL_DESTINATION: {
        direction: "reassuring",
        suggestedPoints: -3,
        strength: "positive",
        affectsScore: true,
        description: "Destination is a sourced first-party organisation-controlled domain."
    },
    CONTROLLED_NAMESPACE: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive",
        affectsScore: true,
        description: "Destination is inside a moderated/restricted namespace."
    },
    OFFICIAL_SHORT_LINK: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive",
        affectsScore: true,
        description: "Organisation-controlled short-link. Resolve final destination before stronger reassurance."
    },
    KNOWN_LOCAL_SENDER: {
        direction: "reassuring",
        suggestedPoints: -2,
        strength: "positive",
        affectsScore: true,
        description: "Exact sender is in the user's local known-sender list; never bypasses other checks."
    },

    // Neutral identification evidence
    PLATFORM_PROVIDER: {
        direction: "neutral",
        suggestedPoints: 0,
        strength: "context",
        affectsScore: false,
        description: "Legitimate provider/platform identified, but content may be user/customer controlled."
    },
    USER_CONTENT_HOST: {
        direction: "neutral",
        suggestedPoints: 0,
        strength: "context",
        affectsScore: false,
        description: "Legitimate hosting domain that can contain user-controlled content."
    },
    INFRASTRUCTURE_DOMAIN: {
        direction: "neutral",
        suggestedPoints: 0,
        strength: "context",
        affectsScore: false,
        description: "Provider infrastructure/CDN/API domain; recognition alone does not reassure the user."
    },

    // Wording evidence
    WORDING_WEAK: {
        direction: "concerning",
        suggestedPoints: 2,
        strength: "weak",
        affectsScore: true,
        description: "Common scam wording that is also common in legitimate mail."
    },
    WORDING_MEDIUM: {
        direction: "concerning",
        suggestedPoints: 5,
        strength: "medium",
        affectsScore: true,
        description: "More specific scam/social-engineering request."
    },
    WORDING_STRONG: {
        direction: "concerning",
        suggestedPoints: 8,
        strength: "strong",
        affectsScore: true,
        description: "Sensitive-action request such as passwords, MFA codes, remote access or changed payment details."
    },

    // Threat intelligence
    KNOWN_PHISHING: {
        direction: "concerning",
        suggestedPoints: 60,
        strength: "critical",
        affectsScore: true,
        minimumVerdict: "HIGH_CONCERN",
        description: "URL/domain appears in a recognised phishing threat source."
    },
    KNOWN_MALWARE: {
        direction: "concerning",
        suggestedPoints: 70,
        strength: "critical",
        affectsScore: true,
        minimumVerdict: "HIGH_CONCERN",
        description: "URL/domain appears in a recognised malware-distribution source."
    },
    DOMAIN_BLOCKLIST_STRONG: {
        direction: "concerning",
        suggestedPoints: 50,
        strength: "strong",
        affectsScore: true,
        minimumVerdict: "CAUTION",
        description: "Domain appears in a sourced high-confidence domain reputation/blocklist category."
    },



    // Email authentication / header intelligence (v0.18)
    AUTH_SPF_ALIGNED: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive",
        affectsScore: true,
        description: "Provider-trusted SPF result passed and its mail-from domain aligns with the visible From domain."
    },
    AUTH_DKIM_ALIGNED: {
        direction: "reassuring",
        suggestedPoints: -2,
        strength: "positive",
        affectsScore: true,
        description: "Provider-trusted DKIM result passed and its signing domain aligns with the visible From domain."
    },
    AUTH_DMARC_PASS: {
        direction: "reassuring",
        suggestedPoints: -2,
        strength: "positive",
        affectsScore: true,
        description: "Provider-trusted DMARC authentication passed."
    },
    AUTH_SPF_FAIL: {
        direction: "concerning",
        suggestedPoints: 5,
        strength: "medium",
        affectsScore: true,
        description: "Provider-trusted SPF authentication failed or returned a permanent error."
    },
    AUTH_DKIM_FAIL: {
        direction: "concerning",
        suggestedPoints: 5,
        strength: "medium",
        affectsScore: true,
        description: "Provider-trusted DKIM authentication failed or returned a permanent error."
    },
    AUTH_DMARC_FAIL: {
        direction: "concerning",
        suggestedPoints: 10,
        strength: "strong",
        affectsScore: true,
        description: "Provider-trusted DMARC authentication failed or returned a permanent error."
    },
    AUTH_DOMAIN_UNALIGNED: {
        direction: "concerning",
        suggestedPoints: 4,
        strength: "weak",
        affectsScore: true,
        description: "Authentication passed, but the authenticated domain does not align with the visible From organisation/domain."
    },
    // Future weak reputation evidence
    ESTABLISHED_DOMAIN: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive-weak",
        affectsScore: true,
        description: "Domain appears established/popular in a sourced ranking. Weak evidence only."
    },
    LONG_REGISTRATION_HISTORY: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive-weak",
        affectsScore: true,
        description: "RDAP registration history indicates an established domain. Weak evidence only."
    },
    HSTS_PRELOAD: {
        direction: "reassuring",
        suggestedPoints: -1,
        strength: "positive-weak",
        affectsScore: true,
        description: "Domain is present in the browser HSTS preload ecosystem. Weak maturity signal only."
    },
    DNSSEC_PRESENT: {
        direction: "neutral",
        suggestedPoints: 0,
        strength: "context",
        affectsScore: false,
        description: "DNSSEC protects DNS integrity but does not establish that the site owner is trustworthy."
    }
});
