// tests/v015_ui_smoke_test.js
// Static assertions for the v0.15 progressive-disclosure UI.
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const popup = read("popup.html");
const popupJs = read("popup.js");
const panel = read("ui/report.js");
const link = read("ui/link_popover.js");
const full = read("report/report.html");

for (const expected of ["Inspect full report", "Things to review", "resultContext"]) {
  if (!popup.includes(expected)) throw new Error(`popup missing ${expected}`);
}
for (const removed of ["riskScore", "senderEmail", "What the full report includes"]) {
  if (popup.includes(removed)) throw new Error(`popup still includes crowded field ${removed}`);
}
if (!popupJs.includes("bucPopupDecisionText")) throw new Error("popup lacks decision-first text");
if (!panel.includes("Link details now live beside the links themselves")) throw new Error("panel not redistributed");
if (panel.includes("Developer / extraction details")) throw new Error("floating panel still duplicates developer details");
if (!link.includes("Registered domain:")) throw new Error("link popover lacks registered domain");
if (!link.includes("Actual destination:")) throw new Error("link popover lacks actual destination label");
if (!link.includes("Wrapper link:")) throw new Error("link popover lacks redirect wrapper display");
if (!link.includes("focusLinkId")) throw new Error("link popover lacks focused full-report action");
for (const expected of ["Evaluation diagnostics (developer)", "All risk indicators", "Unavailable / not exposed checks", "Developer / extraction details"]) {
  if (!full.includes(expected)) throw new Error(`full report missing ${expected}`);
}
if (!popup.includes("statScanned") || !popup.includes("statConcern")) throw new Error("v0.16 team UI activity counters missing");
console.log("v0.15 progressive-disclosure / v0.16 team-UI regression test: PASS");
