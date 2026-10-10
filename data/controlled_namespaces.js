/**
 * BeforeUClick - Controlled / Moderated Namespace Data (Reference Dataset v1.0)
 *
 * Only entries marked affectsScore=true are intended to create a small
 * reassuring deduction via CONTROLLED_NAMESPACE.
 */

const BUC_CONTROLLED_NAMESPACES = [
    { suffix: "cri.nz", label: "New Zealand Crown Research Institute namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "govt.nz", label: "New Zealand Government namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "health.nz", label: "New Zealand health-sector namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "iwi.nz", label: "New Zealand iwi namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "mil.nz", label: "New Zealand military namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "parliament.nz", label: "New Zealand Parliament namespace", scoreKey: "CONTROLLED_NAMESPACE", affectsScore: true, references: [2] },
    { suffix: "microsoft", label: "Microsoft-operated single-registrant top-level domain", scoreKey: "OFFICIAL_DESTINATION", affectsScore: true, references: [23], organisationId: "microsoft" }
];

/*
 * Deliberately not treated as controlled/reassuring:
 * .org, .org.nz, .co.nz, .net.nz, .ac.nz, .school.nz and similar public namespaces.
 */
