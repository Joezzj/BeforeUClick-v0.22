// adapters/outlook/headers.js
// Outlook Web header acquisition for BeforeUClick v0.22.17.
// Uses the current Outlook Web accessibility structure observed in real provider testing:
// More items -> View -> View message details -> role=dialog "Message details".
// Generated Fluent UI ids/classes are deliberately avoided wherever possible.

function bucOutlookWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Outlook's unpinned More -> View -> View message details path is deliberately tuned for a
// roughly 2–3 second cold-check experience. We do not add an artificial minimum delay: every
// DOM wait still resolves immediately when Outlook renders the next stage. The 3 s ceiling simply
// prevents aggressive sub-second timeouts from outrunning Fluent UI while also avoiding the old
// ~5 s "waiting" feeling.
const BUC_OUTLOOK_UNPINNED_TARGET_MS = 2500;
const BUC_OUTLOOK_UNPINNED_BUDGET_MS = 3300;

function bucOutlookNow() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
}

function bucOutlookBudgetTimeout(deadlineAt, preferredMs) {
    if (!deadlineAt) return Math.max(0, preferredMs);
    const remaining = Math.max(0, Math.round(deadlineAt - bucOutlookNow()));
    return Math.min(Math.max(0, preferredMs), remaining);
}

/**
 * Waits for a DOM condition without paying a fixed delay when Outlook renders quickly.
 * MutationObserver supplies the fast path; a short interval is kept as a compatibility fallback.
 */
function bucOutlookWaitFor(getter, timeout = 700, interval = 25) {
    return new Promise(resolve => {
        let finished = false;
        let observer = null;
        let timer = null;
        let deadline = null;

        const finish = value => {
            if (finished) return;
            finished = true;
            try { observer?.disconnect(); } catch (_error) {}
            if (timer) clearInterval(timer);
            if (deadline) clearTimeout(deadline);
            resolve(value || null);
        };

        const check = () => {
            let value = null;
            try { value = getter?.(); } catch (_error) {}
            if (value) finish(value);
        };

        check();
        if (finished) return;

        try {
            observer = new MutationObserver(check);
            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["aria-expanded", "aria-hidden", "class", "style"]
            });
        } catch (_error) {}

        timer = setInterval(check, Math.max(15, interval));
        deadline = setTimeout(() => finish(null), Math.max(50, timeout));
    });
}

function bucOutlookActionText(element) {
    return String(
        element?.getAttribute?.("aria-label") ||
        element?.innerText ||
        element?.textContent ||
        element?.getAttribute?.("title") ||
        ""
    ).replace(/\s+/g, " ").trim().toLowerCase();
}

function bucOutlookVisibleActionElements(scope = document) {
    return Array.from((scope || document).querySelectorAll?.(
        "button, [role='button'], [role='menuitem'], [role='menuitemcheckbox'], [role='option']"
    ) || []).filter(bucAdapterIsVisible);
}

function bucOutlookFindAnyTextAction(texts, { exact = false, scope = document, anchor = null } = {}) {
    const wanted = (texts || [])
        .map(value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase())
        .filter(Boolean);
    const matches = bucOutlookVisibleActionElements(scope).filter(element => {
        const text = bucOutlookActionText(element);
        return wanted.some(value => exact ? text === value : text.includes(value));
    });
    if (!matches.length) return null;
    if (matches.length === 1 || !anchor) return matches[0];

    const anchorRect = anchor.getBoundingClientRect?.();
    if (!anchorRect) return matches[0];
    return matches
        .map(element => {
            const rect = element.getBoundingClientRect();
            const dx = (rect.left + rect.width / 2) - (anchorRect.left + anchorRect.width / 2);
            const dy = (rect.top + rect.height / 2) - (anchorRect.top + anchorRect.height / 2);
            return { element, distance: Math.sqrt(dx * dx + dy * dy) };
        })
        .sort((a, b) => a.distance - b.distance)[0].element;
}

function bucOutlookMessageDetailsDialog() {
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'][aria-modal='true'], [role='dialog']"))
        .filter(bucAdapterIsVisible);

    return dialogs.find(dialog => {
        const labelledBy = dialog.getAttribute?.("aria-labelledby") || "";
        const labelledNode = labelledBy ? document.getElementById(labelledBy) : null;
        const titleText = String(labelledNode?.textContent || "").replace(/\s+/g, " ").trim();
        if (/^message details$/i.test(titleText)) return true;

        return Array.from(dialog.querySelectorAll("h1,h2,h3,[role='heading']")).some(node =>
            /^message details$/i.test(String(node.textContent || "").replace(/\s+/g, " ").trim())
        );
    }) || null;
}

function bucOutlookNormaliseRenderedHeaderText(value) {
    return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ")
        // The Message details surface contains only header text. Outlook/Fluent may insert
        // presentational blank lines, which are not RFC header/body separators here.
        .replace(/\n[ \t]*\n+/g, "\n")
        .trim();
}

/**
 * Reconstructs RFC-style field lines from Outlook's rendered header text. The Message details
 * dialog contains headers only, but normal CSS rendering can remove the leading whitespace that
 * RFC folding uses to mark continuation lines. Treat any non-field line after the first header as
 * a continuation until the next `Name:` field instead of requiring indentation to survive the DOM.
 */
function bucOutlookReconstructHeaderText(value) {
    const lines = bucOutlookNormaliseRenderedHeaderText(value).split("\n");
    const genericHeader = /^[A-Za-z0-9][A-Za-z0-9-]*:\s*/;
    const reconstructed = [];
    let started = false;

    for (const rawLine of lines) {
        const line = String(rawLine || "").trimEnd();
        if (!line.trim()) continue;
        if (genericHeader.test(line.trimStart())) {
            reconstructed.push(line.trimStart());
            started = true;
        } else if (started && reconstructed.length) {
            reconstructed[reconstructed.length - 1] += ` ${line.trim()}`;
        }
    }
    return reconstructed.join("\n");
}

function bucOutlookMessageDetailsText(dialog = bucOutlookMessageDetailsDialog()) {
    if (!dialog) return "";

    const preferred = dialog.querySelector([
        ".fui-DialogContent.allowTextSelection",
        ".fui-DialogContent",
        ".allowTextSelection"
    ].join(", "));
    if (preferred) {
        const value = bucOutlookNormaliseRenderedHeaderText(
            preferred.innerText || preferred.textContent || preferred.value || ""
        );
        if (value) return value;
    }

    // Narrow fallback within the confirmed Message details dialog only.
    const candidates = Array.from(dialog.querySelectorAll("div, pre, textarea, [role='textbox']"));
    const richest = candidates
        .map(node => ({
            node,
            text: bucOutlookNormaliseRenderedHeaderText(node.value || node.innerText || node.textContent || "")
        }))
        .filter(item => /(?:^|\n)Received:\s/i.test(item.text) || /(?:^|\n)Authentication-Results:\s/i.test(item.text))
        .sort((a, b) => b.text.length - a.text.length)[0];
    return richest?.text || "";
}

function bucOutlookFindRawHeaderText() {
    // Prefer the exact current Outlook Message details surface learned from real DOM inspection.
    const dialog = bucOutlookMessageDetailsDialog();
    if (dialog) {
        const rendered = bucOutlookMessageDetailsText(dialog);
        const reconstructed = bucOutlookReconstructHeaderText(rendered);
        const block = bucExtractRawHeaderBlock(reconstructed);
        if (bucLooksLikeRawHeaderText(block)) return block;
    }

    // Compatibility fallback for Outlook builds with a different dialog wrapper.
    const modalSurfaces = Array.from(document.querySelectorAll([
        "[role='dialog']",
        "[aria-modal='true']"
    ].join(", "))).filter(bucAdapterIsVisible);

    const nodes = [];
    for (const surface of modalSurfaces) {
        nodes.push(surface);
        surface.querySelectorAll?.("pre, textarea, [role='textbox'], [contenteditable='false'], .fui-DialogContent, .allowTextSelection, div")
            .forEach(node => nodes.push(node));
    }

    document.querySelectorAll("pre, textarea").forEach(node => nodes.push(node));
    return bucFindRawHeaderTextInNodes([...new Set(nodes)]);
}

function bucOutlookMoreItemsCandidates(scope) {
    return Array.from(scope?.querySelectorAll?.([
        "button[aria-label='More items' i][aria-haspopup='menu']",
        "[role='button'][aria-label='More items' i][aria-haspopup='menu']",
        "button[aria-label*='More items' i]",
        "[role='button'][aria-label*='More items' i]",
        // Older Outlook wording retained as fallback.
        "button[aria-label*='More actions' i]",
        "[role='button'][aria-label*='More actions' i]",
        "button[title*='More actions' i]",
        "[role='button'][title*='More actions' i]"
    ].join(", ")) || []).filter(bucAdapterIsVisible);
}

function bucOutlookPickMoreItems(candidates, context) {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const target = context?.root || context?.body;
    const targetRect = target?.getBoundingClientRect?.();
    if (!targetRect) return candidates[0];

    return candidates
        .map(element => {
            const rect = element.getBoundingClientRect();
            const centreY = rect.top + rect.height / 2;
            const bodyTop = targetRect.top;
            const bodyBottom = targetRect.bottom;
            const verticalDistance = centreY < bodyTop
                ? bodyTop - centreY
                : centreY > bodyBottom
                    ? centreY - bodyBottom
                    : 0;
            const exactLabel = String(element.getAttribute?.("aria-label") || "").trim().toLowerCase();
            const exactLabelBonus = exactLabel === "more items" ? 120 : exactLabel === "more actions" ? 60 : 0;
            const sameContainerBonus = target?.contains?.(element) ? 220 : 0;
            return {
                element,
                score: sameContainerBonus + exactLabelBonus - Math.min(verticalDistance / 3, 220)
            };
        })
        .sort((a, b) => b.score - a.score)[0].element;
}

function bucOutlookMoreItemsButton(context) {
    // The message toolbar may sit outside role=document, so walk outward from the selected message.
    let scope = context?.root || context?.body || null;
    for (let depth = 0; scope && depth < 10; depth += 1) {
        const candidates = bucOutlookMoreItemsCandidates(scope);
        if (candidates.length) return bucOutlookPickMoreItems(candidates, context);
        scope = scope.parentElement;
    }
    return bucOutlookPickMoreItems(bucOutlookMoreItemsCandidates(document), context);
}

function bucOutlookFindVisibleMenuAction(texts, options = {}) {
    const menuScopes = Array.from(document.querySelectorAll("[role='menu'], [role='listbox']"))
        .filter(bucAdapterIsVisible);
    for (const menu of menuScopes.reverse()) {
        const match = bucOutlookFindAnyTextAction(texts, { ...options, scope: menu });
        if (match) return match;
    }

    // Fluent UI flyouts are portal-rendered and some intermediate containers use role=presentation.
    const portalScopes = Array.from(document.querySelectorAll("[data-portal-node='true'], .fui-MenuPopover, [role='presentation']"))
        .filter(bucAdapterIsVisible);
    for (const portal of portalScopes.reverse()) {
        const match = bucOutlookFindAnyTextAction(texts, { ...options, scope: portal });
        if (match) return match;
    }
    return bucOutlookFindAnyTextAction(texts, options);
}

function bucOutlookDispatchPointerLikeEvent(element, type) {
    if (!element) return;
    const point = bucOutlookEventPoint(element);
    const common = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: point.clientX,
        clientY: point.clientY,
        screenX: point.clientX,
        screenY: point.clientY,
        button: 0,
        buttons: 0
    };
    try {
        if (typeof PointerEvent === "function" && type.startsWith("pointer")) {
            element.dispatchEvent(new PointerEvent(type, {
                ...common,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true
            }));
            return;
        }
    } catch (_error) {}

    try {
        element.dispatchEvent(new MouseEvent(type.replace(/^pointer/, "mouse"), common));
    } catch (_error) {}
}


function bucOutlookEventPoint(element) {
    const rect = element?.getBoundingClientRect?.();
    return {
        clientX: rect ? Math.max(rect.left + Math.min(rect.width / 2, 18), rect.left + 2) : 1,
        clientY: rect ? Math.max(rect.top + rect.height / 2, rect.top + 2) : 1
    };
}

function bucOutlookDispatchActivationSequence(element) {
    if (!element) return;
    const point = bucOutlookEventPoint(element);
    const common = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: point.clientX,
        clientY: point.clientY
    };

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        try {
            if (type.startsWith("pointer") && typeof PointerEvent === "function") {
                element.dispatchEvent(new PointerEvent(type, {
                    ...common,
                    pointerType: "mouse",
                    isPrimary: true,
                    buttons: type.endsWith("up") ? 0 : 1
                }));
            } else {
                element.dispatchEvent(new MouseEvent(type, {
                    ...common,
                    buttons: type === "mouseup" || type === "click" ? 0 : 1
                }));
            }
        } catch (_error) {}
    }
}


function bucOutlookDormantMessageDetailsAction(context) {
    const wanted = new Set([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ]);

    // Fluent UI's Overflow component can keep configured toolbar commands in the DOM even when
    // they are not currently visible. Real Outlook inspection showed View message details as a
    // data-overflow-item with a stable aria-label. Clicking that dormant command is much faster
    // than opening the nested More -> View flyout and does not change the user's Outlook settings.
    const candidates = Array.from(document.querySelectorAll([
        "[data-overflow-item][aria-label]",
        "[data-overflow-item][title]",
        "[aria-label='View message details' i]",
        "[title='View message details' i]"
    ].join(", "))).filter(element => {
        const text = bucOutlookActionText(element);
        if (!wanted.has(text)) return false;
        if (element.disabled || element.getAttribute?.("aria-disabled") === "true") return false;
        // Never hijack an item from an already-open menu/dialog; those are handled separately.
        if (element.closest?.("[role='menu'], [role='listbox'], .fui-MenuPopover, [role='dialog'], [aria-modal='true']")) {
            return false;
        }
        // Visible commands are handled by the pinned fast path. This helper is specifically for
        // dormant/overflow commands that Fluent keeps mounted but visually hidden.
        return !bucAdapterIsVisible(element);
    });

    if (!candidates.length) return null;
    const overflow = candidates.find(element => element.hasAttribute?.("data-overflow-item"));
    return overflow || candidates[0];
}

function bucOutlookPinnedMessageDetailsAction(context) {
    const wanted = new Set([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ]);

    const candidates = bucOutlookVisibleActionElements(document).filter(element => {
        const text = bucOutlookActionText(element);
        if (!wanted.has(text)) return false;

        // A pinned reading-pane action is a normal visible toolbar/button action. Do not mistake
        // a command from an already-open Fluent menu or modal for the pinned fast path.
        if (element.closest?.("[role='menu'], [role='listbox'], .fui-MenuPopover, [role='dialog'], [aria-modal='true']")) {
            return false;
        }
        return true;
    });

    if (!candidates.length) return null;

    const target = context?.root || context?.body || null;
    const targetRect = target?.getBoundingClientRect?.();
    if (!targetRect || candidates.length === 1) return candidates[0];

    // Prefer the action spatially closest to the active message. This avoids selecting a control
    // belonging to another message in conversation/thread views.
    return candidates
        .map(element => {
            const rect = element.getBoundingClientRect();
            const dx = (rect.left + rect.width / 2) - (targetRect.left + targetRect.width / 2);
            const dy = (rect.top + rect.height / 2) - targetRect.top;
            return { element, distance: Math.sqrt(dx * dx + dy * dy) };
        })
        .sort((a, b) => a.distance - b.distance)[0].element;
}

async function bucOutlookOpenMessageDetailsCommand(details, diagnostics = [], route = "menu", dialogTimeout = 1100, deadlineAt = null) {
    if (!details) return { rawHeaders: "", openedByPrototype: false, diagnostics, route };

    try { details.click(); } catch (_error) {
        bucOutlookDispatchActivationSequence(details);
    }

    // Outlook normally creates the Fluent dialog almost immediately. Wait on the DOM itself
    // rather than sleeping in 100 ms chunks for several seconds.
    const boundedDialogTimeout = bucOutlookBudgetTimeout(deadlineAt, dialogTimeout);
    if (deadlineAt && boundedDialogTimeout <= 0) {
        diagnostics.push("cold-path-budget-exhausted-before-dialog");
        return { rawHeaders: "", openedByPrototype: true, diagnostics, route };
    }
    const dialog = await bucOutlookWaitFor(() => bucOutlookMessageDetailsDialog(), boundedDialogTimeout || dialogTimeout, 25);
    if (!dialog) {
        diagnostics.push("dialog-not-found");
        return { rawHeaders: "", openedByPrototype: true, diagnostics, route };
    }
    diagnostics.push("dialog-opened");

    const headerTextPreferred = deadlineAt ? 450 : 650;
    const headerTextTimeout = bucOutlookBudgetTimeout(deadlineAt, headerTextPreferred);
    if (deadlineAt && headerTextTimeout <= 0) {
        diagnostics.push("cold-path-budget-exhausted-before-header-text");
        return { rawHeaders: "", openedByPrototype: true, diagnostics, route };
    }
    const rawHeaders = await bucOutlookWaitFor(() => {
        const rendered = bucOutlookMessageDetailsText(dialog);
        if (rendered && !diagnostics.includes("header-text-found")) diagnostics.push("header-text-found");
        const reconstructed = bucOutlookReconstructHeaderText(rendered);
        const block = bucExtractRawHeaderBlock(reconstructed);
        return bucLooksLikeRawHeaderText(block) ? block : null;
    }, headerTextTimeout || headerTextPreferred, 25);

    if (rawHeaders) {
        diagnostics.push("header-parse-success");
        return {
            rawHeaders,
            openedByPrototype: true,
            diagnostics: [...new Set(diagnostics)],
            route
        };
    }

    diagnostics.push("header-parse-failed");
    return {
        rawHeaders: "",
        openedByPrototype: true,
        diagnostics: [...new Set(diagnostics)],
        route
    };
}
function bucOutlookMountedMessageDetailsCommands() {
    const wanted = new Set([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ]);
    const candidates = new Set();

    document.querySelectorAll("[role='menuitem'], [role='button'], .fui-MenuItem__content").forEach(node => {
        const action = node.matches?.("[role='menuitem'], [role='button']")
            ? node
            : node.closest?.("[role='menuitem'], [role='button']");
        if (!action) return;
        const text = bucOutlookActionText(action);
        if (wanted.has(text)) candidates.add(action);
    });
    return [...candidates];
}

function bucOutlookMessageDetailsCommand(anchor = null) {
    // Current Outlook renders the View submenu in a second Fluent portal. Search the entire
    // document semantically first instead of assuming it is a descendant of the View row.
    const mounted = bucOutlookMountedMessageDetailsCommands().filter(bucAdapterIsVisible);
    if (mounted.length === 1 || (mounted.length && !anchor)) return mounted[0];
    if (mounted.length && anchor) {
        const anchorRect = anchor.getBoundingClientRect?.();
        if (anchorRect) {
            return mounted
                .map(element => {
                    const rect = element.getBoundingClientRect();
                    const dx = (rect.left + rect.width / 2) - (anchorRect.left + anchorRect.width / 2);
                    const dy = (rect.top + rect.height / 2) - (anchorRect.top + anchorRect.height / 2);
                    return { element, distance: Math.sqrt(dx * dx + dy * dy) };
                })
                .sort((a, b) => a.distance - b.distance)[0].element;
        }
        return mounted[0];
    }

    return bucOutlookFindVisibleMenuAction([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ], { exact: true, anchor });
}


function bucOutlookVisibleMenuSurfaces() {
    const surfaces = Array.from(document.querySelectorAll("[role='menu'], [role='listbox']"))
        .filter(bucAdapterIsVisible);
    return [...new Set(surfaces)];
}


function bucOutlookMenuLabelledByTrigger(trigger, { visibleOnly = true } = {}) {
    const triggerId = String(trigger?.id || "").trim();
    if (!triggerId) return null;

    const menus = Array.from(document.querySelectorAll("[role='menu'], [role='listbox']"));
    const matches = menus.filter(menu => {
        const labelledBy = String(menu.getAttribute?.("aria-labelledby") || "")
            .split(/\s+/)
            .filter(Boolean);
        if (!labelledBy.includes(triggerId)) return false;
        return visibleOnly ? bucAdapterIsVisible(menu) : true;
    });
    if (!matches.length) return null;

    // Prefer the most recently rendered/visible match when Fluent leaves stale portal nodes behind.
    return matches[matches.length - 1];
}

async function bucOutlookWaitForLinkedMenu(trigger, timeout = 500, deadlineAt = null) {
    const bounded = bucOutlookBudgetTimeout(deadlineAt, timeout);
    if (deadlineAt && bounded <= 0) return null;
    return bucOutlookWaitFor(
        () => bucOutlookMenuLabelledByTrigger(trigger, { visibleOnly: true }),
        bounded || timeout,
        20
    );
}

function bucOutlookMessageDetailsCommandInScope(scope) {
    if (!scope) return null;
    return bucOutlookFindAnyTextAction([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ], { exact: true, scope });
}

function bucOutlookFindMoreMenuSurface(anchor, beforeMenus = new Set()) {
    const surfaces = bucOutlookVisibleMenuSurfaces();
    if (!surfaces.length) return null;

    // Prefer a menu that appeared after the active message's More button was invoked. Fluent UI
    // renders the menu into a document-level portal, so DOM ancestry to the toolbar is not useful.
    const newlyVisible = surfaces.filter(surface => !beforeMenus.has(surface));
    const pool = newlyVisible.length ? newlyVisible : surfaces;
    const anchorRect = anchor?.getBoundingClientRect?.() || null;

    const scored = pool.map(surface => {
        const text = String(surface.innerText || surface.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const hasView = /(?:^|\s)view(?:\s|$)/.test(text);
        const hasTypicalMoreItems = /(delete|mark as unread|flag|customize actions|download|advanced actions|print)/.test(text);
        const rect = surface.getBoundingClientRect?.();
        let distance = 0;
        if (anchorRect && rect) {
            const dx = (rect.left + rect.width / 2) - (anchorRect.left + anchorRect.width / 2);
            const dy = (rect.top + rect.height / 2) - (anchorRect.top + anchorRect.height / 2);
            distance = Math.sqrt(dx * dx + dy * dy);
        }
        let score = 0;
        if (newlyVisible.includes(surface)) score += 160;
        if (hasView) score += 140;
        if (hasTypicalMoreItems) score += 80;
        score -= Math.min(distance / 8, 160);
        return { surface, score, hasView };
    }).sort((a,b) => b.score-a.score);

    // Do not lock onto an unrelated visible menu unless it at least contains the expected View row.
    return scored.find(item => item.hasView)?.surface || null;
}

function bucOutlookViewSubmenuAction(anchor = null, scope = null) {
    // Outlook/Fluent has changed the exact semantics of the View row across real builds.
    // Scope to the newly opened More-items menu whenever possible. This prevents a different
    // visible Outlook control named "View" from winning the relaxed global matcher.
    const searchScope = scope || document;
    const candidates = bucOutlookVisibleActionElements(searchScope).filter(element =>
        bucOutlookActionText(element) === "view"
    );
    if (!candidates.length) {
        return bucOutlookFindVisibleMenuAction(["view"], { exact: true, anchor, scope: searchScope });
    }

    const anchorRect = anchor?.getBoundingClientRect?.() || null;
    const scored = candidates.map(element => {
        const rect = element.getBoundingClientRect?.();
        const role = String(element.getAttribute?.("role") || "").toLowerCase();
        const hasPopup = String(element.getAttribute?.("aria-haspopup") || "").toLowerCase() === "menu";
        const hasIndicator = !!element.querySelector?.(".fui-MenuItem__submenuIndicator");
        const inVisibleMenu = !!element.closest?.("[role='menu'], [data-portal-node='true'], .fui-MenuPopover");
        let semantic = 0;
        if (hasPopup) semantic += 120;
        if (hasIndicator) semantic += 100;
        if (role === "button" || role === "menuitem") semantic += 30;
        if (inVisibleMenu) semantic += 40;

        let distance = 0;
        if (anchorRect && rect) {
            const dx = (rect.left + rect.width / 2) - (anchorRect.left + anchorRect.width / 2);
            const dy = (rect.top + rect.height / 2) - (anchorRect.top + anchorRect.height / 2);
            distance = Math.sqrt(dx * dx + dy * dy);
        }
        return { element, score: semantic - Math.min(distance / 6, 180) };
    });
    return scored.sort((a, b) => b.score - a.score)[0]?.element || null;
}


function bucOutlookMenuItemContentText(element) {
    const content = element?.querySelector?.(".fui-MenuItem__content");
    return String(content?.textContent || content?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function bucOutlookExactViewTriggerInMenu(menu) {
    if (!menu) return null;
    const candidates = Array.from(menu.querySelectorAll([
        "[role='button'][aria-haspopup='menu']",
        "button[aria-haspopup='menu']",
        "[role='menuitem'][aria-haspopup='menu']"
    ].join(", ")));

    return candidates.find(element => {
        const contentText = bucOutlookMenuItemContentText(element);
        if (contentText) return contentText === "view";
        return bucOutlookActionText(element) === "view";
    }) || null;
}

function bucOutlookExactMessageDetailsInMenu(menu) {
    if (!menu) return null;
    const wanted = new Set([
        "view message details",
        "message details",
        "view message source",
        "view source",
        "internet headers"
    ]);
    const candidates = Array.from(menu.querySelectorAll("[role='menuitem'], [role='button']"));
    return candidates.find(element => {
        const contentText = bucOutlookMenuItemContentText(element);
        if (contentText && wanted.has(contentText)) return true;
        return wanted.has(bucOutlookActionText(element));
    }) || null;
}

async function bucOutlookWaitForMessageDetailsCommand(anchor, timeout = 300) {
    return bucOutlookWaitFor(() => bucOutlookMessageDetailsCommand(anchor), timeout, 20);
}

function bucOutlookDispatchArrowRight(element) {
    if (!element) return;
    try { element.focus?.({ preventScroll: true }); } catch (_error) {
        try { element.focus?.(); } catch (_innerError) {}
    }
    for (const type of ["keydown", "keyup"]) {
        try {
            element.dispatchEvent(new KeyboardEvent(type, {
                key: "ArrowRight",
                code: "ArrowRight",
                keyCode: 39,
                which: 39,
                bubbles: true,
                cancelable: true,
                composed: true
            }));
        } catch (_error) {}
    }
}

async function bucOutlookOpenViewSubmenu(element, diagnostics = [], deadlineAt = null) {
    if (!element) return null;

    const triggerId = String(element.id || "").trim();
    diagnostics.push("view-trigger-exact-found");
    diagnostics.push(triggerId ? "view-trigger-id-present" : "view-trigger-id-missing");

    const expanded = () => String(element.getAttribute?.("aria-expanded") || "").toLowerCase() === "true";
    diagnostics.push(`view-expanded-before=${expanded() ? "true" : "false"}`);

    try { element.focus?.({ preventScroll: true }); } catch (_error) {
        try { element.focus?.(); } catch (_innerError) {}
    }

    let linkedSeen = false;
    const waitForLinkedDetails = async (preferredMs) => {
        const timeout = bucOutlookBudgetTimeout(deadlineAt, preferredMs);
        if (deadlineAt && timeout <= 0) return null;

        const details = await bucOutlookWaitFor(() => {
            const linked = bucOutlookMenuLabelledByTrigger(element, { visibleOnly: true });
            if (!linked) return null;
            linkedSeen = true;
            return bucOutlookExactMessageDetailsInMenu(linked);
        }, timeout || preferredMs, 20);

        if (linkedSeen && !diagnostics.includes("view-linked-submenu-found")) {
            diagnostics.push("view-linked-submenu-found");
        }
        if (details) diagnostics.push("view-message-details-item-found", "view-submenu-command-visible");
        return details;
    };

    // The inspected Outlook DOM exposes the real View row as a submenu trigger and toggles
    // aria-expanded=true when Fluent opens its linked portal menu. Use that exact trigger first.
    diagnostics.push("view-activation-attempt-native-click", "view-submenu-native-click");
    try { element.click?.(); } catch (_error) {
        bucOutlookDispatchActivationSequence(element);
    }
    let details = await waitForLinkedDetails(750);
    diagnostics.push(`view-expanded-after-click=${expanded() ? "true" : "false"}`);
    if (expanded()) diagnostics.push("view-submenu-expanded-after-click");
    if (details) return details;

    // If React/Fluent ignored the synthetic click, reproduce a real mouse-intent sequence over
    // the exact View trigger and then wait for the trigger-linked submenu rather than searching
    // the rest of Outlook for another element named View.
    for (const type of ["mousemove", "mouseover", "mouseenter"]) {
        bucOutlookDispatchPointerLikeEvent(element, type);
    }
    diagnostics.push("view-activation-attempt-hover", "view-submenu-mousemove-hover");
    details = await waitForLinkedDetails(750);
    diagnostics.push(`view-expanded-after-hover=${expanded() ? "true" : "false"}`);
    if (expanded()) diagnostics.push("view-submenu-expanded-after-hover");
    if (details) return details;

    // Standards-compatible final fallback for a genuine submenu trigger.
    bucOutlookDispatchArrowRight(element);
    diagnostics.push("view-activation-attempt-arrow-right", "view-submenu-arrow-right");
    details = await waitForLinkedDetails(450);
    diagnostics.push(`view-expanded-after-arrow-right=${expanded() ? "true" : "false"}`);
    if (details) return details;

    if (linkedSeen) diagnostics.push("view-linked-submenu-without-message-details");
    return null;
}

async function bucOutlookTryOpenMessageDetails(context) {
    const diagnostics = [];
    const coldPathStartedAt = bucOutlookNow();
    const coldPathDeadlineAt = coldPathStartedAt + BUC_OUTLOOK_UNPINNED_BUDGET_MS;
    const existing = bucOutlookFindRawHeaderText();
    if (existing) {
        diagnostics.push("header-text-found", "header-parse-success");
        return {
            rawHeaders: existing,
            openedByPrototype: false,
            diagnostics,
            route: "existing"
        };
    }

    // Fast path only: some users may pin View message details to the reading-pane toolbar.
    // It is OFF by default in Outlook, so this must never be required for successful operation.
    const pinned = bucOutlookPinnedMessageDetailsAction(context);
    if (pinned) {
        diagnostics.push("pinned-message-details-action-found");
        const captured = await bucOutlookOpenMessageDetailsCommand(
            pinned, diagnostics, "pinned"
        );
        if (captured.rawHeaders) return captured;

        // If the optional shortcut was present but did not yield usable headers, close any partial
        // dialog and continue with Outlook's default unpinned More -> View route.
        bucOutlookCloseMessageDetailsIfOpened(captured.openedByPrototype);
        diagnostics.push("pinned-message-details-fallback");
    } else {
        diagnostics.push("pinned-message-details-action-not-found");
    }

    // Experimental zero-navigation path: Outlook/Fluent may keep an unpinned toolbar command
    // mounted as a hidden data-overflow-item. If present, invoke it directly without changing the
    // user's pin/customisation setting. Keep the timeout short so a stale/non-functional dormant
    // item cannot make the ordinary fallback feel slower.
    const dormant = bucOutlookDormantMessageDetailsAction(context);
    if (dormant) {
        diagnostics.push("dormant-message-details-action-found");
        const dormantCapture = await bucOutlookOpenMessageDetailsCommand(
            dormant, diagnostics, "overflow", 260
        );
        if (dormantCapture.rawHeaders) return dormantCapture;
        bucOutlookCloseMessageDetailsIfOpened(dormantCapture.openedByPrototype);
        diagnostics.push("dormant-message-details-action-fallback");
    } else {
        diagnostics.push("dormant-message-details-action-not-found");
    }

    const more = bucOutlookMoreItemsButton(context);
    if (!more) {
        return {
            rawHeaders: "",
            openedByPrototype: false,
            diagnostics: [...new Set([...diagnostics, "more-items-not-found"])],
            route: "menu"
        };
    }
    diagnostics.push("more-items-found");

    const menusBeforeMore = new Set(bucOutlookVisibleMenuSurfaces());
    more.click();

    // Fluent UI links a menu back to its trigger with aria-labelledby=<trigger id>. Generated ids
    // are unstable across sessions, but the live relationship is stable and can be followed at
    // runtime. Prefer that relationship over spatial/text heuristics whenever Outlook exposes it.
    const firstMenuFastTimeout = bucOutlookBudgetTimeout(coldPathDeadlineAt, 900);
    let moreMenuSurface = await bucOutlookWaitFor(
        () => bucOutlookMenuLabelledByTrigger(more, { visibleOnly: true }) ||
            bucOutlookFindMoreMenuSurface(more, menusBeforeMore),
        firstMenuFastTimeout || 50,
        20
    );
    if (moreMenuSurface && bucOutlookMenuLabelledByTrigger(more, { visibleOnly: true }) === moreMenuSurface) {
        diagnostics.push("more-menu-linked-by-trigger");
    }

    if (!moreMenuSurface) {
        diagnostics.push("more-menu-wait-extended");
        const extendedTimeout = bucOutlookBudgetTimeout(coldPathDeadlineAt, 700);
        if (extendedTimeout > 0) {
            moreMenuSurface = await bucOutlookWaitFor(
                () => bucOutlookFindMoreMenuSurface(more, menusBeforeMore),
                extendedTimeout,
                20
            );
        }
        if (moreMenuSurface) diagnostics.push("more-menu-rendered-after-extended-wait");
    }

    if (moreMenuSurface) diagnostics.push("more-menu-surface-found");

    // Follow the exact DOM relationship observed in current Outlook. Once the More menu is linked
    // to the active message trigger, do not fall back to a global "View" search: Outlook contains
    // other View-labelled controls and those caused the previous relaxed-match failures.
    let details = moreMenuSurface ? bucOutlookExactMessageDetailsInMenu(moreMenuSurface) : null;

    if (!details) {
        let viewMenu = moreMenuSurface ? bucOutlookExactViewTriggerInMenu(moreMenuSurface) : null;
        if (!viewMenu && moreMenuSurface) {
            const viewWait = bucOutlookBudgetTimeout(coldPathDeadlineAt, 650);
            if (viewWait > 0) {
                viewMenu = await bucOutlookWaitFor(
                    () => bucOutlookExactViewTriggerInMenu(moreMenuSurface),
                    viewWait,
                    20
                );
            }
        }

        if (!viewMenu) {
            diagnostics.push("view-trigger-exact-not-found-in-more-menu");
            try { more.click(); } catch (_error) {}
            return { rawHeaders: "", openedByPrototype: false, diagnostics: [...new Set(diagnostics)], route: "menu" };
        }

        diagnostics.push("view-menu-found", "view-menu-found-in-more-surface", "view-trigger-exact-found-in-more-menu");
        details = await bucOutlookOpenViewSubmenu(viewMenu, diagnostics, coldPathDeadlineAt);
    }

    if (!details) {
        diagnostics.push("message-details-command-not-found");
        try { more.click(); } catch (_error) {}
        return { rawHeaders: "", openedByPrototype: false, diagnostics: [...new Set(diagnostics)], route: "menu" };
    }
    diagnostics.push("message-details-command-found");

    return bucOutlookOpenMessageDetailsCommand(details, diagnostics, "menu", 900, coldPathDeadlineAt);
}

function bucOutlookCloseMessageDetailsIfOpened(openedByPrototype) {
    if (!openedByPrototype) return;
    const dialog = bucOutlookMessageDetailsDialog();
    if (!dialog) return;

    const close = bucOutlookFindAnyTextAction(["close"], { exact: true, scope: dialog }) ||
        dialog.querySelector("button[aria-label='Close' i], button[title='Close' i], [role='button'][aria-label='Close' i]");
    if (close) close.click();
}

async function acquireOutlookHeaders(context, metadata = {}) {
    const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const elapsedMs = () => Math.max(0, Math.round(
        (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - startedAt
    ));
    let captured = { rawHeaders: "", openedByPrototype: false, diagnostics: [] };
    try {
        captured = await bucOutlookTryOpenMessageDetails(context);
        if (captured.rawHeaders) {
            const source = captured.route === "pinned"
                ? "outlook-pinned-message-details"
                : captured.route === "overflow"
                    ? "outlook-overflow-message-details"
                    : captured.route === "existing"
                        ? "outlook-existing-message-details"
                        : "outlook-view-menu-message-details";
            return {
                provider: "outlook",
                status: "full",
                source,
                rawHeaders: captured.rawHeaders,
                limitations: [],
                diagnostics: captured.diagnostics || [],
                durationMs: elapsedMs()
            };
        }
    } catch (_error) {
        captured.diagnostics = [...(captured.diagnostics || []), "automation-error"];
    } finally {
        // Do not leave Message details covering the mailbox after the current check.
        bucOutlookCloseMessageDetailsIfOpened(captured.openedByPrototype);
    }

    const hasSummary = Boolean(metadata.replyTo || metadata.mailedBy || metadata.signedBy);
    const diagnosticText = (captured.diagnostics || []).length
        ? ` Outlook automation stages: ${(captured.diagnostics || []).join(" -> ")}.`
        : "";
    return {
        provider: "outlook",
        status: hasSummary ? "partial" : "unavailable",
        source: hasSummary ? "outlook-visible-summary" : "outlook-visible-message",
        rawHeaders: "",
        limitations: [`Outlook View message details headers could not be captured automatically; visible message data was retained.${diagnosticText}`],
        diagnostics: captured.diagnostics || [],
        durationMs: elapsedMs()
    };
}
