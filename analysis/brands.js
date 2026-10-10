// analysis/brands.js
// Brand/organisation consistency checks backed by the role-aware Reference Dataset v1.0.

/** Returns true when text contains an action/identity cue that makes a brand-labelled link consequential. */
function bucBrandLinkHasSensitiveAction(text) {
    return /\b(?:login|log in|sign in|verify|verification|account|password|security|reset|unlock|payment|invoice|bank|billing|confirm|restore|continue|authenticate|credential)\b/i
        .test(String(text || ""));
}

/** Returns true when sender and destination share the same registrable domain. */
function bucBrandDestinationMatchesSender(hostname, senderDomain) {
    const destination = bucComparableDomain(hostname);
    const sender = bucComparableDomain(senderDomain);
    return Boolean(destination && sender && destination === sender);
}

/**
 * Warns when an organisation is claimed by an actionable link/hostname but the destination
 * is not any recognised domain belonging to that organisation.
 *
 * v0.22.10 adds message-role context learned from real newsletter/digest testing:
 * - a brand mentioned in article/newsletter content is not automatically an impersonation claim;
 * - a known tracking redirect is an intermediary, so its hostname is not compared as though it
 *   were the final claimed-brand destination;
 * - a same-sender destination can suppress incidental content-brand mentions when the sender
 *   display name itself is not claiming that brand and the link text is not a sensitive action.
 */
function checkBrandImpersonation(url, visibleText = "", options = {}) {
    const warnings = [];
    const description = bucDescribeUrl(url);
    if (!description?.hostname) return warnings;

    const hostname = description.hostname;
    const claimed = new Map();
    const referenceSummary = options.reference || bucDescribeDomainReference(hostname);
    const roles = new Set(referenceSummary?.roles || []);

    // Mail/newsletter tracking redirects intentionally sit between the visible CTA and its
    // final destination. Treating the tracker hostname itself as the claimed brand is a false
    // comparison. Recognition is neutral and does not make the eventual target safe.
    if (roles.has("tracking-redirect") || options.suppressBrandMismatchForWrapper) return warnings;

    bucFindClaimedOrganisations(visibleText).forEach(reference => claimed.set(reference.id, reference));

    BUC_ORGANISATION_REFERENCES.forEach(reference => {
        const hostTokens = hostname.split(/[.-]+/).filter(Boolean);
        const mentionsBrand = (reference.aliases || []).some(alias => {
            const compactAlias = alias.toLowerCase().replace(/\s+/g, "");
            return compactAlias.length >= 3 && hostTokens.includes(compactAlias);
        });
        if (mentionsBrand) claimed.set(reference.id, reference);
    });

    const sharedPlatform = typeof bucFindSharedPlatformReference === "function"
        ? bucFindSharedPlatformReference(hostname)
        : null;
    const senderClaims = new Set(options.senderClaimedOrganisationIds || []);
    const sameSenderDestination = bucBrandDestinationMatchesSender(hostname, options.senderDomain || "");
    const sensitiveLinkAction = bucBrandLinkHasSensitiveAction(visibleText);

    claimed.forEach(reference => {
        const recognisedOrganisationDomain = bucReferenceDestinationDomains(reference)
            .some(domain => bucHostnameMatchesDomain(hostname, domain));
        const recognisedSharedPlatformOwner = Boolean(
            sharedPlatform?.ownerOrganisationId && sharedPlatform.ownerOrganisationId === reference.id
        );
        const controlledOwnership = typeof bucControlledNamespaceBelongsToOrganisation === "function"
            && bucControlledNamespaceBelongsToOrganisation(hostname, reference.id);
        const recognised = recognisedOrganisationDomain || recognisedSharedPlatformOwner || controlledOwnership;

        if (recognised) return;

        // A newsletter/digest often links back to its own authenticated sender domain while its
        // article title mentions Microsoft, Apple, police, etc. Do not convert that content topic
        // into impersonation unless the sender itself claims that brand or the link asks for a
        // security-sensitive action.
        const looksIncidentalToOwnContent = sameSenderDestination
            && !senderClaims.has(reference.id)
            && !sensitiveLinkAction;
        if (looksIncidentalToOwnContent) return;

        warnings.push({
            code: "brand-domain-inconsistency",
            score: 35,
            points: 35,
            category: "link",
            source: "brand-reference",
            strength: "strong",
            text: `${reference.name} is referenced by this link, but ${hostname} is not in the sourced domain reference for ${reference.name}.`,
            organisation: reference.name,
            references: reference.references || []
        });
    });

    return warnings;
}
