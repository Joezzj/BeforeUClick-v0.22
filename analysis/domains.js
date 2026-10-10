// analysis/domains.js
// Shared domain parsing helpers for BeforeUClick.
// Uses the bundled Public Suffix List snapshot to find public suffixes and registrable domains.

/**
 * Normalises a hostname for comparisons.
 * Returns a lower-case ASCII hostname without leading/trailing dots.
 */
function bucNormaliseHostname(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    if (!raw) return "";

    try {
        // URL converts Unicode host labels to ASCII/punycode consistently.
        return new URL(`https://${raw}`).hostname.toLowerCase().replace(/\.$/, "");
    } catch (_error) {
        return raw;
    }
}

/**
 * Returns true when hostname is the supplied domain or one of its subdomains.
 */
function bucHostnameMatchesDomain(hostname, domain) {
    const host = bucNormaliseHostname(hostname);
    const wanted = bucNormaliseHostname(domain);
    return Boolean(host && wanted && (host === wanted || host.endsWith(`.${wanted}`)));
}

/**
 * Finds the prevailing Public Suffix List rule for a hostname.
 * Returns the matching rule and number of labels that form the public suffix.
 */
function bucFindPublicSuffixRule(hostname) {
    const host = bucNormaliseHostname(hostname);
    const labels = host.split(".").filter(Boolean);

    if (!labels.length) {
        return { rule: "*", publicSuffixLabels: 0, exception: false };
    }

    let bestRule = "*";
    let bestLabels = 1;
    let exception = false;

    for (let start = 0; start < labels.length; start += 1) {
        const candidate = labels.slice(start).join(".");
        const exact = candidate;
        const exceptionRule = `!${candidate}`;

        if (BUC_PUBLIC_SUFFIX_RULES.has(exceptionRule)) {
            return {
                rule: exceptionRule,
                publicSuffixLabels: Math.max(labels.length - start - 1, 1),
                exception: true
            };
        }

        if (BUC_PUBLIC_SUFFIX_RULES.has(exact)) {
            const count = labels.length - start;
            if (count > bestLabels || (count === bestLabels && bestRule === "*")) {
                bestRule = exact;
                bestLabels = count;
                exception = false;
            }
        }

        if (start > 0) {
            const wildcard = `*.${candidate}`;
            if (BUC_PUBLIC_SUFFIX_RULES.has(wildcard)) {
                const count = labels.length - start + 1;
                if (count > bestLabels) {
                    bestRule = wildcard;
                    bestLabels = count;
                    exception = false;
                }
            }
        }
    }

    return {
        rule: bestRule,
        publicSuffixLabels: Math.min(bestLabels, labels.length),
        exception
    };
}

/**
 * Parses a hostname into public-suffix and registrable-domain components.
 * The registrable domain is null when the hostname itself is only a public suffix.
 */
function bucParseDomain(hostname) {
    const host = bucNormaliseHostname(hostname);
    if (!host) {
        return {
            hostname: "",
            publicSuffix: "",
            registrableDomain: "",
            subdomain: "",
            rule: "",
            isIpAddress: false
        };
    }

    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    const isIpv6 = host.includes(":");

    if (isIpv4 || isIpv6) {
        return {
            hostname: host,
            publicSuffix: "",
            registrableDomain: host,
            subdomain: "",
            rule: "",
            isIpAddress: true
        };
    }

    const labels = host.split(".").filter(Boolean);
    const match = bucFindPublicSuffixRule(host);
    const suffixCount = match.publicSuffixLabels;
    const publicSuffix = suffixCount ? labels.slice(-suffixCount).join(".") : "";
    const registrableDomain = labels.length > suffixCount
        ? labels.slice(-(suffixCount + 1)).join(".")
        : "";
    const subdomain = registrableDomain
        ? labels.slice(0, labels.length - (suffixCount + 1)).join(".")
        : "";

    return {
        hostname: host,
        publicSuffix,
        registrableDomain,
        subdomain,
        rule: match.rule,
        isIpAddress: false
    };
}

/**
 * Parses a URL and returns a normalised domain-information object.
 * Returns null when the supplied URL is invalid.
 */
function bucDescribeUrl(value) {
    try {
        const parsed = new URL(value);
        const domain = bucParseDomain(parsed.hostname);

        return {
            protocol: parsed.protocol,
            hostname: domain.hostname,
            publicSuffix: domain.publicSuffix,
            registrableDomain: domain.registrableDomain,
            subdomain: domain.subdomain,
            port: parsed.port,
            path: parsed.pathname,
            query: parsed.search,
            hash: parsed.hash,
            isIpAddress: domain.isIpAddress,
            pslRule: domain.rule
        };
    } catch (_error) {
        return null;
    }
}

/**
 * Extracts a comparable registrable domain from an email address, hostname or URL-like value.
 */
function bucComparableDomain(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    const emailDomain = typeof bucEmailDomain === "function" ? bucEmailDomain(text) : "";
    if (emailDomain) {
        const parsed = bucParseDomain(emailDomain);
        return parsed.registrableDomain || parsed.hostname;
    }

    try {
        const asUrl = /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^@/, "")}`;
        const parsed = new URL(asUrl);
        const domain = bucParseDomain(parsed.hostname);
        return domain.registrableDomain || domain.hostname;
    } catch (_error) {
        const hostMatch = text.toLowerCase().match(/([a-z0-9.-]+\.[a-z0-9-]{2,})/i);
        if (!hostMatch) return text.toLowerCase().replace(/^@/, "");
        const domain = bucParseDomain(hostMatch[1]);
        return domain.registrableDomain || domain.hostname;
    }
}
