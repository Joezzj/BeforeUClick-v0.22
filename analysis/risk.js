// analysis/risk.js
// Explainable URL evidence checks using role-aware reference data.
// Link observations feed the separate evidence-weighted scoring engine in scoring.js.

/**
 * Creates a standard warning object used by the link-analysis pipeline.
 */
function bucRiskWarning(code, score, text, strength = "weak") {
    return { code, category: "link", source: "link", score, points: score, text, strength };
}

/**
 * Parses visible link text when it appears to be a URL/domain rather than ordinary button text.
 */
function bucDisplayedUrl(text) {
    const value = String(text || "").trim();
    if (!value || /\s/.test(value)) return null;

    let candidate = value;
    if (!/^https?:\/\//i.test(candidate)) {
        if (!/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(candidate)) {
            return null;
        }
        candidate = `https://${candidate}`;
    }

    try {
        return new URL(candidate);
    } catch (_error) {
        return null;
    }
}

/**
 * Removes weak URL-path warnings that are expected on a locally recognised official domain.
 * Strong structural warnings are never removed by this helper.
 */
function bucSuppressWeakOfficialDomainWarnings(warnings, reference, options = {}) {
    const senderComparable = bucComparableDomain(options.senderDomain || "");
    const destinationComparable = bucComparableDomain(options.destinationHostname || "");
    const sameSenderDestination = Boolean(senderComparable && destinationComparable && senderComparable === destinationComparable);
    const trackingRedirect = Boolean(reference?.roles?.includes("tracking-redirect"));

    if (!(reference?.officialOrganisation || reference?.shortLinkOrganisation || trackingRedirect || sameSenderDestination)) return warnings;

    const suppressibleCodes = new Set(["url-word", "long-url"]);
    return warnings.filter(warning => !suppressibleCodes.has(warning.code));
}


/**
 * Infers message-wide click-wrapper domains from the current email without treating them as safe.
 *
 * The inference is intentionally conservative:
 * - known sourced tracking/delivery services are neutral wrapper context;
 * - domains belonging to the same sourced organisation as the sender can be first-party wrappers;
 * - a dominant third-party domain can be treated as neutral only when sender/authentication or
 *   mailed-by context supports that role;
 * - otherwise a very dominant repeated domain is only "probable" wrapper context and can reduce
 *   a strong brand mismatch to Review-level uncertainty, never to reassurance.
 */
function bucInferMessageLinkWrappers(links, options = {}) {
    const counts = new Map();
    const totalLinks = (links || []).reduce((total, link) => {
        const described = bucDescribeUrl(link?.url || "");
        const domain = described?.registrableDomain || described?.hostname || "";
        if (!domain) return total;
        counts.set(domain, (counts.get(domain) || 0) + 1);
        return total + 1;
    }, 0);

    const senderDomain = bucComparableDomain(options.senderDomain || "");
    const mailedDomain = bucComparableDomain(options.mailedBy || "");
    const signedDomain = bucComparableDomain(options.signedBy || "");
    const senderOfficial = Boolean(
        senderDomain && typeof bucFindOfficialSenderOrganisation === "function" &&
        bucFindOfficialSenderOrganisation(senderDomain)
    );
    const senderAligned = Boolean(options.senderAligned);
    const result = {};

    for (const [domain, count] of counts.entries()) {
        const ratio = totalLinks ? count / totalLinks : 0;
        const parsed = bucParseDomain(domain);
        const knownIntermediary = typeof bucIsKnownEmailIntermediary === "function" &&
            bucIsKnownEmailIntermediary(domain);
        const mailedByMatches = Boolean(mailedDomain && mailedDomain === domain);
        const signedByMatches = Boolean(signedDomain && signedDomain === domain);
        const looksStructurallyDangerous = Boolean(
            parsed?.isIpAddress ||
            String(domain).split(".").some(label => label.startsWith("xn--")) ||
            (typeof bucFindTyposquatReference === "function" && bucFindTyposquatReference(domain))
        );

        if (looksStructurallyDangerous) continue;

        let mode = "";
        let confidence = "";
        let suppressStrongMismatch = false;
        let reviewOnly = false;

        if (knownIntermediary) {
            mode = "known-intermediary";
            confidence = "sourced";
            suppressStrongMismatch = true;
        } else if (mailedByMatches && (senderAligned || signedByMatches || senderOfficial)) {
            mode = "mail-infrastructure";
            confidence = "message-context";
            suppressStrongMismatch = true;
        } else if (count >= 4 && ratio >= 0.65 && (senderAligned || senderOfficial)) {
            mode = "dominant-trusted-context";
            confidence = "message-context";
            suppressStrongMismatch = true;
        } else if (count >= 8 && ratio >= 0.80) {
            // With no trusted sender/authentication context we do not call the wrapper safe.
            // We only prevent a single inferred redirect host from becoming a +35 identity claim.
            mode = "dominant-unverified";
            confidence = "structure-only";
            suppressStrongMismatch = true;
            reviewOnly = true;
        }

        if (!mode) continue;
        result[domain] = {
            domain,
            count,
            totalLinks,
            ratio,
            mode,
            confidence,
            suppressStrongMismatch,
            reviewOnly
        };
    }

    return result;
}

/** Returns wrapper context for the current destination, if the message-level analysis inferred one. */
function bucMessageWrapperContext(destinationHostname, options = {}) {
    const described = bucParseDomain(destinationHostname || "");
    const comparable = described.registrableDomain || described.hostname || "";
    const wrappers = options.messageWrapperDomains || {};
    return comparable && wrappers[comparable] ? wrappers[comparable] : null;
}

/** Returns true when the destination belongs to the same sourced organisation as the sender. */
function bucDestinationSharesSenderOrganisation(destinationHostname, senderDomain) {
    const destination = bucComparableDomain(destinationHostname || "");
    const sender = bucComparableDomain(senderDomain || "");
    if (!destination || !sender) return false;
    if (destination === sender) return true;
    return Boolean(
        typeof bucDomainsShareRecognisedOrganisation === "function" &&
        bucDomainsShareRecognisedOrganisation(destination, sender)
    );
}

/**
 * Performs local, explainable URL checks and returns score, warnings and domain/reference context.
 */
function calculateLinkRisk(linkText, destination, options = {}) {
    let parsed;

    try {
        parsed = new URL(destination);
    } catch (_error) {
        return {
            score: 20,
            warnings: [bucRiskWarning("invalid-url", 20, "The destination URL could not be parsed.", "medium")],
            domain: null,
            reference: null
        };
    }

    const domain = bucDescribeUrl(destination);
    const reference = bucDescribeDomainReference(parsed.hostname);
    const hostname = domain?.hostname || parsed.hostname.toLowerCase();
    const warnings = [];
    const messageWrapper = bucMessageWrapperContext(hostname, options);
    const senderTrustedContext = Boolean(
        options.senderAligned ||
        (typeof bucFindOfficialSenderOrganisation === "function" &&
            bucFindOfficialSenderOrganisation(options.senderDomain || ""))
    );
    const destinationSharesSenderOrganisation = bucDestinationSharesSenderOrganisation(
        hostname,
        options.senderDomain || ""
    );
    let firstPartyRedirectContext = false;

    if (parsed.protocol === "http:") {
        warnings.push(bucRiskWarning("http", 10, "The link uses HTTP rather than HTTPS.", "weak"));
    }

    if (domain?.isIpAddress) {
        warnings.push(bucRiskWarning("ip-host", 25, "The link uses a raw IP address instead of a normal domain name.", "strong"));
    }

    const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"];
    if (shorteners.some(shortener => bucHostnameMatchesDomain(hostname, shortener))) {
        warnings.push(bucRiskWarning("shortener", 15, "A URL shortener hides the final destination from the user.", "medium"));
    }

    if (hostname.split(".").some(label => label.startsWith("xn--"))) {
        warnings.push(bucRiskWarning("punycode", 20, "The destination domain contains punycode/IDN encoding.", "medium"));
    }

    const typosquat = bucFindTyposquatReference(hostname);
    if (typosquat) {
        warnings.push(bucRiskWarning(
            "typosquat-domain",
            28,
            `Destination domain ${typosquat.candidateDomain} is very close to recognised ${typosquat.organisation.name} domain ${typosquat.officialDomain}.`,
            "strong"
        ));
    }

    if (domain?.subdomain && domain.subdomain.split(".").filter(Boolean).length > 3) {
        warnings.push(bucRiskWarning("subdomains", 10, "The destination has an unusually long chain of subdomains.", "weak"));
    }

    if (parsed.username || parsed.password) {
        warnings.push(bucRiskWarning("userinfo", 20, "The URL contains user-information before the hostname, which can make a destination misleading.", "strong"));
    }

    if (parsed.port && !["80", "443"].includes(parsed.port)) {
        warnings.push(bucRiskWarning("port", 8, `The link uses unusual network port ${parsed.port}.`, "weak"));
    }

    if (hostname.length > 55 || parsed.href.length > 180) {
        warnings.push(bucRiskWarning("long-url", 5, "The destination URL is unusually long.", "weak"));
    }

    const displayed = bucDisplayedUrl(linkText);
    if (displayed) {
        const displayedDomain = bucParseDomain(displayed.hostname);
        const destinationDomain = bucParseDomain(hostname);
        const displayedComparable = displayedDomain.registrableDomain || displayedDomain.hostname;
        const destinationComparable = destinationDomain.registrableDomain || destinationDomain.hostname;

        if (displayedComparable && destinationComparable && displayedComparable !== destinationComparable) {
            const trackingRedirect = Boolean(reference?.roles?.includes("tracking-redirect"));
            const shortOwner = reference?.shortLinkOrganisation;
            const senderMatchesShortOwner = Boolean(shortOwner && (
                bucReferenceSenderDomains(BUC_ORGANISATION_REFERENCES.find(item => item.id === shortOwner.id) || {})
                    .some(domain => bucHostnameMatchesDomain(options.senderDomain || "", domain))
            ));
            const sameRecognisedOrganisation = typeof bucDomainsShareRecognisedOrganisation === "function"
                && bucDomainsShareRecognisedOrganisation(displayedComparable, destinationComparable);

            const firstPartyRedirect = Boolean(
                destinationSharesSenderOrganisation && senderTrustedContext
            );
            const inferredWrapper = Boolean(messageWrapper?.suppressStrongMismatch);

            // Known tracking intermediaries, related domains in one sourced organisation family,
            // sender-owned redirect domains, and message-wide campaign wrappers can legitimately
            // sit between displayed text and the eventual target. Recognition never makes the
            // unseen final target safe; it only prevents the wrapper host from becoming +35 proof
            // of impersonation.
            if (firstPartyRedirect) firstPartyRedirectContext = true;

            if (!trackingRedirect && !senderMatchesShortOwner && !sameRecognisedOrganisation &&
                !firstPartyRedirect && !inferredWrapper) {
                warnings.push(bucRiskWarning(
                    "display-mismatch",
                    35,
                    `Displayed address belongs to ${displayedComparable}, but the actual destination belongs to ${destinationComparable}.`,
                    "strong"
                ));
            } else if (messageWrapper?.reviewOnly && inferredWrapper) {
                warnings.push(bucRiskWarning(
                    "probable-tracking-wrapper",
                    8,
                    "Many links in this message use the same apparent tracking/redirect domain. The final destination could not be verified locally.",
                    "medium"
                ));
            }
        }
    }

    const suspiciousTerms = [
        "login", "signin", "verify", "verification", "password", "account",
        "suspended", "confirm", "update", "payment", "invoice", "wallet",
        "bank", "recover", "reset", "unlock"
    ];

    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
    const matchedTerms = suspiciousTerms.filter(term => pathAndQuery.includes(term));

    matchedTerms.slice(0, 3).forEach(term => {
        warnings.push(bucRiskWarning(
            "url-word",
            4,
            `Security-sensitive word appears in the URL path or query: "${term}".`,
            "weak"
        ));
    });

    const visibleClaims = bucFindClaimedOrganisations(linkText || "");
    const senderOrganisationIds = new Set(
        typeof bucRecognisedOrganisationIds === "function"
            ? bucRecognisedOrganisationIds(options.senderDomain || "")
            : []
    );
    const foreignVisibleBrandClaim = visibleClaims.some(item => !senderOrganisationIds.has(item.id));
    const firstPartyBrandWrapper = Boolean(
        destinationSharesSenderOrganisation &&
        senderTrustedContext &&
        foreignVisibleBrandClaim &&
        !bucBrandLinkHasSensitiveAction(linkText || "")
    );
    if (firstPartyBrandWrapper) firstPartyRedirectContext = true;

    warnings.push(...checkBrandImpersonation(destination, linkText, {
        ...options,
        reference,
        wrapperContext: messageWrapper,
        suppressBrandMismatchForWrapper: Boolean(
            messageWrapper?.suppressStrongMismatch || firstPartyBrandWrapper
        )
    }));

    if (messageWrapper?.reviewOnly && foreignVisibleBrandClaim &&
        !warnings.some(item => item.code === "probable-tracking-wrapper")) {
        warnings.push(bucRiskWarning(
            "probable-tracking-wrapper",
            8,
            "Many links in this message use the same apparent tracking/redirect domain. The final destination could not be verified locally.",
            "medium"
        ));
    }

    let finalWarnings = bucSuppressWeakOfficialDomainWarnings(warnings, reference, {
        ...options,
        destinationHostname: hostname
    });

    // A long URL is extremely common in legitimate campaign/tracking mail. By itself it is
    // informational rather than a reason to put the link into Review. It keeps its weak weight
    // only when another independent concerning signal is present on the same link.
    const hasConcernBeyondLength = finalWarnings.some(warning =>
        warning.code !== "long-url" && (Number(warning.points ?? warning.score) || 0) > 0
    );
    if (!hasConcernBeyondLength) {
        finalWarnings = finalWarnings.map(warning => warning.code === "long-url"
            ? {
                ...warning,
                score: 0,
                points: 0,
                strength: "context",
                text: "The destination URL is unusually long. This is common in tracked or marketing links and is informational unless another concern is present."
            }
            : warning
        );
    }

    // Weak URL-shape clues are useful context but should not stack indefinitely until an
    // ordinary tracking/marketing URL looks equivalent to a strong identity mismatch.
    const weakWarnings = finalWarnings.filter(warning => (warning.strength || "weak") === "weak");
    const strongerWarnings = finalWarnings.filter(warning => (warning.strength || "weak") !== "weak");
    const weakRawScore = weakWarnings.reduce((total, warning) => total + (warning.score || 0), 0);

    // Display-domain mismatch, sourced brand/domain inconsistency and typosquat detection
    // can all describe the same underlying destination-identity problem. Keep every
    // explanation for the user, but score that overlapping family only once using its
    // strongest member. Independent structural warnings (IP host, userinfo, shortener,
    // etc.) still add normally.
    const destinationIdentityCodes = new Set([
        "display-mismatch",
        "brand-domain-inconsistency",
        "typosquat-domain"
    ]);
    const destinationIdentityWarnings = strongerWarnings.filter(warning =>
        destinationIdentityCodes.has(warning.code)
    );
    const otherStrongerWarnings = strongerWarnings.filter(warning =>
        !destinationIdentityCodes.has(warning.code)
    );
    const destinationIdentityScore = destinationIdentityWarnings.reduce(
        (highest, warning) => Math.max(highest, Number(warning.score) || 0),
        0
    );
    const otherStrongerScore = otherStrongerWarnings.reduce(
        (total, warning) => total + (Number(warning.score) || 0),
        0
    );
    const strongerScore = destinationIdentityScore + otherStrongerScore;
    const weakCap = BUC_SCORING_MODEL?.weakLinkCap || 8;
    const weakAppliedScore = Math.min(weakRawScore, weakCap);
    const rawScore = weakRawScore + strongerScore;
    const score = Math.min(weakAppliedScore + strongerScore, 100);

    return {
        score,
        rawScore,
        weakRawScore,
        weakAppliedScore,
        weakCap,
        destinationIdentityScore,
        overlappingDestinationIdentityWarnings: Math.max(0, destinationIdentityWarnings.length - 1),
        warnings: finalWarnings,
        domain,
        reference,
        wrapperContext: messageWrapper || (firstPartyRedirectContext ? {
            domain: domain?.registrableDomain || hostname,
            mode: "first-party",
            confidence: "sender-organisation",
            suppressStrongMismatch: true,
            reviewOnly: false
        } : null),
        suppressDestinationReassurance: Boolean(messageWrapper || firstPartyRedirectContext)
    };
}
