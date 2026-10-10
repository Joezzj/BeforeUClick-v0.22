if (new URLSearchParams(location.search).get("embedded") === "1") document.body.classList.add("embedded");
// settings/reference_data.js
// Read-only local reference catalogue used by BeforeUClick checks.

function bucRenderReferenceTags(containerId, items) {
    const container = document.getElementById(containerId);
    container.textContent = "";
    items.forEach(value => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = value;
        container.appendChild(tag);
    });
}

function bucOrganisationReferenceLabel(item) {
    const firstRule = item.domainRules?.[0];
    const domain = firstRule?.domain || item.officialDomains?.[0] || item.officialShortDomains?.[0] || "reference";
    return `${item.name} — ${domain}`;
}

function bucRenderReferenceData() {
    document.getElementById("organisationCount").textContent = BUC_ORGANISATION_REFERENCES.length;
    bucRenderReferenceTags("organisationList", BUC_ORGANISATION_REFERENCES.map(bucOrganisationReferenceLabel));
    document.getElementById("wordingCount").textContent = BUC_WORDING_PATTERN_GROUPS.length;
    bucRenderReferenceTags("wordingList", BUC_WORDING_PATTERN_GROUPS.map(item => `${item.name} — ${item.evidenceClass || "WORDING_WEAK"}`));
    document.getElementById("namespaceCount").textContent = BUC_CONTROLLED_NAMESPACES.length;
    bucRenderReferenceTags("namespaceList", BUC_CONTROLLED_NAMESPACES.map(item => item.suffix));
    document.getElementById("platformCount").textContent = BUC_SHARED_PLATFORM_REFERENCES.length;
    bucRenderReferenceTags("platformList", BUC_SHARED_PLATFORM_REFERENCES.map(item => `${item.name} — ${item.domain} (${(item.roles || []).join(", ")})`));
    document.getElementById("freemailCount").textContent = BUC_FREEMAIL_DOMAINS.length;
    bucRenderReferenceTags("freemailList", BUC_FREEMAIL_DOMAINS);
    document.getElementById("threatCount").textContent = BUC_THREAT_SOURCE_DEFINITIONS.length;
    bucRenderReferenceTags("threatList", BUC_THREAT_SOURCE_DEFINITIONS.map(item => `${item.name} — ${item.evidenceClass} (${item.integrationStatus})`));
    const evidenceEntries = Object.entries(BUC_REFERENCE_EVIDENCE_CLASSES);
    document.getElementById("evidenceCount").textContent = evidenceEntries.length;
    bucRenderReferenceTags("evidenceList", evidenceEntries.map(([key, value]) => {
        const points = Number(value.suggestedPoints) || 0;
        const signed = points > 0 ? `+${points}` : String(points);
        return `${key} — ${signed} (${value.affectsScore ? "score" : "context"})`;
    }));
    document.getElementById("reputationCount").textContent = BUC_REPUTATION_SOURCE_DEFINITIONS.length;
    bucRenderReferenceTags("reputationList", BUC_REPUTATION_SOURCE_DEFINITIONS.map(item => `${item.name} — ${item.evidenceClass} (${item.integrationStatus})`));
}

(async function initialiseReferenceData() {
    const preferences = await bucGetPreferences();
    bucApplyExtensionPagePreferences(preferences);
    bucRenderReferenceData();
})().catch(() => {});
