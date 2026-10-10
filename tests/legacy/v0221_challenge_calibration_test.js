// v0.22.1 challenge-corpus and pairwise-review regression.
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const manifest = JSON.parse(read("manifest.json"));
assert(manifest.version === "0.22.1", `Expected v0.22.1 manifest, got ${manifest.version}`);

childProcess.execFileSync(process.execPath, [path.join(root, "calibration/run_calibration.js")], { cwd: root, stdio: "pipe" });
childProcess.execFileSync(process.execPath, [path.join(root, "calibration/run_pairwise_matrix.js")], { cwd: root, stdio: "pipe" });

const baseline = JSON.parse(read("calibration/results/baseline.json"));
assert(baseline.scenarioCount === 78, `Expected 78 total scenarios, got ${baseline.scenarioCount}.`);
assert(baseline.trackSummary.regression.total === 48, "Expected frozen 48-case regression track.");
assert(baseline.trackSummary.regression.FAIL === 0, "Regression track must remain free of failures.");
assert(baseline.trackSummary.challenge.total === 30, "Expected 30 context-sensitive challenge scenarios.");

const byId = new Map(baseline.results.map(item => [item.id, item]));
assert(byId.get("CH-MFA-L")?.actualState === "caution", "Current baseline should expose the legitimate MFA-delivery Caution finding.");
assert(byId.get("CH-GIFTCARD-P")?.actualState === "caution", "Current baseline should expose the gift-card/secrecy phishing under-escalation finding.");
assert(byId.get("CH-SECRECY-L")?.actualState === "caution", "Current baseline should expose the legitimate confidentiality Caution finding.");

const pairwise = JSON.parse(read("calibration/results/pairwise-matrix.json"));
assert(pairwise.signalCount === 19 && pairwise.pairCount === 171, "Expected 19-signal / 171-pair exploration matrix.");
assert(pairwise.reviewFlagCount > 0, "Expected pairwise bot to emit human-review flags.");
assert(fs.existsSync(path.join(root, "calibration/results/PAIRWISE_REVIEW.md")), "Expected human-readable pairwise review report.");

console.log(`v0.22.1 challenge calibration: PASS (${baseline.trackSummary.challenge.PASS} preferred, ${baseline.trackSummary.challenge.ACCEPTABLE} acceptable, ${baseline.trackSummary.challenge.FAIL} findings; ${pairwise.reviewFlagCount} pairwise review flags)`);
