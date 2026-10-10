// analysis/wording.js
// Wording-pattern matching. Pattern data and evidence classes live in data/.

/** Returns the central evidence-class definition for one wording group. */
function bucWordingEvidenceDefinition(group) {
    const key = group?.evidenceClass || "WORDING_WEAK";
    return {
        key,
        ...(BUC_REFERENCE_EVIDENCE_CLASSES[key] || BUC_REFERENCE_EVIDENCE_CLASSES.WORDING_WEAK)
    };
}

/** Returns a calibrated starting weight while preserving a few deliberately weak common patterns. */
function bucWordingCategoryWeight(group, matchCount = 1, matchedPhrases = []) {
    const definition = bucWordingEvidenceDefinition(group);
    let points = Math.max(0, Number(definition.suggestedPoints) || 0);

    // One urgency phrase is common in legitimate correspondence.
    if (group?.id === "urgency" && matchCount <= 1) points = Math.min(points, 2);

    // Generic greetings are useful context but very weak evidence on their own.
    if (group?.id === "generic-greeting") points = Math.min(points, 1);

    // A bare QR mention is common. The category deliberately contains overlapping
    // patterns (for example "scan the QR code" also contains "QR code"), so raw
    // regex-match count must not turn one ordinary instruction into medium evidence.
    // Reserve the full medium weight for an explicit QR-to-sensitive-action phrase.
    if (group?.id === "qr-quishing") {
        const sensitiveQrAction = (matchedPhrases || []).some(phrase =>
            /\bscan to (?:login|sign in|verify|view|pay)\b/i.test(String(phrase || ""))
        );
        if (!sensitiveQrAction) points = Math.min(points, 2);
    }

    return points;
}


/**
 * Some security-news/newsletter text discusses compromised accounts without claiming that the
 * recipient's own account is affected. Require nearby recipient/action context before turning the
 * broad account-compromise vocabulary into concern evidence. This is deliberately narrow: it only
 * changes the account-compromised group and leaves explicit credential/account-threat rules intact.
 */
function bucAccountCompromiseLooksRecipientDirected(text, phrase) {
    const source = String(text || "");
    const needle = String(phrase || "");
    if (!source || !needle) return false;

    const lower = source.toLowerCase();
    const index = lower.indexOf(needle.toLowerCase());
    const start = Math.max(0, (index >= 0 ? index : 0) - 140);
    const end = Math.min(source.length, (index >= 0 ? index + needle.length : source.length) + 180);
    const context = source.slice(start, end);

    return /\b(?:your|you(?:'ve| have| were| are)?|we (?:detected|noticed|found|blocked|saw)|someone (?:signed|logged|tried|attempted)|sign[- ]?in|login attempt|review (?:your|this)|secure (?:your|the) account|on your account|your transaction|your card|your email)\b/i.test(context);
}

/** Matches the sourced wording groups and returns explainable, evidence-class-aware results. */
function checkWording(text) {
    const value = String(text || "");
    const matches = [];
    let score = 0;

    for (const group of BUC_WORDING_PATTERN_GROUPS) {
        const phrases = [];

        for (const pattern of group.patterns || []) {
            const result = value.match(pattern);
            if (result?.[0]) phrases.push(result[0]);
        }

        let uniquePhrases = [...new Set(phrases.map(phrase => phrase.trim()))];
        if (group?.id === "account-compromised") {
            uniquePhrases = uniquePhrases.filter(phrase =>
                bucAccountCompromiseLooksRecipientDirected(value, phrase)
            );
        }
        if (!uniquePhrases.length) continue;

        const definition = bucWordingEvidenceDefinition(group);
        const groupScore = bucWordingCategoryWeight(group, uniquePhrases.length, uniquePhrases);
        const qrSensitiveAction = group.id === "qr-quishing" && uniquePhrases.some(phrase =>
            /\bscan to (?:login|sign in|verify|view|pay)\b/i.test(String(phrase || ""))
        );
        const effectiveEvidenceClass = group.id === "qr-quishing" && !qrSensitiveAction
            ? "WORDING_WEAK"
            : definition.key;
        const effectiveDefinition = BUC_REFERENCE_EVIDENCE_CLASSES[effectiveEvidenceClass] || definition;
        matches.push({
            id: group.id,
            label: group.name || group.label || group.id,
            score: groupScore,
            evidenceClass: effectiveEvidenceClass,
            strength: effectiveDefinition.strength || "weak",
            matchedPhrases: uniquePhrases,
            matchCount: uniquePhrases.length,
            references: group.references || []
        });
        score += groupScore;
    }

    return {
        score: Math.min(score, BUC_SCORING_MODEL?.wordingCap || 15),
        matches
    };
}
