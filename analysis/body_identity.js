// analysis/body_identity.js
// Limited identity checks for email addresses written inside the current message body.

/**
 * Repairs a text-extraction artefact where adjacent UI text is concatenated directly onto
 * the final TLD (for example "person@gmail.comUnsubscribe"). The repair is conservative:
 * it only shortens a candidate when the full final label is not a known public suffix but a
 * shorter prefix produces a recognised Public Suffix List rule.
 */
function bucRepairBodyEmailCandidate(candidate) {
    const value = String(candidate || "").toLowerCase();
    const at = value.lastIndexOf("@");
    if (at < 1) return value;
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    const parsed = typeof bucParseDomain === "function" ? bucParseDomain(domain) : null;
    if (!parsed || (parsed.rule && parsed.rule !== "*")) return value;

    const labels = domain.split(".").filter(Boolean);
    if (labels.length < 2) return value;
    const finalLabel = labels[labels.length - 1];

    for (let cut = finalLabel.length - 1; cut >= 2; cut -= 1) {
        const repairedDomain = [...labels.slice(0, -1), finalLabel.slice(0, cut)].join(".");
        const repaired = bucParseDomain(repairedDomain);
        if (repaired?.rule && repaired.rule !== "*" && repaired.registrableDomain) {
            return `${local}@${repairedDomain}`;
        }
    }
    return value;
}

/** Extracts unique email addresses written as text in the current message body. */
function bucExtractBodyEmailAddresses(text) {
    const matches = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches.map(item => bucRepairBodyEmailCandidate(item)))];
}

/** Creates one body-identity evidence item for scoring/reporting. */
function bucBodyIdentityEvidence(code, points, text, strength = "weak", details = {}) {
    return {
        code,
        category: "identity",
        source: "body-identity",
        points,
        score: points,
        strength,
        text,
        ...details
    };
}

/** Returns local body context around one written email address. */
function bucBodyIdentityAddressContext(bodyText, address, radius = 180) {
    const value = String(bodyText || "");
    const lower = value.toLowerCase();
    const index = lower.indexOf(String(address || "").toLowerCase());
    if (index < 0) return "";
    return value.slice(Math.max(0, index - radius), Math.min(value.length, index + address.length + radius));
}

/**
 * Returns true when a written body address is presented as contact/support identity rather
 * than merely appearing as transaction data, recipient information, or quoted content.
 */
function bucBodyIdentityHasContactCue(contextText) {
    return /\b(?:contact|support|help(?:desk)?|customer service|security team|billing team|accounts? team|reply(?: to)?|email(?: us)?|write to|reach us|call or email)\b/i
        .test(String(contextText || ""));
}

/**
 * Checks contact email addresses written inside the current message body.
 * v0.22.10 deliberately requires local contact/identity context before comparing a body
 * address with a mentioned brand. A receipt containing a customer's Hotmail address, for
 * example, is not a Microsoft identity claim by the sender.
 */
function analyseBodyIdentity(text, options = {}) {
    const bodyText = String(text || "");
    const addresses = bucExtractBodyEmailAddresses(bodyText);
    const evidence = [];
    const excludedAddresses = new Set(
        (Array.isArray(options.excludeAddresses) ? options.excludeAddresses : [])
            .map(value => bucParseEmailAddress(value))
            .filter(Boolean)
    );

    for (const address of addresses) {
        // Provider extraction often includes the recipient address again in newsletter footers
        // ("This email was sent to you@example.com"). That is not a sender/brand contact claim.
        if (excludedAddresses.has(bucParseEmailAddress(address))) continue;
        const domain = bucEmailDomain(address);
        if (!domain) continue;

        const localContext = bucBodyIdentityAddressContext(bodyText, address);
        const contextWithoutAddresses = localContext.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
        const localClaims = bucFindClaimedOrganisations(contextWithoutAddresses);
        const hasContactCue = bucBodyIdentityHasContactCue(contextWithoutAddresses);

        // Written addresses are common transaction/receipt data. Only use look-alike evidence
        // when the address is actually being presented as a contact/support identity.
        if (hasContactCue) {
            const typosquat = bucFindTyposquatReference(domain);
            if (typosquat) {
                evidence.push(bucBodyIdentityEvidence(
                    "body-email-typosquat",
                    12,
                    `A contact address written in the email (${address}) uses a domain very close to recognised ${typosquat.organisation.name} domain ${typosquat.officialDomain}.`,
                    "medium",
                    { emailAddress: address, domain }
                ));
                if (evidence.length >= 3) break;
                continue;
            }
        }

        if (!hasContactCue || !localClaims.length) continue;

        for (const reference of localClaims) {
            const official = bucReferenceDestinationDomains(reference)
                .some(item => bucHostnameMatchesDomain(domain, item));
            const controlledOwnership = typeof bucControlledNamespaceBelongsToOrganisation === "function"
                && bucControlledNamespaceBelongsToOrganisation(domain, reference.id);

            if (!official && !controlledOwnership) {
                evidence.push(bucBodyIdentityEvidence(
                    "body-contact-brand-mismatch",
                    5,
                    `A contact address presented near ${reference.name} uses ${domain}, which is not in the local ${reference.name} reference.`,
                    "weak",
                    { emailAddress: address, domain, organisation: reference.name }
                ));
                break;
            }
        }

        if (evidence.length >= 3) break;
    }

    return {
        score: Math.min(evidence.reduce((total, item) => total + item.points, 0), 15),
        warnings: evidence.map(item => item.text),
        evidence,
        addresses
    };
}
