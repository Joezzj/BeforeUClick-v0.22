// adapters/gmail/headers.js
// Gmail-specific header acquisition for BeforeUClick v0.18.
// Interpretation remains shared in analysis/headers/*.

function bucGmailRawHeaderTextFromPage() {
    const nodes = Array.from(document.querySelectorAll([
        "pre",
        "textarea",
        "[role='dialog'] pre",
        "[role='dialog'] textarea",
        "[role='dialog'] [contenteditable='false']"
    ].join(", ")));

    // Gmail's Show original view can be a dedicated mail.google.com page.
    if (/([?&]view=om(?:&|$)|\/original(?:\/|$))/i.test(location.href)) {
        nodes.push(document.body);
    }
    return bucFindRawHeaderTextInNodes(nodes);
}

/**
 * Gmail normally exposes mailed-by/signed-by in its expanded details UI. Full raw headers are
 * parsed when Show original is already available in the current rendered page/tab.
 */
async function acquireGmailHeaders(_context, metadata = {}) {
    const rawHeaders = bucGmailRawHeaderTextFromPage();
    if (rawHeaders) {
        return {
            provider: "gmail",
            status: "full",
            source: "gmail-show-original",
            rawHeaders,
            limitations: []
        };
    }

    const hasSummary = Boolean(metadata.replyTo || metadata.mailedBy || metadata.signedBy);
    return {
        provider: "gmail",
        status: hasSummary ? "partial" : "unavailable",
        source: hasSummary ? "gmail-expanded-details" : "gmail-visible-message",
        rawHeaders: "",
        limitations: hasSummary
            ? ["Gmail authentication summary is available, but full Show original headers were not captured in this check."]
            : ["Full Gmail Show original headers were not exposed to the current page during this check."]
    };
}
