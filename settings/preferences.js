// settings/preferences.js
// Shared local preferences.
// General UI/behaviour preferences are stored locally so the user's choices persist.
// App preferences are stored locally so the interface can remember the user's choices.
// Email-derived/user-entered information (known senders and unique daily activity) is
// a separate opt-in capability and is not retained unless the user explicitly enables it.

const BUC_PREFERENCE_KEY = "beforeUClickPreferences";

const BUC_DEFAULT_PREFERENCES = Object.freeze({
    highlightMode: "concerns",
    clickGuardMode: "strong-only",
    linkInfoMode: "hover-focus",
    fontSize: "normal",
    density: "comfortable",
    highContrast: true,
    reducedMotion: false,
    inboxPreviewMode: "off",
    showManualTrigger: true,
    panelSize: "standard",
    panelPositionMode: "movable",
    storageMode: false,
    validationMode: false,
    knownSenders: []
});

function bucNormaliseKnownSender(value) {
    return String(value || "").trim().toLowerCase();
}

/** Returns a validated preference object merged with current defaults. */
function bucNormalisePreferences(value) {
    const source = value && typeof value === "object" ? value : {};
    const allowedHighlightModes = new Set(["concerns", "all", "off"]);
    const allowedClickGuardModes = new Set(["strong-only", "high-only", "caution-high", "off"]);
    const allowedLinkInfoModes = new Set(["hover-focus", "off"]);
    const allowedFontSizes = new Set(["normal", "large", "xlarge", "xxlarge"]);
    const allowedDensity = new Set(["comfortable", "compact"]);
    const allowedInboxPreviewModes = new Set(["off", "concerns"]);
    const allowedPanelSizes = new Set(["compact", "standard", "large", "xlarge"]);
    const allowedPanelPositions = new Set(["movable", "fixed"]);

    return {
        highlightMode: allowedHighlightModes.has(source.highlightMode) ? source.highlightMode : BUC_DEFAULT_PREFERENCES.highlightMode,
        clickGuardMode: allowedClickGuardModes.has(source.clickGuardMode) ? source.clickGuardMode : BUC_DEFAULT_PREFERENCES.clickGuardMode,
        linkInfoMode: allowedLinkInfoModes.has(source.linkInfoMode) ? source.linkInfoMode : BUC_DEFAULT_PREFERENCES.linkInfoMode,
        fontSize: allowedFontSizes.has(source.fontSize) ? source.fontSize : BUC_DEFAULT_PREFERENCES.fontSize,
        density: allowedDensity.has(source.density) ? source.density : BUC_DEFAULT_PREFERENCES.density,
        highContrast: typeof source.highContrast === "boolean" ? source.highContrast : BUC_DEFAULT_PREFERENCES.highContrast,
        reducedMotion: source.reducedMotion === true,
        inboxPreviewMode: allowedInboxPreviewModes.has(source.inboxPreviewMode) ? source.inboxPreviewMode : BUC_DEFAULT_PREFERENCES.inboxPreviewMode,
        showManualTrigger: typeof source.showManualTrigger === "boolean" ? source.showManualTrigger : BUC_DEFAULT_PREFERENCES.showManualTrigger,
        panelSize: allowedPanelSizes.has(source.panelSize) ? source.panelSize : BUC_DEFAULT_PREFERENCES.panelSize,
        panelPositionMode: allowedPanelPositions.has(source.panelPositionMode) ? source.panelPositionMode : BUC_DEFAULT_PREFERENCES.panelPositionMode,
        storageMode: source.storageMode === true,
        validationMode: source.validationMode === true,
        knownSenders: [...new Set(
            (Array.isArray(source.knownSenders) ? source.knownSenders : [])
                .map(bucNormaliseKnownSender)
                .filter(Boolean)
        )]
    };
}

async function bucGetPreferences() {
    const data = await chrome.storage.local.get([BUC_PREFERENCE_KEY]);
    return bucNormalisePreferences(data[BUC_PREFERENCE_KEY]);
}

async function bucSavePreferences(preferences) {
    const normalised = bucNormalisePreferences(preferences);
    await chrome.storage.local.set({ [BUC_PREFERENCE_KEY]: normalised });
    return normalised;
}

async function bucAddKnownSender(email) {
    const address = bucNormaliseKnownSender(email);
    const current = await bucGetPreferences();
    if (!current.storageMode || !address) return current;
    if (!current.knownSenders.includes(address)) current.knownSenders.push(address);
    return bucSavePreferences(current);
}

async function bucRemoveKnownSender(email) {
    const address = bucNormaliseKnownSender(email);
    const current = await bucGetPreferences();
    if (!current.storageMode) return current;
    current.knownSenders = current.knownSenders.filter(item => item !== address);
    return bucSavePreferences(current);
}

function bucIsKnownSender(email, preferences) {
    if (preferences?.storageMode !== true) return false;
    const address = bucNormaliseKnownSender(email);
    return Boolean(address && preferences?.knownSenders?.includes(address));
}

/** Applies extension-page-only accessibility preferences without touching the host webmail page. */
function bucApplyExtensionPagePreferences(preferences) {
    if (!document?.body) return;
    const prefs = bucNormalisePreferences(preferences);
    document.body.dataset.fontSize = prefs.fontSize;
    document.body.dataset.density = prefs.density;
    document.body.dataset.highContrast = prefs.highContrast ? "true" : "false";
    document.body.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
}
