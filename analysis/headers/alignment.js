// analysis/headers/alignment.js
// Provider-neutral identity-domain alignment helpers for BeforeUClick v0.18+.

function bucHeaderComparableDomain(value) {
    return typeof bucComparableDomain === "function" ? bucComparableDomain(value) : bucHeaderDomain(value);
}

/**
 * Authentication alignment uses the same registrable/organisational domain after PSL parsing.
 * Do not broaden this merely because two different domains belong to the same referenced company:
 * Microsoft owning both microsoft.com and outlook.com, for example, does not make them the same
 * SPF/DKIM alignment domain.
 */
function bucHeaderDomainsAligned(first, second) {
    const a = bucHeaderComparableDomain(first);
    const b = bucHeaderComparableDomain(second);
    return Boolean(a && b && a === b);
}


/**
 * Reply-To is an identity relationship rather than an SPF/DKIM alignment result. Where the
 * reference dataset knows that two registrable domains belong to the same organisation, keep
 * that broader relationship for the UI/metadata check without weakening authentication alignment.
 */
function bucHeaderIdentityDomainsRelated(first, second) {
    const a = bucHeaderComparableDomain(first);
    const b = bucHeaderComparableDomain(second);
    if (!a || !b) return false;
    if (a === b) return true;
    if (typeof bucMetadataDomainsAligned === "function") return bucMetadataDomainsAligned(a, b);
    return false;
}

/** Returns an alignment summary without scoring it. */
function bucBuildHeaderAlignment(model) {
    const fromDomain = bucHeaderComparableDomain(model?.fromAddress || model?.headerFrom || "");
    const spfDomain = bucHeaderComparableDomain(model?.spf?.domain || "");
    const dkimDomains = (model?.dkim || []).map(item => bucHeaderComparableDomain(item.signingDomain)).filter(Boolean);
    const replyToDomain = bucHeaderComparableDomain(model?.replyTo || "");
    const returnPathDomain = bucHeaderComparableDomain(model?.returnPath || "");

    return {
        fromDomain,
        spfDomain,
        dkimDomains,
        replyToDomain,
        returnPathDomain,
        spfAligned: Boolean(fromDomain && spfDomain && bucHeaderDomainsAligned(fromDomain, spfDomain)),
        dkimAligned: Boolean(fromDomain && dkimDomains.some(domain => bucHeaderDomainsAligned(fromDomain, domain))),
        replyToAligned: Boolean(fromDomain && replyToDomain && bucHeaderIdentityDomainsRelated(fromDomain, replyToDomain)),
        returnPathAligned: Boolean(fromDomain && returnPathDomain && bucHeaderDomainsAligned(fromDomain, returnPathDomain))
    };
}
