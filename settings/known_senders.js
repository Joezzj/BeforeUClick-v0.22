if (new URLSearchParams(location.search).get("embedded") === "1") document.body.classList.add("embedded");
// settings/known_senders.js
// Optional local known-sender management. Available only when remembered email information is enabled.

const knownSenderListEl = document.getElementById("knownSenderList");
const knownEmptyEl = document.getElementById("knownEmpty");
const storageDisabledEl = document.getElementById("storageDisabled");
const addKnownSenderForm = document.getElementById("addKnownSenderForm");
const addKnownSenderInput = document.getElementById("addKnownSenderInput");
const saveStatusEl = document.getElementById("saveStatus");
let bucKnownSenderQueue = Promise.resolve();

function bucKnownSenderStatus(message, persistent = false) {
    if (window.parent !== window) window.parent.postMessage({ type: "BUC_SETTINGS_STATUS", message, persistent }, location.origin);
    saveStatusEl.textContent = message;
    clearTimeout(bucKnownSenderStatus.timer);
    if (!persistent) bucKnownSenderStatus.timer = setTimeout(() => { saveStatusEl.textContent = ""; }, 2400);
}

function bucRenderKnownSenders(preferences) {
    const storageEnabled = preferences.storageMode === true;
    const senders = storageEnabled ? (preferences.knownSenders || []) : [];
    knownSenderListEl.textContent = "";
    storageDisabledEl.classList.toggle("hidden", storageEnabled);
    knownEmptyEl.classList.toggle("hidden", !storageEnabled || senders.length > 0);
    addKnownSenderForm.classList.toggle("hidden", !storageEnabled);
    addKnownSenderInput.disabled = !storageEnabled;

    if (!storageEnabled) return;

    senders.forEach(email => {
        const row = document.createElement("li");
        row.className = "entry-row";
        const label = document.createElement("span");
        label.className = "entry-email";
        label.textContent = email;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "entry-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            bucKnownSenderQueue = bucKnownSenderQueue.catch(() => {}).then(async () => {
                const updated = await bucRemoveKnownSender(email);
                bucRenderKnownSenders(updated);
                bucKnownSenderStatus("Known sender removed.");
            }).catch(() => bucKnownSenderStatus("Could not update the local sender list.", true));
        });
        row.append(label, remove);
        knownSenderListEl.appendChild(row);
    });
}

addKnownSenderForm.addEventListener("submit", event => {
    event.preventDefault();
    const email = addKnownSenderInput.value.trim().toLowerCase();
    if (!email) return;
    bucKnownSenderQueue = bucKnownSenderQueue.catch(() => {}).then(async () => {
        const current = await bucGetPreferences();
        if (!current.storageMode) {
            bucRenderKnownSenders(current);
            bucKnownSenderStatus("Remembered email information is off. Turn it on in Settings first.", true);
            return;
        }
        const updated = await bucAddKnownSender(email);
        addKnownSenderInput.value = "";
        bucRenderKnownSenders(updated);
        bucKnownSenderStatus("Known sender added.");
    }).catch(() => bucKnownSenderStatus("Could not update the local sender list.", true));
});

async function bucRefreshKnownSenders() {
    const preferences = await bucGetPreferences();
    bucApplyExtensionPagePreferences(preferences);
    bucRenderKnownSenders(preferences);
}

(async function initialiseKnownSenders() {
    await bucRefreshKnownSenders();
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[BUC_PREFERENCE_KEY]) {
            bucRefreshKnownSenders().catch(() => {});
        }
    });
})().catch(() => bucKnownSenderStatus("Could not load known senders. Refresh this page to try again.", true));
