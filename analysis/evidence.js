// analysis/evidence.js
// Shared helpers for the sourced evidence classes in data/evidence_classes.js.
// Keeps score-key lookup out of sender/link/wording modules so they remain easier to edit independently.

/** Returns one evidence-class definition, or a neutral fallback when the key is unknown. */
function bucEvidenceDefinition(key) {
    return BUC_REFERENCE_EVIDENCE_CLASSES?.[key] || {
        direction: "neutral",
        suggestedPoints: 0,
        strength: "context",
        affectsScore: false,
        description: "Unknown evidence class."
    };
}

/** Returns the suggested starting point value for one evidence class. */
function bucEvidenceClassPoints(key, fallback = 0) {
    const value = Number(bucEvidenceDefinition(key).suggestedPoints);
    return Number.isFinite(value) ? value : fallback;
}

/** Returns the configured evidence strength for one evidence class. */
function bucEvidenceClassStrength(key, fallback = "context") {
    return bucEvidenceDefinition(key).strength || fallback;
}
