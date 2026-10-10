const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const s = file => fs.readFileSync(path.join(root, file), "utf8");

const manifest = JSON.parse(s("manifest.json"));
if (!["0.16.0", "0.18.0", "0.18.1", "0.18.2"].includes(manifest.version)) throw new Error("Unexpected Team UI compatible build.");
if (!manifest.content_scripts[0].js.includes("adapters/gmail/inbox_preview.js")) throw new Error("Inbox preview module not loaded.");

["icons/icon16.png", "icons/icon48.png", "icons/icon128.png", "icons/mark.png"].forEach(file => {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing team UI asset: ${file}`);
});

const popup = s("popup.html");
[
    'class="header-band"',
    'src="icons/icon128.png"',
    'src="icons/mark.png"',
    'id="statScanned"',
    'id="statConcern"',
    'id="viewFullReportButton"',
    'id="stopCheckingButton"'
].forEach(value => { if (!popup.includes(value)) throw new Error(`Popup missing: ${value}`); });

const preferences = s("settings/preferences.js");
if (!preferences.includes('inboxPreviewMode: "off"')) throw new Error("Inbox preview must default off.");

const preview = s("adapters/gmail/inbox_preview.js");
[
    "analyseSender(",
    "inboxPreviewMode !== \"concerns\"",
    "Sender-only inbox preview",
    "tr.zA"
].forEach(value => { if (!preview.includes(value)) throw new Error(`Inbox preview missing: ${value}`); });
if (preview.includes("BUC_RECORD_SCAN")) throw new Error("Inbox preview must not count as a full scan.");

const options = s("settings/options.html");
if (!options.includes('id="inboxPreviewMode"')) throw new Error("Inbox preview setting missing.");
if (/trusted senders/i.test(options)) throw new Error("Unsafe trusted-sender wording returned.");

const popupJs = s("popup.js");
if (!popupJs.includes('type: "BUC_GET_STATS"')) throw new Error("Popup daily stats are not wired to existing backend.");

console.log("v0.16 team UI integration smoke test: PASS");
