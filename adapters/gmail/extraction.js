// adapters/gmail/extraction.js
// Gmail-specific message selection and metadata extraction for BeforeUClick.
// Keep Gmail DOM selectors here so other mail providers can use separate adapters later.
// The code intentionally favours "unavailable" over borrowing data from another message.

let bucLastInteractedMessageRoot = null;

/**
 * Tracks the Gmail message most recently interacted with by the user.
 * This helps resolve multi-message threads without depending only on viewport position.
 */
document.addEventListener("click", event => {
    const target = event.target;
    if (!target?.closest) return;

    const directRoot = target.closest("div.adn, div.gs");
    if (directRoot?.querySelector("div.a3s")) {
        bucLastInteractedMessageRoot = directRoot;
        return;
    }

    const body = target.closest("div.a3s");
    const root = bucFindMessageRoot(body);
    if (root) bucLastInteractedMessageRoot = root;
}, true);

/** Returns true when an element is rendered with a non-zero visible box. */
function bucIsVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0;
}

/** Finds the Gmail message container that owns a rendered message body. */
function bucFindMessageRoot(bodyElement) {
    if (!bodyElement) return null;
    return bodyElement.closest("div.adn") ||
        bodyElement.closest("div.gs") ||
        bodyElement.parentElement;
}

/** Measures how much of a message body is currently visible in the browser viewport. */
function bucViewportOverlapRatio(element) {
    const rect = element.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return rect.height > 0 ? visibleHeight / rect.height : 0;
}

/** Measures the distance between a message body and the vertical centre of the viewport. */
function bucViewportDistance(element) {
    const rect = element.getBoundingClientRect();
    const centre = window.innerHeight / 2;
    const elementCentre = rect.top + rect.height / 2;
    return Math.abs(elementCentre - centre);
}

/**
 * Selects the most likely current Gmail message using recent interaction, focus and viewport evidence.
 * Returns one context object so body/header/metadata extraction stays tied to the same message.
 */
function findCurrentGmailMessage() {
    const bodies = Array.from(document.querySelectorAll("div.a3s"))
        .filter(bucIsVisible);

    if (!bodies.length) return null;

    const candidates = bodies.map(body => {
        const root = bucFindMessageRoot(body);
        if (!root) return null;

        // Do not fall back to a sender elsewhere in the conversation. Wrong data is
        // worse than unavailable data for a phishing-awareness tool.
        const senderElement = root.querySelector(".gD[email]");
        const overlap = bucViewportOverlapRatio(body);
        const distance = bucViewportDistance(body);
        const activeElement = document.activeElement;
        const containsFocus = Boolean(activeElement && root.contains(activeElement));
        const recentInteraction = root === bucLastInteractedMessageRoot;
        const legacyId = root.getAttribute("data-legacy-message-id") || body.getAttribute("data-legacy-message-id") || "";

        const score =
            (recentInteraction ? 180 : 0) +
            (containsFocus ? 100 : 0) +
            (overlap * 100) +
            (senderElement && bucIsVisible(senderElement) ? 30 : 0) -
            Math.min(distance / 40, 20);

        return {
            body,
            root,
            senderElement,
            score,
            selectionEvidence: {
                recentInteraction,
                containsFocus,
                viewportOverlap: Number(overlap.toFixed(2)),
                distanceFromViewportCentre: Math.round(distance),
                legacyMessageId: legacyId
            }
        };
    }).filter(Boolean);

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
}

/** Extracts current-message text while removing common Gmail quoted-history wrappers. */
function extractCurrentMessageText(context) {
    if (!context?.body) return "";

    const clone = context.body.cloneNode(true);

    // Gmail commonly wraps quoted history in these elements. Keep this list
    // deliberately conservative so normal message content is not removed.
    clone.querySelectorAll(".gmail_quote, .gmail_attr, blockquote[type='cite']")
        .forEach(node => node.remove());

    return String(clone.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Extracts unique email-like addresses from a text value. */
function bucEmailsFromText(value) {
    const source = String(value || "");
    const matches = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map(item => item.toLowerCase()))];
}

/** Normalises and de-duplicates a list of email-address values. */
function bucUniqueEmails(values) {
    const result = [];
    const seen = new Set();

    for (const value of values || []) {
        const email = bucParseEmailAddress(value) || String(value || "").trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        result.push(email);
    }

    return result;
}

/** Finds a compact header/detail row surrounding a Gmail metadata label. */
function bucCompactRowForLabel(node) {
    if (!node) return null;
    const tableRow = node.closest("tr");
    if (tableRow) return tableRow;

    let current = node.parentElement;
    let best = node.parentElement;

    for (let i = 0; current && i < 5; i += 1) {
        const text = String(current.innerText || current.textContent || "").trim();
        if (text.length > 0 && text.length <= 700) best = current;
        if (text.length > 700) break;
        current = current.parentElement;
    }

    return best;
}

/** Normalises a Gmail header label for exact label comparisons. */
function bucNormaliseHeaderLabel(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/:$/, "");
}

/** Finds small nodes whose text exactly matches a requested Gmail metadata label. */
function bucFindExactLabelNodes(scope, label) {
    if (!scope) return [];
    const wanted = bucNormaliseHeaderLabel(label);
    const nodes = Array.from(scope.querySelectorAll("td, th, span, div"));

    return nodes.filter(node => {
        const text = String(node.childElementCount ? node.textContent : (node.innerText || node.textContent || "")).trim();
        if (!text || text.length > 30) return false;
        return bucNormaliseHeaderLabel(text) === wanted;
    });
}

/** Reads email addresses from a labelled Gmail header/detail row. */
function bucReadLabelAddresses(scope, label) {
    const addresses = [];

    for (const labelNode of bucFindExactLabelNodes(scope, label)) {
        const row = bucCompactRowForLabel(labelNode);
        if (!row) continue;

        row.querySelectorAll("[email], [data-hovercard-id]").forEach(element => {
            const candidate = element.getAttribute("email") || element.getAttribute("data-hovercard-id") || element.textContent || "";
            const parsed = bucParseEmailAddress(candidate);
            if (parsed) addresses.push(parsed);
        });

        addresses.push(...bucEmailsFromText(row.innerText || row.textContent || ""));
    }

    return bucUniqueEmails(addresses);
}

/** Reads the first non-empty text value associated with one of the supplied metadata labels. */
function bucReadLabelValue(scope, labels) {
    for (const label of labels) {
        for (const labelNode of bucFindExactLabelNodes(scope, label)) {
            const row = bucCompactRowForLabel(labelNode);
            if (!row) continue;

            const text = String(row.innerText || row.textContent || "")
                .replace(/\u00a0/g, " ")
                .trim();
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const cleaned = text.replace(new RegExp(`^\\s*${escaped}\\s*:?\\s*`, "i"), "").trim();
            if (cleaned && bucNormaliseHeaderLabel(cleaned) !== bucNormaliseHeaderLabel(label)) {
                return cleaned;
            }
        }
    }

    return "";
}

/**
 * Reads compact values from Gmail's expanded detail-panel text when Gmail does not
 * expose the label/value as separate DOM nodes. This fallback is intentionally
 * limited to provider detail-panel text by the caller; it must not scan the email body.
 */
function bucReadGmailDetailTextValue(text, labels) {
    const source = String(text || "").replace(/\u00a0/g, " ");

    for (const label of labels || []) {
        const normalised = bucNormaliseHeaderLabel(label);

        if (normalised === "mailed-by" || normalised === "mailed by") {
            const match = source.match(/\bmailed[- ]by\s*:?\s*([a-z0-9.-]+\.[a-z]{2,})(?=\s|$)/i);
            if (match) return match[1].trim();
        }

        if (normalised === "signed-by" || normalised === "signed by") {
            const match = source.match(/\bsigned[- ]by\s*:?\s*([a-z0-9.-]+\.[a-z]{2,})(?=\s|$)/i);
            if (match) return match[1].trim();
        }

        if (normalised === "reply-to" || normalised === "reply to") {
            const match = source.match(/\breply[- ]to\s*:?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
            if (match) return match[1].trim();
        }
    }

    return "";
}

/** Counts known Gmail metadata keywords to help identify small detail panels. */
function bucDetailsKeywordCount(text) {
    const lower = String(text || "").toLowerCase();
    const keywords = ["from:", "to:", "cc:", "bcc:", "reply-to:", "mailed-by:", "signed-by:", "subject:", "date:"];
    return keywords.filter(keyword => lower.includes(keyword)).length;
}

/** Finds local/nearby DOM scopes that may contain metadata for the selected Gmail message. */
function bucFindMetadataScopes(context) {
    const scopes = [];
    const seen = new Set();

    function add(scope) {
        if (!scope || seen.has(scope)) return;
        seen.add(scope);
        scopes.push(scope);
    }

    add(context?.root);

    // Gmail may render the expanded message-details box outside the message root.
    // Find only small visible containers that look like header/detail panels and are
    // associated with this sender, instead of searching the entire email body for labels.
    const sender = bucParseEmailAddress(
        context?.senderElement?.getAttribute("email") || context?.senderElement?.textContent || ""
    );
    const anchorRect = context?.senderElement?.getBoundingClientRect?.() || context?.root?.getBoundingClientRect?.();

    const candidates = Array.from(document.querySelectorAll("[role='dialog'], [role='menu'], table, div"))
        .filter(node => {
            // Cheap text checks first; getComputedStyle/getBoundingClientRect are much
            // more expensive on Gmail's large DOM.
            const text = String(node.textContent || "").trim();
            if (text.length < 30 || text.length > 2500) return false;
            const hits = bucDetailsKeywordCount(text);
            if (hits < 2 || !bucIsVisible(node)) return false;
            if (sender && text.toLowerCase().includes(sender.toLowerCase())) return true;
            if (!anchorRect) return hits >= 3;
            const rect = node.getBoundingClientRect();
            return Math.abs(rect.top - anchorRect.top) < 700 && hits >= 3;
        })
        .sort((a, b) => {
            const aText = String(a.innerText || a.textContent || "");
            const bText = String(b.innerText || b.textContent || "");
            return aText.length - bText.length;
        });

    candidates.slice(0, 3).forEach(add);
    return scopes;
}

/** Finds Gmail's visible message-details control inside the selected message. */
function bucFindDetailsControl(context) {
    if (!context?.root) return null;

    const nodes = Array.from(context.root.querySelectorAll("button, [role='button'], [aria-label], [title], [data-tooltip]"));
    const phrases = ["show details", "message details", "more details"];

    return nodes.find(node => {
        if (!bucIsVisible(node)) return false;
        const values = [
            node.getAttribute("aria-label"),
            node.getAttribute("title"),
            node.getAttribute("data-tooltip"),
            node.textContent
        ].filter(Boolean).join(" ").toLowerCase();
        return phrases.some(phrase => values.includes(phrase));
    }) || null;
}

/** Returns true when expanded metadata appears to already be available for this message. */
function bucDetailsAlreadyVisible(context) {
    return bucFindMetadataScopes(context).some(scope => {
        const text = String(scope.innerText || scope.textContent || "").toLowerCase();
        return text.includes("mailed-by:") || text.includes("signed-by:") || text.includes("reply-to:") || bucFindExactLabelNodes(scope, "cc").length > 0;
    });
}

/** Waits briefly for Gmail to mutate the DOM after opening message details. */
function bucWaitForDomUpdate(target, timeout = 450) {
    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            resolve();
        };

        const observer = new MutationObserver(finish);
        observer.observe(target || document.body, { childList: true, subtree: true, attributes: true });
        setTimeout(finish, timeout);
    });
}

/** Attempts to reveal Gmail's detailed message metadata before extraction. Returns true when clicked. */
async function ensureGmailDetailsVisible(context) {
    if (!context?.root || bucDetailsAlreadyVisible(context)) return false;
    const control = bucFindDetailsControl(context);
    if (!control) return false;

    try {
        control.click();
        await bucWaitForDomUpdate(context.root, 500);
        // Give Gmail a short moment to finish painting the details panel after
        // the first observed DOM mutation.
        await new Promise(resolve => setTimeout(resolve, 120));
        return true;
    } catch (_error) {
        return false;
    }
}

/** Infers whether a Gmail recipient chip belongs to To, CC or BCC from nearby labels. */
function bucInferRecipientType(element) {
    let current = element;

    for (let i = 0; current && i < 5; i += 1) {
        const text = String(current.innerText || current.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        const attrs = [
            current.getAttribute?.("aria-label"),
            current.getAttribute?.("title"),
            current.getAttribute?.("data-tooltip")
        ].filter(Boolean).join(" ").toLowerCase();
        const combined = `${attrs} ${text}`;

        if (/(^|\s)bcc\s*:/.test(combined)) return "bcc";
        if (/(^|\s)cc\s*:/.test(combined)) return "cc";
        if (/(^|\s)to\s*:/.test(combined) || /^to\s/.test(combined)) return "to";
        if (text.length > 700) break;
        current = current.parentElement;
    }

    return "";
}

/** Collects and de-duplicates To/CC/BCC recipients for the selected Gmail message. */
function bucCollectRecipients(context, scopes, sender) {
    const recipients = { to: [], cc: [], bcc: [] };

    for (const scope of scopes) {
        recipients.to.push(...bucReadLabelAddresses(scope, "to"));
        recipients.cc.push(...bucReadLabelAddresses(scope, "cc"));
        recipients.bcc.push(...bucReadLabelAddresses(scope, "bcc"));
    }

    // Fallback for Gmail recipient chips when expanded labels are not available.
    // Unclassified chips are treated as To, never as CC/BCC.
    context.root.querySelectorAll(".g2[email], [email].g2").forEach(element => {
        const email = bucParseEmailAddress(element.getAttribute("email") || element.textContent || "");
        if (!email || email === sender) return;
        const type = bucInferRecipientType(element) || "to";
        recipients[type].push(email);
    });

    recipients.to = bucUniqueEmails(recipients.to).filter(email => email !== sender);
    recipients.cc = bucUniqueEmails(recipients.cc).filter(email => email !== sender && !recipients.to.includes(email));
    recipients.bcc = bucUniqueEmails(recipients.bcc).filter(email => email !== sender && !recipients.to.includes(email) && !recipients.cc.includes(email));

    return recipients;
}

/** Extracts the best visible date value associated with the selected message. */
function bucExtractDate(root, scopes) {
    for (const scope of scopes) {
        const labelled = bucReadLabelValue(scope, ["date"]);
        if (labelled) return labelled;
    }

    const dateSelectors = [".g3[title]", ".g3", "[data-tooltip][title]"];
    for (const selector of dateSelectors) {
        for (const element of root.querySelectorAll(selector)) {
            const candidate = (element.getAttribute("title") || element.textContent || "").trim();
            if (!candidate) continue;
            if (/\d/.test(candidate) && (/[/:,-]/.test(candidate) || /(?:am|pm|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(candidate))) {
                return candidate;
            }
        }
    }

    return "";
}

/** Extracts the visible conversation/message subject using Gmail subject or detail fields. */
function bucExtractSubject(scopes) {
    const visibleSubjects = Array.from(document.querySelectorAll("h2.hP")).filter(bucIsVisible);
    if (visibleSubjects.length) {
        return String(visibleSubjects[0].innerText || visibleSubjects[0].textContent || "").trim();
    }

    for (const scope of scopes) {
        const labelled = bucReadLabelValue(scope, ["subject"]);
        if (labelled) return labelled;
    }

    return "";
}

/** Extracts the sender display name without duplicating the sender email address. */
function bucSenderDisplayName(senderElement, sender) {
    if (!senderElement) return "";
    let value = senderElement.getAttribute("name") || senderElement.textContent || "";
    value = String(value).replace(sender || "", "").replace(/[<>]/g, "").trim();
    return value;
}

/** Builds the normalised metadata object used by the shared analysis/report pipeline. */
function extractGmailMetadata(context) {
    if (!context?.root) {
        return {
            sender: "",
            senderName: "",
            recipients: { to: [], cc: [], bcc: [] },
            subject: "",
            date: "",
            replyTo: "",
            mailedBy: "",
            signedBy: "",
            unavailable: ["sender", "to", "subject", "date", "replyTo", "mailedBy", "signedBy"]
        };
    }

    const { root, senderElement } = context;
    const scopes = bucFindMetadataScopes(context);
    // Prefer Gmail's expanded detail panel over compact message-header text.
    // The detail panel exposes fuller values (for example signed-by and a full date).
    const detailScopes = scopes.filter(scope => scope && scope !== root);
    const orderedScopes = [...detailScopes, root];
    const sender = bucParseEmailAddress(
        senderElement?.getAttribute("email") || senderElement?.textContent || ""
    );
    const recipients = bucCollectRecipients(context, scopes, sender);

    function readAcrossScopes(labels) {
        // Exact DOM-label extraction remains the primary path. Prefer the expanded
        // details panel so a compact/stale message-header value does not win.
        for (const scope of orderedScopes) {
            const value = bucReadLabelValue(scope, labels);
            if (value) return value;
        }

        // Gmail sometimes renders signed-by/mailed-by/reply-to as a compact text row
        // whose label and value are not separate nodes. Fall back only inside the
        // detected detail-panel scopes, never the email body/root.
        for (const scope of detailScopes) {
            const value = bucReadGmailDetailTextValue(scope.innerText || scope.textContent || "", labels);
            if (value) return value;
        }

        return "";
    }

    const replyToRaw = readAcrossScopes(["reply-to", "reply to"]);
    const mailedByRaw = readAcrossScopes(["mailed-by", "mailed by"]);
    const signedByRaw = readAcrossScopes(["signed-by", "signed by"]);

    const metadata = {
        sender,
        senderName: bucSenderDisplayName(senderElement, sender),
        recipients,
        subject: bucExtractSubject(scopes),
        date: bucExtractDate(root, orderedScopes),
        replyTo: bucParseEmailAddress(replyToRaw) || replyToRaw,
        mailedBy: mailedByRaw.replace(/^.*?mailed[- ]by\s*:?\s*/i, "").trim(),
        signedBy: signedByRaw.replace(/^.*?signed[- ]by\s*:?\s*/i, "").trim()
    };

    metadata.unavailable = [];
    if (!metadata.sender) metadata.unavailable.push("sender");
    if (!metadata.recipients.to.length) metadata.unavailable.push("to");
    if (!metadata.subject) metadata.unavailable.push("subject");
    if (!metadata.date) metadata.unavailable.push("date");
    if (!metadata.replyTo) metadata.unavailable.push("replyTo");
    if (!metadata.mailedBy) metadata.unavailable.push("mailedBy");
    if (!metadata.signedBy) metadata.unavailable.push("signedBy");

    return metadata;
}

