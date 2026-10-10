#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const resultDir = path.join(__dirname, "results");
const loadFiles = [
    "data/public_suffix_rules.js",
    "data/evidence_classes.js",
    "data/organisation_references.js",
    "data/shared_platform_references.js",
    "data/controlled_namespaces.js",
    "data/wording_patterns.js",
    "data/email_provider_references.js",
    "analysis/domains.js",
    "analysis/references.js",
    "analysis/evidence.js",
    "analysis/similarity.js",
    "analysis/brands.js",
    "analysis/wording.js",
    "adapters/shared/links.js",
    "analysis/risk.js",
    "analysis/scoring.js"
];
for (const file of loadFiles) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}

const E = (code, points, strength, evidenceClass = null) => ({
    code,
    evidenceClass: evidenceClass || undefined,
    points: evidenceClass ? bucEvidenceClassPoints(evidenceClass, points) : points,
    strength: evidenceClass ? bucEvidenceClassStrength(evidenceClass, strength) : strength,
    text: code
});
const signals = [
    { id: "urgency", wording: "Urgent.", profile: "weak", family: "wording" },
    { id: "account-threat", wording: "Your account will be suspended.", profile: "medium", family: "wording" },
    { id: "credential-request", wording: "Verify your account to continue.", profile: "credential", family: "wording", credentialSensitive: true },
    { id: "password-request", wording: "Enter your password.", profile: "context-strong", family: "wording", credentialSensitive: true },
    { id: "mfa-request", wording: "Reply with your verification code.", profile: "context-strong", family: "wording", credentialSensitive: true },
    { id: "payment-pressure", wording: "Payment required.", profile: "medium", family: "wording" },
    { id: "changed-payment", wording: "Our bank details have changed.", profile: "context-strong", family: "wording" },
    { id: "gift-card", wording: "Buy gift cards.", profile: "context-strong", family: "wording" },
    { id: "secrecy", wording: "Keep this a secret.", profile: "context-strong", family: "wording" },
    { id: "remote-access", wording: "Install AnyDesk.", profile: "context-strong", family: "wording" },
    { id: "http-link", links: [{ text: "Continue", url: "http://example.test/" }], profile: "weak", family: "link" },
    { id: "shortener-link", links: [{ text: "Continue", url: "https://bit.ly/example" }], profile: "medium", family: "link" },
    { id: "punycode-link", links: [{ text: "Continue", url: "https://xn--e1afmkfd.xn--p1ai/" }], profile: "medium-review", family: "link" },
    { id: "display-mismatch", links: [{ text: "https://microsoft.com", url: "https://example-login.invalid/" }], profile: "strong-destination", family: "link", strongDestination: true },
    { id: "typosquat-link", links: [{ text: "Microsoft sign in", url: "https://micros0ft.com/" }], profile: "strong-destination", family: "link", strongDestination: true },
    { id: "identity-mismatch", senderEvidence: [E("sender-domain-mismatch", 8, "medium")], profile: "identity", family: "identity", identityCorroborator: true },
    { id: "dmarc-fail", metadataEvidence: [E("auth-dmarc-fail", 12, "strong", "AUTH_DMARC_FAIL")], profile: "auth-strong", family: "identity", identityCorroborator: true },
    { id: "official-sender", senderEvidence: [E("official-sender-domain", -5, "positive", "OFFICIAL_SENDER_DOMAIN")], profile: "positive", family: "reassurance" },
    { id: "aligned-auth", metadataEvidence: [E("auth-spf-aligned", -2, "positive", "AUTH_SPF_ALIGNED"), E("auth-dkim-aligned", -3, "positive", "AUTH_DKIM_ALIGNED"), E("auth-dmarc-pass", -2, "positive", "AUTH_DMARC_PASS")], profile: "positive", family: "reassurance" }
];

const signalById = new Map(signals.map(signal => [signal.id, signal]));
const stateRank = { "no-concerns": 0, unknown: 1, review: 2, caution: 3, high: 4 };

function analyseLink(link, index) {
    const result = calculateLinkRisk(link.text || "", link.url || "");
    return {
        id: `LINK-${String(index + 1).padStart(2, "0")}`,
        text: link.text || "",
        url: link.url || "",
        score: result.score || 0,
        warningDetails: result.warnings || [],
        domain: result.domain || null,
        reference: result.reference || null
    };
}

function mergeSignals(a, b = null) {
    const parts = [a, b].filter(Boolean);
    return {
        wordingText: parts.map(x => x.wording || "").filter(Boolean).join(" "),
        links: parts.flatMap(x => x.links || []),
        senderEvidence: parts.flatMap(x => x.senderEvidence || []),
        metadataEvidence: parts.flatMap(x => x.metadataEvidence || []),
        bodyEvidence: parts.flatMap(x => x.bodyEvidence || [])
    };
}

function scoreInput(input) {
    const links = (input.links || []).map(analyseLink);
    const wordingResult = checkWording(input.wordingText || "");
    const scoring = scoreBeforeUClickEvidence({
        senderResult: { evidence: input.senderEvidence || [] },
        metadataResult: { evidence: input.metadataEvidence || [] },
        bodyIdentityResult: { evidence: input.bodyEvidence || [] },
        wordingResult,
        links
    });
    return {
        state: scoring.level.key,
        score: scoring.score,
        scoreDerivedState: scoring.scoreLevel?.key || null,
        scoreBand: scoring.scoreBand?.key || null,
        minimumVerdict: scoring.minimumVerdict || null,
        moduleScores: scoring.moduleScores,
        wordingMatches: (wordingResult.matches || []).map(x => x.id),
        evidenceCodes: [...new Set((scoring.evidence || []).map(x => x.code).filter(Boolean))],
        combinations: (scoring.combinationEvidence || []).map(x => x.code)
    };
}

function reviewSingle(row) {
    const signal = signalById.get(row.signal);
    const reasons = [];
    const rank = stateRank[row.state] ?? -1;

    if (signal.profile === "weak" && rank > stateRank.review) {
        reasons.push("weak signal alone exceeds Review");
    }
    if (signal.profile === "positive" && rank > stateRank.unknown) {
        reasons.push("reassuring signal alone produces a concerning state");
    }
    if (signal.profile === "context-strong" && row.state === "caution") {
        reasons.push("context-sensitive wording alone reaches Caution; test legitimate context before accepting");
    }
    if (signal.profile === "medium-review" && row.state === "caution") {
        reasons.push("medium structural signal alone reaches Caution; human calibration review requested");
    }
    if (signal.profile === "auth-strong" && row.state === "caution") {
        reasons.push("authentication failure alone reaches Caution; test forwarding/authentication edge cases");
    }
    return reasons;
}

function reviewPair(row) {
    const a = signalById.get(row.a);
    const b = signalById.get(row.b);
    const pair = [a, b];
    const reasons = [];
    const rank = stateRank[row.state] ?? -1;
    const hasPositive = pair.some(x => x.profile === "positive");
    const hasWeak = pair.some(x => x.profile === "weak");
    const allLow = pair.every(x => ["weak", "positive"].includes(x.profile));
    const hasStrongDestination = pair.some(x => x.strongDestination);
    const hasCredential = pair.some(x => x.credentialSensitive);
    const hasIdentityCorroborator = pair.some(x => x.identityCorroborator);
    const expectsHighCorroboration = hasStrongDestination && (hasCredential || hasIdentityCorroborator);

    if (expectsHighCorroboration && row.state !== "high") {
        reasons.push("strong destination plus credential/identity corroboration does not reach High concern");
    }
    if (!expectsHighCorroboration && row.state === "high") {
        reasons.push("High concern appears without the currently defined strong-destination corroboration pattern");
    }
    if (allLow && rank > stateRank.review) {
        reasons.push("weak/reassuring pair exceeds Review");
    }
    if (hasPositive && hasWeak && rank > stateRank.review) {
        reasons.push("reassurance plus weak concern exceeds Review");
    }
    if (hasPositive && pair.some(x => x.profile === "context-strong") && row.state === "caution") {
        reasons.push("context-sensitive strong wording stays at Caution despite reassurance; verify with realistic legitimate cases");
    }
    return reasons;
}

const singles = signals.map(signal => ({ signal: signal.id, profile: signal.profile, ...scoreInput(mergeSignals(signal)) }));
for (const row of singles) row.reviewReasons = reviewSingle(row);

const pairs = [];
for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
        const row = { a: signals[i].id, b: signals[j].id, ...scoreInput(mergeSignals(signals[i], signals[j])) };
        row.reviewReasons = reviewPair(row);
        pairs.push(row);
    }
}

const stateCounts = rows => rows.reduce((acc, row) => {
    acc[row.state] = (acc[row.state] || 0) + 1;
    return acc;
}, {});
const singleFlags = singles.filter(row => row.reviewReasons.length);
const pairFlags = pairs.filter(row => row.reviewReasons.length);

const output = {
    generatedAt: new Date().toISOString(),
    scoringModelRevision: BUC_SCORING_MODEL.revision,
    signalCount: signals.length,
    singleCount: singles.length,
    pairCount: pairs.length,
    singleStateDistribution: stateCounts(singles),
    pairStateDistribution: stateCounts(pairs),
    singleScoreBandDistribution: stateCounts(singles.map(row => ({ state: row.scoreBand || "unclassified" }))),
    pairScoreBandDistribution: stateCounts(pairs.map(row => ({ state: row.scoreBand || "unclassified" }))),
    reviewFlagCount: singleFlags.length + pairFlags.length,
    singleReviewFlagCount: singleFlags.length,
    pairReviewFlagCount: pairFlags.length,
    singles,
    pairs
};

fs.mkdirSync(resultDir, { recursive: true });
fs.writeFileSync(path.join(resultDir, "pairwise-matrix.json"), JSON.stringify(output, null, 2));

const esc = value => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const rows = [["signal_a", "signal_b", "state", "score", "score_derived_state", "score_band", "minimum_verdict", "identity", "links", "wording", "combinations", "reassurance", "combination_codes", "review_reasons"]];
for (const row of pairs) {
    rows.push([row.a, row.b, row.state, row.score, row.scoreDerivedState || "", row.scoreBand || "", row.minimumVerdict || "", row.moduleScores.identity, row.moduleScores.links, row.moduleScores.wording, row.moduleScores.combinations, row.moduleScores.reassurance, row.combinations.join("|"), row.reviewReasons.join(" | ")]);
}
fs.writeFileSync(path.join(resultDir, "pairwise-matrix.csv"), rows.map(r => r.map(esc).join(",")).join("\n") + "\n");

const flagRows = [["type", "signal_a", "signal_b", "state", "score", "reason"]];
for (const row of singleFlags) {
    for (const reason of row.reviewReasons) flagRows.push(["single", row.signal, "", row.state, row.score, reason]);
}
for (const row of pairFlags) {
    for (const reason of row.reviewReasons) flagRows.push(["pair", row.a, row.b, row.state, row.score, reason]);
}
fs.writeFileSync(path.join(resultDir, "pairwise-review-flags.csv"), flagRows.map(r => r.map(esc).join(",")).join("\n") + "\n");

const md = [];
md.push("# Pairwise exploration review flags");
md.push("");
md.push(`- Signals: **${signals.length}**`);
md.push(`- Unique pairs: **${pairs.length}**`);
md.push(`- Single-signal review flags: **${singleFlags.length}**`);
md.push(`- Pair review flags: **${pairFlags.length}**`);
md.push("");
md.push("These are **review prompts, not pass/fail labels**. They encode only a few broad calibration expectations so the bot can point humans toward potentially noisy or under-sensitive combinations without deciding the final scoring policy.");
md.push("");
md.push("## Single-signal flags");
md.push("");
if (!singleFlags.length) md.push("None.");
else {
    md.push("| Signal | State | Score | Review reason |");
    md.push("| --- | --- | ---: | --- |");
    for (const row of singleFlags) md.push(`| ${row.signal} | ${row.state} | ${row.score} | ${row.reviewReasons.join("; ")} |`);
}
md.push("");
md.push("## Pair flags");
md.push("");
if (!pairFlags.length) md.push("None.");
else {
    md.push("| Pair | State | Score | Review reason |");
    md.push("| --- | --- | ---: | --- |");
    for (const row of pairFlags) md.push(`| ${row.a} + ${row.b} | ${row.state} | ${row.score} | ${row.reviewReasons.join("; ")} |`);
}
md.push("");
md.push("A flag means the case deserves a realistic whole-email scenario before a weight, evidence strength or breakpoint is changed. The script never edits production scoring automatically.");
fs.writeFileSync(path.join(resultDir, "PAIRWISE_REVIEW.md"), md.join("\n") + "\n");

console.log(`Pairwise exploration: ${signals.length} signals, ${pairs.length} unique pairs`);
console.log("Singles:", output.singleStateDistribution);
console.log("Pairs:", output.pairStateDistribution);
console.log("Single score bands:", output.singleScoreBandDistribution);
console.log("Pair score bands:", output.pairScoreBandDistribution);
console.log(`Human-review flags: ${singleFlags.length} singles, ${pairFlags.length} pairs`);
console.log("Flags are review prompts only; they do not automatically change production scoring.");
