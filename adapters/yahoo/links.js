// adapters/yahoo/links.js
// Yahoo Mail link wrapper for BeforeUClick.

function extractYahooLinks(context) {
    return bucExtractLinksFromContainer(context?.body, [
        "blockquote",
        "[data-test-id*='quoted' i]",
        "[data-test-id='message-original']",
        "[class*='quoted']",
        "[aria-label*='previous message' i]",
        "[aria-label*='show trimmed content' i]"
    ]);
}
