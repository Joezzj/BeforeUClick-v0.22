// analysis/headers/authentication.js
// Normalises raw/header-summary information into one shared authentication model.

function bucAuthMethodEntries(parsedHeaders, method) {
    const all = [];
    for (const result of parsedHeaders?.authenticationResults || []) {
        for (const item of result.methods || []) {
            if (item.method === method) all.push({ ...item, authservId: result.authservId, providerTrusted: result.providerTrusted });
        }
    }
    return all;
}

function bucPreferTrustedAuthEntry(entries) {
    return (entries || []).find(item => item.providerTrusted) || (entries || [])[0] || null;
}

function bucAuthExactDomain(value) {
    let token = bucCleanAuthToken(value);
    if (!token) return "";

    const email = bucHeaderEmail(token);
    if (email) token = email.split("@").pop() || "";
    else if (token.includes("@")) token = token.slice(token.lastIndexOf("@") + 1);
    token = token.replace(/^@/, "");

    return typeof bucNormaliseHostname === "function"
        ? bucNormaliseHostname(token)
        : token.toLowerCase();
}

function bucAuthDomainFromEntry(entry, method) {
    if (!entry) return "";
    const p = entry.parameters || {};
    let value = "";
    if (method === "spf") value = p["smtp.mailfrom"] || p["header.from"] || p["smtp.helo"] || "";
    if (method === "dkim") value = p["header.d"] || p["header.i"] || "";
    if (method === "dmarc") value = p["header.from"] || "";
    return bucAuthExactDomain(value);
}

/**
 * Builds the provider-neutral authentication model from provider acquisition + visible metadata.
 * Visible provider summaries (for example Gmail mailed-by/signed-by) are retained as partial context,
 * while raw header Authentication-Results can support stronger evidence.
 */
function bucBuildAuthenticationModel(acquisition, metadata = {}, provider = "") {
    const rawHeaders = acquisition?.rawHeaders || "";
    const parsedHeaders = rawHeaders ? bucParseHeaderIntelligence(rawHeaders, provider) : null;
    const spfEntry = bucPreferTrustedAuthEntry(bucAuthMethodEntries(parsedHeaders, "spf"));
    const dkimEntries = bucAuthMethodEntries(parsedHeaders, "dkim");
    const dmarcEntry = bucPreferTrustedAuthEntry(bucAuthMethodEntries(parsedHeaders, "dmarc"));
    const arcEntry = bucPreferTrustedAuthEntry([
        ...bucAuthMethodEntries(parsedHeaders, "arc"),
        ...(parsedHeaders?.arcAuthenticationResults || []).flatMap(result => (result.methods || []).map(item => ({ ...item, authservId: result.authservId, providerTrusted: result.providerTrusted })))
    ]);

    const fallbackSpf = parsedHeaders?.receivedSpf?.[0] || null;
    const rawDkimSignatures = parsedHeaders?.dkimSignatures || [];
    const fromAddress = bucHeaderEmail(parsedHeaders?.from || metadata.sender || "") || metadata.sender || "";

    const dkim = dkimEntries.length
        ? dkimEntries.map(entry => ({
            result: entry.result || "unknown",
            signingDomain: bucAuthDomainFromEntry(entry, "dkim"),
            selector: entry.parameters?.["header.s"] || "",
            identity: entry.parameters?.["header.i"] || "",
            authservId: entry.authservId || "",
            providerTrusted: Boolean(entry.providerTrusted),
            source: "authentication-results"
        }))
        : rawDkimSignatures.map(signature => ({
            result: "present",
            signingDomain: signature.signingDomain || metadata.signedBy || "",
            selector: signature.selector || "",
            identity: signature.identity || "",
            authservId: "",
            providerTrusted: false,
            source: "dkim-signature"
        }));

    if (!dkim.length && metadata.signedBy) {
        dkim.push({ result: "summary", signingDomain: metadata.signedBy, selector: "", identity: "", providerTrusted: false, source: "provider-summary" });
    }

    const model = {
        provider,
        acquisitionStatus: acquisition?.status || "unavailable",
        source: acquisition?.source || "none",
        rawHeaders,
        rawHeaderCount: parsedHeaders?.ordered?.length || 0,
        fromAddress,
        headerFrom: parsedHeaders?.from || metadata.sender || "",
        replyTo: parsedHeaders?.replyTo || metadata.replyTo || "",
        returnPath: parsedHeaders?.returnPath || "",
        messageId: parsedHeaders?.messageId || "",
        subject: parsedHeaders?.subject || metadata.subject || "",
        date: parsedHeaders?.date || metadata.date || "",
        received: parsedHeaders?.received || [],
        spf: {
            result: spfEntry?.result || fallbackSpf?.result || (metadata.mailedBy ? "summary" : "unavailable"),
            domain: bucAuthDomainFromEntry(spfEntry, "spf") || bucAuthExactDomain(fallbackSpf?.envelopeFrom || "") || bucAuthExactDomain(metadata.mailedBy || "") || metadata.mailedBy || "",
            authservId: spfEntry?.authservId || "",
            providerTrusted: Boolean(spfEntry?.providerTrusted),
            source: spfEntry ? "authentication-results" : (fallbackSpf ? "received-spf" : (metadata.mailedBy ? "provider-summary" : "none"))
        },
        dkim,
        dmarc: {
            result: dmarcEntry?.result || "unavailable",
            domain: bucAuthDomainFromEntry(dmarcEntry, "dmarc"),
            policy: dmarcEntry?.parameters?.["policy.dmarc"] || "",
            authservId: dmarcEntry?.authservId || "",
            providerTrusted: Boolean(dmarcEntry?.providerTrusted),
            source: dmarcEntry ? "authentication-results" : "none"
        },
        arc: {
            result: arcEntry?.result || (parsedHeaders?.arcAuthenticationResults?.length ? "present" : "unavailable"),
            authservId: arcEntry?.authservId || "",
            providerTrusted: Boolean(arcEntry?.providerTrusted),
            source: arcEntry ? "authentication-results" : (parsedHeaders?.arcAuthenticationResults?.length ? "arc-authentication-results" : "none")
        },
        limitations: [...(acquisition?.limitations || [])],
        parsedHeaders
    };

    model.alignment = bucBuildHeaderAlignment(model);
    return model;
}


/**
 * Chooses the most identity-relevant DKIM domain for the compact metadata "signed-by" field.
 * Messages can carry several valid DKIM signatures (for example tenant/infrastructure plus an
 * aligned first-party signature). Prefer a provider-trusted passing signature that aligns with
 * the visible From domain instead of whichever Authentication-Results clause happened to appear first.
 */
function bucPreferredMetadataSignedBy(authentication) {
    const items = (authentication?.dkim || []).filter(item => item?.signingDomain);
    if (!items.length) return "";

    const fromDomain = authentication?.alignment?.fromDomain || bucHeaderComparableDomain(authentication?.fromAddress || authentication?.headerFrom || "");
    const aligned = item => Boolean(fromDomain && bucHeaderDomainsAligned(fromDomain, item.signingDomain));
    const passing = item => item.result === "pass";

    return (
        items.find(item => item.providerTrusted && passing(item) && aligned(item)) ||
        items.find(item => passing(item) && aligned(item)) ||
        items.find(item => item.providerTrusted && passing(item)) ||
        items.find(passing) ||
        items.find(item => item.providerTrusted) ||
        items[0]
    )?.signingDomain || "";
}

/** Fills visible metadata blanks from raw headers without overriding provider-visible values. */
function bucMergeMetadataFromAuthentication(metadata, authentication) {
    const result = {
        ...(metadata || {}),
        recipients: {
            to: [...(metadata?.recipients?.to || [])],
            cc: [...(metadata?.recipients?.cc || [])],
            bcc: [...(metadata?.recipients?.bcc || [])]
        },
        unavailable: [...(metadata?.unavailable || [])]
    };

    const parsed = authentication?.parsedHeaders;
    const fill = (key, value) => {
        if (!result[key] && value) result[key] = value;
    };

    fill("sender", authentication?.fromAddress);
    fill("replyTo", bucHeaderEmail(authentication?.replyTo) || authentication?.replyTo);
    fill("mailedBy", authentication?.spf?.domain);
    fill("signedBy", bucPreferredMetadataSignedBy(authentication));
    fill("subject", authentication?.subject);
    fill("date", authentication?.date);

    if (parsed) {
        const collectAddresses = values => [...new Set((values || []).flatMap(value => {
            const matches = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
            return matches.map(item => item.toLowerCase());
        }))];
        if (!result.recipients.to.length) result.recipients.to = collectAddresses(parsed.to);
        if (!result.recipients.cc.length) result.recipients.cc = collectAddresses(parsed.cc);
        if (!result.recipients.bcc.length) result.recipients.bcc = collectAddresses(parsed.bcc);
    }

    const availableKeys = ["sender", "replyTo", "mailedBy", "signedBy", "subject", "date"]
        .filter(key => Boolean(result[key]));
    result.unavailable = result.unavailable.filter(item => !availableKeys.includes(item));
    return result;
}
