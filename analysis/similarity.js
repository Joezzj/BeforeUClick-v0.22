// analysis/similarity.js
// Small string-similarity helpers used for explainable look-alike-domain checks.

/** Returns the Levenshtein edit distance between two short strings. */
function bucLevenshteinDistance(a, b) {
    const left = String(a || "").toLowerCase();
    const right = String(b || "").toLowerCase();

    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= right.length; j += 1) {
            const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + substitutionCost);
        }
        previous = current;
    }

    return previous[right.length];
}


/** Returns the registrable label before the public suffix (for example pb from pb.co.nz). */
function bucRegistrableLabel(domainDescription) {
    const registrable = String(domainDescription?.registrableDomain || "");
    const suffix = String(domainDescription?.publicSuffix || "");
    if (!registrable) return "";
    if (suffix && registrable.endsWith(`.${suffix}`)) return registrable.slice(0, -(suffix.length + 1));
    return registrable.split(".")[0] || "";
}

/** Finds a recognised organisation domain suspiciously close to the supplied hostname. */
function bucFindTyposquatReference(hostname) {
    const hostDescription = bucParseDomain(hostname);
    const candidate = hostDescription.registrableDomain || hostDescription.hostname;
    if (!candidate || candidate.length < 4) return null;

    const candidateLabel = bucRegistrableLabel(hostDescription);
    // Generic one-edit matching is unreliable for very short organisation labels: pb.co.nz vs
    // asb.co.nz is a real-world false positive. Short labels need stronger independent evidence.
    if (candidateLabel.length < 4) return null;

    // Never call one sourced official domain a typosquat of another sourced official domain.
    // This matters especially for short, similar organisation names such as ANZ / BNZ: both are
    // legitimate references, and edit-distance alone cannot distinguish them safely.
    for (const reference of BUC_ORGANISATION_REFERENCES) {
        for (const officialDomain of bucReferenceSimilarityDomains(reference)) {
            if (bucHostnameMatchesDomain(hostname, officialDomain)) return null;
        }
    }

    let best = null;

    for (const reference of BUC_ORGANISATION_REFERENCES) {
        for (const officialDomain of bucReferenceSimilarityDomains(reference)) {
            if (bucHostnameMatchesDomain(hostname, officialDomain)) continue;

            const officialDescription = bucParseDomain(officialDomain);
            const officialComparable = officialDescription.registrableDomain || officialDescription.hostname;
            if (!officialComparable || officialComparable === candidate) continue;
            const officialLabel = bucRegistrableLabel(officialDescription);
            if (officialLabel.length < 4) continue;

            const lengthDifference = Math.abs(candidate.length - officialComparable.length);
            if (lengthDifference > 2) continue;

            const maximumDistance = Math.min(candidate.length, officialComparable.length) >= 8 ? 2 : 1;
            const distance = bucLevenshteinDistance(candidate, officialComparable);
            if (distance <= 0 || distance > maximumDistance) continue;

            if (!best || distance < best.distance) {
                best = {
                    organisation: reference,
                    candidateDomain: candidate,
                    officialDomain: officialComparable,
                    distance
                };
            }
        }
    }

    return best;
}
