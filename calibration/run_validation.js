#!/usr/bin/env node
"use strict";

/**
 * BeforeUClick v0.22.3 independent whole-email validation runner.
 *
 * This is deliberately separate from calibration/scenarios.json and
 * challenge_scenarios.json. The validation set is not used to choose weights.
 * It exercises the same sender, metadata, authentication, wording, body-identity,
 * link and scoring modules used by the extension, then compares the final report
 * state against broad human-authored expectations.
 *
 * Score ranges are diagnostic only. A score outside a suggested range does not by
 * itself fail a scenario; the purpose is to expose clustering or compression
 * without encouraging exact-number overfitting.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const resultDir = path.join(__dirname, "validation_results");
const scenarioPath = path.join(__dirname, "validation_scenarios.json");
const VALIDATION_REVISION = "0.22.3-independent-validation-v1";

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
    "analysis/sender.js",
    "analysis/metadata.js",
    "analysis/headers/parser.js",
    "analysis/headers/alignment.js",
    "analysis/headers/authentication.js",
    "analysis/headers/evidence.js",
    "analysis/body_identity.js",
    "adapters/shared/links.js",
    "analysis/risk.js",
    "analysis/scoring.js"
];

for (const file of loadFiles) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}

const scenarios = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

const providerAuthserv = Object.freeze({
    gmail: "mx.google.com",
    outlook: "mail.protection.outlook.com",
    yahoo: "sonic.gate.mail.ne1.yahoo.com"
});

function buildRawHeaders(email) {
    if (email.rawHeaders) return email.rawHeaders;
    if (!email.auth) return "";

    const provider = email.provider || "gmail";
    const authserv = providerAuthserv[provider] || providerAuthserv.gmail;
    const sender = email.sender || "unknown@example.test";
    const senderDomain = sender.includes("@") ? sender.split("@").pop() : "example.test";
    const auth = email.auth || {};
    const spfDomain = auth.spfDomain || senderDomain;
    const dkimDomain = auth.dkimDomain || senderDomain;
    const dmarcDomain = auth.dmarcDomain || senderDomain;
    const returnPath = email.returnPath || `bounce@${spfDomain}`;
    const parts = [];

    if (auth.spf) parts.push(`spf=${auth.spf} smtp.mailfrom=${spfDomain}`);
    if (auth.dkim) parts.push(`dkim=${auth.dkim} header.d=${dkimDomain} header.s=v1`);
    if (auth.dmarc) parts.push(`dmarc=${auth.dmarc} header.from=${dmarcDomain}`);

    const lines = [
        `From: ${email.senderName ? `${email.senderName} <${sender}>` : sender}`,
        `To: recipient@example.net`,
        email.replyTo ? `Reply-To: ${email.replyTo}` : "",
        `Return-Path: <${returnPath}>`,
        `Message-ID: <${email.id || "validation"}@${senderDomain}>`,
        parts.length ? `Authentication-Results: ${authserv}; ${parts.join("; ")}` : "",
        auth.dkim ? `DKIM-Signature: v=1; a=rsa-sha256; d=${dkimDomain}; s=v1; b=validation` : "",
        `Received: from mail.${spfDomain} by ${authserv}`,
        `Subject: ${email.subject || ""}`,
        `Date: Sun, 27 Sep 2026 10:00:00 +1300`
    ].filter(Boolean);

    return lines.join("\r\n");
}

function analyseLinks(items) {
    return (items || []).map((link, index) => {
        const risk = calculateLinkRisk(link.text || link.altText || "", link.url || "");
        return {
            id: link.id || `LINK-${String(index + 1).padStart(2, "0")}`,
            text: link.text || "",
            altText: link.altText || "",
            type: link.type || "text",
            url: link.url || "",
            score: risk.score || 0,
            rawScore: risk.rawScore ?? risk.score ?? 0,
            warnings: (risk.warnings || []).map(item => item.text || item.code || "Link warning"),
            warningDetails: risk.warnings || [],
            domain: risk.domain || null,
            reference: risk.reference || null
        };
    });
}

function runScenario(scenario) {
    const email = scenario.email || {};
    const provider = email.provider || "gmail";
    let metadata = {
        sender: email.sender || "",
        senderName: email.senderName || "",
        recipients: { to: ["recipient@example.net"], cc: [], bcc: [] },
        subject: email.subject || "",
        date: "Sun, 27 Sep 2026 10:00:00 +1300",
        replyTo: email.replyTo || "",
        mailedBy: email.mailedBy || "",
        signedBy: email.signedBy || "",
        unavailable: []
    };

    const rawHeaders = buildRawHeaders(email);
    const acquisition = rawHeaders
        ? { provider, status: "full", source: "validation-fixture", rawHeaders, limitations: [] }
        : { provider, status: "unavailable", source: "none", rawHeaders: "", limitations: ["Independent fixture intentionally omits full headers."] };

    const authentication = bucBuildAuthenticationModel(acquisition, metadata, provider);
    metadata = bucMergeMetadataFromAuthentication(metadata, authentication);
    const authenticationResult = analyseAuthentication(authentication);
    const senderResult = analyseSender(metadata.sender, metadata.senderName, { knownSender: Boolean(email.knownSender) });

    const metadataForConsistency = {
        ...metadata,
        mailedBy: authentication?.spf?.providerTrusted ? "" : metadata.mailedBy,
        signedBy: authentication?.dkim?.some(item => item.providerTrusted) ? "" : metadata.signedBy
    };
    const metadataResult = analyseMetadata(metadataForConsistency);
    const bodyIdentityResult = analyseBodyIdentity(email.body || "");
    const wordingResult = checkWording([metadata.subject, email.body || ""].filter(Boolean).join("\n\n"));
    const links = analyseLinks(email.links || []);

    const scoringMetadataResult = {
        ...metadataResult,
        evidence: [
            ...(metadataResult.evidence || []),
            ...(authenticationResult.evidence || [])
        ]
    };

    const scoring = scoreBeforeUClickEvidence({
        senderResult,
        metadataResult: scoringMetadataResult,
        bodyIdentityResult,
        wordingResult,
        links
    });

    const expected = scenario.expected || {};
    const preferred = expected.preferredStates || [];
    const acceptable = expected.acceptableStates || [];
    const forbidden = expected.forbiddenStates || [];
    const actual = scoring.level.key;

    let status = preferred.includes(actual) ? "PASS" : (acceptable.includes(actual) ? "ACCEPTABLE" : "FAIL");
    const reasons = [];
    if (!preferred.includes(actual) && !acceptable.includes(actual)) reasons.push(`state ${actual} not in expected range`);
    if (forbidden.includes(actual)) {
        status = "FAIL";
        reasons.push(`state ${actual} is explicitly forbidden`);
    }

    const scoreRange = expected.scoreRange || null;
    let scoreRangeStatus = "UNSPECIFIED";
    if (Array.isArray(scoreRange) && scoreRange.length === 2) {
        if (scoring.score < scoreRange[0]) scoreRangeStatus = "LOW";
        else if (scoring.score > scoreRange[1]) scoreRangeStatus = "HIGH";
        else scoreRangeStatus = "IN_RANGE";
    }

    const stateRanks = { "no-concerns": 0, unknown: 1, review: 2, caution: 3, high: 4 };
    const allowedRanks = [...preferred, ...acceptable].map(key => stateRanks[key]).filter(Number.isFinite);
    const nearestRankDistance = allowedRanks.length
        ? Math.min(...allowedRanks.map(rank => Math.abs((stateRanks[actual] ?? 1) - rank)))
        : 0;

    return {
        id: scenario.id,
        group: scenario.group,
        theme: scenario.theme || "",
        description: scenario.description,
        provider,
        status,
        actualState: actual,
        actualLabel: scoring.level.label,
        score: scoring.score,
        scoreDerivedState: scoring.scoreLevel?.key || null,
        scoreBand: scoring.scoreBand?.key || null,
        scoreBandLabel: scoring.scoreBand?.label || null,
        scoreRange,
        scoreRangeStatus,
        majorStateMiss: status === "FAIL" && nearestRankDistance >= 2,
        expectedPreferred: preferred,
        expectedAcceptable: acceptable,
        forbiddenStates: forbidden,
        reasons,
        moduleScores: scoring.moduleScores,
        minimumVerdict: scoring.minimumVerdict || null,
        senderEvidence: (senderResult.evidence || []).map(item => item.code),
        authenticationEvidence: (authenticationResult.evidence || []).map(item => item.code),
        metadataEvidence: (metadataResult.evidence || []).map(item => item.code),
        bodyIdentityEvidence: (bodyIdentityResult.evidence || []).map(item => item.code),
        wordingMatches: (wordingResult.matches || []).map(item => item.id),
        combinationCodes: (scoring.combinationEvidence || []).map(item => item.code),
        linkEvidence: links.map(link => ({
            url: link.url,
            score: link.score,
            warningCodes: (link.warningDetails || []).map(item => item.code)
        }))
    };
}

function summarise(rows) {
    const out = { total: rows.length, PASS: 0, ACCEPTABLE: 0, FAIL: 0, majorStateMiss: 0, scoreRangeOutside: 0, states: {}, bands: {} };
    for (const row of rows) {
        out[row.status] += 1;
        if (row.majorStateMiss) out.majorStateMiss += 1;
        if (["LOW", "HIGH"].includes(row.scoreRangeStatus)) out.scoreRangeOutside += 1;
        out.states[row.actualState] = (out.states[row.actualState] || 0) + 1;
        out.bands[row.scoreBand || "unclassified"] = (out.bands[row.scoreBand || "unclassified"] || 0) + 1;
    }
    const scores = rows.map(row => row.score).sort((a, b) => a - b);
    if (scores.length) {
        out.scoreMin = scores[0];
        out.scoreMax = scores[scores.length - 1];
        const mid = Math.floor(scores.length / 2);
        out.scoreMedian = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    }
    return out;
}

const results = scenarios.map(runScenario);
const groups = {};
for (const row of results) {
    if (!groups[row.group]) groups[row.group] = [];
    groups[row.group].push(row);
}
const groupSummary = Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, summarise(rows)]));
const totals = summarise(results);

const output = {
    generatedAt: new Date().toISOString(),
    validationRevision: VALIDATION_REVISION,
    scenarioCount: results.length,
    scoringModelRevision: BUC_SCORING_MODEL.revision,
    scoringModel: BUC_SCORING_MODEL,
    purpose: "Independent whole-email validation. This dataset must not be used to tune production weights case-by-case.",
    totals,
    groupSummary,
    results
};

fs.mkdirSync(resultDir, { recursive: true });
fs.writeFileSync(path.join(resultDir, "validation.json"), JSON.stringify(output, null, 2));

const csvEscape = value => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvRows = [[
    "id", "group", "theme", "provider", "status", "expected_preferred", "expected_acceptable",
    "actual_state", "score", "score_band", "score_range", "score_range_status", "major_state_miss",
    "identity", "links", "wording", "combinations", "reassurance", "description", "reasons",
    "wording_matches", "combination_codes"
]];
for (const row of results) {
    csvRows.push([
        row.id, row.group, row.theme, row.provider, row.status,
        row.expectedPreferred.join("|"), row.expectedAcceptable.join("|"), row.actualState,
        row.score, row.scoreBand || "", row.scoreRange ? row.scoreRange.join("-") : "", row.scoreRangeStatus,
        row.majorStateMiss ? "yes" : "no", row.moduleScores.identity, row.moduleScores.links,
        row.moduleScores.wording, row.moduleScores.combinations, row.moduleScores.reassurance,
        row.description, row.reasons.join("; "), row.wordingMatches.join("|"), row.combinationCodes.join("|")
    ]);
}
fs.writeFileSync(path.join(resultDir, "validation.csv"), csvRows.map(row => row.map(csvEscape).join(",")).join("\n") + "\n");

const md = [];
md.push("# BeforeUClick independent validation report", "");
md.push(`- Validation set: **${VALIDATION_REVISION}**`);
md.push(`- Scoring model: \`${BUC_SCORING_MODEL.revision}\``);
md.push(`- Whole-email scenarios: **${results.length}**`);
md.push(`- PASS: **${totals.PASS}**`);
md.push(`- ACCEPTABLE: **${totals.ACCEPTABLE}**`);
md.push(`- FAIL: **${totals.FAIL}**`);
md.push(`- Major state misses (2+ state steps): **${totals.majorStateMiss}**`);
md.push(`- Scores outside broad diagnostic ranges: **${totals.scoreRangeOutside}**`, "");
md.push("> This is a hold-out validation set. Score ranges are deliberately broad and diagnostic only. Do not rewrite production weights to make individual validation fixtures pass. Investigate repeated patterns/clusters first.", "");
md.push("## Group summary", "");
md.push("| Group | Total | Pass | Acceptable | Fail | Major misses | Score range outside | Score min / median / max | State distribution |");
md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
for (const [group, summary] of Object.entries(groupSummary)) {
    const states = Object.entries(summary.states).map(([key, value]) => `${key}:${value}`).join(", ");
    md.push(`| ${group} | ${summary.total} | ${summary.PASS} | ${summary.ACCEPTABLE} | ${summary.FAIL} | ${summary.majorStateMiss} | ${summary.scoreRangeOutside} | ${summary.scoreMin} / ${summary.scoreMedian} / ${summary.scoreMax} | ${states} |`);
}
md.push("", "## Cases needing review", "");
const reviewRows = results.filter(row => row.status !== "PASS" || ["LOW", "HIGH"].includes(row.scoreRangeStatus));
if (!reviewRows.length) {
    md.push("No validation cases require review.");
} else {
    md.push("| Case | Group | Status | Expected | Actual | Score | Band | Range | Range check | Main modules | Why |");
    md.push("| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |");
    for (const row of reviewRows) {
        const expected = [row.expectedPreferred.join("/"), row.expectedAcceptable.length ? `(${row.expectedAcceptable.join("/")} acceptable)` : ""].filter(Boolean).join(" ");
        const modules = `I:${row.moduleScores.identity} L:${row.moduleScores.links} W:${row.moduleScores.wording} C:${row.moduleScores.combinations} R:${row.moduleScores.reassurance}`;
        md.push(`| ${row.id} | ${row.group} | ${row.status} | ${expected} | ${row.actualState} | ${row.score} | ${row.scoreBandLabel || ""} | ${row.scoreRange ? row.scoreRange.join("–") : ""} | ${row.scoreRangeStatus} | ${modules} | ${row.reasons.join("; ") || "Diagnostic range only"} |`);
    }
}
md.push("", "## Validation rule", "");
md.push("A single surprising case is a prompt to inspect the evidence trace, not permission to retune the model. Change production scoring only when multiple independent validation cases expose the same systematic problem, then rerun the original 78-scenario regression/challenge calibration and the 171-pair exploration before accepting the change.");
fs.writeFileSync(path.join(resultDir, "VALIDATION_SUMMARY.md"), md.join("\n") + "\n");

console.log(`BeforeUClick independent validation: ${results.length} whole-email scenarios`);
console.log(`PASS ${totals.PASS} | ACCEPTABLE ${totals.ACCEPTABLE} | FAIL ${totals.FAIL}`);
for (const [group, summary] of Object.entries(groupSummary)) {
    console.log(`${group}: ${summary.PASS} pass, ${summary.ACCEPTABLE} acceptable, ${summary.FAIL} fail / ${summary.total} | score ${summary.scoreMin}/${summary.scoreMedian}/${summary.scoreMax}`);
}
console.log(`Major state misses: ${totals.majorStateMiss}`);
console.log(`Diagnostic score-range flags: ${totals.scoreRangeOutside}`);
const failures = results.filter(row => row.status === "FAIL");
if (failures.length) {
    console.log("\nVALIDATION FINDINGS:");
    failures.forEach(row => console.log(`- ${row.id}: expected ${[...row.expectedPreferred, ...row.expectedAcceptable].join("/")}, got ${row.actualState} (${row.score})`));
}
