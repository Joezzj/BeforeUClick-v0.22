// adapters/shared/dom.js
// Provider-neutral DOM helpers for BeforeUClick.
// These helpers do not analyse message content; they only support provider adapters.

/** Returns true when an element has a visible, non-zero layout box. */
function bucAdapterIsVisible(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) !== 0 &&
        rect.width > 0 &&
        rect.height > 0;
}

/** Returns how much of an element's height currently intersects the viewport. */
function bucAdapterViewportOverlap(element) {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const visible = Math.max(0, bottom - top);
    return rect.height > 0 ? visible / rect.height : 0;
}

/** Returns distance between an element centre and the viewport centre. */
function bucAdapterViewportDistance(element) {
    if (!element) return Number.MAX_SAFE_INTEGER;
    const rect = element.getBoundingClientRect();
    return Math.abs((rect.top + rect.height / 2) - (window.innerHeight / 2));
}

/** Extracts unique email-looking addresses from text. */
function bucAdapterEmailsFromText(value) {
    const matches = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map(value => value.toLowerCase()))];
}

/** Returns the first email-looking address from a DOM element's common attributes/text. */
function bucAdapterEmailFromElement(element) {
    if (!element) return "";
    const values = [
        element.getAttribute?.("data-email-address"),
        element.getAttribute?.("email"),
        element.getAttribute?.("data-hovercard-id"),
        element.getAttribute?.("title"),
        element.getAttribute?.("aria-label"),
        element.textContent
    ].filter(Boolean);

    for (const value of values) {
        const addresses = bucAdapterEmailsFromText(value);
        if (addresses[0]) return addresses[0];
    }
    return "";
}

/** Normalises human-readable text extracted from provider DOM. */
function bucAdapterCleanText(value) {
    return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Picks the best visible candidate using viewport overlap and proximity. */
function bucAdapterPickVisibleCandidate(elements, extraScore = () => 0) {
    const candidates = [...new Set((elements || []).filter(bucAdapterIsVisible))]
        .map(element => ({
            element,
            overlap: bucAdapterViewportOverlap(element),
            distance: bucAdapterViewportDistance(element),
            score: bucAdapterViewportOverlap(element) * 100 -
                Math.min(bucAdapterViewportDistance(element) / 40, 25) +
                Number(extraScore(element) || 0)
        }))
        .sort((a, b) => b.score - a.score);

    return candidates[0] || null;
}

/** Finds a short visible text from the first matching selector. */
function bucAdapterFirstText(scope, selectors) {
    for (const selector of selectors || []) {
        const nodes = Array.from((scope || document).querySelectorAll(selector));
        const node = nodes.find(bucAdapterIsVisible) || nodes[0];
        const value = bucAdapterCleanText(node?.innerText || node?.textContent || "");
        if (value) return value;
    }
    return "";
}

/** Finds a first matching visible element from a selector list. */
function bucAdapterFirstElement(scope, selectors) {
    for (const selector of selectors || []) {
        const nodes = Array.from((scope || document).querySelectorAll(selector));
        const node = nodes.find(bucAdapterIsVisible) || nodes[0];
        if (node) return node;
    }
    return null;
}

/** Returns unique emails found in elements matched by a selector list. */
function bucAdapterEmailsFromSelectors(scope, selectors) {
    const values = [];
    for (const selector of selectors || []) {
        (scope || document).querySelectorAll(selector).forEach(element => {
            const direct = bucAdapterEmailFromElement(element);
            if (direct) values.push(direct);
            values.push(...bucAdapterEmailsFromText(element.getAttribute?.("aria-label") || ""));
            values.push(...bucAdapterEmailsFromText(element.getAttribute?.("title") || ""));
            values.push(...bucAdapterEmailsFromText(element.textContent || ""));
        });
    }
    return [...new Set(values)];
}

/** Walks up from a body node to find a reasonably bounded message container. */
function bucAdapterFindBoundedRoot(body, preferredSelectors = []) {
    if (!body) return null;
    for (const selector of preferredSelectors) {
        const root = body.closest(selector);
        if (root) return root;
    }

    let current = body.parentElement;
    let best = body.parentElement;
    for (let i = 0; current && i < 9; i += 1) {
        const rect = current.getBoundingClientRect();
        const textLength = String(current.innerText || current.textContent || "").length;
        if (rect.width > 250 && textLength < 100000) best = current;
        if (current.matches?.("main, [role='main']")) break;
        current = current.parentElement;
    }
    return best || body.parentElement;
}
