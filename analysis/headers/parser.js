// analysis/headers/parser.js
// Shared RFC-style Internet-header parser for BeforeUClick v0.18.
// Provider adapters obtain header text; this module interprets it consistently.

/** Normalises line endings without changing the message content. */
function bucNormaliseHeaderSource(rawHeaders) {
    return String(rawHeaders || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
}

/**
 * Extracts only the RFC-style header block from a raw-message/source view.
 * Raw-message pages can include the entire email body. Stopping at the first header/body
 * separator prevents body text such as "From:" from being misinterpreted as metadata.
 */
function bucExtractRawHeaderBlock(rawHeaders) {
    const lines = bucNormaliseHeaderSource(rawHeaders).split("\n");
    const recognisedStart = /^(?:delivered-to|return-path|received|authentication-results|arc-authentication-results|arc-seal|arc-message-signature|dkim-signature|received-spf|from|to|cc|bcc|reply-to|subject|date|message-id|mime-version|content-type):/i;
    const genericHeader = /^[^:\s][^:]*:\s*/;

    let start = lines.findIndex(line => recognisedStart.test(line.trimStart()));
    if (start < 0) start = lines.findIndex(line => genericHeader.test(line));
    if (start < 0) return "";

    const block = [];
    let headerCount = 0;
    let started = false;

    for (let index = start; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) {
            if (started) break;
            continue;
        }
        if (/^[ \t]/.test(line) && started) {
            block.push(line);
            continue;
        }
        if (genericHeader.test(line)) {
            block.push(line);
            headerCount += 1;
            started = true;
            continue;
        }
        if (started) break;
    }

    return headerCount >= 2 ? block.join("\n").trim() : "";
}

/** Unfolds RFC header continuation lines while preserving top-to-bottom header order. */
function bucUnfoldHeaderLines(rawHeaders) {
    const headerBlock = bucExtractRawHeaderBlock(rawHeaders);
    if (!headerBlock) return [];
    return headerBlock
        .replace(/\n[ \t]+/g, " ")
        .split("\n")
        .map(line => line.trimEnd())
        .filter(Boolean);
}

/** Parses a raw header block into ordered fields and a case-insensitive multi-value map. */
function bucParseRawHeaders(rawHeaders) {
    // Never fall back to treating an entire raw-message page as headers. If a plausible
    // RFC-style header block cannot be isolated, return an empty parse rather than risk
    // interpreting body lines such as "From:" or "Authentication-Results:" as metadata.
    const headerBlock = bucExtractRawHeaderBlock(rawHeaders);
    const ordered = [];
    const fields = Object.create(null);

    for (const line of bucUnfoldHeaderLines(headerBlock)) {
        const match = line.match(/^([^:\s][^:]*):\s*(.*)$/);
        if (!match) continue;
        const name = match[1].trim();
        const key = name.toLowerCase();
        const value = match[2].trim();
        ordered.push({ name, key, value });
        if (!fields[key]) fields[key] = [];
        fields[key].push(value);
    }

    return { raw: headerBlock, ordered, fields };
}

function bucHeaderValues(parsed, name) {
    return parsed?.fields?.[String(name || "").toLowerCase()] || [];
}

function bucHeaderFirst(parsed, name) {
    return bucHeaderValues(parsed, name)[0] || "";
}

/** Extracts the first mailbox-looking address from a header value. */
function bucHeaderEmail(value) {
    if (typeof bucParseEmailAddress === "function") return bucParseEmailAddress(value);
    const match = String(value || "").match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
    return match ? match[1].toLowerCase() : "";
}

function bucHeaderDomain(value) {
    const email = bucHeaderEmail(value);
    if (email) return email.split("@")[1] || "";
    return typeof bucComparableDomain === "function" ? bucComparableDomain(value) : String(value || "").toLowerCase();
}

function bucCleanAuthToken(value) {
    return String(value || "")
        .trim()
        .replace(/^[<\[(]+|[>\]),]+$/g, "")
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase();
}

/** Returns selected key/value parameters from one Authentication-Results method clause. */
function bucParseAuthClauseParameters(text) {
    const result = {};
    const pattern = /\b(smtp\.mailfrom|smtp\.helo|header\.from|header\.d|header\.s|header\.i|policy\.dmarc|policy\.spf|reason)\s*=\s*("[^"]*"|'[^']*'|[^\s;]+)/gi;
    let match;
    while ((match = pattern.exec(String(text || "")))) {
        result[match[1].toLowerCase()] = bucCleanAuthToken(match[2]);
    }
    return result;
}

/**
 * Parses one Authentication-Results / ARC-Authentication-Results value.
 * The first semicolon-delimited item is the authserv-id; following clauses are methods.
 */
function bucParseAuthenticationResultsValue(value, headerName = "authentication-results") {
    const segments = String(value || "").split(";").map(part => part.trim()).filter(Boolean);
    const authservId = bucCleanAuthToken(segments.shift() || "");
    const methods = [];

    for (const segment of segments) {
        const methodMatch = segment.match(/^([a-z0-9_-]+)\s*=\s*([a-z0-9_-]+)/i);
        if (!methodMatch) continue;
        methods.push({
            method: methodMatch[1].toLowerCase(),
            result: methodMatch[2].toLowerCase(),
            parameters: bucParseAuthClauseParameters(segment),
            raw: segment
        });
    }

    return { headerName, authservId, methods, raw: String(value || "") };
}

/** Parses Received-SPF when Authentication-Results does not contain an SPF result. */
function bucParseReceivedSpf(value) {
    const text = String(value || "");
    const result = (text.match(/^\s*([a-z0-9_-]+)/i)?.[1] || "").toLowerCase();
    const envelopeFrom = bucCleanAuthToken(text.match(/(?:envelope-from|smtp\.mailfrom)\s*=\s*([^;\s]+)/i)?.[1] || "");
    const helo = bucCleanAuthToken(text.match(/(?:helo|smtp\.helo)\s*=\s*([^;\s]+)/i)?.[1] || "");
    const clientIp = bucCleanAuthToken(text.match(/client-ip\s*=\s*([^;\s]+)/i)?.[1] || "");
    return { result, envelopeFrom, helo, clientIp, raw: text };
}

/** Parses one DKIM-Signature into the fields useful for identity comparison. */
function bucParseDkimSignature(value) {
    const text = String(value || "");
    const param = name => bucCleanAuthToken(text.match(new RegExp(`(?:^|;)\\s*${name}=([^;\\s]+)`, "i"))?.[1] || "");
    return {
        signingDomain: param("d"),
        selector: param("s"),
        identity: param("i"),
        algorithm: param("a"),
        raw: text
    };
}

/** Determines whether an authserv-id plausibly belongs to the receiving webmail provider. */
function bucIsProviderAuthserv(provider, authservId) {
    // RFC-style authserv-id values can carry a trailing implementation/version token.
    // Outlook currently renders values such as "mx.microsoft.com 1". Preserve the raw value
    // elsewhere, but remove that numeric suffix for provider-ownership comparison.
    const id = bucCleanAuthToken(authservId)
        .replace(/\s+\d+(?:\.\d+)*$/, "")
        .replace(/:\d+$/, "");
    if (!id) return false;
    const matchesSuffix = suffix => id === suffix || id.endsWith(`.${suffix}`);
    if (provider === "gmail") return matchesSuffix("google.com") || matchesSuffix("gmail.com");
    if (provider === "outlook") {
        return matchesSuffix("outlook.com")
            || matchesSuffix("microsoft.com")
            || matchesSuffix("office365.com")
            || matchesSuffix("microsoft");
    }
    if (provider === "yahoo") return matchesSuffix("yahoo.com") || matchesSuffix("yahoodns.net");
    return false;
}

/** Produces a provider-neutral structured representation of raw Internet headers. */
function bucParseHeaderIntelligence(rawHeaders, provider = "") {
    const parsed = bucParseRawHeaders(rawHeaders);
    const authResults = bucHeaderValues(parsed, "authentication-results")
        .map(value => bucParseAuthenticationResultsValue(value, "authentication-results"));
    const arcResults = bucHeaderValues(parsed, "arc-authentication-results")
        .map(value => bucParseAuthenticationResultsValue(value, "arc-authentication-results"));

    authResults.forEach(result => {
        result.providerTrusted = bucIsProviderAuthserv(provider, result.authservId);
    });
    arcResults.forEach(result => {
        result.providerTrusted = bucIsProviderAuthserv(provider, result.authservId);
    });

    return {
        parsed,
        from: bucHeaderFirst(parsed, "from"),
        to: bucHeaderValues(parsed, "to"),
        cc: bucHeaderValues(parsed, "cc"),
        bcc: bucHeaderValues(parsed, "bcc"),
        replyTo: bucHeaderFirst(parsed, "reply-to"),
        returnPath: bucHeaderFirst(parsed, "return-path"),
        subject: bucHeaderFirst(parsed, "subject"),
        date: bucHeaderFirst(parsed, "date"),
        messageId: bucHeaderFirst(parsed, "message-id"),
        received: bucHeaderValues(parsed, "received"),
        authenticationResults: authResults,
        arcAuthenticationResults: arcResults,
        receivedSpf: bucHeaderValues(parsed, "received-spf").map(bucParseReceivedSpf),
        dkimSignatures: bucHeaderValues(parsed, "dkim-signature").map(bucParseDkimSignature)
    };
}


/** Returns true when text contains a plausible Internet-header block rather than ordinary email prose. */
function bucLooksLikeRawHeaderText(value) {
    const text = bucExtractRawHeaderBlock(value);
    if (text.length < 80) return false;

    const names = new Set([
        "from", "to", "date", "message-id", "authentication-results",
        "received", "dkim-signature", "return-path"
    ]);
    const present = new Set();
    for (const line of bucUnfoldHeaderLines(text)) {
        const match = line.match(/^([^:\s][^:]*):/);
        if (match) present.add(match[1].trim().toLowerCase());
    }

    const count = [...names].filter(name => present.has(name)).length;
    return count >= 3 && ["from", "received", "authentication-results", "message-id"].some(name => present.has(name));
}

/** Chooses the richest header block from a list of DOM nodes without retaining message-body text. */
function bucFindRawHeaderTextInNodes(nodes) {
    const candidates = [];
    for (const node of nodes || []) {
        const source = String(node?.value || node?.innerText || node?.textContent || "").trim();
        const text = bucExtractRawHeaderBlock(source);
        if (!bucLooksLikeRawHeaderText(text)) continue;
        const fieldCount = bucUnfoldHeaderLines(text).filter(line => /^[^:\s][^:]*:\s*/.test(line)).length;
        candidates.push({ text, fieldCount, length: text.length });
    }
    candidates.sort((a, b) => (b.fieldCount - a.fieldCount) || (b.length - a.length));
    return candidates[0]?.text || "";
}

