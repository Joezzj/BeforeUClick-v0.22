// analysis/sender.js
// Explainable sender-address/display-name checks.
// Reassuring sender evidence is emitted only for explicitly sourced sender-domain rules.

/** Extracts and normalises one email address from a Gmail/header value. */
function bucParseEmailAddress(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
    return match ? match[1].toLowerCase() : "";
}

/** Returns the domain portion of a parsed email address. */
function bucEmailDomain(value) {
    const address = bucParseEmailAddress(value);
    return address ? address.split("@")[1] : "";
}

/** Creates one standard sender-evidence item for the scoring engine. */
function bucSenderEvidence(code, points, text, strength = "weak", extra = {}) {
    return {
        code,
        category: points < 0 ? "reassuring" : "identity",
        source: "sender",
        points,
        score: points,
        strength,
        text,
        ...extra
    };
}

/** Returns true when a sender domain is one of the common consumer/free-mail providers. */
function bucIsFreemailDomain(domain) {
    const value = bucNormaliseHostname(domain);
    return BUC_FREEMAIL_DOMAINS.some(item => bucHostnameMatchesDomain(value, item));
}

/** Checks a brand-like display name against explicitly sourced sender domains for that brand. */
function bucCheckSenderBrandMismatch(displayName, domain) {
    if (!displayName || !domain || bucIsFreemailDomain(domain)) return [];

    const claimed = bucFindClaimedOrganisations(displayName);
    return claimed
        .filter(reference => {
            const sourcedSender = bucReferenceSenderDomains(reference).some(official =>
                bucHostnameMatchesDomain(domain, official)
            );
            const controlledOwnership = typeof bucControlledNamespaceBelongsToOrganisation === "function"
                && bucControlledNamespaceBelongsToOrganisation(domain, reference.id);
            // Controlled ownership suppresses a false impersonation mismatch, but it does not
            // turn the domain into OFFICIAL_SENDER_DOMAIN reassurance.
            return !sourcedSender && !controlledOwnership;
        })
        .map(reference => bucSenderEvidence(
            "sender-brand-domain-mismatch",
            18,
            `Sender name references ${reference.name}, but ${domain} is not in the sourced sender-domain reference for ${reference.name}.`,
            "strong",
            { organisation: reference.name, references: reference.references || [] }
        ));
}

/** Flags an organisation-like display name using a consumer mailbox. */
function bucCheckFreemailOrganisationName(displayName, domain, knownSender) {
    if (!displayName || !domain || !bucIsFreemailDomain(domain)) return null;

    const claimedOrganisations = bucFindClaimedOrganisations(displayName);
    if (claimedOrganisations.length) {
        return bucSenderEvidence(
            "sender-brand-on-freemail",
            18,
            `The sender name claims ${claimedOrganisations[0].name}, but the address uses the consumer email provider ${domain}.`,
            "strong",
            { organisation: claimedOrganisations[0].name, references: claimedOrganisations[0].references || [] }
        );
    }

    if (knownSender) return null;

    const lowerName = displayName.toLowerCase();
    const keyword = BUC_ORGANISATION_DISPLAY_KEYWORDS.find(item => lowerName.includes(item));
    if (!keyword) return null;

    return bucSenderEvidence(
        "sender-organisation-name-on-freemail",
        6,
        `The sender name sounds organisational ("${keyword}") but the address uses the consumer email provider ${domain}.`,
        "weak"
    );
}

/** Runs the current explainable checks against the visible sender address and display name. */
function analyseSender(sender, displayName = "", options = {}) {
    const evidence = [];
    const address = bucParseEmailAddress(sender);

    if (!address) {
        return {
            score: 0,
            warnings: ["Sender address could not be parsed."],
            evidence: [],
            domain: "",
            knownSender: false
        };
    }

    const domain = bucEmailDomain(address);
    const labels = domain.split(".").filter(Boolean);
    const knownSender = Boolean(options.knownSender);
    const officialSenderOrganisation = !bucIsFreemailDomain(domain)
        ? bucFindOfficialSenderOrganisation(domain)
        : null;

    if (officialSenderOrganisation) {
        evidence.push(bucSenderEvidence(
            "sender-official-domain",
            bucEvidenceClassPoints("OFFICIAL_SENDER_DOMAIN", -5),
            `Sender address uses a sourced official sender domain for ${officialSenderOrganisation.name}.`,
            "positive",
            {
                evidenceClass: "OFFICIAL_SENDER_DOMAIN",
                organisation: officialSenderOrganisation.name,
                references: officialSenderOrganisation.references || []
            }
        ));
    }

    if (knownSender) {
        evidence.push(bucSenderEvidence(
            "sender-known-local",
            bucEvidenceClassPoints("KNOWN_LOCAL_SENDER", -2),
            "This exact sender address is in the local known-sender list.",
            "positive",
            { evidenceClass: "KNOWN_LOCAL_SENDER" }
        ));
    }

    if (labels.some(label => label.startsWith("xn--"))) {
        evidence.push(bucSenderEvidence(
            "sender-punycode", 15,
            "Sender domain contains punycode/IDN encoding. This can be legitimate but deserves closer inspection.",
            "medium"
        ));
    }

    if (labels.length > 4) {
        evidence.push(bucSenderEvidence("sender-subdomains", 5, "Sender domain contains an unusually long chain of subdomains.", "weak"));
    }

    if (domain.length > 45) {
        evidence.push(bucSenderEvidence("sender-long-domain", 4, "Sender domain is unusually long.", "weak"));
    }

    if (domain.includes("..") || domain.startsWith("-") || domain.endsWith("-")) {
        evidence.push(bucSenderEvidence("sender-structure", 10, "Sender domain has an unusual structure.", "medium"));
    }

    const typosquat = bucFindTyposquatReference(domain);
    if (typosquat) {
        evidence.push(bucSenderEvidence(
            "sender-typosquat", 20,
            `Sender domain ${typosquat.candidateDomain} is very close to ${typosquat.officialDomain}, a recognised ${typosquat.organisation.name} domain.`,
            "strong",
            { organisation: typosquat.organisation.name, references: typosquat.organisation.references || [] }
        ));
    }

    evidence.push(...bucCheckSenderBrandMismatch(displayName, domain));

    const freemailEvidence = bucCheckFreemailOrganisationName(displayName, domain, knownSender);
    if (freemailEvidence) evidence.push(freemailEvidence);

    const concerningEvidence = evidence.filter(item => (Number(item.points) || 0) > 0);

    return {
        score: Math.min(concerningEvidence.reduce((total, item) => total + item.points, 0), 30),
        warnings: concerningEvidence.map(item => item.text),
        evidence,
        domain,
        knownSender,
        officialOrganisation: officialSenderOrganisation ? {
            id: officialSenderOrganisation.id,
            name: officialSenderOrganisation.name,
            references: officialSenderOrganisation.references || []
        } : null
    };
}
