// content.js
// Coordinates extraction, header/authentication intelligence, analysis, scoring and the explicit manual-check session for the current MVP.
// No email content or analysis result is transmitted or stored. Optional remembered-email features may retain only known-sender addresses and opaque daily message fingerprints for unique counters.

let bucLastReport = null;
let bucLastMessageKey = "";
let bucCheckEngaged = false;
let bucCheckPromise = null;
let bucSessionRevision = 0;
let bucManualTriggerEnabled = BUC_DEFAULT_PREFERENCES.showManualTrigger !== false;

// One-message, tab-memory-only header cache. This exists only to make "Check again" fast;
// it is never written to chrome.storage and is overwritten naturally when another message is checked.
let bucSessionHeaderCache = null;

function bucGetCachedProviderHeaders(providerKey, messageKey) {
    if (!messageKey || !bucSessionHeaderCache) return null;
    if (bucSessionHeaderCache.providerKey !== providerKey || bucSessionHeaderCache.messageKey !== messageKey) return null;
    const acquisition = bucSessionHeaderCache.acquisition;
    if (!acquisition?.rawHeaders || acquisition.status !== "full") return null;
    return {
        ...acquisition,
        diagnostics: [...new Set([...(acquisition.diagnostics || []), "session-header-cache-hit"])],
        cacheHit: true,
        durationMs: 0
    };
}

function bucRememberProviderHeaders(providerKey, messageKey, acquisition) {
    if (!messageKey || !acquisition?.rawHeaders || acquisition.status !== "full") return;
    bucSessionHeaderCache = {
        providerKey,
        messageKey,
        acquisition: {
            ...acquisition,
            diagnostics: [...(acquisition.diagnostics || [])],
            cacheHit: false
        }
    };
}

// -----------------------------------------------------------------------------
// Session-only provider validation runner (v0.22.12)
// -----------------------------------------------------------------------------
// These records never use chrome.storage. They live only in this content-script
// instance and disappear when the webmail tab is refreshed or closed. Export is
// explicitly user initiated.
let bucValidationSessionStartedAt = new Date().toISOString();
let bucValidationSequence = 0;
let bucValidationSession = [];

function bucValidationLinkCountBucket(count) {
    const value = Number(count) || 0;
    if (value === 0) return "0";
    if (value <= 5) return "1-5";
    if (value <= 15) return "6-15";
    if (value <= 40) return "16-40";
    return "41+";
}

function bucValidationCollapseEvidence(items = []) {
    const byCode = new Map();
    for (const item of items || []) {
        const code = String(item?.code || item?.evidenceClass || "evidence");
        const points = Number(item?.points) || 0;
        const existing = byCode.get(code) || {
            code,
            count: 0,
            maxPoints: points,
            strength: String(item?.strength || "context")
        };
        existing.count += Number(item?.affectedCount) || 1;
        existing.maxPoints = Math.max(existing.maxPoints, points);
        if (["critical","strong","medium","weak"].indexOf(String(item?.strength)) <
            ["critical","strong","medium","weak"].indexOf(existing.strength)) {
            existing.strength = String(item?.strength || existing.strength);
        }
        byCode.set(code, existing);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function bucValidationComponentStates(report) {
    const output = {};
    for (const [key, value] of Object.entries(report?.evaluation?.components || {})) {
        if (value?.assessment?.key) output[key] = value.assessment.key;
    }
    return output;
}

function bucValidationPatternSignature(report) {
    const concerning = bucValidationCollapseEvidence(report?.scoring?.concerningEvidence || []).map(item => item.code);
    const reassurance = bucValidationCollapseEvidence(report?.scoring?.reassuringEvidence || []).map(item => item.code);
    const wording = [...new Set((report?.wordingMatches || []).map(item => item?.id).filter(Boolean))].sort();
    const components = bucValidationComponentStates(report);
    const signature = {
        provider: report?.providerKey || "unknown",
        header: report?.headerAcquisition?.status || "unavailable",
        linkBucket: bucValidationLinkCountBucket(report?.links?.length || 0),
        components,
        concerning,
        reassurance,
        wording
    };
    return JSON.stringify(signature);
}

function bucValidationSafeDomains(report) {
    const domains = [];
    const push = value => {
        const domain = String(value || "").trim().toLowerCase();
        if (domain && !domains.includes(domain)) domains.push(domain);
    };
    try { push(bucEmailDomain(report?.metadata?.sender || "")); } catch (_error) {}
    push(report?.metadata?.mailedBy);
    push(report?.metadata?.signedBy);
    for (const link of report?.links || []) {
        push(link?.domain?.registrableDomain || link?.domain?.hostname);
        if (domains.length >= 14) break;
    }
    return domains.slice(0, 14);
}

function bucValidationBuildRecord(report, category = "unclassified") {
    const overall = report?.evaluation?.overall || report?.level || {};
    const components = bucValidationComponentStates(report);
    const patternSignature = bucValidationPatternSignature(report);
    const similarRecords = bucValidationSession
        .filter(item => item.patternSignature === patternSignature && item.messageKey !== report?.messageKey)
        .map(item => item.number);

    return {
        number: 0,
        recordedAt: new Date().toISOString(),
        category: String(category || "unclassified"),
        provider: report?.provider || "Webmail",
        providerKey: report?.providerKey || "unknown",
        providerStatus: report?.providerStatus || "unknown",
        overall: {
            key: overall?.key || "unknown",
            label: overall?.label || "Not enough evidence"
        },
        internalScore: Number.isFinite(Number(report?.score)) ? Number(report.score) : null,
        scoreBand: report?.scoring?.scoreBand?.label || null,
        coverage: report?.evaluation?.coverage?.label || "unknown",
        scoringRevision: report?.scoring?.modelRevision || null,
        components,
        header: {
            status: report?.headerAcquisition?.status || "unavailable",
            source: report?.headerAcquisition?.source || "none",
            spf: typeof bucTestAuthResult === "function" ? bucTestAuthResult(report?.authentication?.spf) : "unknown",
            dkim: typeof bucTestAuthResult === "function" ? bucTestAuthResult(report?.authentication?.dkim) : "unknown",
            dmarc: typeof bucTestAuthResult === "function" ? bucTestAuthResult(report?.authentication?.dmarc) : "unknown"
        },
        linkCount: Number(report?.links?.length) || 0,
        linkCountBucket: bucValidationLinkCountBucket(report?.links?.length || 0),
        domains: bucValidationSafeDomains(report),
        concerningEvidence: bucValidationCollapseEvidence(report?.scoring?.concerningEvidence || []),
        reassuringEvidence: bucValidationCollapseEvidence(report?.scoring?.reassuringEvidence || []),
        wordingPatterns: [...new Set((report?.wordingMatches || []).map(item => item?.id).filter(Boolean))].sort(),
        patternSignature,
        newPattern: similarRecords.length === 0,
        similarTo: similarRecords,
        // Kept only in tab memory for duplicate-record protection; stripped from export.
        messageKey: String(report?.messageKey || "")
    };
}

function bucRecordValidationCurrent(report, category = "unclassified") {
    if (!report || report !== bucLastReport || !bucCurrentMessageMatchesLastReport()) {
        return { ok: false, error: "The current email no longer matches this report." };
    }

    const existingIndex = bucValidationSession.findIndex(item => item.messageKey && item.messageKey === report.messageKey);
    const record = bucValidationBuildRecord(report, category);

    if (existingIndex >= 0) {
        const previousNumber = bucValidationSession[existingIndex].number;
        record.number = previousNumber;
        bucValidationSession[existingIndex] = record;
        return {
            ok: true,
            updated: true,
            record: { ...record, messageKey: undefined },
            count: bucValidationSession.length,
            uniquePatterns: new Set(bucValidationSession.map(item => item.patternSignature)).size
        };
    }

    bucValidationSequence += 1;
    record.number = bucValidationSequence;
    bucValidationSession.push(record);
    return {
        ok: true,
        updated: false,
        record: { ...record, messageKey: undefined },
        count: bucValidationSession.length,
        uniquePatterns: new Set(bucValidationSession.map(item => item.patternSignature)).size
    };
}

function bucValidationSessionSummary() {
    return {
        count: bucValidationSession.length,
        uniquePatterns: new Set(bucValidationSession.map(item => item.patternSignature)).size
    };
}

function bucValidationCountBy(records, selector) {
    const result = {};
    for (const record of records) {
        const key = String(selector(record) || "unknown");
        result[key] = (result[key] || 0) + 1;
    }
    return result;
}

function bucBuildValidationExport() {
    let version = "0.22.17.1";
    try { version = chrome?.runtime?.getManifest?.().version || version; } catch (_error) {}
    const records = bucValidationSession.map(({ messageKey, ...record }) => record);
    const signatureCounts = bucValidationCountBy(records, record => record.patternSignature);
    const duplicatePatternRecords = records.filter(record => (signatureCounts[record.patternSignature] || 0) > 1).length;

    return {
        format: "BeforeUClick provider validation batch",
        version: version || "unknown",
        sessionStartedAt: bucValidationSessionStartedAt,
        exportedAt: new Date().toISOString(),
        privacy: {
            sessionOnlyUntilExport: true,
            omitted: [
                "subject",
                "message body",
                "recipients",
                "full email addresses",
                "raw headers",
                "full URLs",
                "provider message identifiers"
            ]
        },
        summary: {
            records: records.length,
            uniqueBehaviourPatterns: new Set(records.map(record => record.patternSignature)).size,
            duplicatePatternRecords,
            providers: bucValidationCountBy(records, record => record.providerKey),
            categories: bucValidationCountBy(records, record => record.category),
            verdicts: bucValidationCountBy(records, record => record.overall?.key),
            note: duplicatePatternRecords > Math.max(3, records.length / 2)
                ? "Many recorded emails share existing evidence patterns. More value is likely to come from a different provider, message category or deliberately constructed scenario than from more same-theme mail."
                : "Continue until new emails mostly repeat existing behaviour patterns, then move to another provider/category."
        },
        records
    };
}

function bucDownloadValidationBatch() {
    const payload = bucBuildValidationExport();
    if (!payload.records.length) return { ok: false, error: "No validation tests have been recorded in this tab." };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `BeforeUClick_validation_${payload.version}_${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, filename, summary: payload.summary };
}

function bucClearValidationSession() {
    bucValidationSession = [];
    bucValidationSequence = 0;
    bucValidationSessionStartedAt = new Date().toISOString();
    return { ok: true, ...bucValidationSessionSummary() };
}

// A rapid double-click must not launch competing scans or count one check twice.
function analyseCurrentEmail(options = {}) {
    if (bucCheckPromise) return bucCheckPromise;
    const trigger = document.getElementById('beforeuclick-check-button');
    if (trigger) trigger.disabled = true;
    bucCheckPromise = bucAnalyseCurrentEmailPipeline(options)
        .catch(error => {
            if (options.showPanel !== false) showBeforeUClickStatus('The check could not finish. Refresh your mailbox and try again.', true);
            return { ok: false, error: String(error) };
        })
        .finally(() => { bucCheckPromise = null; if (trigger) trigger.disabled = false; });
    return bucCheckPromise;
}

/** Returns whether BeforeUClick is currently engaged with one manually checked message. */
function bucIsCheckEngaged() {
    return bucCheckEngaged === true;
}

/**
 * Ends the current manual-check session.
 * Removes report UI, link badges/highlights/popovers and click-guard state,
 * then forgets the in-memory report so the next toolbar/manual action starts fresh.
 */
function bucDisengageCurrentCheck({ removePanel = true } = {}) {
    bucSessionRevision++;
    if (removePanel && typeof bucPanelResizeCleanup === "function") bucPanelResizeCleanup();
    bucCheckEngaged = false;
    bucLastReport = null;
    bucLastMessageKey = "";

    if (typeof bucSetLinkInteractionEngaged === "function") {
        bucSetLinkInteractionEngaged(false);
    }
    if (typeof bucSetClickGuardEngaged === "function") {
        bucSetClickGuardEngaged(false);
    }
    if (typeof bucCloseLinkInfoPopover === "function") {
        bucCloseLinkInfoPopover();
    }
    if (typeof bucCloseClickGuard === "function") {
        bucCloseClickGuard();
    }
    if (typeof bucResetLinkRegistry === "function") {
        bucResetLinkRegistry();
    } else if (typeof bucClearLinkHighlights === "function") {
        bucClearLinkHighlights();
    }

    if (removePanel) {
        document.getElementById("beforeuclick-panel")?.remove();
    }

    return { ok: true, engaged: false };
}

/** Creates a small non-cryptographic fingerprint used only to identify the current rendered message. */
function bucSimpleFingerprint(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

/** Builds the temporary key used to decide whether the current report still belongs to the open message. */
function bucGetMessageKey(context, metadata) {
    if (!context) return "";

    const id = context.root?.getAttribute("data-legacy-message-id") ||
        context.root?.getAttribute("data-message-id") ||
        context.body?.getAttribute("data-legacy-message-id") ||
        context.body?.getAttribute("data-message-id");

    if (id) return id;

    const bodySample = bucExtractCurrentMessageText(context).slice(0, 500);
    const recipients = [
        ...(metadata?.recipients?.to || []),
        ...(metadata?.recipients?.cc || []),
        ...(metadata?.recipients?.bcc || [])
    ].join(",");

    return bucSimpleFingerprint(
        `${metadata?.sender || ""}|${recipients}|${metadata?.date || ""}|${metadata?.subject || ""}|${bodySample}`
    );
}

/** Creates a consistent module result for partial-result handling, debug output and score evidence. */
function bucModuleResult(status, score = 0, warnings = [], details = null, evidence = []) {
    return { status, score, warnings, details, evidence };
}

/** Runs the complete manual BeforeUClick pipeline against the selected supported webmail message. */
async function bucAnalyseCurrentEmailPipeline({ showPanel = true, recordScan = true } = {}) {
    // A new explicit check replaces any previous engaged message/session.
    bucDisengageCurrentCheck({ removePanel: true });

    const revision = bucSessionRevision;
    if (showPanel) showBeforeUClickStatus("Reading this email…");
    const context = bucFindCurrentMessage();

    if (!context) {
        if (showPanel) {
            showBeforeUClickStatus(`Open an email in ${bucSupportedProviderLabel()}, then click “Check this email”.`, true);
        }
        return {
            ok: false,
            error: "No opened message could be detected on this supported webmail page."
        };
    }

    const modules = {};
    let metadata = {};
    let messageText = "";
    let links = [];
    let wordingMatches = [];
    let senderResult = { score: 0, warnings: [], evidence: [] };
    let metadataResult = { score: 0, warnings: [], evidence: [] };
    let authentication = null;
    let authenticationResult = { score: 0, warnings: [], evidence: [], model: null };
    let headerAcquisition = { status: "unavailable", source: "none", rawHeaders: "", limitations: [] };
    let bodyIdentityResult = { score: 0, warnings: [], evidence: [], addresses: [] };
    let wordingResult = { score: 0, matches: [] };
    let preferences = { ...BUC_DEFAULT_PREFERENCES, knownSenders: [] };
    const overallWarnings = [];

    // Start every manual check with a clean visual state.
    bucClearLinkHighlights();

    // Load local-only preferences once per manual check.
    try {
        preferences = await bucGetPreferences();
        bucSetClickGuardMode(preferences.clickGuardMode);
        bucSetLinkInfoMode(preferences.linkInfoMode);
        bucSetUiPreferences(preferences);
    } catch (_error) {
        preferences = { ...BUC_DEFAULT_PREFERENCES, knownSenders: [] };
        bucSetClickGuardMode(preferences.clickGuardMode);
        bucSetLinkInfoMode(preferences.linkInfoMode);
        bucSetUiPreferences(preferences);
    }

    // A user may stop the scan while an asynchronous preference read is still resolving.
    // Do not let later progress updates recreate a panel that the user explicitly closed.
    if (revision !== bucSessionRevision) return { ok: false, cancelled: true };

    // Extraction module. Provider adapters may reveal local message-detail metadata where supported.
    try {
        const expandedDetails = await bucEnsureProviderDetailsVisible(context);
        if (revision !== bucSessionRevision) return { ok: false, cancelled: true };
        messageText = bucExtractCurrentMessageText(context);
        metadata = bucExtractProviderMetadata(context);

        modules.extraction = bucModuleResult(
            "ok",
            0,
            [],
            {
                textLength: messageText.length,
                detailsExpandedByPrototype: expandedDetails,
                unavailable: metadata.unavailable || []
            }
        );
    } catch (error) {
        modules.extraction = bucModuleResult("error", 0, ["Message extraction failed."], String(error));
        metadata = {
            sender: "",
            senderName: "",
            recipients: { to: [], cc: [], bcc: [] },
            subject: "",
            date: "",
            replyTo: "",
            mailedBy: "",
            signedBy: "",
            unavailable: ["metadata"]
        };
    }
    if (revision !== bucSessionRevision) return { ok: false, cancelled: true };

    const selectedMessageKey = bucGetMessageKey(context, metadata);

    // Keep at most one email's raw headers in tab memory. Moving to another message drops the
    // previous temporary cache before any new provider acquisition begins.
    if (bucSessionHeaderCache && (
        bucSessionHeaderCache.providerKey !== (context.provider || "") ||
        bucSessionHeaderCache.messageKey !== selectedMessageKey
    )) {
        bucSessionHeaderCache = null;
    }

    if (showPanel && typeof bucUpdateBeforeUClickStatus === "function") {
        bucUpdateBeforeUClickStatus(
            context.provider === "outlook"
                ? "Message found · checking Outlook authentication…"
                : "Message found · checking sender and authentication…"
        );
    }

    // Provider-specific Internet-header acquisition + shared authentication interpretation.
    // This is intentionally separate from visible-message extraction: providers obtain the data,
    // while one common parser/alignment/evidence path handles SPF/DKIM/DMARC consistently.
    try {
        const cachedHeaders = bucGetCachedProviderHeaders(context.provider || "", selectedMessageKey);
        headerAcquisition = cachedHeaders || await bucAcquireProviderHeaders(context, metadata);
        if (revision !== bucSessionRevision) return { ok: false, cancelled: true };
        if (!cachedHeaders) {
            bucRememberProviderHeaders(context.provider || "", selectedMessageKey, headerAcquisition);
        }
        authentication = bucBuildAuthenticationModel(headerAcquisition, metadata, context.provider || "");
        metadata = bucMergeMetadataFromAuthentication(metadata, authentication);
        authenticationResult = analyseAuthentication(authentication);

        modules.authentication = bucModuleResult(
            headerAcquisition.status === "full" ? "ok" : "partial",
            authenticationResult.score,
            authenticationResult.warnings,
            {
                acquisitionStatus: headerAcquisition.status,
                source: headerAcquisition.source,
                rawHeaderCount: authentication.rawHeaderCount || 0,
                spf: authentication.spf,
                dkim: authentication.dkim,
                dmarc: authentication.dmarc,
                arc: authentication.arc,
                alignment: authentication.alignment,
                limitations: authentication.limitations || [],
                acquisitionDiagnostics: headerAcquisition.diagnostics || []
            },
            authenticationResult.evidence || []
        );
        overallWarnings.push(...authenticationResult.warnings);
    } catch (error) {
        authentication = bucBuildAuthenticationModel(
            { provider: context.provider || "", status: "unavailable", source: "none", rawHeaders: "", limitations: ["Header/authentication analysis failed."] },
            metadata,
            context.provider || ""
        );
        authenticationResult = { score: 0, warnings: [], evidence: [], model: authentication };
        modules.authentication = bucModuleResult("error", 0, ["Header/authentication analysis could not be completed."], String(error));
    }
    if (revision !== bucSessionRevision) return { ok: false, cancelled: true };

    if (showPanel && typeof bucUpdateBeforeUClickStatus === "function") {
        bucUpdateBeforeUClickStatus("Authentication checked · reviewing links and wording…");
    }

    // Sender analysis. Evidence is kept separate from presentation text for later score changes.
    try {
        senderResult = analyseSender(metadata.sender, metadata.senderName, {
            knownSender: bucIsKnownSender(metadata.sender, preferences)
        });
        modules.sender = bucModuleResult(
            "ok",
            senderResult.score,
            senderResult.warnings,
            null,
            senderResult.evidence || []
        );
        overallWarnings.push(...senderResult.warnings);
    } catch (error) {
        modules.sender = bucModuleResult("error", 0, ["Sender analysis could not be completed."], String(error));
    }

    // Metadata consistency analysis. When full provider-trusted SPF/DKIM results are available,
    // avoid scoring the same mailed-by/signed-by relationship twice through the older summary fields.
    try {
        const metadataForConsistency = {
            ...metadata,
            mailedBy: authentication?.spf?.providerTrusted ? "" : metadata.mailedBy,
            signedBy: authentication?.dkim?.some(item => item.providerTrusted) ? "" : metadata.signedBy
        };
        metadataResult = analyseMetadata(metadataForConsistency);
        modules.metadata = bucModuleResult(
            "ok",
            metadataResult.score,
            metadataResult.warnings,
            null,
            metadataResult.evidence || []
        );
        overallWarnings.push(...metadataResult.warnings);
    } catch (error) {
        modules.metadata = bucModuleResult("error", 0, ["Metadata analysis could not be completed."], String(error));
    }

    // Body identity analysis. This checks contact addresses written inside the current message
    // and remains deliberately low-weight because legitimate messages can mention third parties.
    try {
        bodyIdentityResult = analyseBodyIdentity(messageText, {
            excludeAddresses: [
                ...(metadata?.recipients?.to || []),
                ...(metadata?.recipients?.cc || []),
                ...(metadata?.recipients?.bcc || [])
            ]
        });
        modules.bodyIdentity = bucModuleResult(
            "ok",
            bodyIdentityResult.score,
            bodyIdentityResult.warnings,
            { addresses: bodyIdentityResult.addresses || [] },
            bodyIdentityResult.evidence || []
        );
        overallWarnings.push(...bodyIdentityResult.warnings);
    } catch (error) {
        modules.bodyIdentity = bucModuleResult("error", 0, ["Body contact-address analysis could not be completed."], String(error));
    }

    // Wording analysis. Subject is included because phishing language often appears there.
    try {
        const wordingInput = [metadata.subject, messageText].filter(Boolean).join("\n\n");
        wordingResult = checkWording(wordingInput);
        wordingMatches = wordingResult.matches;
        modules.wording = bucModuleResult(
            "ok",
            wordingResult.score,
            wordingMatches.map(match => `Wording pattern: ${match.label}`),
            null,
            wordingMatches.map(match => ({
                code: match.id,
                category: "wording",
                source: "wording",
                strength: match.strength || "weak",
                evidenceClass: match.evidenceClass || "WORDING_WEAK",
                points: match.score,
                text: match.label,
                matchedPhrases: match.matchedPhrases || []
            }))
        );
        overallWarnings.push(...modules.wording.warnings);
    } catch (error) {
        modules.wording = bucModuleResult("error", 0, ["Wording analysis could not be completed."], String(error));
    }

    // Link analysis. Each result preserves the exact provider DOM element mapping created by shared link extraction.
    try {
        const rawLinks = bucExtractProviderLinks(context);
        const senderDomain = bucEmailDomain(metadata.sender || "");
        const senderAligned = Boolean(authentication?.alignment?.spf || authentication?.alignment?.dkim);
        const messageWrapperDomains = bucInferMessageLinkWrappers(rawLinks, {
            senderDomain,
            mailedBy: metadata.mailedBy || "",
            signedBy: metadata.signedBy || "",
            senderAligned
        });

        links = rawLinks.map(link => {
            const displayValue = link.text || link.altText || "";
            const risk = calculateLinkRisk(displayValue, link.url, {
                senderDomain,
                senderName: metadata.senderName || "",
                senderClaimedOrganisationIds: bucFindClaimedOrganisations(metadata.senderName || "").map(item => item.id),
                senderAligned,
                messageWrapperDomains
            });
            return {
                ...link,
                score: risk.score,
                rawScore: risk.rawScore ?? risk.score,
                weakRawScore: risk.weakRawScore ?? 0,
                weakAppliedScore: risk.weakAppliedScore ?? 0,
                weakCap: risk.weakCap ?? BUC_SCORING_MODEL.weakLinkCap,
                warnings: risk.warnings.map(warning => warning.text),
                warningDetails: risk.warnings,
                domain: risk.domain,
                reference: risk.reference,
                wrapperContext: risk.wrapperContext || null,
                suppressDestinationReassurance: Boolean(risk.suppressDestinationReassurance)
            };
        });

        // Make the same analysed records available to highlighting and the click guard.
        bucSetAnalysedLinkResults(links);

        const highestLinkScore = links.length ? Math.max(...links.map(link => link.score)) : 0;
        modules.links = bucModuleResult(
            "ok",
            Math.min(highestLinkScore, BUC_SCORING_MODEL.linkCap),
            links.flatMap(link => link.warnings),
            {
                highestRawLinkScore: highestLinkScore,
                totalLinks: links.length
            },
            links.flatMap(link => link.warningDetails || [])
        );
        overallWarnings.push(...modules.links.warnings);
    } catch (error) {
        modules.links = bucModuleResult("error", 0, ["Link analysis could not be completed."], String(error));
    }

    if (showPanel && typeof bucUpdateBeforeUClickStatus === "function") {
        bucUpdateBeforeUClickStatus("Finishing the assessment…");
    }

    // Scoring happens after the modules finish, so changing weights does not require rewriting extraction logic.
    let scoring;
    try {
        const scoringMetadataResult = {
            ...metadataResult,
            evidence: [
                ...(metadataResult.evidence || []),
                ...(authenticationResult.evidence || [])
            ]
        };
        scoring = scoreBeforeUClickEvidence({
            senderResult,
            metadataResult: scoringMetadataResult,
            bodyIdentityResult,
            wordingResult,
            links
        });
        modules.scoring = bucModuleResult(
            "ok",
            scoring.score,
            scoring.combinationEvidence.map(item => item.text),
            {
                moduleScores: scoring.moduleScores,
                caps: scoring.caps,
                linkSummary: scoring.linkSummary
            },
            scoring.evidence
        );
    } catch (error) {
        scoring = {
            score: BUC_SCORING_MODEL.baseUncertaintyScore,
            level: bucScoreLevel(BUC_SCORING_MODEL.baseUncertaintyScore),
            baseScore: BUC_SCORING_MODEL.baseUncertaintyScore,
            concernScore: 0,
            reassuranceAdjustment: 0,
            moduleScores: {
                baseline: BUC_SCORING_MODEL.baseUncertaintyScore,
                identity: 0,
                links: 0,
                wording: 0,
                combinations: 0,
                reassurance: 0
            },
            caps: {
                identity: BUC_SCORING_MODEL.identityCap,
                links: BUC_SCORING_MODEL.linkCap,
                wording: BUC_SCORING_MODEL.wordingCap,
                combinations: BUC_SCORING_MODEL.combinationCap,
                reassurance: BUC_SCORING_MODEL.reassuranceCap
            },
            linkSummary: { highestLinkScore: 0, multiLinkBonus: 0, suspiciousLinkCount: 0 },
            combinationEvidence: [],
            reassuringEvidence: [],
            concerningEvidence: [],
            evidence: [],
            criticalOverrideApplied: false
        };
        modules.scoring = bucModuleResult("error", 0, ["Evidence scoring could not be completed."], String(error));
    }

    // Build five-state component assessments for presentation. The numeric score remains
    // available internally for diagnostics/calibration but is not the ordinary user-facing result.
    let evaluation;
    try {
        evaluation = bucBuildEvaluationSummary({
            scoring,
            modules,
            metadata,
            senderResult,
            metadataResult,
            bodyIdentityResult,
            authenticationResult,
            headerAcquisition,
            wordingResult,
            links
        });

        const linkAssessments = new Map(
            (evaluation.components?.links?.items || []).map(item => [item.linkId, item])
        );
        links.forEach(link => {
            if (link?.id && linkAssessments.has(link.id)) link.assessment = linkAssessments.get(link.id);
        });

        // Refresh contextual link consumers after the component assessment is attached.
        bucSetAnalysedLinkResults(links);
    } catch (error) {
        evaluation = {
            overall: scoring.level || bucScoreLevel(scoring.score),
            coverage: { key: "partial", label: "Partial", note: "Component assessment summary could not be completed." },
            components: {},
            primaryReasons: [],
            scoreVisibleToUser: false,
            scoreMeaning: "Internal evidence weight only; not a probability."
        };
        modules.evaluation = bucModuleResult("error", 0, ["Component evaluation summary could not be completed."], String(error));
    }

    if (!modules.evaluation) {
        modules.evaluation = bucModuleResult("ok", 0, [], {
            coverage: evaluation.coverage,
            overall: evaluation.overall,
            components: Object.fromEntries(Object.entries(evaluation.components || {}).map(([key, value]) => [key, {
                assessment: value.assessment,
                coverage: value.coverage
            }]))
        });
    }

    // Partial results: module errors do not prevent the rest of the report from being returned.
    const moduleErrors = Object.entries(modules)
        .filter(([, result]) => result.status === "error")
        .map(([name]) => name);

    if (moduleErrors.length) {
        overallWarnings.push(`Partial result: ${moduleErrors.join(", ")} module(s) could not be completed.`);
    }

    const messageKey = selectedMessageKey;
    const linkTypeCounts = links.reduce((counts, link) => {
        counts[link.type] = (counts[link.type] || 0) + 1;
        return counts;
    }, {});

    const debug = {
        provider: context.providerName || "Webmail",
        providerStatus: context.providerStatus || "unknown",
        messageSelection: context.selectionEvidence || {},
        extractedTextLength: messageText.length,
        metadataUnavailable: metadata.unavailable || [],
        headerAcquisition: {
            status: headerAcquisition.status,
            source: headerAcquisition.source,
            rawHeaderCount: authentication?.rawHeaderCount || 0,
            limitations: authentication?.limitations || [],
            diagnostics: headerAcquisition.diagnostics || [],
            durationMs: Number.isFinite(Number(headerAcquisition.durationMs)) ? Number(headerAcquisition.durationMs) : null,
            cacheHit: headerAcquisition.cacheHit === true
        },
        totalLinks: links.length,
        linkTypeCounts,
        moduleStatus: Object.fromEntries(Object.entries(modules).map(([name, result]) => [name, result.status])),
        scoreBreakdown: scoring.moduleScores,
        visibleAssessment: evaluation.overall,
        coverage: evaluation.coverage
    };

    // Header acquisition is asynchronous: do not revive a stopped or changed email.
    const currentContext = bucFindCurrentMessage();
    const currentKey = currentContext ? bucGetMessageKey(currentContext, bucExtractProviderMetadata(currentContext)) : '';
    if (revision !== bucSessionRevision || currentKey !== messageKey) {
        if (revision === bucSessionRevision) {
            bucDisengageCurrentCheck({ removePanel: true });
            if (showPanel) showBeforeUClickStatus('The open email changed. Check the message you want to inspect.', true);
        }
        return { ok: false, cancelled: true };
    }
    bucLastReport = {
        ok: true,
        analysedAt: new Date().toISOString(),
        provider: context.providerName || "Webmail",
        providerKey: context.provider || "unknown",
        providerStatus: context.providerStatus || "unknown",
        messageKey,
        score: scoring.score,
        level: evaluation.overall || scoring.level,
        scoring,
        evaluation,
        metadata,
        authentication,
        headerAcquisition: {
            provider: headerAcquisition.provider || context.provider || "",
            status: headerAcquisition.status || "unavailable",
            source: headerAcquisition.source || "none",
            limitations: headerAcquisition.limitations || [],
            diagnostics: headerAcquisition.diagnostics || [],
            durationMs: Number.isFinite(Number(headerAcquisition.durationMs)) ? Number(headerAcquisition.durationMs) : null,
            cacheHit: headerAcquisition.cacheHit === true
        },
        unavailableChecks: [
            ...(metadata.unavailable || []),
            ...((authentication?.limitations || []).map(item => `Authentication/header: ${item}`))
        ],
        warnings: overallWarnings,
        links,
        wordingMatches,
        modules,
        debug
    };
    bucLastMessageKey = messageKey;

    // Contextual UI only becomes active after a successful explicit manual check.
    bucCheckEngaged = true;
    if (typeof bucSetLinkInteractionEngaged === "function") {
        bucSetLinkInteractionEngaged(true);
    }
    if (typeof bucSetClickGuardEngaged === "function") {
        bucSetClickGuardEngaged(true);
    }

    bucApplyLinkHighlightMode(links, preferences.highlightMode || "concerns");

    // Record only explicit user-triggered checks. Internal refreshes must not inflate counters.
    if (recordScan) {
        try {
            await chrome.runtime.sendMessage({
                type: "BUC_RECORD_SCAN",
                verdictKey: evaluation.overall?.key || scoring.level?.key || "unknown",
                messageKey
            });
        } catch (_error) {
            // Aggregate stats are optional and must never block the analysis result.
        }
        if (revision !== bucSessionRevision) return { ok: false, cancelled: true };
    }

    if (showPanel && revision === bucSessionRevision && bucLastReport) {
        renderReport(bucLastReport);
    }

    return bucLastReport;
}

/** Checks whether the saved result still belongs to the currently selected supported message. */
function bucCurrentMessageMatchesLastReport() {
    if (!bucCheckEngaged || !bucLastReport) return false;

    try {
        const context = bucFindCurrentMessage();
        if (!context) return false;
        const metadata = bucExtractProviderMetadata(context);
        const currentKey = bucGetMessageKey(context, metadata);
        return Boolean(currentKey && currentKey === bucLastMessageKey);
    } catch (_error) {
        return false;
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return false;

    if (message.type === "BUC_OPEN_PANEL") {
        if (bucCurrentMessageMatchesLastReport()) {
            renderReport(bucLastReport);
            sendResponse({ ok: true });
        } else {
            analyseCurrentEmail({ showPanel: true })
                .then(sendResponse)
                .catch(error => sendResponse({ ok: false, error: String(error) }));
        }
        return true;
    }

    if (message.type === "ANALYSE_CURRENT_EMAIL") {
        analyseCurrentEmail({ showPanel: true })
            .then(sendResponse)
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message.type === "REANALYSE_CURRENT_EMAIL") {
        analyseCurrentEmail({ showPanel: false, recordScan: false })
            .then(sendResponse)
            .catch(error => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message.type === "GET_LAST_REPORT") {
        sendResponse(bucCurrentMessageMatchesLastReport() ? bucLastReport : null);
        return false;
    }

    if (message.type === "STOP_CHECKING") {
        sendResponse(bucDisengageCurrentCheck({ removePanel: true }));
        return false;
    }

    if (message.type === "GET_CHECK_ENGAGEMENT") {
        sendResponse({ ok: true, engaged: bucIsCheckEngaged() });
        return false;
    }

    return false;
});

/** Keeps the optional floating manual trigger in sync with the user preference. */
function bucEnsureManualTrigger() {
    const existing = document.getElementById("beforeuclick-check-button");
    if (!bucManualTriggerEnabled) {
        existing?.remove();
        return null;
    }
    return createManualTrigger(() => analyseCurrentEmail({ showPanel: true }));
}

async function bucRefreshAccessPreferences() {
    try {
        const preferences = await bucGetPreferences();
        bucManualTriggerEnabled = preferences.showManualTrigger !== false;
        bucSetUiPreferences(preferences);
    } catch (_error) {
        bucManualTriggerEnabled = BUC_DEFAULT_PREFERENCES.showManualTrigger !== false;
    }
    bucEnsureManualTrigger();
}

bucRefreshAccessPreferences();
bucInstallClickGuard();
bucInstallLinkInfoPopover();

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[BUC_PREFERENCE_KEY]) {
        bucRefreshAccessPreferences();
    }
});

// Supported webmail apps update without a full page reload. Keep the manual trigger available,
// but do not automatically analyse messages.
let bucObserverTimer = null;

/**
 * If the user navigates away from the checked message, end that session automatically.
 * The newly opened message is not analysed until the user presses Check this email again.
 */
function bucDisengageIfMessageChanged() {
    if (!bucCheckEngaged || !bucLastReport || !bucLastMessageKey) return;

    try {
        const context = bucFindCurrentMessage();
        if (!context) {
            bucDisengageCurrentCheck({ removePanel: true });
            return;
        }

        const metadata = bucExtractProviderMetadata(context);
        const currentKey = bucGetMessageKey(context, metadata);
        if (currentKey && currentKey !== bucLastMessageKey) {
            bucDisengageCurrentCheck({ removePanel: true });
        }
    } catch (_error) {
        // Provider DOM may be transient during navigation. Do not auto-analyse or guess.
    }
}

const bucObserver = new MutationObserver(() => {
    const triggerPresent = Boolean(document.getElementById("beforeuclick-check-button"));

    // During ordinary mailbox use, the fixed trigger is already present and no message is engaged.
    // Avoid continuously creating debounce timers for the host app's high-volume DOM mutations.
    if (!bucCheckEngaged && (triggerPresent || !bucManualTriggerEnabled)) return;

    // Throttle rather than endlessly re-debounce. Busy webmail pages can mutate many times per
    // second; this guarantees the message-change check still runs while keeping observer work small.
    if (bucObserverTimer) return;
    bucObserverTimer = setTimeout(() => {
        bucObserverTimer = null;
        bucEnsureManualTrigger();
        bucDisengageIfMessageChanged();
    }, 350);
});

bucObserver.observe(document.body, {
    childList: true,
    subtree: true
});
