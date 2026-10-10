// adapters/provider_router.js
// Routes the shared BeforeUClick analysis pipeline to the appropriate webmail DOM adapter.

const BUC_SUPPORTED_PROVIDERS = Object.freeze([
    {
        key: "gmail",
        name: "Gmail",
        hosts: ["mail.google.com"],
        status: "primary"
    },
    {
        key: "outlook",
        name: "Outlook",
        hosts: ["outlook.live.com", "outlook.office.com", "outlook.office365.com", "outlook.cloud.microsoft"],
        status: "supported"
    },
    {
        key: "yahoo",
        name: "Yahoo Mail",
        hosts: ["mail.yahoo.com"],
        status: "testing"
    }
]);

/** Detects the current supported provider from the page hostname. */
function bucDetectProvider() {
    const host = String(location.hostname || "").toLowerCase();
    return BUC_SUPPORTED_PROVIDERS.find(provider =>
        provider.hosts.some(value => host === value || host.endsWith(`.${value}`))
    ) || null;
}

/** Finds the currently opened message using the provider-specific selector strategy. */
function bucFindCurrentMessage() {
    const provider = bucDetectProvider();
    if (!provider) return null;

    let context = null;
    if (provider.key === "gmail") context = findCurrentGmailMessage();
    if (provider.key === "outlook") context = findCurrentOutlookMessage();
    if (provider.key === "yahoo") context = findCurrentYahooMessage();

    if (!context) return null;
    return {
        ...context,
        provider: provider.key,
        providerName: provider.name,
        providerStatus: provider.status
    };
}

/** Extracts visible current-message text using the provider adapter. */
function bucExtractCurrentMessageText(context) {
    if (!context) return "";
    if (context.provider === "gmail") return extractCurrentMessageText(context);
    if (context.provider === "outlook") return extractOutlookMessageText(context);
    if (context.provider === "yahoo") return extractYahooMessageText(context);
    return "";
}

/** Tries to reveal provider details where that provider exposes a safe local action. */
async function bucEnsureProviderDetailsVisible(context) {
    if (!context) return false;
    if (context.provider === "gmail") return ensureGmailDetailsVisible(context);
    if (context.provider === "outlook") return ensureOutlookDetailsVisible(context);
    if (context.provider === "yahoo") return ensureYahooDetailsVisible(context);
    return false;
}

/** Extracts provider-specific metadata into the shared BeforeUClick shape. */
function bucExtractProviderMetadata(context) {
    if (!context) return {};
    if (context.provider === "gmail") return extractGmailMetadata(context);
    if (context.provider === "outlook") return extractOutlookMetadata(context);
    if (context.provider === "yahoo") return extractYahooMetadata(context);
    return {};
}

/** Extracts provider-specific links while retaining shared exact-element mappings. */
function bucExtractProviderLinks(context) {
    if (!context) return [];
    if (context.provider === "gmail") return extractGmailLinks(context);
    if (context.provider === "outlook") return extractOutlookLinks(context);
    if (context.provider === "yahoo") return extractYahooLinks(context);
    return [];
}



/** Acquires the richest provider-specific Internet-header/authentication source available. */
async function bucAcquireProviderHeaders(context, metadata = {}) {
    if (!context) return { provider: "", status: "unavailable", source: "none", rawHeaders: "", limitations: ["No current message context."] };
    if (context.provider === "gmail") return acquireGmailHeaders(context, metadata);
    if (context.provider === "outlook") return acquireOutlookHeaders(context, metadata);
    if (context.provider === "yahoo") return acquireYahooHeaders(context, metadata);
    return { provider: context.provider || "", status: "unavailable", source: "none", rawHeaders: "", limitations: ["No header-acquisition adapter is available for this provider."] };
}

/** Returns a compact supported-provider label for UI/error messages. */
function bucSupportedProviderLabel() {
    return BUC_SUPPORTED_PROVIDERS.map(provider => provider.name).join(", ");
}
