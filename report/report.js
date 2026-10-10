// report/report.js
// Read-only full report page. It requests the in-memory last report from the source webmail tab.

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const reportEl = document.getElementById("report");
let bucFullSourceTabId = null;
let bucFullCurrentReport = null;

function bucFullText(tag, text, className = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text == null ? "" : String(text);
    return el;
}


function bucFullRow(container, label, value) {
    const row = bucFullText("div", "", "row");
    row.append(bucFullText("strong", label), bucFullText("span", value || "Not available"));
    container.appendChild(row);
}

function bucFullError(message) {
    bucUpdateReportSubtitle("Check an email to inspect its evidence");
    loadingEl.classList.add("hidden");
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
}

function bucFullMessageTab(tabId, message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, response => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(response);
        });
    });
}

function bucFullApplyPreferences(prefs) {
    document.body.dataset.fontSize = prefs.fontSize || "normal";
    document.body.dataset.highContrast = prefs.highContrast ? "true" : "false";
    document.body.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
    document.body.dataset.density = prefs.density || "comfortable";
}

function bucFullAuthenticationResultText(item) {
    const result = String(item?.result || "unavailable").toUpperCase();
    const trusted = item?.providerTrusted ? " · provider result" : "";
    return `${result}${trusted}`;
}

function bucFullRenderAuthentication(report) {
    const container = document.getElementById("authentication");
    const raw = document.getElementById("rawHeaders");
    const status = document.getElementById("authStatus");
    const auth = report.authentication || {};
    const acquisition = report.headerAcquisition || {};
    const alignment = auth.alignment || {};

    container.textContent = "";
    status.textContent = String(acquisition.status || auth.acquisitionStatus || "unavailable");

    bucFullRow(container, "Header source", acquisition.source || auth.source || "Not available");
    bucFullRow(container, "Header capture", acquisition.status || auth.acquisitionStatus || "unavailable");
    bucFullRow(container, "Visible / header From", auth.fromAddress || auth.headerFrom || "Not available");
    bucFullRow(container, "Reply-To", auth.replyTo || "Not present / not exposed");
    bucFullRow(container, "Return-Path", auth.returnPath || "Not present / not exposed");
    bucFullRow(container, "Message-ID", auth.messageId || "Not present / not exposed");

    const spfDomain = auth.spf?.domain ? ` · ${auth.spf.domain}` : "";
    bucFullRow(container, "SPF", `${bucFullAuthenticationResultText(auth.spf)}${spfDomain}`);

    const dkim = auth.dkim || [];
    if (dkim.length) {
        dkim.forEach((item, index) => {
            const details = [
                bucFullAuthenticationResultText(item),
                item.signingDomain ? `d=${item.signingDomain}` : "",
                item.selector ? `s=${item.selector}` : ""
            ].filter(Boolean).join(" · ");
            bucFullRow(container, `DKIM${dkim.length > 1 ? ` ${index + 1}` : ""}`, details);
        });
    } else {
        bucFullRow(container, "DKIM", "Not present / not exposed");
    }

    const dmarcDomain = auth.dmarc?.domain ? ` · ${auth.dmarc.domain}` : "";
    bucFullRow(container, "DMARC", `${bucFullAuthenticationResultText(auth.dmarc)}${dmarcDomain}`);
    bucFullRow(container, "ARC", bucFullAuthenticationResultText(auth.arc));

    bucFullRow(container, "From domain", alignment.fromDomain || "Not available");
    bucFullRow(container, "SPF alignment", alignment.spfDomain ? (alignment.spfAligned ? "Aligned" : "Not aligned") : "Not available");
    bucFullRow(container, "DKIM alignment", alignment.dkimDomains?.length ? (alignment.dkimAligned ? "Aligned" : "Not aligned") : "Not available");
    bucFullRow(container, "Reply-To alignment", alignment.replyToDomain ? (alignment.replyToAligned ? "Aligned" : "Different domain/organisation") : "Not available");
    bucFullRow(container, "Return-Path alignment", alignment.returnPathDomain ? (alignment.returnPathAligned ? "Aligned" : "Different domain/organisation") : "Not available");
    bucFullRow(container, "Received hops", Array.isArray(auth.received) && auth.received.length ? String(auth.received.length) : "Not available");

    if (Array.isArray(auth.limitations) && auth.limitations.length) {
        const limitationBox = bucFullText("div", "", "evidence-row");
        limitationBox.appendChild(bucFullText("strong", "Acquisition note"));
        const ul = document.createElement("ul");
        auth.limitations.forEach(item => ul.appendChild(bucFullText("li", item)));
        limitationBox.appendChild(ul);
        container.appendChild(limitationBox);
    }

    raw.textContent = auth.rawHeaders || "Full raw Internet headers were not captured for this check. Provider-visible summary information may still be shown above.";
}

function bucFullRenderEvidence(report) {
    const container = document.getElementById("evidence");
    const evidence = report.scoring?.evidence || [];
    document.getElementById("evidenceCount").textContent = evidence.length;
    container.textContent = "";

    if (!evidence.length) {
        container.appendChild(bucFullText("p", "No score-changing evidence rows were recorded.", "muted"));
        return;
    }

    evidence.forEach(item => {
        const row = bucFullText("div", "", "evidence-row");
        const title = bucFullText("div", "");
        title.append(
            bucFullText("span", String(item.strength || (Number(item.points) < 0 ? "reassuring" : "context")).toUpperCase(), "points"),
            bucFullText("strong", item.text || item.code || "Evidence")
        );
        row.appendChild(title);

        if (item.linkUrl) row.appendChild(bucFullText("div", item.linkUrl, "url"));
        if (item.references?.length) {
            row.appendChild(bucFullText("div", `References: ${item.references.map(v => `[${v}]`).join(", ")}`, "muted"));
        }
        if (item.notAppliedReason) row.appendChild(bucFullText("div", item.notAppliedReason, "muted"));
        container.appendChild(row);
    });
}

function bucFullLinkState(link) {
    const assessed = link?.assessment?.assessment;
    if (assessed?.key) {
        const labels = {
            "no-concerns": "No obvious concerns",
            unknown: "Not enough evidence",
            review: "Review",
            caution: "Caution",
            high: "High concern"
        };
        return { key: assessed.key, icon: assessed.icon || "?", label: labels[assessed.key] || assessed.label || "Not enough evidence" };
    }
    const warnings = link?.warningDetails || [];
    const score = Math.max(0, Number(link?.score) || 0);
    const hasCritical = warnings.some(item => item.strength === "critical");
    if (hasCritical || score >= 60) return { key: "high", icon: "!", label: "High concern" };
    if (score >= 35) return { key: "caution", icon: "⚠", label: "Caution" };
    if (score >= 17) return { key: "review", icon: "i", label: "Review" };
    const recognised = Boolean(link?.reference?.officialOrganisation || link?.reference?.shortLinkOrganisation || link?.reference?.controlledNamespace);
    if (recognised && warnings.length === 0) return { key: "no-concerns", icon: "✓", label: "No obvious concerns" };
    return { key: "unknown", icon: "?", label: "Not enough evidence" };
}

function bucFullRenderLinks(report) {
    const container = document.getElementById("links");
    const links = report.links || [];
    document.getElementById("linkCount").textContent = links.length;
    container.textContent = "";

    if (!links.length) {
        container.appendChild(bucFullText("p", "No HTTP/HTTPS links were found.", "muted"));
        return;
    }

    links.forEach((link, index) => {
        const details = bucFullText("details", "", "link-card");
        details.id = `report-link-${link.id || index}`;
        details.dataset.linkId = link.id || "";
        const state = bucFullLinkState(link);
        details.dataset.state = state.key;

        const summary = bucFullText(
            "summary",
            `${state.icon} Link ${index + 1} — ${state.label}`
        );
        const inside = bucFullText("div", "", "inside");

        bucFullRow(inside, "Type", link.type || "link");
        bucFullRow(inside, "Displayed", link.text || link.altText || "(no visible text)");
        const url = bucFullText("div", `Actual destination: ${link.url || "Destination unavailable"}`, "url");
        inside.appendChild(url);
        if (link.originalUrl && link.originalUrl !== link.url) {
            inside.appendChild(bucFullText("div", `Wrapper link: ${link.originalUrl}`, "url"));
        }

        if (link.domain?.registrableDomain) bucFullRow(inside, "Registered domain", link.domain.registrableDomain);
        if (link.domain?.publicSuffix) bucFullRow(inside, "Public suffix", link.domain.publicSuffix);

        if (link.reference?.officialOrganisation) {
            bucFullRow(inside, "Reference", `First-party: ${link.reference.officialOrganisation.name}`);
        } else if (link.reference?.recognisedOrganisation) {
            bucFullRow(inside, "Reference", `Recognised provider: ${link.reference.recognisedOrganisation.name} (${(link.reference.roles || []).join(", ") || "context"})`);
        } else if (link.reference?.recognisedService) {
            bucFullRow(inside, "Reference", `Shared platform: ${link.reference.recognisedService.name} (${(link.reference.roles || []).join(", ") || "context"}) — recognition is not a safety signal`);
        }

        if (link.warnings?.length) {
            const ul = document.createElement("ul");
            link.warnings.forEach(warning => ul.appendChild(bucFullText("li", warning)));
            inside.appendChild(ul);
        }

        details.append(summary, inside);
        container.appendChild(details);
    });
}

function bucFullRenderWording(report) {
    const container = document.getElementById("wording");
    const matches = report.wordingMatches || [];
    document.getElementById("wordingCount").textContent = matches.length;
    container.textContent = "";

    if (!matches.length) {
        container.appendChild(bucFullText("p", "No configured wording pattern group matched.", "muted"));
        return;
    }

    matches.forEach(match => {
        const row = bucFullText("div", "", "evidence-row");
        row.appendChild(bucFullText("strong", `${match.label || match.id} — ${match.evidenceClass || "WORDING_WEAK"}`));
        if (match.matchedPhrases?.length) {
            row.appendChild(bucFullText("div", `Matched: ${match.matchedPhrases.join(", ")}`, "muted"));
        }
        container.appendChild(row);
    });
}


function bucFullRenderScoreBreakdown(report) {
    const container = document.getElementById("scoreBreakdown");
    container.textContent = "";
    const scores = report.scoring?.moduleScores || {};
    const caps = report.scoring?.caps || {};
    bucFullRow(container, "Scoring revision", report.scoring?.modelRevision || "Legacy / unspecified");
    bucFullRow(container, "Internal evidence score", `${report.score ?? 15} / 100`);
    const scoreBand = report.scoring?.scoreBand;
    if (scoreBand?.label) {
        const range = Number.isFinite(scoreBand.min) && Number.isFinite(scoreBand.max)
            ? ` (${scoreBand.min}–${scoreBand.max})`
            : "";
        bucFullRow(container, "Internal calibration band", `${scoreBand.label}${range}`);
    }
    if (report.scoring?.scoreLevel?.label) {
        bucFullRow(container, "Score-derived result", report.scoring.scoreLevel.label);
    }
    if (report.scoring?.minimumVerdict) {
        bucFullRow(container, "Minimum-state rule", report.scoring.minimumVerdict);
    }
    const finalLevel = report.evaluation?.overall || report.level;
    if (finalLevel?.label) bucFullRow(container, "Displayed assessment", finalLevel.label);
    [
        ["Neutral uncertainty baseline", scores.baseline, null],
        ["Identity / metadata / authentication", scores.identity, caps.identity],
        ["Links / destinations", scores.links, caps.links],
        ["Wording", scores.wording, caps.wording],
        ["Cross-signal combinations", scores.combinations, caps.combinations],
        ["Reassuring evidence adjustment", scores.reassurance, caps.reassurance]
    ].forEach(([label, value, cap]) => {
        bucFullRow(container, label, `${value ?? 0}${cap != null && label !== "Reassuring evidence adjustment" ? ` / ${cap}` : ""}`);
    });
    container.appendChild(bucFullText("p", "Developer/calibration information only. The numeric score is not a probability and is intentionally hidden from the normal user-facing result.", "muted"));
}

function bucFullRenderComponents(report) {
    const container = document.getElementById("components");
    const components = report.evaluation?.components || {};
    container.textContent = "";

    const order = ["sender", "authentication", "links", "wording"];
    const stateLabels = {
        "no-concerns": "No obvious concerns",
        unknown: "Not enough evidence",
        review: "Review",
        caution: "Caution",
        high: "High concern"
    };

    order.forEach(key => {
        const component = components[key];
        if (!component?.assessment) return;
        const card = bucFullText("div", "", "component-card");
        card.dataset.state = component.assessment.key || "unknown";
        const head = bucFullText("div", "", "component-head");
        head.append(
            bucFullText("strong", component.label || key),
            bucFullText("span", `${component.assessment.icon || "?"} ${stateLabels[component.assessment.key] || component.assessment.label || "Not enough evidence"}`, "component-state")
        );
        card.appendChild(head);
        card.appendChild(bucFullText("div", `Coverage: ${component.coverage?.label || "Partial"}`, "muted"));
        if (component.coverage?.note) card.appendChild(bucFullText("div", component.coverage.note, "muted"));

        const reason = (component.concerningEvidence || [])[0]?.text;
        if (reason) card.appendChild(bucFullText("div", reason, "component-reason"));
        else if (component.assessment.key === "no-concerns") card.appendChild(bucFullText("div", "No concern was identified within this completed component check.", "component-reason"));
        else if (component.assessment.key === "unknown") card.appendChild(bucFullText("div", "This component did not provide enough evidence for a useful conclusion.", "component-reason"));

        container.appendChild(card);
    });
}

function bucFullRenderWarnings(report) {
    const container = document.getElementById("warnings");
    const warnings = report.warnings || [];
    document.getElementById("warningCount").textContent = warnings.length;
    container.textContent = "";
    if (!warnings.length) return container.appendChild(bucFullText("p", "No risk indicators were emitted by the current checks.", "muted"));
    const ul = document.createElement("ul");
    warnings.forEach(warning => ul.appendChild(bucFullText("li", warning)));
    container.appendChild(ul);
}

function bucFullRenderUnavailable(report) {
    const container = document.getElementById("unavailable");
    const values = report.unavailableChecks || report.metadata?.unavailable || [];
    document.getElementById("unavailableCount").textContent = values.length;
    container.textContent = "";
    if (!values.length) return container.appendChild(bucFullText("p", "No unavailable fields were recorded.", "muted"));
    const ul = document.createElement("ul");
    values.forEach(value => ul.appendChild(bucFullText("li", value)));
    container.appendChild(ul);
}

async function bucFullRenderKnownSender(report) {
    const container = document.getElementById("knownSenderAction");
    container.textContent = "";
    const email = String(report.metadata?.sender || "").trim().toLowerCase();
    if (!email) return;

    const prefs = await bucGetPreferences();
    if (!prefs.storageMode) {
        const button = bucFullText("button", "Open privacy settings", "small-action");
        button.type = "button";
        button.addEventListener("click", () => bucSetWorkspaceView("settings"));
        const note = bucFullText("span", "Remembered email information is off. Turn it on in Settings before using Known senders.", "muted");
        container.append(button, note);
        return;
    }

    const known = prefs.knownSenders.includes(email);
    const button = bucFullText("button", known ? "Remove from known senders" : "Mark sender as known", "small-action");
    button.type = "button";
    const note = bucFullText(
        "span",
        known
            ? "Saved locally. Other checks still run normally."
            : "Known-sender status is only a small local reassuring signal and never bypasses other checks.",
        "muted"
    );

    button.addEventListener("click", async () => {
        button.disabled = true;
        try {
            if (known) await bucRemoveKnownSender(email);
            else await bucAddKnownSender(email);

            if (Number.isInteger(bucFullSourceTabId)) {
                const refreshed = await bucFullMessageTab(
                    bucFullSourceTabId,
                    { type: "REANALYSE_CURRENT_EMAIL" }
                );
                if (refreshed?.ok) {
                    bucFullRender(refreshed);
                    return;
                }
            }

            note.textContent = "Saved locally. Re-check the email to refresh its assessment.";
        } catch (error) {
            note.textContent = `Could not update the known-sender setting: ${String(error.message || error)}`;
        } finally {
            button.disabled = false;
        }
    });

    container.append(button, note);
}

function bucFullFocusRequestedLink() {
    const focusLink = new URLSearchParams(location.search).get("focusLink");
    if (!focusLink) return;
    const target = Array.from(document.querySelectorAll(".link-card")).find(card => card.dataset.linkId === focusLink);
    if (!target) return;
    target.open = true;
    target.classList.add("focus-card");
    target.scrollIntoView({ block: "center" });
}

function bucFullRender(report) {
    bucFullCurrentReport = report;
    const shareButton = document.getElementById("shareReportButton");
    if (shareButton) shareButton.disabled = false;
    loadingEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    reportEl.classList.remove("hidden");

    const level = report.evaluation?.overall || report.level || { key: "unknown", label: "NOT ENOUGH EVIDENCE", icon: "?" };
    const summary = document.getElementById("summaryCard");
    summary.dataset.state = level.key || "unknown";
    document.getElementById("verdict").textContent = `${level.icon || ""} ${level.label || "Result"}`.trim();
    const coverage = report.evaluation?.coverage || { label: "Partial", note: "" };
    document.getElementById("score").textContent = `Check complete · coverage ${coverage.label}`;
    document.getElementById("summaryMessage").textContent = level.key === "no-concerns"
        ? "No obvious concerns were found in the checks that completed. This is not a safety guarantee."
        : level.key === "unknown"
            ? "We did not find enough information to make a useful assessment. Verify the sender before acting."
            : level.key === "review"
                ? "We noticed something worth checking before you act."
                : level.key === "high"
                    ? "Strong warning signs were found. Avoid interacting until you verify the message another way."
                    : "We found signs that could indicate a scam or unsafe request. Check before acting.";

    const provider = report.provider || report.debug?.provider || "Webmail";
    bucUpdateReportSubtitle(`${provider} · checked ${new Date(report.analysedAt || Date.now()).toLocaleString()}`);

    const metadata = document.getElementById("metadata");
    metadata.textContent = "";
    const m = report.metadata || {};
    bucFullRow(metadata, "Provider", provider);
    bucFullRow(metadata, "Sender", m.senderName && m.sender ? `${m.senderName} <${m.sender}>` : (m.sender || m.senderName));
    bucFullRow(metadata, "To", (m.recipients?.to || []).join(", "));
    bucFullRow(metadata, "CC", (m.recipients?.cc || []).join(", "));
    bucFullRow(metadata, "BCC", (m.recipients?.bcc || []).join(", "));
    bucFullRow(metadata, "Subject", m.subject);
    bucFullRow(metadata, "Date", m.date);
    bucFullRow(metadata, "Reply-To", m.replyTo);
    bucFullRow(metadata, "Mailed-by", m.mailedBy);
    bucFullRow(metadata, "Signed-by", m.signedBy);

    bucFullRenderComponents(report);
    bucFullRenderAuthentication(report);
    bucFullRenderEvidence(report);
    bucFullRenderLinks(report);
    bucFullRenderWording(report);
    bucFullRenderScoreBreakdown(report);
    bucFullRenderWarnings(report);
    bucFullRenderUnavailable(report);
    bucFullRenderKnownSender(report).catch(() => { document.getElementById("knownSenderAction").textContent = "Known-sender preferences could not be loaded."; });

    const debug = report.debug || {};
    document.getElementById("debug").textContent = [
        `Provider: ${debug.provider || provider}`,
        `Extracted text length: ${debug.extractedTextLength || 0}`,
        `Total links: ${debug.totalLinks || 0}`,
        `Link types: ${JSON.stringify(debug.linkTypeCounts || {})}`,
        `Unavailable metadata: ${(debug.metadataUnavailable || []).join(", ") || "none"}`,
        `Header acquisition: ${JSON.stringify(debug.headerAcquisition || {})}`,
        `Modules: ${JSON.stringify(debug.moduleStatus || {})}`,
        `Score breakdown: ${JSON.stringify(debug.scoreBreakdown || {})}`
    ].join("\n");
    setTimeout(bucFullFocusRequestedLink, 40);
}

(async function initialiseFullReport() {
    try {
        const prefs = await bucGetPreferences();
        bucFullApplyPreferences(prefs);

        const params = new URLSearchParams(location.search);
        if (!params.has("sourceTab")) throw new Error(params.has("notice")
            ? "Open an email in Gmail, Outlook or Yahoo Mail, then click BeforeUClick. If your mailbox was already open when the extension was updated, refresh it first."
            : "No email report is open. Check a message in your mailbox to view its report here.");
        const tabId = Number(params.get("sourceTab"));
        if (!Number.isInteger(tabId)) throw new Error("The source webmail tab could not be identified.");
        bucFullSourceTabId = tabId;

        const report = await bucFullMessageTab(tabId, { type: "GET_LAST_REPORT" });
        if (!report?.ok) throw new Error("The checked message is no longer open, or no report is available.");
        bucFullRender(report);
    } catch (error) {
        bucFullError(String(error.message || error));
    }
})();


const shareReportButton = document.getElementById("shareReportButton");
shareReportButton?.addEventListener("click", async () => {
    if (!bucFullCurrentReport) return;
    shareReportButton.disabled = true;
    try {
        const result = await bucShareAssessment(bucFullCurrentReport);
        if (result.cancelled) return;
        const status = document.getElementById("workspaceStatus");
        status.textContent = result.method === "native"
            ? "Shared using your device. BeforeUClick did not upload the email."
            : "Summary copied. Paste it into a message or email for a second opinion.";
        setTimeout(() => { if (status.textContent) status.textContent = ""; }, 3600);
    } catch (_error) {
        const status = document.getElementById("workspaceStatus");
        status.textContent = "Sharing is unavailable in this browser.";
    } finally {
        shareReportButton.disabled = false;
    }
});

const settingsToggle = document.getElementById('settingsToggle');
const reportTab = document.getElementById('reportTab');
const sendersTab = document.getElementById('sendersTab');
const referenceTab = document.getElementById('referenceTab');
const reportSubtitle = document.getElementById('reportSubtitle');
const shareReportButtonEl = document.getElementById('shareReportButton');
let savedReportSubtitle = null;
let bucWorkspaceCurrentView = 'report';
const workspaceScroll = { report: 0, settings: 0, senders: 0, reference: 0 };
const workspaceConfig = {
    report: { tab: reportTab, view: document.getElementById('reportView'), title: 'Full report', subtitle: null },
    settings: { tab: settingsToggle, view: document.getElementById('settingsView'), frame: document.getElementById('settingsFrame'), src: '../settings/options.html?embedded=1', title: 'Settings', subtitle: 'Make BeforeUClick work the way you do.' },
    senders: { tab: sendersTab, view: document.getElementById('sendersView'), frame: document.getElementById('sendersFrame'), src: '../settings/known_senders.html?embedded=1', title: 'Known senders', subtitle: 'Optional local reassurance list; available only when remembered email information is enabled.' },
    reference: { tab: referenceTab, view: document.getElementById('referenceView'), frame: document.getElementById('referenceFrame'), src: '../settings/reference_data.html?embedded=1', title: 'Reference data', subtitle: 'Inspect the local rules and metadata used by BeforeUClick checks.' }
};
function bucUpdateReportSubtitle(text) {
    if (bucWorkspaceCurrentView !== 'report') savedReportSubtitle = text;
    else reportSubtitle.textContent = text;
}
function bucSetWorkspaceView(name) {
    const target = workspaceConfig[name] || workspaceConfig.report;
    workspaceScroll[bucWorkspaceCurrentView] = window.scrollY;
    if (name !== 'report' && savedReportSubtitle === null) savedReportSubtitle = reportSubtitle.textContent;
    bucWorkspaceCurrentView = name in workspaceConfig ? name : 'report';
    for (const [key, config] of Object.entries(workspaceConfig)) {
        const active = key === bucWorkspaceCurrentView;
        config.view.classList.toggle('hidden', !active);
        config.tab.classList.toggle('active', active);
        if (active) config.tab.setAttribute('aria-current', 'page');
        else config.tab.removeAttribute('aria-current');
    }
    document.getElementById('pageTitle').textContent = target.title;
    if (bucWorkspaceCurrentView === 'report') {
        if (savedReportSubtitle !== null) { reportSubtitle.textContent = savedReportSubtitle; savedReportSubtitle = null; }
    } else {
        reportSubtitle.textContent = target.subtitle;
        if (target.frame && !target.frame.hasAttribute('src')) target.frame.src = target.src;
    }
    shareReportButtonEl?.classList.toggle('hidden', bucWorkspaceCurrentView !== 'report');
    if (bucWorkspaceCurrentView === 'report') bucGetPreferences().then(bucFullApplyPreferences).catch(()=>{});
    requestAnimationFrame(() => window.scrollTo({ top: workspaceScroll[bucWorkspaceCurrentView], behavior: 'instant' }));
}
settingsToggle.addEventListener('click', () => bucSetWorkspaceView('settings'));
reportTab.addEventListener('click', () => bucSetWorkspaceView('report'));
sendersTab.addEventListener('click', () => bucSetWorkspaceView('senders'));
referenceTab.addEventListener('click', () => bucSetWorkspaceView('reference'));
document.getElementById('brandHome').addEventListener('click', () => bucSetWorkspaceView('report'));

for (const frame of [workspaceConfig.settings.frame, workspaceConfig.senders.frame, workspaceConfig.reference.frame]) {
    frame.addEventListener('load', () => {
        const doc = frame.contentDocument;
        if (!doc) return;
        const resize = () => { frame.style.height = `${doc.body.scrollHeight + 8}px`; };
        new ResizeObserver(resize).observe(doc.body);
        resize();
    });
}
const requestedWorkspaceView = new URLSearchParams(location.search).get('view');
if (['settings','senders','reference'].includes(requestedWorkspaceView)) bucSetWorkspaceView(requestedWorkspaceView);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.beforeUClickPreferences) bucFullApplyPreferences(bucNormalisePreferences(changes.beforeUClickPreferences.newValue));
});

let workspaceStatusTimer;
window.addEventListener('message', event => {
    if (![workspaceConfig.settings.frame.contentWindow, workspaceConfig.senders.frame.contentWindow, workspaceConfig.reference.frame.contentWindow].includes(event.source) || event.origin !== location.origin || event.data?.type !== 'BUC_SETTINGS_STATUS') return;
    const status = document.getElementById('workspaceStatus');
    status.textContent = String(event.data.message || '').slice(0,300);
    clearTimeout(workspaceStatusTimer);
    if (!event.data.persistent) workspaceStatusTimer = setTimeout(() => { status.textContent = ''; }, 2400);
});
