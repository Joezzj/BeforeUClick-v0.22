// adapters/yahoo/extraction.js
// Yahoo Mail Web read-message adapter.
//
// Uses semantic/test/accessibility attributes where possible.
// Avoids compose editors and prefers unavailable metadata over cross-message guessing.

let bucLastInteractedYahooBody = null;

/** True when a candidate looks like a compose editor rather than a message being read. */
function bucYahooLooksLikeCompose(element) {
    if (!element) return false;

    if (element.matches?.("[contenteditable='true'], [role='textbox']")) return true;
    if (element.closest?.("[contenteditable='true'], [role='dialog'] [role='textbox']")) return true;

    return Boolean(
        element.querySelector?.("[contenteditable='true'][role='textbox'], [contenteditable='true']")
    );
}

/** Returns bounded readable text length without failing during Yahoo DOM transitions. */
function bucYahooTextLength(element) {
    try {
        return bucAdapterCleanText(element?.innerText || element?.textContent || "").length;
    } catch (_error) {
        return 0;
    }
}

/** Returns plausible visible Yahoo read-message body candidates. */
function bucYahooBodyCandidates() {
    const selectors = [
        "[data-test-id='message-body']",
        "[data-test-id='message-view-body']",
        "[data-test-id*='message-body' i]",
        "[data-test-id*='message' i][data-test-id*='body' i]",
        "[aria-label='Message body' i]",
        "[aria-label*='message body' i]",
        "[role='article'] [role='document']",
        "[data-test-id='message-card'] [role='document']",
        "[data-test-id*='message-view' i] [role='document']",
        "[role='main'] [role='document']"
    ];

    const bodies = [];
    for (const selector of selectors) {
        try {
            document.querySelectorAll(selector).forEach(node => bodies.push(node));
        } catch (_error) {
            // Continue with remaining selector fallbacks.
        }
    }

    return [...new Set(bodies)].filter(element => {
        if (!bucAdapterIsVisible(element)) return false;
        if (bucYahooLooksLikeCompose(element)) return false;

        const length = bucYahooTextLength(element);
        return length >= 10 && length <= 150000;
    });
}

/** Track the most recently interacted Yahoo read-message body. */
document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const body = bucYahooBodyCandidates().find(candidate =>
        candidate === target || candidate.contains(target)
    );

    if (body) bucLastInteractedYahooBody = body;
}, true);

/** Scores a Yahoo body candidate for current-message selection. */
function bucYahooBodyCandidateScore(body) {
    let score = 0;

    if (body === bucLastInteractedYahooBody) score += 220;
    if (body.closest("[role='main']")) score += 20;
    if (body.closest("[role='article']")) score += 18;
    if (body.closest("[data-test-id='message-card'], [data-test-id*='message-view' i]")) score += 18;
    if (body.querySelector("a[href]")) score += 6;

    const length = bucYahooTextLength(body);
    if (length >= 40) score += 15;
    if (length >= 250) score += 5;

    if (bucYahooLooksLikeCompose(body)) score -= 300;

    return score;
}

/** Finds the smallest useful Yahoo message root around a selected body. */
function bucFindYahooMessageRoot(body) {
    if (!body) return null;

    return bucAdapterFindBoundedRoot(body, [
        "[data-test-id='message-card']",
        "[data-test-id*='message-view' i]",
        "[role='article']",
        "[data-test-id='message-group']"
    ]) || body.parentElement || body;
}

/** Finds the best visible Yahoo message being read. */
function findCurrentYahooMessage() {
    const bodies = bucYahooBodyCandidates();
    const picked = bucAdapterPickVisibleCandidate(
        bodies,
        body => bucYahooBodyCandidateScore(body)
    );

    if (!picked) return null;

    const body = picked.element;
    const root = bucFindYahooMessageRoot(body);

    const senderElement = bucAdapterFirstElement(root, [
        "[data-test-id='message-from']",
        "[data-test-id*='message-from' i]",
        "[data-test-id*='sender' i]",
        "[data-test-id*='from' i][data-email-address]",
        "[data-email-address]",
        "[aria-label*='from:' i][aria-label*='@']",
        "[title*='@']",
        "button[aria-label*='@']",
        "span[aria-label*='@']"
    ]);

    return {
        provider: "yahoo",
        providerName: "Yahoo Mail",
        body,
        root,
        senderElement,
        selectionEvidence: {
            recentInteraction: body === bucLastInteractedYahooBody,
            viewportOverlap: Number(picked.overlap.toFixed(2)),
            distanceFromViewportCentre: Math.round(picked.distance),
            candidateCount: bodies.length
        }
    };
}

/** Removes common quoted/replied sections from current-message body text. */
function extractYahooMessageText(context) {
    if (!context?.body) return "";

    const clone = context.body.cloneNode(true);
    clone.querySelectorAll([
        "blockquote",
        "[data-test-id*='quoted' i]",
        "[data-test-id='message-original']",
        "[class*='quoted']",
        "[aria-label*='previous message' i]",
        "[aria-label*='show trimmed content' i]"
    ].join(", ")).forEach(node => node.remove());

    return bucAdapterCleanText(clone.innerText || clone.textContent || "");
}

/**
 * Yahoo visible-detail expansion remains conservative; richer raw-header acquisition is handled separately by adapters/yahoo/headers.js.
 * Missing values remain unavailable rather than triggering provider UI controls unexpectedly.
 */
async function ensureYahooDetailsVisible(_context) {
    return false;
}

/** Tries a selector list in the selected message root first, then document as a fallback. */
function bucYahooTextRootThenDocument(root, selectors) {
    const local = bucAdapterFirstText(root, selectors);
    if (local) return local;
    return bucAdapterFirstText(document, selectors);
}

/** Reads Yahoo metadata conservatively from the selected message root. */
function extractYahooMetadata(context) {
    const root = context?.root || context?.body;

    const senderElement = context?.senderElement || bucAdapterFirstElement(root, [
        "[data-test-id='message-from']",
        "[data-test-id*='message-from' i]",
        "[data-test-id*='sender' i]",
        "[data-email-address]",
        "[aria-label*='from:' i][aria-label*='@']",
        "[title*='@']"
    ]);

    let sender = bucAdapterEmailFromElement(senderElement);

    if (!sender && root) {
        const fromElement = bucAdapterFirstElement(root, [
            "[aria-label*='from:' i][aria-label*='@']",
            "[title*='from:' i][title*='@']",
            "[data-test-id*='from' i]"
        ]);
        sender = bucAdapterEmailFromElement(fromElement);
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
        "[data-test-id='message-to']",
        "[data-test-id*='message-to' i]",
        "[data-test-id*='recipient-to' i]",
        "[aria-label^='To:' i]",
        "[aria-label*=' To:' i]",
        "[title^='To:' i]"
    ]).filter(email => email !== sender);

    let cc = bucAdapterEmailsFromSelectors(root, [
        "[data-test-id='message-cc']",
        "[data-test-id*='message-cc' i]",
        "[data-test-id*='recipient-cc' i]",
        "[aria-label^='Cc:' i]",
        "[aria-label*=' Cc:' i]",
        "[title^='Cc:' i]"
    ]).filter(email => email !== sender && !to.includes(email));

    let bcc = bucAdapterEmailsFromSelectors(root, [
        "[data-test-id='message-bcc']",
        "[data-test-id*='message-bcc' i]",
        "[data-test-id*='recipient-bcc' i]",
        "[aria-label^='Bcc:' i]",
        "[aria-label*=' Bcc:' i]",
        "[title^='Bcc:' i]"
    ]).filter(email => email !== sender && !to.includes(email) && !cc.includes(email));

    // A header should not contain a large body-like address collection.
    if (to.length > 12) to = [];
    if (cc.length > 12) cc = [];
    if (bcc.length > 12) bcc = [];

    const subject = bucYahooTextRootThenDocument(root, [
        "[data-test-id='message-subject']",
        "[data-test-id*='message-subject' i]",
        "[data-test-id*='subject' i]",
        "[aria-label*='subject' i]",
        "[role='heading'][aria-level='2']",
        "h1",
        "h2"
    ]);

    const date = bucYahooTextRootThenDocument(root, [
        "[data-test-id='message-date']",
        "[data-test-id*='message-date' i]",
        "[data-test-id*='date' i]",
        "[data-test-id*='timestamp' i]",
        "time",
        "[aria-label*='sent:' i]",
        "[title*='202']",
        "[aria-label*='202']"
    ]);

    const unavailable = [];
    if (!sender) unavailable.push("sender");
    if (!to.length) unavailable.push("to");
    if (!subject) unavailable.push("subject");
    if (!date) unavailable.push("date");

    // Not reliably available in Yahoo's standard rendered read view.
    unavailable.push("replyTo", "mailedBy", "signedBy");

    return {
        sender,
        senderName,
        recipients: { to, cc, bcc },
        subject,
        date,
        replyTo: "",
        mailedBy: "",
        signedBy: "",
        unavailable: [...new Set(unavailable)]
    };
}
