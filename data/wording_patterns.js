/**
 * BeforeUClick - Wording / Behaviour Pattern Data (Reference Dataset v1.0)
 *
 * SCORE POLICY
 * Every group points to an evidenceClass. The scoring engine should map
 * that class to points and continue enforcing the overall wording cap.
 *
 * Individual regex phrases are implementation-derived examples unless
 * explicitly stated otherwise. References support the broader behaviour.
 */

const BUC_WORDING_PATTERN_GROUPS = [
    {
        id: "urgency",
        name: "Urgency or time pressure",
        evidenceClass: "WORDING_WEAK",
        references: [3, 7, 11, 12, 15, 18, 20, 33, 39, 41],
        patterns: [
            /\burgent\b/i, /\bimmediately\b/i, /\bact now\b/i, /\baction required\b/i,
            /\baction needed\b/i, /\brespond immediately\b/i, /\bwithin 24 hours\b/i,
            /\bfinal warning\b/i, /\blast warning\b/i, /\bdo not delay\b/i,
            /\btime sensitive\b/i, /\bmust act\b/i
        ]
    },
    {
        id: "account-threat",
        name: "Account lock, suspension or closure threat",
        evidenceClass: "WORDING_MEDIUM",
        references: [10, 15, 17, 18, 19, 33],
        patterns: [
            /\baccount (?:has been |is )?(?:locked|blocked|suspended|restricted|disabled)\b/i,
            /\baccount will be (?:locked|blocked|suspended|restricted|closed)\b/i,
            /\baccess (?:has been |is )?(?:limited|restricted|suspended)\b/i,
            /\baccount (?:requires|needs) verification\b/i,
            /\bverify (?:your )?account to (?:continue|restore|avoid)\b/i
        ]
    },
    {
        id: "account-compromised",
        name: "Claim of compromised or suspicious account activity",
        evidenceClass: "WORDING_MEDIUM",
        references: [11, 12, 14, 17, 18, 42],
        patterns: [
            /\bsuspicious activity\b/i, /\bunusual activity\b/i,
            /\bunauthori[sz]ed (?:activity|transaction|login)\b/i,
            /\bsuspicious transaction\b/i, /\baccount (?:has been|may be) compromised\b/i,
            /\bsecurity alert\b/i, /\bfraud(?:ulent)? activity\b/i
        ]
    },
    {
        id: "credential-request",
        name: "Credential or account verification request",
        evidenceClass: "WORDING_MEDIUM",
        references: [3, 6, 9, 15, 18, 20, 22, 34, 36, 50],
        patterns: [
            /\bverify (?:your )?(?:account|identity|login|details|information)\b/i,
            /\bconfirm (?:your )?(?:account|identity|login|details|information)\b/i,
            /\bvalidate (?:your )?(?:account|identity|details|information)\b/i,
            /\bre-enter (?:your )?(?:password|login|credentials)\b/i,
            /\bsign in to (?:verify|confirm|restore|continue)\b/i,
            /\blog in to (?:verify|confirm|restore|continue)\b/i
        ]
    },
    {
        id: "password-request",
        name: "Password / PIN request",
        evidenceClass: "WORDING_STRONG",
        references: [6, 9, 11, 13, 15, 18, 19, 22, 33, 36, 45],
        patterns: [
            /\b(?:send|share|provide|reply with|enter|confirm) (?:your )?password\b/i,
            /\b(?:send|share|provide|reply with|enter|confirm) (?:your )?pin\b/i,
            /\bconfirm your password\b/i, /\bverify your password\b/i,
            /\bonline banking password\b/i, /\binternet banking password\b/i
        ]
    },
    {
        id: "mfa-code-request",
        name: "One-time code / MFA / verification-code request",
        evidenceClass: "WORDING_STRONG",
        references: [7, 11, 13, 15, 18, 22, 39, 45, 50],
        patterns: [
            /\b(?:send|share|provide|reply with|read out) (?:the |your )?(?:one[- ]time|verification|security|authentication) code\b/i,
            /\b(?:send|share|provide|reply with|read out) (?:the |your )?(?:otp|2fa|mfa) code\b/i,
            /\bnetcode\b/i, /\bone[- ]time pin\b/i, /\bone[- ]time password\b/i,
            /\bverification code\b/i, /\bauthentication code\b/i, /\bsecurity code\b/i
        ]
    },
    {
        id: "personal-information-request",
        name: "Personal information request",
        evidenceClass: "WORDING_MEDIUM",
        references: [4, 6, 9, 15, 18, 20, 36, 42, 50],
        patterns: [
            /\bprovide (?:your )?personal information\b/i,
            /\bconfirm (?:your )?personal information\b/i,
            /\bdate of birth\b/i, /\bdriver(?:'s)? licence (?:number|details)\b/i,
            /\bpassport (?:number|details)\b/i, /\bsecurity questions?\b/i
        ]
    },
    {
        id: "card-payment-data",
        name: "Payment card or banking-data request",
        evidenceClass: "WORDING_STRONG",
        references: [3, 9, 11, 12, 13, 15, 18, 20, 36, 40, 41, 42],
        patterns: [
            /\bcredit card (?:number|details|information)\b/i,
            /\bdebit card (?:number|details|information)\b/i,
            /\bcard number\b/i, /\bcvv\b/i, /\bcvc\b/i, /\bexpiry date\b/i,
            /\bbank account (?:number|details)\b/i, /\bbanking details\b/i
        ]
    },
    {
        id: "payment-pressure",
        name: "Payment, bill or invoice pressure",
        evidenceClass: "WORDING_MEDIUM",
        references: [6, 12, 13, 17, 19, 21, 38, 41, 42, 46, 47],
        patterns: [
            /\boverdue (?:payment|invoice|bill|account|levy)\b/i,
            /\b(?:your|the) (?:invoice|bill|account|balance|payment) is overdue\b/i,
            /\bpayment (?:is )?overdue\b/i, /\boutstanding (?:payment|invoice|balance|amount)\b/i,
            /\bpay (?:now|immediately|today)\b/i,
            /\bpay (?:this|the|your|our) (?:invoice|bill|balance|amount|account) (?:now|immediately|today)\b/i,
            /\bsettle (?:this|the|your|our)? ?(?:outstanding )?(?:invoice|bill|balance|amount|account) (?:now|immediately|today)\b/i,
            /\bpayment (?:is )?(?:required|due) (?:now|immediately|today)\b/i,
            /\bpayment required\b/i, /\bpayment failed\b/i,
            /\bfailed payment\b/i, /\blate fee\b/i
        ]
    },
    {
        id: "changed-payment-details",
        name: "Changed supplier or bank-payment details",
        evidenceClass: "WORDING_STRONG",
        references: [16],
        patterns: [
            /\b(?:our|my) bank (?:account|details) (?:has|have) changed\b/i,
            /\bnew bank account\b/i, /\bnew payment details\b/i,
            /\bupdated payment details\b/i,
            /\b(?:bank|payment) details (?:are|have been) (?:new|updated|changed)\b/i,
            /\bplease (?:use|pay (?:this|the) invoice using) (?:our|the|these)? ?new (?:bank )?(?:account|details)\b/i,
            /\buse (?:our|the) new account\b/i
        ]
    },
    {
        id: "refund-reward",
        name: "Refund, reward or expiring-points lure",
        evidenceClass: "WORDING_WEAK",
        references: [9, 10, 13, 42],
        patterns: [
            /\b(?:tax |levy )?refund\b/i, /\brefund available\b/i,
            /\byou are eligible for (?:a )?refund\b/i,
            /\brewards? (?:points? )?(?:will )?expire\b/i,
            /\bredeem (?:your )?(?:reward|rewards|points)\b/i,
            /\bclaim (?:your )?(?:refund|reward|rewards)\b/i
        ]
    },
    {
        id: "prize-too-good",
        name: "Prize / giveaway / too-good-to-be-true lure",
        evidenceClass: "WORDING_WEAK",
        references: [7, 17, 19, 33, 50],
        patterns: [
            /\byou(?:'ve| have) won\b/i, /\bclaim your prize\b/i,
            /\bfree gift\b/i, /\bexclusive reward\b/i, /\binheritance\b/i,
            /\btoo good to be true\b/i
        ]
    },
    {
        id: "gift-card",
        name: "Gift-card payment or code request",
        evidenceClass: "WORDING_STRONG",
        references: [7],
        patterns: [
            /\bbuy (?:a |some )?gift cards?\b/i, /\bpurchase (?:a |some )?gift cards?\b/i,
            /\bpay (?:me|us|them)? ?(?:with|using) (?:a )?gift card\b/i,
            /\bgift card (?:number|numbers|pin)\b/i,
            /\bsend (?:a )?(?:photo|picture) of (?:the )?gift card\b/i
        ]
    },
    {
        id: "secrecy-isolation",
        name: "Secrecy or isolation request",
        evidenceClass: "WORDING_STRONG",
        references: [7],
        patterns: [
            /\bkeep (?:this|it) (?:a )?secret\b/i, /\bdon'?t tell anyone\b/i,
            /\bdo not tell anyone\b/i, /\bdo not discuss\b/i,
            /\bkeep this confidential\b/i, /\bbetween you and me\b/i
        ]
    },
    {
        id: "remote-access",
        name: "Remote-access or software-install request",
        evidenceClass: "WORDING_STRONG",
        references: [11, 13, 14, 17, 19, 42],
        patterns: [
            /\bremote access\b/i, /\bremotely access\b/i,
            /\bdownload (?:this |the )?(?:remote support|remote control|remote|support|screen[- ]sharing|remote-access) (?:software|app|application|tool)\b/i,
            /\binstall (?:this |the )?(?:remote support|remote control|remote|support|screen[- ]sharing|remote-access) (?:software|app|application|tool)\b/i,
            /\bdownload (?:this |the )?(?:remote support|remote control) (?:software|tool)\b/i,
            /\bteamviewer\b/i, /\banydesk\b/i, /\bawe ?sun\b/i,
            /\ballow (?:me|us|our team) access to your (?:computer|device|phone)\b/i
        ]
    },
    {
        id: "parcel-delivery",
        name: "Parcel / delivery problem lure",
        evidenceClass: "WORDING_WEAK",
        references: [3, 9, 15, 39, 40, 41],
        patterns: [
            /\bmissed (?:your )?(?:parcel|delivery)\b/i,
            /\bdelivery (?:failed|issue|problem)\b/i, /\bparcel (?:is )?(?:on hold|held|delayed)\b/i,
            /\bupdate (?:your )?delivery address\b/i, /\bredelivery fee\b/i
        ]
    },
    {
        id: "toll-vehicle",
        name: "Road toll / vehicle-licence lure",
        evidenceClass: "WORDING_WEAK",
        references: [15, 21],
        patterns: [
            /\boverdue toll\b/i, /\bunpaid toll\b/i, /\btoll payment\b/i,
            /\broad toll\b/i, /\brego\b/i, /\bvehicle licence\b/i,
            /\broad user charges?\b/i, /\bruc\b/i
        ]
    },
    {
        id: "link-pressure",
        name: "Pressure to click/follow a link",
        evidenceClass: "WORDING_WEAK",
        references: [4, 6, 15, 18, 20, 34, 39],
        patterns: [
            /\bclick (?:the |this )?link\b/i, /\bclick below\b/i,
            /\bfollow (?:the |this )?link\b/i, /\bopen (?:the |this )?link\b/i,
            /\bcomplete (?:the |your )?(?:verification|process) (?:here|below)\b/i
        ]
    },
    {
        id: "attachment-pressure",
        name: "Unexpected attachment / file request",
        evidenceClass: "WORDING_MEDIUM",
        references: [6, 15, 18, 33, 39],
        patterns: [
            /\bopen (?:the |this )?attachment\b/i, /\bdownload (?:the |this )?attachment\b/i,
            /\battached invoice\b/i, /\battached document\b/i, /\bopen the file\b/i
        ]
    },
    {
        id: "generic-greeting",
        name: "Generic greeting",
        evidenceClass: "WORDING_WEAK",
        references: [9, 12, 15, 18, 33, 37, 39, 41],
        patterns: [
            /\bdear customer\b/i, /\bdear user\b/i, /\bdear account holder\b/i,
            /\bdear sir or madam\b/i, /\bvalued customer\b/i
        ]
    },
    {
        id: "boss-authority-favour",
        name: "Authority / boss / unusual favour request",
        evidenceClass: "WORDING_MEDIUM",
        references: [7, 8],
        patterns: [
            /\bcan you do me a favou?r\b/i, /\burgent favou?r\b/i,
            /\bi'?m in a meeting\b/i, /\bi cannot talk right now\b/i,
            /\bhandle this for me\b/i
        ]
    },
    {
        id: "storage-quota",
        name: "Mailbox storage / quota lure",
        evidenceClass: "WORDING_WEAK",
        references: [17],
        patterns: [
            /\bmailbox (?:is )?full\b/i, /\bstorage (?:is )?(?:full|exceeded)\b/i,
            /\bquota (?:is )?exceeded\b/i, /\bupgrade (?:your )?(?:mailbox|storage)\b/i
        ]
    },

    // Expanded v1.0 categories
    {
        id: "investment-crypto",
        name: "Investment / cryptocurrency opportunity",
        evidenceClass: "WORDING_MEDIUM",
        references: [33, 43, 50],
        patterns: [
            /\bguaranteed returns?\b/i, /\bhigh returns? with (?:little|no) risk\b/i,
            /\bcrypto(?:currency)? investment\b/i, /\binvestment opportunity\b/i,
            /\bdouble your (?:money|investment)\b/i, /\btransfer (?:money|crypto)\b/i
        ]
    },
    {
        id: "seed-phrase-request",
        name: "Cryptocurrency seed/recovery phrase request",
        evidenceClass: "WORDING_STRONG",
        references: [54],
        patterns: [
            /\bseed phrase\b/i, /\brecovery phrase\b/i, /\bwallet recovery words?\b/i,
            /\b(?:send|share|enter|provide) (?:your )?(?:seed|recovery) phrase\b/i
        ]
    },
    {
        id: "friend-family-emergency",
        name: "Friend / family emergency money request",
        evidenceClass: "WORDING_MEDIUM",
        references: [50],
        patterns: [
            /\bi need money urgently\b/i, /\bemergency.*(?:money|payment|transfer)\b/i,
            /\bplease don'?t call\b/i, /\bnew phone number\b/i,
            /\bhelp me pay\b/i
        ]
    },
    {
        id: "job-recruitment",
        name: "Suspicious job / recruitment offer",
        evidenceClass: "WORDING_MEDIUM",
        references: [33, 43],
        patterns: [
            /\bwork from home\b/i, /\bno experience (?:needed|required)\b/i,
            /\beasy money\b/i, /\bhigh pay\b/i, /\bjob offer\b/i,
            /\bpay a (?:fee|deposit) to (?:start|apply)\b/i
        ]
    },
    {
        id: "subscription-renewal",
        name: "Unexpected subscription renewal / purchase confirmation",
        evidenceClass: "WORDING_MEDIUM",
        references: [36, 37],
        patterns: [
            /\bsubscription (?:renewal|renewed|has (?:been )?renewed|was renewed|remains active)\b/i,
            /\bpurchase confirmation\b/i, /\brenewal notice\b/i,
            /\bautomatic renewal\b/i, /\bunauthori[sz]ed (?:purchase|charge)\b/i
        ]
    },
    {
        id: "document-esign",
        name: "Unexpected document / e-signature request",
        evidenceClass: "WORDING_WEAK",
        references: [37],
        patterns: [
            /\breview (?:and )?sign\b/i, /\breview document\b/i,
            /\bsignature required\b/i, /\bdocuments? pending\b/i,
            /\be-?sign\b/i, /\bsecure document\b/i
        ]
    },
    {
        id: "qr-quishing",
        name: "QR-code / quishing instruction",
        evidenceClass: "WORDING_MEDIUM",
        references: [37],
        patterns: [
            /\bscan (?:the |this )?qr code\b/i, /\bscan to (?:login|sign in|verify|view|pay)\b/i,
            /\bqr code\b/i
        ]
    },
    {
        id: "fake-support-callback",
        name: "Unexpected support phone/callback instruction",
        evidenceClass: "WORDING_MEDIUM",
        references: [37, 38, 50],
        patterns: [
            /\bcall (?:support|customer service) (?:now|immediately)\b/i,
            /\bcall this number\b/i, /\bcontact support immediately\b/i,
            /\bto dispute (?:this|the) charge call\b/i
        ]
    },
    {
        id: "police-legal-authority",
        name: "Police / legal authority impersonation",
        evidenceClass: "WORDING_MEDIUM",
        references: [43, 54],
        patterns: [
            /\b(?:this is|we are|from) (?:the )?(?:police|law enforcement)\b/i,
            /\b(?:police|law enforcement) (?:notice|warning|investigation|case)\b/i,
            /\b(?:arrest warrant|warrant for your arrest)\b/i,
            /\blegal action (?:against you|will be taken|has been (?:started|initiated))\b/i, /\byour identity was found\b/i,
            /\bwithdraw (?:cash|money) for (?:evidence|investigation)\b/i
        ]
    },
    {
        id: "charity-disaster",
        name: "Charity / disaster donation pressure",
        evidenceClass: "WORDING_WEAK",
        references: [6],
        patterns: [
            /\bdonate now\b/i, /\burgent donation\b/i, /\bdisaster relief\b/i,
            /\bemergency appeal\b/i
        ]
    }
];
