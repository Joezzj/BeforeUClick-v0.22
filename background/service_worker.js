// background/service_worker.js
// Optional local activity memory for BeforeUClick.
// Email-related persistence is OFF by default. When remembered email information is enabled,
// this worker stores only daily opaque message fingerprints + latest verdict state
// so the same email is not counted more than once. No email content, sender, URL,
// subject, raw message ID or analysis report is stored here.

const BUC_STATS_KEY = "beforeUClickDailyStats";
const BUC_PREFERENCE_KEY = "beforeUClickPreferences";
const BUC_BADGE_COLOR = "#1565C0";
const BUC_CONCERN_STATES = new Set(["review", "caution", "high"]);
const BUC_ALLOWED_STATES = new Set(["no-concerns", "unknown", "review", "caution", "high"]);

/** Returns a local-calendar date key rather than a UTC date. */
function bucTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/** Reads only the opt-in bit needed by the worker. */
async function bucStorageModeEnabled() {
    const data = await chrome.storage.local.get([BUC_PREFERENCE_KEY]);
    return data?.[BUC_PREFERENCE_KEY]?.storageMode === true;
}

/**
 * Produces a deterministic opaque fingerprint for a provider/message key.
 * This is deliberately one-way enough for the local dedupe use-case and prevents
 * raw provider IDs or body-derived fallback keys from being written to storage.
 */
async function bucOpaqueMessageFingerprint(value) {
    const text = String(value || "");
    if (!text) return "";
    const encoded = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function bucStatsFromSeen(seen = {}) {
    const values = Object.values(seen);
    return {
        date: bucTodayKey(),
        scanned: values.length,
        concern: values.filter(state => BUC_CONCERN_STATES.has(state)).length,
        high: values.filter(state => state === "high").length,
        seen
    };
}

function bucPublicStats(stats, extra = {}) {
    return {
        enabled: true,
        date: stats.date,
        scanned: Number(stats.scanned) || 0,
        concern: Number(stats.concern) || 0,
        high: Number(stats.high) || 0,
        ...extra
    };
}

/** Loads today's unique-message counters. Old/legacy counter formats start fresh. */
async function bucGetDailyStats() {
    if (!(await bucStorageModeEnabled())) {
        await chrome.storage.local.remove?.([BUC_STATS_KEY]);
        return { enabled: false, date: bucTodayKey(), scanned: 0, concern: 0, high: 0, seen: {} };
    }

    const data = await chrome.storage.local.get([BUC_STATS_KEY]);
    const stored = data[BUC_STATS_KEY];

    if (!stored || stored.date !== bucTodayKey() || !stored.seen || typeof stored.seen !== "object" || Array.isArray(stored.seen)) {
        const fresh = bucStatsFromSeen({});
        await chrome.storage.local.set({ [BUC_STATS_KEY]: fresh });
        return { enabled: true, ...fresh };
    }

    const seen = {};
    for (const [fingerprint, state] of Object.entries(stored.seen)) {
        if (/^[0-9a-f]{64}$/i.test(fingerprint) && BUC_ALLOWED_STATES.has(state)) seen[fingerprint] = state;
    }
    const normalised = bucStatsFromSeen(seen);
    return { enabled: true, ...normalised };
}

/** Resets only today's optional activity memory. */
async function bucResetDailyStats() {
    if (!(await bucStorageModeEnabled())) {
        await chrome.storage.local.remove?.([BUC_STATS_KEY]);
        await bucUpdateToolbarBadge({ enabled: false, concern: 0 });
        return { enabled: false, date: bucTodayKey(), scanned: 0, concern: 0, high: 0 };
    }
    const fresh = bucStatsFromSeen({});
    await chrome.storage.local.set({ [BUC_STATS_KEY]: fresh });
    await bucUpdateToolbarBadge({ enabled: true, ...fresh });
    return bucPublicStats(fresh);
}

/** Removes all optional email-related activity memory and clears the toolbar badge. */
async function bucClearLocalActivity() {
    await chrome.storage.local.remove?.([BUC_STATS_KEY]);
    await bucUpdateToolbarBadge({ enabled: false, concern: 0 });
    return { enabled: false, date: bucTodayKey(), scanned: 0, concern: 0, high: 0 };
}


/** Removes all optional remembered email information while keeping app preferences. */
async function bucClearRememberedEmailData() {
    const data = await chrome.storage.local.get([BUC_PREFERENCE_KEY]);
    const storedPreferences = data?.[BUC_PREFERENCE_KEY];
    const enabled = storedPreferences?.storageMode === true;

    await chrome.storage.local.remove?.([BUC_STATS_KEY]);
    if (storedPreferences && Array.isArray(storedPreferences.knownSenders) && storedPreferences.knownSenders.length) {
        await chrome.storage.local.set({
            [BUC_PREFERENCE_KEY]: { ...storedPreferences, knownSenders: [] }
        });
    }
    await bucUpdateToolbarBadge({ enabled, concern: 0 });
    return { enabled, date: bucTodayKey(), scanned: 0, concern: 0, high: 0 };
}

/** Reflects today's unique Review/Caution/High count in the toolbar badge. */
async function bucUpdateToolbarBadge(stats) {
    const count = stats?.enabled === false ? 0 : (Number(stats?.concern) || 0);
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    if (count > 0) await chrome.action.setBadgeBackgroundColor({ color: BUC_BADGE_COLOR });
}

/**
 * Records the latest verdict for one unique message. Re-checking the same message
 * updates its stored state instead of increasing the checked count.
 */
async function bucRecordScan(verdictKey, messageKey) {
    const stats = await bucGetDailyStats();
    if (!stats.enabled) return { enabled: false, date: bucTodayKey(), scanned: 0, concern: 0, high: 0, recorded: false };

    const fingerprint = await bucOpaqueMessageFingerprint(messageKey);
    if (!fingerprint) return { ...bucPublicStats(stats), recorded: false, reason: "missing-message-key" };

    const state = BUC_ALLOWED_STATES.has(verdictKey) ? verdictKey : "unknown";
    const previous = stats.seen[fingerprint];
    stats.seen[fingerprint] = state;
    const next = bucStatsFromSeen(stats.seen);
    await chrome.storage.local.set({ [BUC_STATS_KEY]: next });
    await bucUpdateToolbarBadge({ enabled: true, ...next });
    return bucPublicStats(next, { recorded: true, duplicate: Boolean(previous), previousState: previous || null });
}

/** Scrubs optional email-related data whenever storage mode is not enabled. */
async function bucEnforceStoragePrivacy() {
    const data = await chrome.storage.local.get([BUC_PREFERENCE_KEY]);
    const storedPreferences = data?.[BUC_PREFERENCE_KEY];
    if (storedPreferences?.storageMode === true) return;

    await chrome.storage.local.remove?.([BUC_STATS_KEY]);
    if (storedPreferences && Array.isArray(storedPreferences.knownSenders) && storedPreferences.knownSenders.length) {
        await chrome.storage.local.set({
            [BUC_PREFERENCE_KEY]: { ...storedPreferences, knownSenders: [] }
        });
    }
    await bucUpdateToolbarBadge({ enabled: false, concern: 0 });
}

let bucStatsQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "BUC_RECORD_SCAN") {
        bucStatsQueue = bucStatsQueue.catch(() => {}).then(() => bucRecordScan(message.verdictKey, message.messageKey));
        bucStatsQueue
            .then(stats => sendResponse({ ok: true, stats }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type === "BUC_RESET_STATS") {
        bucStatsQueue = bucStatsQueue.catch(() => {}).then(() => bucResetDailyStats());
        bucStatsQueue
            .then(stats => sendResponse({ ok: true, stats }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type === "BUC_CLEAR_LOCAL_ACTIVITY") {
        bucStatsQueue = bucStatsQueue.catch(() => {}).then(() => bucClearLocalActivity());
        bucStatsQueue
            .then(stats => sendResponse({ ok: true, stats }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }


    if (message?.type === "BUC_CLEAR_REMEMBERED_EMAIL_DATA") {
        bucStatsQueue = bucStatsQueue.catch(() => {}).then(() => bucClearRememberedEmailData());
        bucStatsQueue
            .then(stats => sendResponse({ ok: true, stats }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type === "BUC_OPEN_WORKSPACE") {
        const allowed = new Set(["settings", "senders", "reference"]);
        const view = allowed.has(message.view) ? message.view : "settings";
        const sourceTab = _sender?.tab?.id;
        const source = Number.isInteger(sourceTab) ? `sourceTab=${sourceTab}&` : "";
        const url = chrome.runtime.getURL(`report/report.html?${source}view=${encodeURIComponent(view)}`);
        chrome.tabs.create({ url })
            .then(tab => sendResponse({ ok: true, tabId: tab.id }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type === "BUC_OPEN_FULL_REPORT") {
        const sourceTab = _sender?.tab?.id;
        if (!Number.isInteger(sourceTab)) {
            sendResponse({ ok: false, error: "Source webmail tab unavailable." });
            return false;
        }

        const focus = message.focusLinkId ? `&focusLink=${encodeURIComponent(message.focusLinkId)}` : "";
        const url = chrome.runtime.getURL(`report/report.html?sourceTab=${sourceTab}${focus}`);
        chrome.tabs.create({ url })
            .then(tab => sendResponse({ ok: true, tabId: tab.id }))
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type === "BUC_GET_STATS") {
        bucGetDailyStats()
            .then(async stats => {
                try { await bucUpdateToolbarBadge(stats); } catch (_error) {}
                sendResponse({ ok: true, stats: stats.enabled ? bucPublicStats(stats) : stats });
            })
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    return false;
});

chrome.runtime.onInstalled.addListener(() => {
    bucEnforceStoragePrivacy().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
    bucEnforceStoragePrivacy().catch(() => {});
});

// Both toolbar and in-email entry points use the same panel.
chrome.action.onClicked.addListener(async tab => {
    if (!Number.isInteger(tab?.id)) return;

    try {
        const stats = await bucGetDailyStats();
        await bucUpdateToolbarBadge(stats);
    } catch (_error) {}

    try {
        await chrome.tabs.sendMessage(tab.id, { type: "BUC_OPEN_PANEL" });
    } catch (_error) {
        await chrome.tabs.create({ url: chrome.runtime.getURL("report/report.html?notice=unavailable") });
    }
});
