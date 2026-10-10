// analysis/headers/evidence.js
// Converts trusted authentication/header observations into explainable score evidence.

function bucAuthenticationEvidence(code, evidenceClass, text, extra = {}) {
    const points = bucEvidenceClassPoints(evidenceClass, 0);
    return {
        code,
        evidenceClass,
        category: points < 0 ? "reassuring" : "identity",
        source: "authentication",
        strength: bucEvidenceClassStrength(evidenceClass, points < 0 ? "positive" : "medium"),
        points,
        score: points,
        text,
        ...extra
    };
}

function bucAuthenticationResultTrusted(item) {
    return Boolean(item?.providerTrusted && item?.source === "authentication-results");
}

/**
 * Authentication passes only reassure when the provider-trusted result aligns to the visible From domain.
 * Explicit failures can contribute concern; untrusted/summary-only results remain display context.
 */
function analyseAuthentication(authentication) {
    const evidence = [];
    if (!authentication) return { score: 0, warnings: [], evidence: [], model: null };

    const alignment = authentication.alignment || {};
    const spf = authentication.spf || {};
    const dmarc = authentication.dmarc || {};
    const trustedDkim = (authentication.dkim || []).filter(bucAuthenticationResultTrusted);
    const trustedSpf = bucAuthenticationResultTrusted(spf);
    const trustedDmarc = bucAuthenticationResultTrusted(dmarc);

    if (trustedSpf && spf.result === "pass" && alignment.spfAligned) {
        evidence.push(bucAuthenticationEvidence(
            "auth-spf-pass-aligned",
            "AUTH_SPF_ALIGNED",
            `SPF passed at the receiving provider and the mail-from domain aligns with the visible sender (${alignment.fromDomain}).`,
            { domain: alignment.spfDomain, authservId: spf.authservId }
        ));
    } else if (trustedSpf && ["fail", "softfail", "permerror"].includes(spf.result)) {
        evidence.push(bucAuthenticationEvidence(
            "auth-spf-fail",
            "AUTH_SPF_FAIL",
            `SPF returned ${spf.result.toUpperCase()} at the receiving provider.`,
            { domain: alignment.spfDomain, authservId: spf.authservId }
        ));
    }

    const alignedDkimPass = trustedDkim.find(item => item.result === "pass" && bucHeaderDomainsAligned(alignment.fromDomain, item.signingDomain));
    const trustedDmarcPass = Boolean(trustedDmarc && dmarc.result === "pass");
    const trustedSpfAlignedPass = Boolean(trustedSpf && spf.result === "pass" && alignment.spfAligned);
    if (alignedDkimPass) {
        evidence.push(bucAuthenticationEvidence(
            "auth-dkim-pass-aligned",
            "AUTH_DKIM_ALIGNED",
            `DKIM passed at the receiving provider and the signing domain aligns with the visible sender (${alignment.fromDomain}).`,
            { domain: bucHeaderComparableDomain(alignedDkimPass.signingDomain), selector: alignedDkimPass.selector, authservId: alignedDkimPass.authservId }
        ));
    } else if (trustedDkim.some(item => ["fail", "permerror"].includes(item.result))) {
        evidence.push(bucAuthenticationEvidence(
            "auth-dkim-fail",
            "AUTH_DKIM_FAIL",
            "DKIM authentication failed at the receiving provider.",
            { authservId: trustedDkim.find(item => item.authservId)?.authservId || "" }
        ));
    }

    if (trustedDmarc && dmarc.result === "pass") {
        evidence.push(bucAuthenticationEvidence(
            "auth-dmarc-pass",
            "AUTH_DMARC_PASS",
            "DMARC passed at the receiving provider.",
            { domain: bucHeaderComparableDomain(dmarc.domain), authservId: dmarc.authservId }
        ));
    } else if (trustedDmarc && ["fail", "permerror"].includes(dmarc.result)) {
        evidence.push(bucAuthenticationEvidence(
            "auth-dmarc-fail",
            "AUTH_DMARC_FAIL",
            `DMARC returned ${dmarc.result.toUpperCase()} at the receiving provider.`,
            { domain: bucHeaderComparableDomain(dmarc.domain), authservId: dmarc.authservId }
        ));
    }

    // A trusted pass that is not aligned is useful context but not automatically a failure.
    if (trustedSpf && spf.result === "pass" && alignment.fromDomain && alignment.spfDomain && !alignment.spfAligned
        && !trustedDmarcPass && !alignedDkimPass) {
        evidence.push(bucAuthenticationEvidence(
            "auth-spf-pass-unaligned",
            "AUTH_DOMAIN_UNALIGNED",
            `SPF passed, but its mail-from domain (${alignment.spfDomain}) does not align with the visible sender domain (${alignment.fromDomain}).`,
            { authservId: spf.authservId }
        ));
    }

    const trustedDkimPasses = trustedDkim.filter(item => item.result === "pass" && item.signingDomain);
    if (trustedDkimPasses.length && alignment.fromDomain
        && !trustedDkimPasses.some(item => bucHeaderDomainsAligned(alignment.fromDomain, item.signingDomain))
        && !trustedDmarcPass && !trustedSpfAlignedPass) {
        evidence.push(bucAuthenticationEvidence(
            "auth-dkim-pass-unaligned",
            "AUTH_DOMAIN_UNALIGNED",
            `DKIM passed, but the signing domain does not align with the visible sender domain (${alignment.fromDomain}).`,
            { signingDomains: trustedDkimPasses.map(item => bucHeaderComparableDomain(item.signingDomain)).filter(Boolean) }
        ));
    }

    const concerning = evidence.filter(item => (Number(item.points) || 0) > 0);
    return {
        score: Math.min(concerning.reduce((total, item) => total + (Number(item.points) || 0), 0), 20),
        warnings: concerning.map(item => item.text),
        evidence,
        model: authentication
    };
}
