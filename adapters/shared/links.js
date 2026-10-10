// adapters/shared/links.js
// Provider-neutral link extraction, DOM mapping and local redirect unwrapping for BeforeUClick.

let bucLinkElementRegistry = new Map();
let bucCurrentAnalysedLinks = new Map();
let bucLinkCounter = 0;

/** Unwraps a small set of known redirect wrappers without any network request. */
function bucUnwrapKnownRedirect(href) {
    try {
        const parsed = new URL(href);
        const host = parsed.hostname.toLowerCase();

        const matchesDomain = (candidate, domain) => typeof bucHostnameMatchesDomain === "function"
            ? bucHostnameMatchesDomain(candidate, domain)
            : (candidate === domain || candidate.endsWith(`.${domain}`));

        if (matchesDomain(host, "google.com") && parsed.pathname === "/url") {
            const destination = parsed.searchParams.get("q") || parsed.searchParams.get("url");
            if (destination && /^https?:\/\//i.test(destination)) return destination;
        }

        // Outlook Safe Links expose the original URL in a query parameter. Only unwrap the
        // actual Microsoft Safe Links domain family; look-alike hostnames must remain untouched.
        if (matchesDomain(host, "safelinks.protection.outlook.com")) {
            const destination = parsed.searchParams.get("url");
            if (destination && /^https?:\/\//i.test(destination)) return destination;
        }
    } catch (_error) {
        // Keep original URL when parsing fails.
    }
    return href;
}

/** Returns true when an element belongs to provider-specific quoted-history content. */
function bucIsInsideQuotedHistory(element, container, quoteSelectors = []) {
    if (!element || !container) return false;
    for (const selector of quoteSelectors) {
        const quoted = element.closest(selector);
        if (quoted && container.contains(quoted)) return true;
    }
    return false;
}

/** Clears per-analysis link mappings and old persistent highlighting. */
function bucResetLinkRegistry() {
    if (typeof bucClearLinkHighlights === "function") bucClearLinkHighlights();
    bucLinkElementRegistry = new Map();
    bucCurrentAnalysedLinks = new Map();
    bucLinkCounter = 0;
}

/** Classifies the visible form of an email link. */
function bucLinkType(anchor) {
    const images = Array.from(anchor.querySelectorAll("img"));
    const text = String(anchor.innerText || anchor.textContent || "").trim();
    const role = String(anchor.getAttribute("role") || "").toLowerCase();
    const inlineStyle = String(anchor.getAttribute("style") || "").toLowerCase();
    const className = String(anchor.className || "").toLowerCase();
    const containsButtonLikeChild = Boolean(anchor.querySelector("button, [role='button'], table, td"));

    const looksButton = role === "button" ||
        containsButtonLikeChild ||
        /(?:button|btn)/.test(className) ||
        /background(?:-color)?\s*:|padding\s*:|border-radius\s*:/.test(inlineStyle);

    if (images.length && text) return "mixed";
    if (images.length) return "image";
    if (looksButton) return "button";
    return "text";
}

/** Extracts accessible descriptions from linked images. */
function bucLinkAltText(anchor) {
    return Array.from(anchor.querySelectorAll("img"))
        .map(image => image.getAttribute("alt") || image.getAttribute("title") || image.getAttribute("aria-label") || "")
        .map(value => value.trim())
        .filter(Boolean)
        .join("; ");
}

/** Returns visible rectangle area, or zero when not highlightable. */
function bucElementArea(element) {
    if (!element || !document.contains(element)) return 0;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return 0;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    return rect.width * rect.height;
}

/** Chooses the visible object users actually see for text/button/image links. */
function bucFindVisualLinkTarget(anchor, type) {
    if (!anchor) return null;

    if (type === "image" || type === "mixed") {
        const images = Array.from(anchor.querySelectorAll("img"))
            .filter(image => bucElementArea(image) > 0)
            .sort((a, b) => bucElementArea(b) - bucElementArea(a));
        if (images[0]) return images[0];
    }

    const candidates = [
        anchor,
        ...anchor.querySelectorAll("button, [role='button'], table, td, div, span, img")
    ].filter(element => bucElementArea(element) > 0);

    if (!candidates.length) return anchor;
    candidates.sort((a, b) => bucElementArea(b) - bucElementArea(a));

    const largest = candidates[0];
    const anchorArea = bucElementArea(anchor);
    if (type === "button" && largest !== anchor && bucElementArea(largest) >= Math.max(anchorArea, 1)) return largest;
    return anchorArea >= 16 ? anchor : largest;
}

/** Registers an anchor/visual-target pair for exact highlighting and click guarding. */
function bucRegisterAnchor(anchor, type) {
    const id = `buc-link-${Date.now()}-${++bucLinkCounter}`;
    const visualTarget = bucFindVisualLinkTarget(anchor, type) || anchor;
    bucLinkElementRegistry.set(id, { anchor, visualTarget });
    return id;
}

/** Builds a readable display label for a linked element. */
function bucBuildLinkDisplayText(anchor, type, altText) {
    const text = String(anchor.innerText || anchor.textContent || "").replace(/\s+/g, " ").trim();
    if (text) return text;
    if (altText) return altText;
    if (type === "image") return "Linked image";
    if (type === "button") return "Linked button";
    if (type === "mixed") return "Linked image and text";
    return "Link";
}

/** Returns message text while preserving DOM boundaries that stop one visible word joining another. */
function bucTextWithDomBoundaries(root) {
    if (!root) return "";

    // Minimal DOM doubles and unusual detached nodes may not expose childNodes.
    // Fall back to their existing text representation rather than losing genuine plain URLs.
    if (root.childNodes == null) {
        return String(root.innerText || root.textContent || "")
            .replace(/\u00a0/g, " ");
    }

    const boundaryTags = new Set([
        "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
        "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
        "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
        "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"
    ]);
    const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

    function read(node) {
        if (!node) return "";
        if (node.nodeType === 3) return String(node.nodeValue || "");
        if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return "";

        const tag = String(node.tagName || "").toUpperCase();
        if (ignoredTags.has(tag)) return "";
        if (tag === "BR") return "\n";

        let text = "";
        for (const child of Array.from(node.childNodes || [])) text += read(child);

        return boundaryTags.has(tag) ? `\n${text}\n` : text;
    }

    return read(root)
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
}

/** Clones message text and removes provider-specific quoted history before plain-URL scanning. */
function bucCurrentTextForPlainUrls(container, quoteSelectors = []) {
    if (!container) return "";
    const clone = container.cloneNode(true);
    for (const selector of quoteSelectors) {
        clone.querySelectorAll(selector).forEach(node => node.remove());
    }

    // Clickable links have already been recorded from the original DOM above.
    // Remove them ONLY from this detached text clone so visible anchor text is not
    // treated as a second plain-text destination. This also preserves display-vs-actual
    // link analysis on the original anchor without creating a duplicate visible URL.
    clone.querySelectorAll("a[href]").forEach(anchor => {
        anchor.replaceWith(document.createTextNode(" "));
    });

    // Do not rely on textContent: adjacent Gmail block elements can be joined with no
    // whitespace, turning "https://example.test/" + "This" into
    // "https://example.test/This". Preserve block/line boundaries instead.
    return bucTextWithDomBoundaries(clone);
}

/**
 * Builds a stable comparison key so equivalent root URLs are counted once. URL()
 * normalises a bare origin such as https://example.com to https://example.com/.
 * Genuine paths, query strings and hashes remain distinct.
 */
function bucLinkDestinationKey(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
        const parsed = new URL(raw);
        if (!/^https?:$/i.test(parsed.protocol)) return raw.toLowerCase();
        parsed.protocol = parsed.protocol.toLowerCase();
        parsed.hostname = parsed.hostname.toLowerCase();
        return parsed.href;
    } catch (_error) {
        return raw.toLowerCase();
    }
}

/** Extracts clickable and plain-text HTTP(S) links from any supported provider body. */
function bucExtractLinksFromContainer(container, quoteSelectors = []) {
    const links = [];
    const anchorDestinations = new Set();
    const plainTextSeen = new Set();

    bucResetLinkRegistry();
    if (!container) return links;

    container.querySelectorAll("a[href]").forEach(anchor => {
        if (bucIsInsideQuotedHistory(anchor, container, quoteSelectors)) return;

        const raw = String(anchor.href || anchor.getAttribute("href") || "").trim();
        if (!/^https?:\/\//i.test(raw)) return;

        const destination = bucUnwrapKnownRedirect(raw);
        const type = bucLinkType(anchor);
        const altText = bucLinkAltText(anchor);
        const elementId = bucRegisterAnchor(anchor, type);
        const text = bucBuildLinkDisplayText(anchor, type, altText);

        anchorDestinations.add(bucLinkDestinationKey(destination));
        links.push({
            id: elementId,
            text,
            altText,
            url: destination,
            originalUrl: raw !== destination ? raw : "",
            type,
            source: "anchor"
        });
    });

    const text = bucCurrentTextForPlainUrls(container, quoteSelectors);
    const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
    const matches = text.match(urlPattern) || [];

    matches.forEach(match => {
        const destination = match.replace(/[.,;:!?]+$/, "");
        const key = bucLinkDestinationKey(destination);
        if (anchorDestinations.has(key) || plainTextSeen.has(key)) return;
        plainTextSeen.add(key);
        links.push({
            id: "",
            text: destination,
            altText: "",
            url: destination,
            type: "plain-text",
            source: "plain-text"
        });
    });

    return links;
}

/** Stores latest analysed link records against exact DOM mappings. */
function bucSetAnalysedLinkResults(links) {
    bucCurrentAnalysedLinks = new Map(
        (links || []).filter(link => link.id).map(link => [link.id, link])
    );
}

/** Returns a link registry entry by internal ID. */
function bucGetLinkRegistryEntry(linkId) {
    return bucLinkElementRegistry.get(linkId) || null;
}

/** Finds the analysed link record belonging to an exact anchor. */
function bucFindAnalysedLinkForAnchor(anchor) {
    if (!anchor) return null;
    for (const [linkId, entry] of bucLinkElementRegistry.entries()) {
        if (entry?.anchor === anchor) {
            const link = bucCurrentAnalysedLinks.get(linkId);
            return link ? { linkId, link, entry } : null;
        }
    }
    return null;
}
