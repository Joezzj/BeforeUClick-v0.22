// analysis/evaluation.js
// Builds user-facing component assessments from the existing explainable evidence.
// Numeric values stay internal by default; users see five ordinary states and coverage notes.

const BUC_VISIBLE_ASSESSMENTS = Object.freeze({
    "no-concerns": Object.freeze({ key: "no-concerns", label: "NO OBVIOUS CONCERNS", icon: "✓", rank: 0 }),
    unknown: Object.freeze({ key: "unknown", label: "NOT ENOUGH EVIDENCE", icon: "?", rank: 1 }),
    review: Object.freeze({ key: "review", label: "REVIEW", icon: "i", rank: 2 }),
    caution: Object.freeze({ key: "caution", label: "CAUTION", icon: "⚠", rank: 3 }),
    high: Object.freeze({ key: "high", label: "HIGH CONCERN", icon: "!", rank: 4 })
});

function bucVisibleAssessment(key) {
    return BUC_VISIBLE_ASSESSMENTS[key] || BUC_VISIBLE_ASSESSMENTS.unknown;
}

function bucEvidenceStrengthRank(strength) {
    const key = String(strength || "").toLowerCase();
    if (key === "critical") return 4;
    if (key === "strong") return 3;
    if (key === "medium") return 2;
    if (key === "weak") return 1;
    return 0;
}

function bucHighestEvidenceStrength(evidence) {
    let best = { strength: "context", rank: 0 };
    for (const item of evidence || []) {
        if ((Number(item?.points) || 0) <= 0) continue;
        const rank = bucEvidenceStrengthRank(item?.strength);
        if (rank > best.rank) best = { strength: item?.strength || "context", rank };
    }
    return best;
}

function bucAssessmentFromInternalScore(score, options = {}) {
    const value = Math.max(0, Math.min(100, Number(score) || 0));
    const strongest = bucEvidenceStrengthRank(options.strongestStrength);

    if (strongest >= 4 || value >= BUC_SCORING_MODEL.thresholds.high) return bucVisibleAssessment("high");
    if (value >= BUC_SCORING_MODEL.thresholds.caution) return bucVisibleAssessment("caution");
    if (value >= BUC_SCORING_MODEL.thresholds.review) return bucVisibleAssessment("review");
    if (value <= 9 && options.hasReassuringEvidence) return bucVisibleAssessment("no-concerns");
    return bucVisibleAssessment("unknown");
}

function bucCoverage(key, note = "") {
    const labels = {
        complete: "Complete",
        partial: "Partial",
        limited: "Limited",
        unavailable: "Unavailable"
    };
    return { key, label: labels[key] || labels.partial, note };
}

function bucModuleCoverage(moduleResult, fallback = "partial") {
    if (!moduleResult) return bucCoverage("unavailable", "This check did not run.");
    if (moduleResult.status === "ok") return bucCoverage("complete");
    if (moduleResult.status === "partial") return bucCoverage("limited", "Some provider information was not exposed.");
    if (moduleResult.status === "error") return bucCoverage("unavailable", "This check could not be completed.");
    return bucCoverage(fallback);
}

function bucOwnedEvidence(evidence, component, targetId = "") {
    return (evidence || []).map(item => ({
        ...item,
        component,
        targetId: targetId || item.targetId || item.linkId || ""
    }));
}

/**
 * Produces one component-level assessment. Components use the same five labels as the
 * overall result, but are scoped to that one area of the message.
 */
function bucBuildComponentAssessment({
    key,
    label,
    evidence = [],
    coverage = bucCoverage("complete"),
    concernScore = null,
    reassuringCap = 15,
    weakConcernCap = 8,
    zeroConcernState = "unknown",
    targetId = ""
}) {
    const ownedEvidence = bucOwnedEvidence(evidence, key, targetId);
    const concerning = ownedEvidence.filter(item => (Number(item.points) || 0) > 0);
    const reassuring = ownedEvidence.filter(item => (Number(item.points) || 0) < 0);

    const weakRaw = concerning
        .filter(item => bucEvidenceStrengthRank(item.strength) <= 1)
        .reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);
    const strongerRaw = concerning
        .filter(item => bucEvidenceStrengthRank(item.strength) >= 2)
        .reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);

    const calculatedConcern = Math.min(weakRaw, weakConcernCap) + strongerRaw;
    const appliedConcern = Number.isFinite(concernScore)
        ? Math.max(0, Number(concernScore))
        : calculatedConcern;
    const reassuringReduction = Math.min(
        Math.abs(reassuring.reduce((total, item) => total + Math.min(0, Number(item.points) || 0), 0)),
        reassuringCap
    );

    const internalScore = Math.max(0, Math.min(100,
        BUC_SCORING_MODEL.baseUncertaintyScore + appliedConcern - reassuringReduction
    ));
    const strongest = bucHighestEvidenceStrength(concerning);

    let assessment = bucAssessmentFromInternalScore(internalScore, {
        strongestStrength: strongest.strength,
        hasReassuringEvidence: reassuring.length > 0
    });

    // A completed, scoped check can say "no obvious concerns" when it found no concerning
    // evidence and the caller has enough local coverage to make that limited statement.
    if (!concerning.length && coverage.key === "complete" && zeroConcernState === "no-concerns") {
        assessment = bucVisibleAssessment("no-concerns");
    }

    // Limited/unavailable coverage must never look reassuring merely because no evidence existed.
    if (["limited", "unavailable"].includes(coverage.key) && assessment.key === "no-concerns") {
        assessment = bucVisibleAssessment("unknown");
    }

    return {
        key,
        label,
        assessment,
        coverage,
        internalScore: Math.round(internalScore),
        concernScore: Math.round(appliedConcern),
        reassuringReduction: Math.round(reassuringReduction),
        strongestEvidence: strongest.strength,
        concerningEvidence: concerning,
        reassuringEvidence: reassuring,
        evidence: ownedEvidence
    };
}

function bucBuildLinkAssessment(link) {
    const warnings = bucOwnedEvidence(link?.warningDetails || [], "link", link?.id || "");
    const reassuring = typeof bucBuildLinkReassuringEvidence === "function"
        ? bucOwnedEvidence(bucBuildLinkReassuringEvidence([link]), "link", link?.id || "")
        : [];
    const recognised = Boolean(
        link?.reference?.officialOrganisation ||
        link?.reference?.controlledNamespace ||
        link?.reference?.shortLinkOrganisation
    );

    const component = bucBuildComponentAssessment({
        key: "link",
        label: link?.id || "Link",
        evidence: [...warnings, ...reassuring],
        coverage: bucCoverage("complete"),
        concernScore: Math.max(0, Number(link?.score) || 0),
        weakConcernCap: BUC_SCORING_MODEL.weakLinkCap || 8,
        zeroConcernState: recognised ? "no-concerns" : "unknown",
        targetId: link?.id || ""
    });

    return {
        ...component,
        linkId: link?.id || "",
        url: link?.url || "",
        displayedText: link?.text || link?.altText || ""
    };
}

function bucWorstAssessment(items) {
    return (items || []).reduce((worst, item) => {
        const state = item?.assessment || item;
        const rank = Number(state?.rank) || 0;
        return rank > (Number(worst?.rank) || 0) ? state : worst;
    }, bucVisibleAssessment("no-concerns"));
}

function bucBuildOverallCoverage(components) {
    const values = Object.values(components || {}).map(item => item?.coverage?.key).filter(Boolean);
    if (values.length && values.every(value => value === "complete")) return bucCoverage("complete");
    const unavailableCount = values.filter(value => value === "unavailable").length;
    const limitedCount = values.filter(value => value === "limited").length;
    if (unavailableCount >= 2 || (unavailableCount + limitedCount) >= 3) {
        return bucCoverage("limited", "Several checks could not access all of the information they normally use.");
    }
    return bucCoverage("partial", "Some provider information was unavailable or only partially exposed.");
}

function bucPrimaryEvaluationReasons(components, limit = 3) {
    const ordered = Object.values(components || {})
        .filter(item => item?.assessment)
        .sort((a, b) => (b.assessment.rank || 0) - (a.assessment.rank || 0));
    const reasons = [];

    for (const component of ordered) {
        const evidence = [...(component.concerningEvidence || [])]
            .sort((a, b) => bucEvidenceStrengthRank(b.strength) - bucEvidenceStrengthRank(a.strength));
        for (const item of evidence) {
            if (item.text && !reasons.includes(item.text)) reasons.push(item.text);
            if (reasons.length >= limit) return reasons;
        }
    }
    return reasons;
}

/** Builds sender/authentication/link/wording summaries plus the overall presentation model. */
function bucBuildEvaluationSummary({
    scoring,
    modules,
    metadata,
    senderResult,
    metadataResult,
    bodyIdentityResult,
    authenticationResult,
    headerAcquisition,
    wordingResult,
    links
}) {
    const senderEvidence = [
        ...(senderResult?.evidence || []),
        ...(metadataResult?.evidence || []),
        ...(bodyIdentityResult?.evidence || [])
    ];
    let senderCoverage;
    if (modules?.sender?.status === "error") {
        senderCoverage = bucCoverage("unavailable", "Sender analysis could not be completed.");
    } else if (metadata?.sender) {
        senderCoverage = bucCoverage("complete");
    } else {
        senderCoverage = bucCoverage("limited", "The visible sender address was not exposed reliably for this message.");
    }

    const sender = bucBuildComponentAssessment({
        key: "sender",
        label: "Sender & identity",
        evidence: senderEvidence,
        coverage: senderCoverage,
        weakConcernCap: BUC_SCORING_MODEL.weakIdentityCap || 8,
        zeroConcernState: senderEvidence.some(item => (Number(item.points) || 0) < 0) ? "no-concerns" : "unknown"
    });

    let authCoverage;
    if (headerAcquisition?.status === "full") authCoverage = bucCoverage("complete");
    else if (headerAcquisition?.status === "partial") authCoverage = bucCoverage("limited", "Only part of the provider's authentication/header information was available.");
    else if (modules?.authentication?.status === "error") authCoverage = bucCoverage("unavailable", "Authentication/header analysis could not be completed.");
    else authCoverage = bucCoverage("unavailable", "Full authentication/header information was not exposed for this check.");

    const authentication = bucBuildComponentAssessment({
        key: "authentication",
        label: "Authentication",
        evidence: authenticationResult?.evidence || [],
        coverage: authCoverage,
        zeroConcernState: (authenticationResult?.evidence || []).some(item => (Number(item.points) || 0) < 0) ? "no-concerns" : "unknown"
    });

    const wordingCoverage = modules?.extraction?.status === "error"
        ? bucCoverage("unavailable", "Message text extraction failed, so wording coverage is unavailable.")
        : bucModuleCoverage(modules?.wording);
    const wording = bucBuildComponentAssessment({
        key: "wording",
        label: "Wording",
        evidence: modules?.wording?.evidence || [],
        coverage: wordingCoverage,
        concernScore: Number(scoring?.moduleScores?.wording) || 0,
        weakConcernCap: BUC_SCORING_MODEL.weakWordingCap || 6,
        zeroConcernState: "no-concerns"
    });

    const linkItems = (links || []).map(bucBuildLinkAssessment);
    let linksAssessment;
    if (!linkItems.length) {
        linksAssessment = bucBuildComponentAssessment({
            key: "links",
            label: "Links",
            evidence: [],
            coverage: bucModuleCoverage(modules?.links),
            concernScore: 0,
            zeroConcernState: "no-concerns"
        });
    } else {
        const worst = bucWorstAssessment(linkItems);
        const linkEvidence = linkItems.flatMap(item => item.evidence || []);
        linksAssessment = bucBuildComponentAssessment({
            key: "links",
            label: "Links",
            evidence: linkEvidence,
            coverage: bucModuleCoverage(modules?.links),
            concernScore: Number(scoring?.moduleScores?.links) || 0,
            weakConcernCap: BUC_SCORING_MODEL.weakLinkCap || 8,
            zeroConcernState: "unknown"
        });
        if (worst.rank > linksAssessment.assessment.rank) linksAssessment.assessment = worst;
    }
    linksAssessment.items = linkItems;

    const components = { sender, authentication, links: linksAssessment, wording };
    const overallCoverage = bucBuildOverallCoverage(components);
    const overall = scoring?.level || bucVisibleAssessment("unknown");

    return {
        overall,
        coverage: overallCoverage,
        components,
        primaryReasons: bucPrimaryEvaluationReasons(components, 3),
        scoreVisibleToUser: false,
        scoreMeaning: "Internal evidence weight only; not a probability."
    };
}
