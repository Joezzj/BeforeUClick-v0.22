// analysis/references.js
// Organisation/domain lookup helpers for Reference Dataset v1.0.
// Recognition and reassuring score eligibility are deliberately separate concepts.

/** Returns normalised domain-rule objects for one organisation, including legacy fallback data. */
function bucReferenceDomainRules(reference) {
    if (!reference) return [];

    if (Array.isArray(reference.domainRules) && reference.domainRules.length) {
        return reference.domainRules
            .filter(rule => rule?.domain)
            .map(rule => ({
                domain: bucNormaliseHostname(rule.domain),
                roles: [...new Set(rule.roles || [])],
                scoreKeys: [...new Set(rule.scoreKeys || [])],
                notes: rule.notes || ""
            }));
    }

    // Backwards-compatible fallback for older archived datasets.
    return [
        ...(reference.officialDomains || reference.domains || []).map(domain => ({
            domain: bucNormaliseHostname(domain),
            roles: ["first-party", "sender-domain"],
            scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"],
            notes: "Legacy reference entry."
        })),
        ...(reference.officialShortDomains || []).map(domain => ({
            domain: bucNormaliseHostname(domain),
            roles: ["short-link"],
            scoreKeys: ["OFFICIAL_SHORT_LINK"],
            notes: "Legacy short-link entry."
        }))
    ].filter(rule => rule.domain);
}

/** Returns unique domains for one organisation, optionally filtered by role or score key. */
function bucReferenceDomains(reference, { roles = null, scoreKeys = null } = {}) {
    const roleSet = roles ? new Set(roles) : null;
    const scoreSet = scoreKeys ? new Set(scoreKeys) : null;

    return [...new Set(
        bucReferenceDomainRules(reference)
            .filter(rule => {
                if (roleSet && !rule.roles.some(role => roleSet.has(role))) return false;
                if (scoreSet && !rule.scoreKeys.some(key => scoreSet.has(key))) return false;
                return true;
            })
            .map(rule => rule.domain)
            .filter(Boolean)
    )];
}

/** All recognised domains for brand consistency. Kept for compatibility with older modules. */
function bucReferenceDestinationDomains(reference) {
    return bucReferenceDomains(reference);
}

/** Domains suitable as brand/look-alike comparison targets, excluding infrastructure-only entries where possible. */
function bucReferenceSimilarityDomains(reference) {
    const preferred = bucReferenceDomainRules(reference)
        .filter(rule => rule.roles.some(role => ["first-party", "platform", "user-content", "short-link"].includes(role)))
        .map(rule => rule.domain);
    return [...new Set(preferred.length ? preferred : bucReferenceDestinationDomains(reference))];
}

/** Domains explicitly sourced as legitimate sender domains for one organisation. */
function bucReferenceSenderDomains(reference) {
    return bucReferenceDomains(reference, { scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] });
}

/** Domains explicitly eligible for first-party destination reassurance. */
function bucReferenceOfficialDestinationDomains(reference) {
    return bucReferenceDomains(reference, { scoreKeys: ["OFFICIAL_DESTINATION"] });
}

/**
 * Finds organisation/domain rules that match a hostname.
 *
 * Only the most-specific matching rule for each organisation is kept. This lets a
 * provider deliberately override a broad first-party rule for user-content surfaces
 * such as sites.google.com without inheriting reassurance from google.com.
 */
function bucFindOrganisationDomainMatches(hostname) {
    const host = bucNormaliseHostname(hostname);
    if (!host) return [];

    const matches = [];
    for (const reference of BUC_ORGANISATION_REFERENCES) {
        const referenceMatches = bucReferenceDomainRules(reference)
            .filter(rule => bucHostnameMatchesDomain(host, rule.domain))
            .sort((a, b) => b.domain.length - a.domain.length);
        if (referenceMatches.length) matches.push({ reference, rule: referenceMatches[0] });
    }

    return matches.sort((a, b) => b.rule.domain.length - a.rule.domain.length);
}

/** Finds a score-neutral shared-hosting/user-content service reference. */
function bucFindSharedPlatformReference(hostname) {
    const host = bucNormaliseHostname(hostname);
    if (!host || typeof BUC_SHARED_PLATFORM_REFERENCES === "undefined") return null;

    return BUC_SHARED_PLATFORM_REFERENCES
        .filter(item => item?.domain && bucHostnameMatchesDomain(host, item.domain))
        .sort((a, b) => b.domain.length - a.domain.length)[0] || null;
}

/** Returns every recognised organisation id attached to a hostname. */
function bucRecognisedOrganisationIds(hostname) {
    const ids = bucFindOrganisationDomainMatches(hostname)
        .map(item => item?.reference?.id)
        .filter(Boolean);

    // Restricted namespaces can establish organisation ownership even when every individual
    // subdomain is not listed as a domain rule. Example: Microsoft is the sole registrant of
    // the .microsoft TLD, so outlook.mail.microsoft is Microsoft-owned identity context.
    const controlled = bucFindControlledNamespace(hostname);
    if (controlled?.organisationId) ids.push(controlled.organisationId);

    return [...new Set(ids)];
}

/** True when a controlled/restricted namespace is explicitly assigned to an organisation. */
function bucControlledNamespaceBelongsToOrganisation(hostname, organisationId) {
    if (!hostname || !organisationId) return false;
    const controlled = bucFindControlledNamespace(hostname);
    return Boolean(controlled?.organisationId && controlled.organisationId === organisationId);
}

/**
 * Returns true when two domains are explicitly represented by the same sourced organisation
 * group. This is relationship context only; it does not make either domain safe.
 */
function bucDomainsShareRecognisedOrganisation(firstDomain, secondDomain) {
    const firstIds = new Set(bucRecognisedOrganisationIds(firstDomain));
    if (!firstIds.size) return false;
    return bucRecognisedOrganisationIds(secondDomain).some(id => firstIds.has(id));
}

/** Returns true when a hostname is recognised as email delivery / tracking infrastructure. */
function bucIsKnownEmailIntermediary(hostname) {
    const service = bucFindSharedPlatformReference(hostname);
    const roles = new Set(service?.roles || []);
    return roles.has("tracking-redirect") || roles.has("mail-delivery") || roles.has("signature-link");
}

/** Finds the organisation for any recognised domain role. This is context, not a safety verdict. */
function bucFindRecognisedOrganisation(hostname) {
    return bucFindOrganisationDomainMatches(hostname)[0]?.reference || null;
}

/** Backwards-compatible alias for general organisation recognition. */
function bucFindOfficialOrganisation(hostname) {
    return bucFindRecognisedOrganisation(hostname);
}

/** Finds an organisation only when the hostname is explicitly eligible for destination reassurance. */
function bucFindOfficialDestinationOrganisation(hostname) {
    const match = bucFindOrganisationDomainMatches(hostname)
        .find(item => item.rule.scoreKeys.includes("OFFICIAL_DESTINATION"));
    return match?.reference || null;
}

/** Finds an organisation only when the hostname is explicitly sourced as an official sender domain. */
function bucFindOfficialSenderOrganisation(hostname) {
    const match = bucFindOrganisationDomainMatches(hostname)
        .find(item => item.rule.scoreKeys.includes("OFFICIAL_SENDER_DOMAIN"));
    return match?.reference || null;
}

/** Returns a controlled/moderated namespace record when the hostname sits beneath one. */
function bucFindControlledNamespace(hostname) {
    const host = bucNormaliseHostname(hostname);
    if (!host) return null;

    return BUC_CONTROLLED_NAMESPACES.find(reference =>
        bucHostnameMatchesDomain(host, reference.suffix)
    ) || null;
}

/** Finds organisation references whose names/aliases are explicitly present in visible text. */
function bucFindClaimedOrganisations(text) {
    const value = String(text || "").toLowerCase();
    if (!value) return [];

    return BUC_ORGANISATION_REFERENCES.filter(reference =>
        (reference.aliases || []).some(alias => {
            const escaped = String(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
        })
    );
}

/** Returns true when a reference summary carries the requested score key. */
function bucReferenceHasScoreKey(referenceSummary, scoreKey) {
    return Boolean(referenceSummary?.scoreKeys?.includes(scoreKey));
}

/** Returns a compact, role-aware reference summary for a destination hostname. */
function bucDescribeDomainReference(hostname) {
    const matches = bucFindOrganisationDomainMatches(hostname);
    const primary = matches[0] || null;
    const sharedService = bucFindSharedPlatformReference(hostname);
    const officialDestination = matches.find(item => item.rule.scoreKeys.includes("OFFICIAL_DESTINATION")) || null;
    const officialSender = matches.find(item => item.rule.scoreKeys.includes("OFFICIAL_SENDER_DOMAIN")) || null;
    const shortLink = matches.find(item => item.rule.scoreKeys.includes("OFFICIAL_SHORT_LINK")) || null;
    const controlled = bucFindControlledNamespace(hostname);
    const roles = [...new Set([
        ...matches.flatMap(item => item.rule.roles),
        ...(sharedService?.roles || [])
    ])];
    const scoreKeys = [...new Set([
        ...matches.flatMap(item => item.rule.scoreKeys),
        ...(sharedService?.scoreKeys || [])
    ])];

    const compactOrganisation = item => item ? ({
        id: item.reference.id,
        name: item.reference.name,
        references: item.reference.references || []
    }) : null;
    const compactService = sharedService ? ({
        id: sharedService.id,
        name: sharedService.name,
        references: sharedService.references || []
    }) : null;
    const primaryRule = primary ? {
        domain: primary.rule.domain,
        roles: primary.rule.roles,
        scoreKeys: primary.rule.scoreKeys,
        notes: primary.rule.notes || ""
    } : sharedService ? {
        domain: sharedService.domain,
        roles: sharedService.roles || [],
        scoreKeys: sharedService.scoreKeys || [],
        notes: "Shared hosting/user-content platform; recognition is score-neutral."
    } : null;

    return {
        recognisedOrganisation: compactOrganisation(primary),
        recognisedService: compactService,
        officialOrganisation: compactOrganisation(officialDestination),
        senderOrganisation: compactOrganisation(officialSender),
        shortLinkOrganisation: compactOrganisation(shortLink),
        primaryRule,
        roles,
        scoreKeys,
        isPlatform: roles.includes("platform"),
        isUserContent: roles.includes("user-content"),
        isInfrastructure: roles.includes("infrastructure"),
        controlledNamespace: controlled ? { ...controlled } : null
    };
}
