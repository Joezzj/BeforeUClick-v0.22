// adapters/gmail/links.js
// Gmail link wrapper for BeforeUClick.

function extractGmailLinks(context) {
    return bucExtractLinksFromContainer(context?.body, [
        ".gmail_quote",
        ".gmail_attr",
        "blockquote[type='cite']"
    ]);
}
