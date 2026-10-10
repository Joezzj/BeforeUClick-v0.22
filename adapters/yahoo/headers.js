// adapters/yahoo/headers.js
// Yahoo Mail header acquisition for BeforeUClick v0.18.
// Yahoo View Raw Message often opens a separate page/tab, so v0.18 parses it when exposed in the
// current document and otherwise keeps the visible-message result without silently opening a new tab.

function bucYahooRawHeaderTextFromPage() {
    const nodes = Array.from(document.querySelectorAll([
        "pre",
        "textarea",
        "[role='dialog'] pre",
        "[role='dialog'] textarea",
        "[data-test-id*='raw' i]",
        "[aria-label*='raw message' i]"
    ].join(", ")));

    // Dedicated raw-message pages can expose the entire message as body/pre text.
    if (/raw|source/i.test(location.href)) nodes.push(document.body);
    return bucFindRawHeaderTextInNodes(nodes);
}

async function acquireYahooHeaders(_context, metadata = {}) {
    const rawHeaders = bucYahooRawHeaderTextFromPage();
    if (rawHeaders) {
        return {
            provider: "yahoo",
            status: "full",
            source: "yahoo-view-raw-message",
            rawHeaders,
            limitations: []
        };
    }

    const hasSummary = Boolean(metadata.replyTo || metadata.mailedBy || metadata.signedBy);
    return {
        provider: "yahoo",
        status: hasSummary ? "partial" : "unavailable",
        source: hasSummary ? "yahoo-visible-summary" : "yahoo-visible-message",
        rawHeaders: "",
        limitations: ["Yahoo View Raw Message was not exposed in the current page. v0.18 does not silently open a separate raw-message tab."]
    };
}
