// adapters/outlook/links.js
// Outlook Web link wrapper for BeforeUClick.

function extractOutlookLinks(context) {
    return bucExtractLinksFromContainer(context?.body, [
        "blockquote",
        "[data-testid*='quoted']",
        "[class*='quotedText']",
        "[id*='divRplyFwdMsg']"
    ]);
}
