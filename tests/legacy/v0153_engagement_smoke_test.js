// tests/v0153_engagement_smoke_test.js
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function source(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

const content = source("content.js");
[
    "let bucCheckEngaged = false",
    "function bucDisengageCurrentCheck",
    'message.type === "STOP_CHECKING"',
    "bucSetLinkInteractionEngaged(true)",
    "bucSetClickGuardEngaged(true)",
    "bucDisengageIfMessageChanged",
    "!bucCheckEngaged || !bucLastReport"
].forEach(value => {
    if (!content.includes(value)) throw new Error(`content.js missing: ${value}`);
});

const popover = source("ui/link_popover.js");
[
    "let bucLinkInteractionEngaged = false",
    "function bucSetLinkInteractionEngaged",
    "!bucLinkInteractionEngaged"
].forEach(value => {
    if (!popover.includes(value)) throw new Error(`link_popover.js missing: ${value}`);
});

const guard = source("ui/click_guard.js");
[
    "let bucClickGuardEngaged = false",
    "function bucSetClickGuardEngaged",
    "!bucClickGuardEngaged"
].forEach(value => {
    if (!guard.includes(value)) throw new Error(`click_guard.js missing: ${value}`);
});

const popup = source("popup.js");
if (!popup.includes('type: "STOP_CHECKING"')) throw new Error("Popup stop-check message missing.");
if (!popup.includes('checkAgainButton.addEventListener("click", bucPopupRunCheck)')) {
    throw new Error("Check again does not rerun analysis.");
}

const report = source("ui/report.js");
if (!report.includes('bucMakeSmallAction("Stop checking")')) {
    throw new Error("Floating report Stop checking control missing.");
}

console.log("v0.15.3 engagement smoke test: PASS");
