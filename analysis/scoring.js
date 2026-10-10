// analysis/scoring.js
// Evidence-weighted scoring engine with Reference Dataset v1.0.
// The score is an internal decision-support indicator, not a probability that an email is malicious.

const BUC_SCORING_MODEL = Object.freeze({
    revision: "0.22.17-auth-identity-family",
    baseUncertaintyScore: 15,
    identityCap: 30,
    linkCap: 45,
    wordingCap: 15,
    combinationCap: 20,
    weakIdentityCap: 8,
    weakLinkCap: 8,
    weakWordingCap: 6,
    reassuranceCap: 12,
    reassuranceCapWhenMediumConcern: 7,
    reassuranceCapWhenStrongConcern: 5,
    totalCap: 100,
    criticalMinimum: 70,
    thresholds: Object.freeze({
        noConcernsMax: 9,
        review: 17,
        reviewStrong: 25,
        caution: 35,
        cautionStrong: 45,
        high: 60
    })
});

/**
 * Returns a score-based fallback verdict. The main pipeline can refine this using the
 * actual positive/negative evidence so "unknown" is not confused with "reassuring".
 */
function bucScoreLevel(score) {
    const value = Number.isFinite(score) ? score : BUC_SCORING_MODEL.baseUncertaintyScore;

    if (value >= BUC_SCORING_MODEL.thresholds.high) {
        return { key: "high", label: "HIGH CONCERN", icon: "!", rank: 4 };
    }
    if (value >= BUC_SCORING_MODEL.thresholds.caution) {
        return { key: "caution", label: "CAUTION", icon: "⚠", rank: 3 };
    }
    if (value >= BUC_SCORING_MODEL.thresholds.review) {
        return { key: "review", label: "REVIEW", icon: "i", rank: 2 };
    }
    if (value <= BUC_SCORING_MODEL.thresholds.noConcernsMax) {
        return { key: "no-concerns", label: "NO OBVIOUS CONCERNS", icon: "✓", rank: 0 };
    }
    return { key: "unknown", label: "NOT ENOUGH EVIDENCE", icon: "?", rank: 1 };
}

/**
 * Returns the finer internal calibration band. These bands are diagnostic only; the
 * ordinary UI still collapses them to the five user-facing assessment states.
 */
function bucScoreBand(score) {
    const value = Number.isFinite(score) ? score : BUC_SCORING_MODEL.baseUncertaintyScore;
    if (value <= BUC_SCORING_MODEL.thresholds.noConcernsMax) {
        return { key: "reassuring", label: "Reassuring", min: 0, max: 9 };
    }
    if (value <= 16) {
        return { key: "limited-evidence", label: "Limited evidence", min: 10, max: 16 };
    }
    if (value <= BUC_SCORING_MODEL.thresholds.reviewStrong - 1) {
        return { key: "review-suggested", label: "Review suggested", min: 17, max: 24 };
    }
    if (value <= BUC_SCORING_MODEL.thresholds.caution - 1) {
        return { key: "review-recommended", label: "Review recommended", min: 25, max: 34 };
    }
    if (value <= BUC_SCORING_MODEL.thresholds.cautionStrong - 1) {
        return { key: "caution-advised", label: "Caution advised", min: 35, max: 44 };
    }
    if (value <= BUC_SCORING_MODEL.thresholds.high - 1) {
        return { key: "strong-caution", label: "Strong caution", min: 45, max: 59 };
    }
    return { key: "high-concern", label: "High concern", min: 60, max: 100 };
}

/**
 * Converts sender/metadata evidence into the identity-module score while preventing
 * repeated weak clues from growing without limit.
 */
function bucScoreIdentityEvidence(senderResult, metadataResult, bodyIdentityResult) {
    const allEvidence = [
        ...(senderResult?.evidence || []),
        ...(metadataResult?.evidence || []),
        ...(bodyIdentityResult?.evidence || [])
    ];
    const evidence = allEvidence.filter(item => (Number(item.points) || 0) > 0);

    const weak = evidence.filter(item => (item.strength || "weak") === "weak");
    const stronger = evidence.filter(item => (item.strength || "weak") !== "weak");
    const weakRaw = weak.reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);
    const strongerRaw = stronger.reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);
    const weakApplied = Math.min(weakRaw, BUC_SCORING_MODEL.weakIdentityCap);
    const raw = weakRaw + strongerRaw;

    return {
        score: Math.min(weakApplied + strongerRaw, BUC_SCORING_MODEL.identityCap),
        rawScore: raw,
        weakRaw,
        weakApplied,
        evidence,
        allEvidence
    };
}

/**
 * Adds the exact link context to a warning so score evidence can point back to the
 * specific URL/button/image that caused it.
 */
function bucAttachLinkContext(warning, link) {
    return {
        ...warning,
        points: Number(warning.points ?? warning.score) || 0,
        category: warning.category || "link",
        source: warning.source || "link",
        linkId: link.id || null,
        linkUrl: link.url || "",
        displayedText: link.text || link.altText || "",
        linkType: link.type || "link",
        registrableDomain: link.domain?.registrableDomain || link.domain?.hostname || ""
    };
}

/**
 * Scores link evidence using the highest-risk destination as the main contribution.
 * A small multi-link bonus is allowed, but harmless links never average-down a dangerous one.
 */
function bucScoreLinkEvidence(links) {
    const scoredLinks = (links || []).map((link, index) => ({
        link,
        id: link.id || null,
        score: Math.max(0, Number(link.score) || 0),
        warnings: link.warningDetails || [],
        destinationKey: typeof bucLinkDestinationKey === "function"
            ? bucLinkDestinationKey(link.url)
            : String(link.url || `unmapped-${index}`).trim().toLowerCase()
    }));

    // The same destination can legitimately appear more than once in an email (header/footer,
    // repeated call-to-action buttons, etc.). Keep every visual link for UI/highlighting, but let
    // one destination influence the aggregate link score only once. If duplicate anchors carry
    // different visible-text evidence, retain the highest-scoring representative.
    const uniqueByDestination = new Map();
    scoredLinks.forEach((item, index) => {
        const key = item.destinationKey || `unmapped-${index}`;
        const existing = uniqueByDestination.get(key);
        if (!existing || item.score > existing.score) uniqueByDestination.set(key, item);
    });
    const uniqueScoredLinks = [...uniqueByDestination.values()].sort((a, b) => b.score - a.score);

    const highest = uniqueScoredLinks[0]?.score || 0;
    const suspiciousUnique = uniqueScoredLinks.filter(item => item.score >= 10);

    // Multiple campaign URLs can be distinct destinations while still representing one message-level
    // tracking-wrapper mechanism. Count one inferred wrapper domain once for the small multi-link
    // bonus so blocked images / rendering differences cannot easily move the same newsletter across
    // a visible assessment boundary. Independent non-wrapper destinations still count separately.
    const suspiciousGroups = new Set(suspiciousUnique.map((item, index) => {
        const wrapperDomain = item.link?.wrapperContext?.domain || "";
        if (wrapperDomain) return `wrapper:${wrapperDomain}`;
        return `destination:${item.destinationKey || index}`;
    }));
    const additionalSuspicious = Math.max(0, suspiciousGroups.size - (highest >= 10 ? 1 : 0));
    const multiLinkBonus = Math.min(additionalSuspicious * 2, 5);

    const evidence = uniqueScoredLinks.flatMap(item =>
        item.warnings.map(warning => bucAttachLinkContext(warning, item.link))
    );

    return {
        score: Math.min(highest + multiLinkBonus, BUC_SCORING_MODEL.linkCap),
        highestLinkScore: highest,
        multiLinkBonus,
        suspiciousLinkCount: suspiciousUnique.length,
        visibleLinkCount: scoredLinks.length,
        uniqueDestinationCount: uniqueScoredLinks.length,
        evidence
    };
}

/**
 * Scores wording categories separately from technical evidence and deliberately caps their influence.
 */
function bucScoreWordingEvidence(wordingResult) {
    const matches = wordingResult?.matches || [];
    const weak = matches.filter(match => (match.strength || "weak") === "weak");
    const stronger = matches.filter(match => (match.strength || "weak") !== "weak");
    const weakRaw = weak.reduce((total, match) => total + (Number(match.score) || 0), 0);
    const strongerRaw = stronger.reduce((total, match) => total + (Number(match.score) || 0), 0);
    const weakApplied = Math.min(weakRaw, BUC_SCORING_MODEL.weakWordingCap);
    const raw = weakRaw + strongerRaw;

    return {
        score: Math.min(weakApplied + strongerRaw, BUC_SCORING_MODEL.wordingCap),
        rawScore: raw,
        weakRaw,
        weakApplied,
        evidence: matches.map(match => ({
            code: match.id,
            category: "wording",
            source: "wording",
            strength: match.strength || "weak",
            evidenceClass: match.evidenceClass || "WORDING_WEAK",
            points: Number(match.score) || 0,
            text: match.label,
            matchedPhrases: match.matchedPhrases || []
        }))
    };
}

/**
 * Returns all negative-point evidence already emitted by sender/metadata modules.
 * These observations are kept out of the concern score and applied only through the capped
 * reassurance stage.
 */
function bucCollectModuleReassuringEvidence(senderResult, metadataResult) {
    return [
        ...(senderResult?.evidence || []),
        ...(metadataResult?.evidence || [])
    ].filter(item => (Number(item.points) || 0) < 0);
}

/**
 * Builds link-based reassuring evidence from recognised official destinations and controlled
 * namespaces. Repeated links to the same organisation/namespace count once.
 */
function bucBuildLinkReassuringEvidence(links) {
    const evidence = [];
    const seenOrganisations = new Set();
    const seenShortLinks = new Set();
    const seenNamespaces = new Set();

    (links || []).forEach(link => {
        const reference = link.reference || {};
        const official = reference.officialOrganisation;
        // A sender-owned or campaign redirect wrapper may itself be first-party, but the
        // eventual target is not visible to the local checker. Do not turn wrapper recognition
        // into reassurance for the unseen destination.
        if (link.suppressDestinationReassurance) {
            return;
        }
        if (official?.id && !seenOrganisations.has(official.id)) {
            seenOrganisations.add(official.id);
            const destinationDomain = link.domain?.registrableDomain || link.domain?.hostname || "";
            evidence.push({
                code: "official-domain-reference",
                evidenceClass: "OFFICIAL_DESTINATION",
                category: "reassuring",
                source: "organisation-reference",
                strength: "positive",
                points: bucEvidenceClassPoints("OFFICIAL_DESTINATION", -4),
                text: `An analysed link to ${destinationDomain || "this destination"} matches a sourced first-party domain for ${official.name}.`,
                linkId: link.id || null,
                linkUrl: link.url || "",
                displayedText: link.text || link.altText || "",
                registrableDomain: link.domain?.registrableDomain || link.domain?.hostname || "",
                organisation: official.name,
                references: official.references || []
            });
        }

        const shortLink = reference.shortLinkOrganisation;
        const shortDomain = reference.primaryRule?.domain;
        if (shortLink?.id && shortDomain && !seenShortLinks.has(shortDomain)) {
            seenShortLinks.add(shortDomain);
            evidence.push({
                code: "official-short-link-reference",
                evidenceClass: "OFFICIAL_SHORT_LINK",
                category: "reassuring",
                source: "organisation-reference",
                strength: "positive",
                points: bucEvidenceClassPoints("OFFICIAL_SHORT_LINK", -1),
                text: `Destination uses a sourced ${shortLink.name} short-link domain. The final destination should still be checked.`,
                linkId: link.id || null,
                linkUrl: link.url || "",
                displayedText: link.text || link.altText || "",
                registrableDomain: link.domain?.registrableDomain || link.domain?.hostname || "",
                organisation: shortLink.name,
                references: shortLink.references || []
            });
        }

        const controlled = reference.controlledNamespace;
        const suffix = controlled?.suffix;
        if (suffix && controlled.affectsScore !== false && !seenNamespaces.has(suffix)) {
            seenNamespaces.add(suffix);
            const key = controlled.scoreKey || "CONTROLLED_NAMESPACE";
            evidence.push({
                code: "controlled-namespace-reference",
                evidenceClass: key,
                category: "reassuring",
                source: "namespace-reference",
                strength: "positive",
                points: bucEvidenceClassPoints(key, -2),
                text: `Destination is within the sourced controlled namespace ${suffix}.`,
                linkId: link.id || null,
                linkUrl: link.url || "",
                displayedText: link.text || link.altText || "",
                registrableDomain: link.domain?.registrableDomain || link.domain?.hostname || "",
                namespace: suffix,
                references: controlled.references || []
            });
        }
    });

    return evidence;
}

/**
 * Builds the complete positive-evidence list. "No warning" never creates a deduction;
 * every negative point must correspond to a concrete reason that can be displayed to the user.
 */
function bucBuildReassuringEvidence({ senderResult, metadataResult, links }) {
    return [
        ...bucCollectModuleReassuringEvidence(senderResult, metadataResult),
        ...bucBuildLinkReassuringEvidence(links)
    ];
}

/**
 * Applies reassuring evidence with hard safety caps.
 * - normal email: up to -12
 * - strong concern present: at most -5
 * - critical threat evidence: no reassurance deduction at all
 *
 * Unlike earlier builds, a positive observation can now reduce an otherwise-unknown email even when
 * unrelated destinations remain unknown. Unknown links simply contribute zero; they do not
 * erase verified positive evidence.
 */
function bucScoreReassuringEvidence({ senderResult, metadataResult, links, hasMediumConcern, hasStrongConcern, hasCriticalEvidence }) {
    const requestedEvidence = bucBuildReassuringEvidence({ senderResult, metadataResult, links });
    const requestedReduction = Math.abs(
        requestedEvidence.reduce((total, item) => total + Math.min(0, Number(item.points) || 0), 0)
    );

    const cap = hasCriticalEvidence
        ? 0
        : (hasStrongConcern
            ? BUC_SCORING_MODEL.reassuranceCapWhenStrongConcern
            : (hasMediumConcern
                ? BUC_SCORING_MODEL.reassuranceCapWhenMediumConcern
                : BUC_SCORING_MODEL.reassuranceCap));
    const appliedReduction = Math.min(requestedReduction, cap);

    let remaining = appliedReduction;
    const evidence = requestedEvidence.map(item => {
        const requested = Math.abs(Math.min(0, Number(item.points) || 0));
        const applied = Math.min(requested, remaining);
        remaining -= applied;
        return {
            ...item,
            requestedPoints: -requested,
            points: -applied,
            capped: applied < requested,
            notAppliedReason: applied < requested
                ? (hasCriticalEvidence
                    ? "Critical threat evidence prevents reassuring deductions from reducing this result."
                    : "The reassuring adjustment reached the current concern-aware safety cap.")
                : ""
        };
    });

    const destinationLinks = (links || []).filter(link => link.url && link.domain);
    const uniqueDestinations = new Map();
    destinationLinks.forEach((link, index) => {
        const key = typeof bucLinkDestinationKey === "function"
            ? bucLinkDestinationKey(link.url)
            : String(link.url || `unmapped-${index}`).trim().toLowerCase();
        if (!uniqueDestinations.has(key || `unmapped-${index}`)) uniqueDestinations.set(key || `unmapped-${index}`, link);
    });
    const uniqueDestinationLinks = [...uniqueDestinations.values()];
    const recognisedDestinations = uniqueDestinationLinks.filter(link =>
        Boolean(link.reference?.officialOrganisation || link.reference?.shortLinkOrganisation || (link.reference?.controlledNamespace?.affectsScore !== false && link.reference?.controlledNamespace))
    );

    return {
        score: -appliedReduction,
        requestedReduction,
        appliedReduction,
        cap,
        recognisedDestinationCount: recognisedDestinations.length,
        destinationCount: uniqueDestinationLinks.length,
        evidence
    };
}

/**
 * Finds whether any analysed link contains a warning matching the supplied code/strength criteria.
 */
function bucLinkHasEvidence(links, { code = null, strength = null } = {}) {
    return (links || []).some(link =>
        (link.warningDetails || []).some(warning => {
            if (code && warning.code !== code) return false;
            if (strength && warning.strength !== strength) return false;
            return true;
        })
    );
}

/**
 * Builds cross-signal evidence when independent modules reinforce each other.
 * These bonuses are intentionally limited so one repeated theme cannot dominate the whole result.
 */
function bucBuildCombinationEvidence({ senderResult, metadataResult, bodyIdentityResult, wordingResult, links }) {
    const combinations = [];
    const wordingIds = new Set((wordingResult?.matches || []).map(match => match.id));
    const identityEvidence = [
        ...(senderResult?.evidence || []),
        ...(metadataResult?.evidence || []),
        ...(bodyIdentityResult?.evidence || [])
    ];

    const hasIdentityMismatch = identityEvidence.some(item =>
        ["medium", "strong", "critical"].includes(item.strength)
    );
    const hasStrongLink = bucLinkHasEvidence(links, { strength: "strong" }) ||
        bucLinkHasEvidence(links, { strength: "critical" });
    const hasAnyConcerningLink = (links || []).some(link =>
        (link.warningDetails || []).some(warning => (Number(warning.points ?? warning.score) || 0) > 0)
    );
    const hasBrandMismatch = bucLinkHasEvidence(links, { code: "brand-domain-inconsistency" });

    // Treat explicit password/PIN and MFA-code requests as members of the same credential
    // family as account-verification wording. Earlier builds only recognised the generic
    // credential-request group here, which meant a more sensitive password request could
    // receive *less* cross-signal weight than a generic verification request.
    const credentialRequestIds = new Set([
        "credential-request",
        "password-request",
        "mfa-code-request"
    ]);
    const hasCredentialRequest = [...credentialRequestIds].some(id => wordingIds.has(id));
    const hasHighSensitivityCredentialRequest =
        wordingIds.has("password-request") || wordingIds.has("mfa-code-request");
    const hasUrgency = wordingIds.has("urgency");
    const hasPaymentPressure = wordingIds.has("payment-pressure");
    const hasChangedPaymentDetails = wordingIds.has("changed-payment-details");
    const hasSecrecy = wordingIds.has("secrecy-isolation");
    const hasSensitiveAction = hasCredentialRequest ||
        wordingIds.has("account-threat") ||
        hasPaymentPressure;

    if (hasCredentialRequest && hasStrongLink) {
        combinations.push({
            code: "credential-plus-strong-link",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 10,
            text: "Credential/account verification wording appears together with a strong suspicious-link indicator."
        });
    }

    if (hasIdentityMismatch && hasStrongLink) {
        combinations.push({
            code: "identity-plus-strong-link",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 8,
            text: "Sender/metadata inconsistency appears together with a strong suspicious-link indicator."
        });
    }

    if (hasUrgency && hasSensitiveAction && hasStrongLink) {
        combinations.push({
            code: "urgency-action-link",
            category: "combination",
            source: "cross-signal",
            strength: "medium",
            points: 5,
            text: "Urgency, a sensitive requested action and a suspicious link appear together."
        });
    }

    // A direct password/PIN or MFA-code request is more sensitive than generic account
    // verification. When it is also urgent and accompanied by a strong suspicious-link
    // indicator, add one small corroboration bonus. This is intentionally capped by the
    // existing combinationCap and does not create a critical/known-threat override.
    if (hasHighSensitivityCredentialRequest && hasUrgency && hasStrongLink) {
        combinations.push({
            code: "urgent-secret-request-plus-strong-link",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 5,
            text: "An urgent password/PIN or verification-code request appears together with a strong suspicious-link indicator."
        });
    }

    if (hasBrandMismatch && hasIdentityMismatch) {
        combinations.push({
            code: "brand-plus-identity",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 7,
            text: "The claimed organisation does not match the destination and the message also contains sender/metadata inconsistency."
        });
    }

    // A direct secret request paired with even a weaker concerning destination (for example
    // plain HTTP) deserves extra weight, but less than the existing strong-link combination.
    if (hasHighSensitivityCredentialRequest && hasAnyConcerningLink && !hasStrongLink) {
        combinations.push({
            code: "secret-request-plus-concerning-link",
            category: "combination",
            source: "cross-signal",
            strength: "medium",
            points: 5,
            text: "A password/PIN or verification-code request appears together with a concerning link indicator."
        });
    }


    // Changed bank/payment details are often legitimate and should normally live in Review, not
    // Caution. Escalate only when payment change/pressure is reinforced by an independent
    // concern such as secrecy, identity inconsistency or a concerning destination. This keeps
    // ordinary overdue invoices and genuine supplier updates from looking like fraud alerts.
    if (hasChangedPaymentDetails && (hasPaymentPressure || hasUrgency) &&
        (hasSecrecy || hasIdentityMismatch || hasAnyConcerningLink)) {
        combinations.push({
            code: "changed-payment-plus-independent-concern",
            category: "combination",
            source: "cross-signal",
            strength: "medium",
            points: 5,
            text: "Changed payment details and payment pressure are reinforced by another independent concern that should be verified before paying."
        });
    }

    // Urgent remote-access instructions are a distinctive social-engineering pattern even
    // without a malicious URL. Keep the bonus separate from the wording cap.
    if (wordingIds.has("remote-access") && hasUrgency) {
        combinations.push({
            code: "urgent-remote-access-request",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 10,
            text: "An urgent request asks the recipient to install or allow remote-access software."
        });
    }

    // Secrecy becomes more meaningful when an independent sender/metadata inconsistency is
    // present. Requiring urgency avoids treating ordinary confidentiality language as this pattern.
    if (wordingIds.has("secrecy-isolation") && hasUrgency && hasIdentityMismatch) {
        combinations.push({
            code: "urgent-secrecy-plus-identity",
            category: "combination",
            source: "cross-signal",
            strength: "medium",
            points: 5,
            text: "Urgent secrecy instructions appear together with a sender or metadata inconsistency."
        });
    }

    // Wording is deliberately capped, so a distinctive social-engineering pattern needs a
    // separate corroboration path rather than inflating every individual phrase. The classic
    // urgent + gift-card + secrecy pattern is much more meaningful than any one phrase alone.
    if (wordingIds.has("gift-card") && wordingIds.has("secrecy-isolation") && hasUrgency) {
        combinations.push({
            code: "urgent-secret-gift-card-request",
            category: "combination",
            source: "cross-signal",
            strength: "strong",
            points: 10,
            text: "An urgent gift-card request is combined with instructions to keep the request secret."
        });
    }

    return combinations;
}

/**
 * Collapses repeated display evidence without changing the score that was already calculated.
 * Newsletter/tracking templates can produce dozens of visually distinct links with the same
 * underlying explanation; reporting each copy makes the result look more certain than it is.
 */
function bucDeduplicateEvidenceForDisplay(evidence) {
    const groups = new Map();
    for (const item of evidence || []) {
        const key = [
            item?.code || item?.evidenceClass || "evidence",
            item?.text || "",
            item?.organisation || "",
            item?.registrableDomain || ""
        ].join("|");
        const existing = groups.get(key);
        if (!existing) {
            groups.set(key, { ...item, occurrences: 1, affectedLinkIds: item?.linkId ? [item.linkId] : [] });
            continue;
        }
        existing.occurrences += 1;
        if (item?.linkId && !existing.affectedLinkIds.includes(item.linkId)) existing.affectedLinkIds.push(item.linkId);
        // Keep the strongest/most consequential representative for display metadata.
        if ((Number(item?.points) || 0) > (Number(existing?.points) || 0)) {
            existing.points = item.points;
            existing.score = item.score;
            existing.strength = item.strength;
        }
    }

    return [...groups.values()].map(item => {
        if ((item.occurrences || 1) <= 1) return item;
        const suffix = item.affectedLinkIds?.length
            ? ` Affected ${item.affectedLinkIds.length} analysed links.`
            : ` Repeated ${item.occurrences} times.`;
        return { ...item, text: `${item.text}${suffix}` };
    });
}

/**
 * Builds the user-facing verdict using both score and evidence direction. This is what separates
 * "we found nothing" from "we positively recognised reassuring evidence".
 */
function bucMinimumVerdictFromEvidence(evidence) {
    const rankByKey = { "no-concerns": 0, unknown: 1, review: 2, caution: 3, high: 4 };
    const keyByMinimum = {
        REVIEW: "review",
        CAUTION: "caution",
        HIGH_CONCERN: "high"
    };
    let best = null;

    for (const item of evidence || []) {
        const definition = item?.evidenceClass && typeof bucEvidenceDefinition === "function"
            ? bucEvidenceDefinition(item.evidenceClass)
            : null;
        const minimum = item?.minimumVerdict || definition?.minimumVerdict || "";
        const key = keyByMinimum[String(minimum).toUpperCase()] || null;
        if (!key) continue;
        if (!best || rankByKey[key] > rankByKey[best]) best = key;
    }
    return best;
}

/**
 * Builds the user-facing verdict. The score supplies the normal state. Only explicit
 * minimum-verdict evidence (for example a known threat source) bypasses the ordinary
 * breakpoints. Evidence strength by itself no longer forces Caution; that prevents one
 * context-sensitive phrase from outranking the accumulated score.
 */
function bucBuildOverallVerdict({ score, reassuranceApplied, hasCriticalEvidence, minimumVerdict }) {
    const rankByKey = { "no-concerns": 0, unknown: 1, review: 2, caution: 3, high: 4 };
    const byKey = {
        "no-concerns": { key: "no-concerns", label: "NO OBVIOUS CONCERNS", icon: "✓", rank: 0 },
        unknown: { key: "unknown", label: "NOT ENOUGH EVIDENCE", icon: "?", rank: 1 },
        review: { key: "review", label: "REVIEW", icon: "i", rank: 2 },
        caution: { key: "caution", label: "CAUTION", icon: "⚠", rank: 3 },
        high: { key: "high", label: "HIGH CONCERN", icon: "!", rank: 4 }
    };

    let result = bucScoreLevel(score);
    if (result.key === "no-concerns" && reassuranceApplied <= 0) result = byKey.unknown;
    if (hasCriticalEvidence && rankByKey[result.key] < rankByKey.high) result = byKey.high;
    if (minimumVerdict && rankByKey[minimumVerdict] > rankByKey[result.key]) result = byKey[minimumVerdict];
    return result;
}

/**
 * Produces the complete internal score, including the neutral baseline, concerning evidence,
 * capped reassuring evidence, exact link references and a non-probabilistic verdict.
 */
function scoreBeforeUClickEvidence({ senderResult, metadataResult, bodyIdentityResult, wordingResult, links }) {
    const identity = bucScoreIdentityEvidence(senderResult, metadataResult, bodyIdentityResult);
    const link = bucScoreLinkEvidence(links);
    const wording = bucScoreWordingEvidence(wordingResult);
    const combinationEvidence = bucBuildCombinationEvidence({
        senderResult,
        metadataResult,
        bodyIdentityResult,
        wordingResult,
        links
    });
    const combinationRaw = combinationEvidence.reduce(
        (total, item) => total + Math.max(0, Number(item.points) || 0),
        0
    );
    const combinations = {
        score: Math.min(combinationRaw, BUC_SCORING_MODEL.combinationCap),
        rawScore: combinationRaw,
        evidence: combinationEvidence
    };

    const rawConcerningEvidence = [
        ...identity.evidence,
        ...link.evidence,
        ...wording.evidence,
        ...combinations.evidence
    ];
    const hasCriticalEvidence = rawConcerningEvidence.some(item => item.strength === "critical");
    const hasStrongConcern = rawConcerningEvidence.some(item => item.strength === "strong");
    const hasMediumConcern = rawConcerningEvidence.some(item => item.strength === "medium");

    const reassurance = bucScoreReassuringEvidence({
        senderResult,
        metadataResult,
        links,
        hasMediumConcern,
        hasStrongConcern,
        hasCriticalEvidence
    });
    const concernScore = identity.score + link.score + wording.score + combinations.score;
    const rawScore = BUC_SCORING_MODEL.baseUncertaintyScore + concernScore + reassurance.score;
    const minimum = hasCriticalEvidence ? BUC_SCORING_MODEL.criticalMinimum : 0;
    const score = Math.min(
        Math.max(rawScore, minimum),
        BUC_SCORING_MODEL.totalCap
    );
    const minimumVerdict = bucMinimumVerdictFromEvidence(rawConcerningEvidence);
    const concerningEvidence = bucDeduplicateEvidenceForDisplay(rawConcerningEvidence);
    const verdict = bucBuildOverallVerdict({
        score,
        reassuranceApplied: reassurance.appliedReduction,
        hasCriticalEvidence,
        minimumVerdict
    });

    return {
        modelRevision: BUC_SCORING_MODEL.revision,
        score: Math.round(score),
        level: verdict,
        scoreLevel: bucScoreLevel(score),
        scoreBand: bucScoreBand(score),
        minimumVerdict: minimumVerdict || null,
        baseScore: BUC_SCORING_MODEL.baseUncertaintyScore,
        concernScore,
        reassuranceAdjustment: reassurance.score,
        reassuranceRequested: reassurance.requestedReduction,
        reassuranceCapApplied: reassurance.cap,
        moduleScores: {
            baseline: BUC_SCORING_MODEL.baseUncertaintyScore,
            identity: identity.score,
            links: link.score,
            wording: wording.score,
            combinations: combinations.score,
            reassurance: reassurance.score,
            weakIdentityApplied: identity.weakApplied || 0,
            weakWordingApplied: wording.weakApplied || 0
        },
        caps: {
            identity: BUC_SCORING_MODEL.identityCap,
            links: BUC_SCORING_MODEL.linkCap,
            wording: BUC_SCORING_MODEL.wordingCap,
            combinations: BUC_SCORING_MODEL.combinationCap,
            reassurance: reassurance.cap,
            weakIdentity: BUC_SCORING_MODEL.weakIdentityCap,
            weakLinks: BUC_SCORING_MODEL.weakLinkCap,
            weakWording: BUC_SCORING_MODEL.weakWordingCap
        },
        linkSummary: {
            highestLinkScore: link.highestLinkScore,
            multiLinkBonus: link.multiLinkBonus,
            suspiciousLinkCount: link.suspiciousLinkCount,
            visibleLinkCount: link.visibleLinkCount,
            uniqueDestinationCount: link.uniqueDestinationCount,
            recognisedDestinationCount: reassurance.recognisedDestinationCount,
            destinationCount: reassurance.destinationCount
        },
        combinationEvidence,
        reassuringEvidence: reassurance.evidence,
        concerningEvidence,
        rawConcerningEvidence,
        evidence: [...concerningEvidence, ...reassurance.evidence],
        criticalOverrideApplied: hasCriticalEvidence,
        strongestConcernStrength: hasCriticalEvidence ? "critical" : hasStrongConcern ? "strong" : hasMediumConcern ? "medium" : (concerningEvidence.length ? "weak" : "context")
    };
}
