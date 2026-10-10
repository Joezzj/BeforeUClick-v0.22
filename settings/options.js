if (new URLSearchParams(location.search).get("embedded") === "1") document.body.classList.add("embedded");
// settings/options.js
// General settings only. Known senders and read-only reference data have their own workspace tabs.

const highlightModeEl = document.getElementById("highlightMode");
const clickGuardModeEl = document.getElementById("clickGuardMode");
const linkInfoModeEl = document.getElementById("linkInfoMode");
const fontSizeEl = document.getElementById("fontSize");
const densityEl = document.getElementById("density");
const highContrastEl = document.getElementById("highContrast");
const reducedMotionEl = document.getElementById("reducedMotion");
const inboxPreviewModeEl = document.getElementById("inboxPreviewMode");
const showManualTriggerEl = document.getElementById("showManualTrigger");
const panelSizeEl = document.getElementById("panelSize");
const panelPositionModeEl = document.getElementById("panelPositionMode");
const storageModeEl = document.getElementById("storageMode");
const validationModeEl = document.getElementById("validationMode");
const saveStatusEl = document.getElementById("saveStatus");
const clearRememberedDataEl = document.getElementById("clearRememberedData");

let bucSettingsQueue = Promise.resolve();
function bucQueueSettingsUpdate(task) {
    bucSettingsQueue = bucSettingsQueue.then(task).catch(() => {
        clearTimeout(bucShowSaved.timer);
        bucShowSaved("Could not save changes. Please try again.", true);
    });
    return bucSettingsQueue;
}

function bucShowSaved(message, persistent = false) {
    if (window.parent !== window) window.parent.postMessage({ type: "BUC_SETTINGS_STATUS", message, persistent }, location.origin);
    saveStatusEl.textContent = message;
    clearTimeout(bucShowSaved.timer);
    if (!persistent) bucShowSaved.timer = setTimeout(() => { saveStatusEl.textContent = ""; }, 2800);
}

async function bucNotifyStorageModeDisabled() {
    try {
        await chrome.runtime.sendMessage({ type: "BUC_CLEAR_LOCAL_ACTIVITY" });
    } catch (_error) {
        // The preference is still saved. Activity cleanup can be retried when the worker next starts.
    }
}

async function bucSaveBehaviourSettings() {
    const current = await bucGetPreferences();
    const wasStorageEnabled = current.storageMode === true;

    current.highlightMode = highlightModeEl.value;
    current.clickGuardMode = clickGuardModeEl.value;
    current.linkInfoMode = linkInfoModeEl.value;
    current.fontSize = fontSizeEl.value;
    current.density = densityEl.value;
    current.highContrast = highContrastEl.checked;
    current.reducedMotion = reducedMotionEl.checked;
    current.inboxPreviewMode = inboxPreviewModeEl.value;
    current.showManualTrigger = showManualTriggerEl.checked;
    current.panelSize = panelSizeEl.value;
    current.panelPositionMode = panelPositionModeEl.value;
    current.storageMode = storageModeEl.checked;
    current.validationMode = validationModeEl.checked;

    if (!current.storageMode) current.knownSenders = [];

    const saved = await bucSavePreferences(current);
    if (wasStorageEnabled && !saved.storageMode) await bucNotifyStorageModeDisabled();

    bucApplyExtensionPagePreferences(saved);
    bucShowSaved(saved.storageMode
        ? "Settings saved. Remembered email information is enabled on this device."
        : "Settings saved. BeforeUClick will not retain email-check history or known senders.");
}

clearRememberedDataEl?.addEventListener("click", () => bucQueueSettingsUpdate(async () => {
    clearRememberedDataEl.disabled = true;
    try {
        const response = await chrome.runtime.sendMessage({ type: "BUC_CLEAR_REMEMBERED_EMAIL_DATA" });
        if (!response?.ok) throw new Error("Clear failed");
        bucShowSaved("Remembered email data cleared. Your app preferences were kept.");
    } finally {
        clearRememberedDataEl.disabled = false;
    }
}));

for (const element of [
    highlightModeEl,
    clickGuardModeEl,
    linkInfoModeEl,
    fontSizeEl,
    densityEl,
    highContrastEl,
    reducedMotionEl,
    inboxPreviewModeEl,
    showManualTriggerEl,
    panelSizeEl,
    panelPositionModeEl,
    storageModeEl,
    validationModeEl
]) {
    element.addEventListener("change", () => bucQueueSettingsUpdate(bucSaveBehaviourSettings));
}

(async function initialiseOptions() {
    const preferences = await bucGetPreferences();
    highlightModeEl.value = preferences.highlightMode;
    clickGuardModeEl.value = preferences.clickGuardMode;
    linkInfoModeEl.value = preferences.linkInfoMode;
    fontSizeEl.value = preferences.fontSize;
    densityEl.value = preferences.density;
    highContrastEl.checked = preferences.highContrast;
    reducedMotionEl.checked = preferences.reducedMotion;
    inboxPreviewModeEl.value = preferences.inboxPreviewMode;
    showManualTriggerEl.checked = preferences.showManualTrigger;
    panelSizeEl.value = preferences.panelSize;
    panelPositionModeEl.value = preferences.panelPositionMode;
    storageModeEl.checked = preferences.storageMode;
    validationModeEl.checked = preferences.validationMode;
    bucApplyExtensionPagePreferences(preferences);
})().catch(() => { bucShowSaved("Could not load settings. Refresh this page to try again.", true); });
