// adapters/outlook/extraction.js
// Outlook / Hotmail / Microsoft 365 Web read-message adapter.
//
// Supports current common Outlook Web hosts including outlook.cloud.microsoft.
// Uses broad read-mode semantic selectors and avoids compose editors.

let bucLastInteractedOutlookBody = null;

function bucOutlookLooksLikeCompose(element) {
    if (!element) return false;
    if (element.matches?.("[contenteditable='true'], [role='textbox']")) return true;
    if (element.closest?.("[contenteditable='true'], [role='dialog'] [role='textbox']")) return true;
    return false;
}

function bucOutlookTextLength(element) {
    try {
        return bucAdapterCleanText(element?.innerText || element?.textContent || "").length;
    } catch (_error) {
        return 0;
    }
}

function bucOutlookBodyCandidates() {
    const selectors = [
        "[role='main'] [role='document']",
        "[role='document']",
        "[aria-label='Message body' i]",
        "[aria-label*='message body' i]",
        "[data-testid='message-body']",
        "[data-testid*='message' i][data-testid*='body' i]",
        "[data-app-section='MailReadCompose'] [role='document']",
        "[data-app-section*='MailRead' i] [role='document']",
        "[role='article'] [role='document']",
        "[role='article'] [aria-label*='message' i]",
        "[data-itemid] [role='document']",
        "[data-message-id] [role='document']"
    ];

    const results = [];
    for (const selector of selectors) {
        try {
            document.querySelectorAll(selector).forEach(node => results.push(node));
        } catch (_error) {}
    }

    return [...new Set(results)].filter(element => {
        if (!bucAdapterIsVisible(element)) return false;
        if (bucOutlookLooksLikeCompose(element)) return false;
        const length = bucOutlookTextLength(element);
        return length >= 10 && length <= 150000;
    });
}

document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const body = bucOutlookBodyCandidates().find(candidate =>
        candidate === target || candidate.contains(target)
    );
    if (body) bucLastInteractedOutlookBody = body;
}, true);

function bucOutlookBodyCandidateScore(body) {
    let score = 0;
    if (body === bucLastInteractedOutlookBody) score += 220;
    if (body.closest("[role='main']")) score += 20;
    if (body.closest("[role='article']")) score += 18;
    if (body.closest("[data-itemid], [data-message-id], [data-convid]")) score += 15;
    if (body.querySelector("a[href]")) score += 6;

    const length = bucOutlookTextLength(body);
    if (length >= 40) score += 15;
    if (length >= 250) score += 5;

    if (bucOutlookLooksLikeCompose(body) ||
        body.querySelector("[contenteditable='true'][role='textbox']")) {
        score -= 300;
    }
    return score;
}

function bucFindOutlookMessageRoot(body) {
    if (!body) return null;
    return bucAdapterFindBoundedRoot(body, [
        "[data-itemid]",
        "[data-message-id]",
        "[data-convid]",
        "[data-app-section='MailReadCompose']",
        "[data-app-section*='MailRead' i]",
        "[role='article']"
    ]) || body.parentElement || body;
}


/**
 * Finds Outlook's visible sender line near the selected message body.
 * Current Outlook builds often render `Name <address@example.com>` as ordinary text without
 * a stable data-testid. Search only a bounded ancestor chain and prefer small visible elements
 * immediately above/around the active body so recipient/footer addresses are not mistaken for From.
 */
function bucOutlookFindVisibleSenderElement(body, initialRoot = null) {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const bodyRect = body?.getBoundingClientRect?.();
    let scope = initialRoot || body?.parentElement || null;
    const seen = new Set();
    const candidates = [];

    for (let depth = 0; scope && depth < 8; depth += 1) {
        const nodes = Array.from(scope.querySelectorAll?.([
            "[data-email-address]",
            "[aria-label*='@']",
            "[title*='@']",
            "button",
            "[role='button']",
            "span"
        ].join(", ")) || []);

        for (const node of nodes) {
            if (seen.has(node) || !bucAdapterIsVisible(node)) continue;
            seen.add(node);
            if (body?.contains?.(node)) continue;

            const text = bucAdapterCleanText(
                node.getAttribute?.("data-email-address") ||
                node.getAttribute?.("aria-label") ||
                node.getAttribute?.("title") ||
                node.innerText || node.textContent || ""
            );
            const email = text.match(emailPattern)?.[0] || "";
            if (!email || text.length > 220) continue;

            const rect = node.getBoundingClientRect?.();
            if (!rect) continue;
            const bodyTop = bodyRect?.top ?? rect.top;
            const bodyLeft = bodyRect?.left ?? rect.left;
            const vertical = Math.abs((rect.bottom || rect.top) - bodyTop);
            const horizontal = Math.abs(rect.left - bodyLeft);
            const bracketBonus = /<[^>]*@[^>]*>/.test(text) ? 80 : 0;
            const fromBonus = /\bfrom:?\b/i.test(text) ? 40 : 0;
            const aboveBonus = rect.top <= bodyTop + 80 ? 60 : 0;
            candidates.push({ node, score: bracketBonus + fromBonus + aboveBonus - Math.min(vertical / 3, 180) - Math.min(horizontal / 15, 60) });
        }

        if (candidates.some(item => item.score >= 40)) break;
        scope = scope.parentElement;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.node || null;
}

function findCurrentOutlookMessage() {
    const bodies = bucOutlookBodyCandidates();
    const picked = bucAdapterPickVisibleCandidate(
        bodies,
        body => bucOutlookBodyCandidateScore(body)
    );
    if (!picked) return null;

    const body = picked.element;
    const root = bucFindOutlookMessageRoot(body);

    const senderElement = bucAdapterFirstElement(root, [
        "[data-testid*='sender' i] [data-email-address]",
        "[data-testid*='from' i] [data-email-address]",
        "[data-testid*='sender' i] [title*='@']",
        "[data-email-address]",
        "[aria-label*='from:' i][aria-label*='@']",
        "[title*='@']",
        "button[aria-label*='@']",
        "span[aria-label*='@']"
    ]) || bucOutlookFindVisibleSenderElement(body, root);

    return {
        provider: "outlook",
        providerName: "Outlook",
        body,
        root,
        senderElement,
        selectionEvidence: {
            recentInteraction: body === bucLastInteractedOutlookBody,
            viewportOverlap: Number(picked.overlap.toFixed(2)),
            distanceFromViewportCentre: Math.round(picked.distance),
            candidateCount: bodies.length
        }
    };
}

function extractOutlookMessageText(context) {
    if (!context?.body) return "";
    const clone = context.body.cloneNode(true);
    clone.querySelectorAll([
        "blockquote",
        "[data-testid*='quoted' i]",
        "[class*='quotedText']",
        "[id*='divRplyFwdMsg']",
        ".x_gmail_quote",
        "[aria-label*='previous message' i]",
        "[aria-label*='show trimmed content' i]"
    ].join(", ")).forEach(node => node.remove());

    return bucAdapterCleanText(clone.innerText || clone.textContent || "");
}

async function ensureOutlookDetailsVisible(_context) {
    return false;
}

function extractOutlookMetadata(context) {
    const root = context?.root || context?.body;

    const senderElement = context?.senderElement || bucAdapterFirstElement(root, [
        "[data-testid*='sender' i] [data-email-address]",
        "[data-testid*='from' i] [data-email-address]",
        "[data-email-address]",
        "[aria-label*='from:' i][aria-label*='@']",
        "[title*='@']",
        "button[aria-label*='@']"
    ]) || bucOutlookFindVisibleSenderElement(context?.body, root);

    let sender = bucAdapterEmailFromElement(senderElement);

    if (!sender && root) {
        const fromLabel = bucAdapterFirstElement(root, [
            "[aria-label*='from:' i][aria-label*='@']",
            "[title*='from:' i][title*='@']",
            "[data-testid*='from' i]"
        ]);
        sender = bucAdapterEmailFromElement(fromLabel);
    }

    let senderName = bucAdapterCleanText(
        senderElement?.innerText ||
        senderElement?.textContent ||
        senderElement?.getAttribute?.("aria-label") ||
        ""
    );

    if (sender && senderName.toLowerCase().includes(sender)) {
        senderName = senderName
            .replace(new RegExp(sender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
            .replace(/[<>()[\]]/g, "")
            .replace(/\bfrom:?\b/ig, "")
            .trim();
    }

    let to = bucAdapterEmailsFromSelectors(root, [
        "[data-testid*='recipient' i]",
        "[data-testid*='to' i][aria-label*='@']",
        "[aria-label^='To:' i]",
        "[aria-label*=' To:' i]",
        "[title^='To:' i]"
    ]).filter(email => email !== sender);

    let cc = bucAdapterEmailsFromSelectors(root, [
        "[data-testid*='cc' i][aria-label*='@']",
        "[aria-label^='Cc:' i]",
        "[aria-label*=' Cc:' i]",
        "[title^='Cc:' i]"
    ]).filter(email => email !== sender && !to.includes(email));

    if (to.length > 12) to = [];
    if (cc.length > 12) cc = [];

    const subject = bucAdapterFirstText(document, [
        "[data-testid='message-subject']",
        "[data-testid*='subject' i]",
        "[aria-label*='subject' i]",
        "[role='main'] [role='heading'][aria-level='2']",
        "[role='main'] h1",
        "[role='main'] h2"
    ]);

    const date = bucAdapterFirstText(root, [
        "time",
        "[data-testid*='date' i]",
        "[data-testid*='timestamp' i]",
        "[aria-label*='sent:' i]",
        "[title*='202']",
        "[aria-label*='202']"
    ]);

    const unavailable = [];
    if (!sender) unavailable.push("sender");
    if (!to.length) unavailable.push("to");
    if (!subject) unavailable.push("subject");
    if (!date) unavailable.push("date");
    unavailable.push("replyTo", "mailedBy", "signedBy");

    return {
        sender,
        senderName,
        recipients: { to, cc, bcc: [] },
        subject,
        date,
        replyTo: "",
        mailedBy: "",
        signedBy: "",
        unavailable: [...new Set(unavailable)]
    };
}
