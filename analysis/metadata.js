// analysis/metadata.js
// Provider-independent metadata consistency checks for BeforeUClick.
// Positive alignment can provide small reassuring evidence, but only concerning evidence
// contributes to the identity-risk module score.

/** Creates one standard metadata evidence item for the shared scoring engine. */
function bucMetadataEvidence(code, points, text, strength = "weak", extra = {}) {
    return {
        code,
        category: points < 0 ? "reassuring" : "identity",
        source: "metadata",
        points,
        score: points,
        strength,
        text,
        ...extra
    };
}

/** Returns the recognised organisation record for a comparable domain, if one exists. */
function bucMetadataOrganisation(domain) {
    return domain ? bucFindRecognisedOrganisation(domain) : null;
}

/**
 * Returns true when two domains are directly equal or belong to the same recognised organisation.
 * This avoids treating related first-party domains (for example within one provider) as automatically mismatched.
 */
function bucMetadataDomainsAligned(firstDomain, secondDomain) {
    if (!firstDomain || !secondDomain) return false;
    if (firstDomain === secondDomain) return true;

    if (typeof bucDomainsShareRecognisedOrganisation === "function" &&
        bucDomainsShareRecognisedOrganisation(firstDomain, secondDomain)) {
        return true;
    }

    const firstOrganisation = bucMetadataOrganisation(firstDomain);
    const secondOrganisation = bucMetadataOrganisation(secondDomain);
    return Boolean(
        firstOrganisation?.id &&
        secondOrganisation?.id &&
        firstOrganisation.id === secondOrganisation.id
    );
}

/**
 * Returns a small negative-point alignment value. Authentication-style alignment is useful
 * supporting evidence, but it is intentionally weaker for an unknown organisation and ignored
 * for consumer/free-mail domains where a scammer can legitimately own the mailbox.
 */
function bucMetadataAlignmentPoints(senderDomain, kind) {
    if (!senderDomain || bucIsFreemailDomain(senderDomain)) return 0;

    const official = bucFindOfficialSenderOrganisation(senderDomain);
    if (kind === "signed") return official ? -3 : -1;
    if (kind === "mailed") return official ? -2 : -1;
    if (kind === "reply") return official ? -1 : 0;
    return 0;
}

/**
 * Compares visible-sender authentication domains using registrable domains from domains.js.
 * Mismatches remain cautionary evidence; positive alignment is kept separately as reassurance.
 */
function analyseMetadata(metadata) {
    const evidence = [];

    const senderDomain = bucComparableDomain(metadata.sender);
    const replyDomain = bucComparableDomain(metadata.replyTo);
    const mailedDomain = bucComparableDomain(metadata.mailedBy);
    const signedDomain = bucComparableDomain(metadata.signedBy);

    const compare = ({ domain, codeMismatch, mismatchPoints, mismatchText, mismatchStrength, alignKind, alignCode, alignText, allowKnownMailInfrastructure = false }) => {
        if (!senderDomain || !domain) return;

        if (!bucMetadataDomainsAligned(senderDomain, domain)) {
            // A sourced bulk-mail / tracking provider can legitimately appear in mailed-by while
            // the visible sender and DKIM identity remain the organisation itself. Recognition is
            // deliberately neutral: it suppresses a false mismatch but adds no reassurance.
            if (allowKnownMailInfrastructure && typeof bucIsKnownEmailIntermediary === "function" && bucIsKnownEmailIntermediary(domain)) {
                return;
            }
            evidence.push(bucMetadataEvidence(
                codeMismatch,
                mismatchPoints,
                mismatchText,
                mismatchStrength
            ));
            return;
        }

        const points = bucMetadataAlignmentPoints(senderDomain, alignKind);
        if (points < 0) {
            const official = bucMetadataOrganisation(senderDomain);
            evidence.push(bucMetadataEvidence(
                alignCode,
                points,
                alignText,
                "positive",
                {
                    organisation: official?.name || "",
                    references: official?.references || []
                }
            ));
        }
    };

    compare({
        domain: replyDomain,
        codeMismatch: "reply-domain-mismatch",
        mismatchPoints: 12,
        mismatchText: "Reply-To uses a different domain from the visible sender. This can be legitimate, but it should be checked.",
        mismatchStrength: "medium",
        alignKind: "reply",
        alignCode: "reply-domain-aligned",
        alignText: "Reply-To is aligned with the visible sender domain/organisation."
    });

    compare({
        domain: signedDomain,
        codeMismatch: "signed-domain-mismatch",
        mismatchPoints: 10,
        mismatchText: "The signed-by domain differs from the visible sender domain. This may be legitimate for third-party mail services.",
        mismatchStrength: "medium",
        alignKind: "signed",
        alignCode: "signed-domain-aligned",
        alignText: "The signed-by domain is aligned with the visible sender domain/organisation."
    });

    compare({
        domain: mailedDomain,
        codeMismatch: "mailed-domain-mismatch",
        mismatchPoints: 6,
        mismatchText: "The mailed-by domain differs from the visible sender domain. This may be legitimate for third-party mail services.",
        mismatchStrength: "weak",
        alignKind: "mailed",
        alignCode: "mailed-domain-aligned",
        alignText: "The mailed-by domain is aligned with the visible sender domain/organisation.",
        allowKnownMailInfrastructure: true
    });

    const concerningEvidence = evidence.filter(item => (Number(item.points) || 0) > 0);

    return {
        score: Math.min(concerningEvidence.reduce((total, item) => total + item.points, 0), 20),
        warnings: concerningEvidence.map(item => item.text),
        evidence,
        domains: {
            sender: senderDomain,
            replyTo: replyDomain,
            mailedBy: mailedDomain,
            signedBy: signedDomain
        }
    };
}
