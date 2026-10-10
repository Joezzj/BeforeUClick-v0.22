#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const resultDir = path.join(__dirname, "results");
const scenarioFiles = [
    { file: "scenarios.json", defaultTrack: "regression" },
    { file: "challenge_scenarios.json", defaultTrack: "challenge" }
];

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

const scenarios = [];
for (const source of scenarioFiles) {
    const fullPath = path.join(__dirname, source.file);
    if (!fs.existsSync(fullPath)) continue;
    const items = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    for (const item of items) scenarios.push({ ...item, track: item.track || source.defaultTrack });
}

const BUC_CALIBRATION_EVIDENCE_CLASS_BY_CODE = Object.freeze({
    "official-sender-domain": "OFFICIAL_SENDER_DOMAIN",
    "known-local-sender": "KNOWN_LOCAL_SENDER",
    "auth-spf-aligned": "AUTH_SPF_ALIGNED",
    "auth-dkim-aligned": "AUTH_DKIM_ALIGNED",
    "auth-dmarc-pass": "AUTH_DMARC_PASS",
    "auth-spf-fail": "AUTH_SPF_FAIL",
    "auth-dkim-fail": "AUTH_DKIM_FAIL",
    "auth-dmarc-fail": "AUTH_DMARC_FAIL",
    "auth-domain-unaligned": "AUTH_DOMAIN_UNALIGNED",
    "known-phishing": "KNOWN_PHISHING"
});

function bucResolveCalibrationEvidence(item) {
    const evidenceClass = item?.evidenceClass || BUC_CALIBRATION_EVIDENCE_CLASS_BY_CODE[item?.code] || null;
    if (!evidenceClass) return { ...item };
    return {
        ...item,
        evidenceClass,
        points: bucEvidenceClassPoints(evidenceClass, Number(item?.points) || 0),
        strength: bucEvidenceClassStrength(evidenceClass, item?.strength || "context")
    };
}

function moduleFromEvidence(evidence) {
    return { evidence: (evidence || []).map(bucResolveCalibrationEvidence) };
}

function analyseLink(link, index) {
    const result = calculateLinkRisk(link.text || "", link.url || "");
    return {
        id: link.id || `LINK-${String(index + 1).padStart(2, "0")}`,
        text: link.text || "",
        altText: link.altText || "",
        type: link.type || "text",
        url: link.url || "",
        score: result.score || 0,
        rawScore: result.rawScore || result.score || 0,
        warnings: (result.warnings || []).map(item => item.text || item.code || "Link warning"),
        warningDetails: result.warnings || [],
        domain: result.domain || null,
        reference: result.reference || null
    };
}

function runScenario(scenario) {
    const input = scenario.input || {};
    const wordingResult = checkWording(input.wordingText || "");
    const links = (input.links || []).map(analyseLink);
    const senderResult = moduleFromEvidence(input.senderEvidence);
    const metadataResult = moduleFromEvidence(input.metadataEvidence);
    const bodyIdentityResult = moduleFromEvidence(input.bodyEvidence);

    const scoring = scoreBeforeUClickEvidence({
        senderResult,
        metadataResult,
        bodyIdentityResult,
        wordingResult,
        links
    });

    const evidenceCodes = [...new Set((scoring.evidence || []).map(item => item.code).filter(Boolean))];
    const preferred = scenario.expected?.preferredStates || [];
    const acceptable = scenario.expected?.acceptableStates || [];
    const forbidden = scenario.expected?.forbiddenStates || [];
    const required = scenario.expected?.requiredEvidenceCodes || [];

    let status = preferred.includes(scoring.level.key)
        ? "PASS"
        : (acceptable.includes(scoring.level.key) ? "ACCEPTABLE" : "FAIL");

    const reasons = [];
    if (!preferred.includes(scoring.level.key) && !acceptable.includes(scoring.level.key)) {
        reasons.push(`state ${scoring.level.key} not in expected range`);
    }
    if (forbidden.includes(scoring.level.key)) {
        status = "FAIL";
        reasons.push(`state ${scoring.level.key} is explicitly forbidden`);
    }
    for (const code of required) {
        if (!evidenceCodes.includes(code)) {
            status = "FAIL";
            reasons.push(`missing required evidence ${code}`);
        }
    }

    return {
        id: scenario.id,
        track: scenario.track || "regression",
        group: scenario.group,
        signalFocus: scenario.signalFocus || null,
        description: scenario.description,
        status,
        actualState: scoring.level.key,
        actualLabel: scoring.level.label,
        score: scoring.score,
        scoreDerivedState: scoring.scoreLevel?.key || null,
        scoreBand: scoring.scoreBand?.key || null,
        scoreBandLabel: scoring.scoreBand?.label || null,
        minimumVerdict: scoring.minimumVerdict || null,
        expectedPreferred: preferred,
        expectedAcceptable: acceptable,
        forbiddenStates: forbidden,
        reasons,
        moduleScores: scoring.moduleScores,
        linkSummary: scoring.linkSummary,
        combinationCodes: (scoring.combinationEvidence || []).map(item => item.code),
        evidenceCodes,
        wordingMatches: (wordingResult.matches || []).map(item => item.id),
        links: links.map(link => ({
            id: link.id,
            url: link.url,
            score: link.score,
            warningCodes: (link.warningDetails || []).map(item => item.code)
        }))
    };
}

const results = scenarios.map(runScenario);
const totalsFor = rows => rows.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
}, { PASS: 0, ACCEPTABLE: 0, FAIL: 0 });
const totals = totalsFor(results);

const groupSummary = {};
const trackSummary = {};
const scoreBandSummary = {};
for (const result of results) {
    if (!groupSummary[result.group]) groupSummary[result.group] = { total: 0, PASS: 0, ACCEPTABLE: 0, FAIL: 0, states: {} };
    const group = groupSummary[result.group];
    group.total += 1;
    group[result.status] += 1;
    group.states[result.actualState] = (group.states[result.actualState] || 0) + 1;

    if (!trackSummary[result.track]) trackSummary[result.track] = { total: 0, PASS: 0, ACCEPTABLE: 0, FAIL: 0, states: {} };
    const track = trackSummary[result.track];
    track.total += 1;
    track[result.status] += 1;
    track.states[result.actualState] = (track.states[result.actualState] || 0) + 1;

    const band = result.scoreBand || "unclassified";
    scoreBandSummary[band] = (scoreBandSummary[band] || 0) + 1;
}

const output = {
    generatedAt: new Date().toISOString(),
    scenarioCount: results.length,
    scoringModelRevision: BUC_SCORING_MODEL.revision,
    scoringModel: BUC_SCORING_MODEL,
    totals,
    trackSummary,
    groupSummary,
    scoreBandSummary,
    results
};

fs.mkdirSync(resultDir, { recursive: true });
const jsonPath = path.join(resultDir, "baseline.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

const csvEscape = value => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvRows = [[
    "id", "track", "group", "signal_focus", "status", "expected_preferred", "expected_acceptable",
    "actual_state", "score", "score_derived_state", "score_band", "minimum_verdict", "identity", "links", "wording", "combinations",
    "reassurance", "description", "reasons", "wording_matches", "combination_codes"
]];
for (const item of results) {
    csvRows.push([
        item.id,
        item.track,
        item.group,
        item.signalFocus || "",
        item.status,
        item.expectedPreferred.join("|"),
        item.expectedAcceptable.join("|"),
        item.actualState,
        item.score,
        item.scoreDerivedState || "",
        item.scoreBand || "",
        item.minimumVerdict || "",
        item.moduleScores.identity,
        item.moduleScores.links,
        item.moduleScores.wording,
        item.moduleScores.combinations,
        item.moduleScores.reassurance,
        item.description,
        item.reasons.join("; "),
        item.wordingMatches.join("|"),
        item.combinationCodes.join("|")
    ]);
}
fs.writeFileSync(path.join(resultDir, "baseline.csv"), csvRows.map(row => row.map(csvEscape).join(",")).join("\n") + "\n");

const md = [];
md.push("# BeforeUClick scoring calibration baseline");
md.push("");
md.push(`- Scenarios: **${results.length}**`);
md.push(`- Scoring model: \`${BUC_SCORING_MODEL.revision}\``);
md.push(`- PASS: **${totals.PASS}**`);
md.push(`- ACCEPTABLE: **${totals.ACCEPTABLE}**`);
md.push(`- FAIL: **${totals.FAIL}**`);
md.push("");
md.push("The **regression** track preserves the original scenario corpus. v0.22.2 intentionally re-baselines a small set of human-authored expected ranges to match the agreed low-end user-warning philosophy; the scenarios themselves remain regression evidence. The **challenge** track contains harder context-sensitive cases.");
md.push("");
md.push("## Track summary");
md.push("");
md.push("| Track | Total | Pass | Acceptable | Fail | State distribution |");
md.push("| --- | ---: | ---: | ---: | ---: | --- |");
for (const [name, summary] of Object.entries(trackSummary)) {
    const states = Object.entries(summary.states).map(([key, count]) => `${key}:${count}`).join(", ");
    md.push(`| ${name} | ${summary.total} | ${summary.PASS} | ${summary.ACCEPTABLE} | ${summary.FAIL} | ${states} |`);
}
md.push("");
md.push("## Group summary");
md.push("");
md.push("| Group | Total | Pass | Acceptable | Fail | State distribution |");
md.push("| --- | ---: | ---: | ---: | ---: | --- |");
for (const [name, summary] of Object.entries(groupSummary)) {
    const states = Object.entries(summary.states).map(([key, count]) => `${key}:${count}`).join(", ");
    md.push(`| ${name} | ${summary.total} | ${summary.PASS} | ${summary.ACCEPTABLE} | ${summary.FAIL} | ${states} |`);
}
md.push("");
md.push("## Internal score-band distribution");
md.push("");
md.push("These bands are calibration diagnostics. The ordinary interface still shows only the five user-facing states.");
md.push("");
for (const [band, count] of Object.entries(scoreBandSummary)) md.push(`- ${band}: **${count}**`);
md.push("");
md.push("## Cases needing attention");
md.push("");
const attention = results.filter(item => item.status !== "PASS");
if (!attention.length) {
    md.push("All scenarios landed in their preferred state. Add harder scenarios before tuning; a perfect result can indicate an underspecified corpus.");
} else {
    md.push("| Case | Track | Focus | Status | Expected | Actual | Score | Main module scores | Why |");
    md.push("| --- | --- | --- | --- | --- | --- | ---: | --- | --- |");
    for (const item of attention) {
        const expected = [...item.expectedPreferred, ...item.expectedAcceptable.map(x => `${x} (acceptable)`)].join(", ");
        const modules = `I:${item.moduleScores.identity} L:${item.moduleScores.links} W:${item.moduleScores.wording} C:${item.moduleScores.combinations} R:${item.moduleScores.reassurance}`;
        md.push(`| ${item.id} | ${item.track} | ${item.signalFocus || "-"} | ${item.status} | ${expected} | ${item.actualState} | ${item.score} | ${modules} | ${item.reasons.join("; ") || "Neighbouring acceptable state"} |`);
    }
}
md.push("");
md.push("## Important interpretation");
md.push("");
md.push("This is a calibration harness, not ground truth. Expected ranges are human-authored hypotheses and should be revised when realistic testing shows they are unreasonable. The runner must not automatically rewrite production weights simply to maximise its own pass rate. That would overfit the fixture set.");
md.push("");
md.push("Use the final state, internal score band, score-derived state and evidence explanation together. Small score differences inside the same useful region are acceptable. Change a weight or rule only when a repeated pattern produces an unreasonable user-facing warning or an implausible ordering of evidence, then rerun both tracks and the pairwise matrix.");
fs.writeFileSync(path.join(resultDir, "BASELINE_SUMMARY.md"), md.join("\n") + "\n");

console.log(`BeforeUClick calibration: ${results.length} scenarios`);
console.log(`PASS ${totals.PASS} | ACCEPTABLE ${totals.ACCEPTABLE} | FAIL ${totals.FAIL}`);
for (const [name, summary] of Object.entries(trackSummary)) {
    console.log(`${name}: ${summary.PASS} pass, ${summary.ACCEPTABLE} acceptable, ${summary.FAIL} fail / ${summary.total}`);
}
for (const [name, summary] of Object.entries(groupSummary)) {
    console.log(`${name}: ${summary.PASS} pass, ${summary.ACCEPTABLE} acceptable, ${summary.FAIL} fail / ${summary.total}`);
}
const failed = results.filter(item => item.status === "FAIL");
if (failed.length) {
    console.log("\nCALIBRATION FINDINGS:");
    for (const item of failed) console.log(`- ${item.id}: expected ${[...item.expectedPreferred, ...item.expectedAcceptable].join("/")}, got ${item.actualState} (${item.score}) ${item.reasons.join("; ")}`);
}
