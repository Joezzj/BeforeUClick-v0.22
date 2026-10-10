/**
 * BeforeUClick - Organisation Reference Data (Reference Dataset v1.6)
 *
 * PURPOSE
 * Sourced organisation names, aliases and domain rules used for:
 * - sender identity checking,
 * - brand/domain consistency,
 * - destination recognition,
 * - typosquatting comparison,
 * - explainable reassuring evidence.
 *
 * REFERENCES
 * Numeric references point to README_REFERENCES.md.
 *
 * DOMAIN ROLE SAFETY
 * Only rules with scoreKey OFFICIAL_DESTINATION or OFFICIAL_SENDER_DOMAIN
 * are intended to reduce the score.
 *
 * Platform/user-content domains are intentionally score-neutral.
 *
 * LAST REVIEWED
 * 2026-10-02
 */

const BUC_ORGANISATION_REFERENCES = [
    {
        id: "microsoft",
        name: "Microsoft",
        aliases: ["microsoft", "microsoft 365", "office 365", "outlook", "hotmail", "windows", "onedrive", "sharepoint"],
        references: [23, 24, 85, 86, 87],
        domainRules: [
            { domain: "microsoft.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "aka.ms", roles: ["short-link"], scoreKeys: ["OFFICIAL_SHORT_LINK"], notes: "Microsoft Support documents aka.ms as a genuine Microsoft short-link domain. The final destination should still be checked." },
            { domain: "cloud.microsoft", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "outlook.cloud.microsoft", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"], notes: "Microsoft 365 endpoint documentation lists Outlook on cloud.microsoft." },
            { domain: "outlook.office.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"], notes: "Microsoft 365 endpoint documentation lists this as an Exchange Online endpoint." },
            { domain: "outlook.office365.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"], notes: "Microsoft 365 endpoint documentation lists this as an Exchange Online endpoint." },
            { domain: "outlook.com", roles: ["platform"], scoreKeys: ["PLATFORM_PROVIDER"] },
            { domain: "live.com", roles: ["platform"], scoreKeys: ["PLATFORM_PROVIDER"] },
            { domain: "office.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "sharepoint.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"] }
        ]
    },
    {
        id: "google",
        name: "Google",
        aliases: ["google", "google account", "gmail", "google drive", "google docs", "google forms", "google workspace", "youtube"],
        references: [25, 26, 74],
        domainRules: [
            { domain: "google.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"], notes: "First-party Google pages and sourced/validated Google sender domain. More-specific user-content rules below override this broad rule." },
            { domain: "sites.google.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Google Sites can contain user-published content; recognised but not reassuring." },
            { domain: "docs.google.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Documents can contain user-controlled content; recognised but not reassuring." },
            { domain: "drive.google.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Drive hosts user-controlled content; recognised but not reassuring." },
            { domain: "forms.google.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Google Forms can contain user-controlled content; recognised but not reassuring." },
            { domain: "storage.googleapis.com", roles: ["infrastructure", "user-content"], scoreKeys: ["INFRASTRUCTURE_DOMAIN", "USER_CONTENT_HOST"] },
            { domain: "googleusercontent.com", roles: ["infrastructure", "user-content"], scoreKeys: ["INFRASTRUCTURE_DOMAIN", "USER_CONTENT_HOST"] },
            { domain: "gmail.com", roles: ["platform", "sender-domain"], scoreKeys: ["PLATFORM_PROVIDER"], notes: "Consumer sender domain; does not earn official-organisation sender reassurance." },
            { domain: "googlemail.com", roles: ["platform", "sender-domain"], scoreKeys: ["PLATFORM_PROVIDER"] },
            { domain: "forms.gle", roles: ["short-link", "user-content"], scoreKeys: ["USER_CONTENT_HOST"] },
            { domain: "c.gle", roles: ["short-link"], scoreKeys: ["OFFICIAL_SHORT_LINK"], notes: "Google-controlled short/redirect domain observed in an authenticated Google Account notification during provider validation; ownership cross-checked against Google infrastructure." },
            { domain: "youtube.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"] }
        ]
    },
    {
        id: "apple",
        name: "Apple",
        aliases: ["apple", "apple account", "apple id", "icloud", "app store"],
        references: [27],
        domainRules: [
            { domain: "apple.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "icloud.com", roles: ["platform"], scoreKeys: ["PLATFORM_PROVIDER"] }
        ]
    },
    {
        id: "paypal",
        name: "PayPal",
        aliases: ["paypal", "paypal security", "paypal account"],
        references: [22],
        domainRules: [
            { domain: "paypal.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "amazon",
        name: "Amazon / AWS",
        aliases: ["amazon", "amazon web services", "aws", "amazon account", "amazon prime"],
        references: [51],
        domainRules: [
            { domain: "amazon.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "amazon.com.au", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "aws.amazon.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "amazonaws.com", roles: ["infrastructure", "user-content"], scoreKeys: ["INFRASTRUCTURE_DOMAIN", "USER_CONTENT_HOST"], notes: "Cloud-hosting infrastructure can host arbitrary customer content." }
        ]
    },
    {
        id: "meta",
        name: "Meta / Facebook / Instagram",
        aliases: ["meta", "facebook", "instagram", "messenger", "meta support", "facebook support", "instagram support"],
        references: [50, 52, 82],
        domainRules: [
            { domain: "meta.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "facebook.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"] },
            { domain: "instagram.com", roles: ["platform", "user-content", "sender-domain"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST", "OFFICIAL_SENDER_DOMAIN"], notes: "Instagram destinations can contain user-controlled content, so destination handling remains score-neutral; SPF/DKIM-aligned provider validation confirmed mail.instagram.com as a first-party sender subdomain." },
            { domain: "facebookmail.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "linkedin",
        name: "LinkedIn",
        aliases: ["linkedin", "linkedin recruiter", "linkedin support", "linkedin jobs"],
        references: [33, 80],
        domainRules: [
            { domain: "linkedin.com", roles: ["platform", "user-content", "sender-domain"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST", "OFFICIAL_SENDER_DOMAIN"], notes: "LinkedIn's own Help guidance tells users to trust mail from @linkedin.com. Link destinations remain user-content/platform context rather than a general safety guarantee." },
            { domain: "cs.linkedin.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "e.linkedin.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "el.linkedin.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "dropbox",
        name: "Dropbox",
        aliases: ["dropbox", "dropbox sign", "hellosign", "docsend"],
        references: [34],
        domainRules: [
            { domain: "dropbox.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Provider is legitimate but shared links can contain user-controlled content." },
            { domain: "dropboxmail.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "dropboxpartners.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "docsend.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"] },
            { domain: "dropboxusercontent.com", roles: ["user-content"], scoreKeys: ["USER_CONTENT_HOST"] },
            { domain: "db.tt", roles: ["short-link"], scoreKeys: ["OFFICIAL_SHORT_LINK"] }
        ]
    },
    {
        id: "adobe",
        name: "Adobe",
        aliases: ["adobe", "acrobat", "creative cloud", "adobe account", "adobe sign"],
        references: [35],
        domainRules: [
            { domain: "adobe.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "adobelogin.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "adobe-identity.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "adobe.io", roles: ["infrastructure", "platform"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"] }
        ]
    },
    {
        id: "netflix",
        name: "Netflix",
        aliases: ["netflix", "netflix account", "netflix billing", "netflix subscription"],
        references: [36],
        domainRules: [
            { domain: "netflix.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "docusign",
        name: "Docusign",
        aliases: ["docusign", "docu sign"],
        references: [37],
        domainRules: [
            { domain: "docusign.com", roles: ["platform"], scoreKeys: ["PLATFORM_PROVIDER"], notes: "Docusign itself documents abuse of legitimate platform notifications; no normal reassurance deduction." },
            { domain: "docusign.net", roles: ["platform", "sender-domain"], scoreKeys: ["PLATFORM_PROVIDER", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "xero",
        name: "Xero",
        aliases: ["xero", "xero accounting", "xero support", "xero invoice"],
        references: [38],
        domainRules: [
            { domain: "xero.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },

    // New Zealand government / public services
    {
        id: "ird",
        name: "Inland Revenue New Zealand",
        aliases: ["ird", "inland revenue", "myir"],
        references: [10],
        domainRules: [
            { domain: "ird.govt.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "nzta",
        name: "NZ Transport Agency Waka Kotahi",
        aliases: ["nzta", "waka kotahi", "new zealand transport agency"],
        references: [21],
        domainRules: [
            { domain: "nzta.govt.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "acc",
        name: "ACC New Zealand",
        aliases: ["acc", "acc new zealand", "myacc", "acc levy", "acc claim"],
        references: [42],
        domainRules: [
            { domain: "acc.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "ext.acc.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"], notes: "ACC explicitly documents noreply@ext.acc.nz for Voice of Customer surveys." }
        ]
    },
    {
        id: "nz-police",
        name: "New Zealand Police",
        aliases: ["new zealand police", "nz police"],
        references: [43],
        domainRules: [
            { domain: "police.govt.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "work-and-income",
        name: "Work and Income New Zealand",
        aliases: ["work and income", "winz", "mymsd", "ministry of social development"],
        references: [44],
        domainRules: [
            { domain: "workandincome.govt.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "realme",
        name: "RealMe",
        aliases: ["realme", "realme login", "realme verified identity"],
        references: [45],
        domainRules: [
            { domain: "realme.govt.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "login.realme.govt.nz", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] }
        ]
    },

    // New Zealand postal / marketplace
    {
        id: "nzpost",
        name: "NZ Post",
        aliases: ["nz post", "new zealand post", "courierpost", "courier post"],
        references: [9],
        domainRules: [
            { domain: "nzpost.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "nzp.st", roles: ["short-link"], scoreKeys: ["OFFICIAL_SHORT_LINK"] }
        ]
    },
    {
        id: "trademe",
        name: "Trade Me",
        aliases: ["trade me", "trademe", "trade me support", "trade me payments"],
        references: [20],
        domainRules: [
            { domain: "trademe.co.nz", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"] },
            { domain: "email.trademe.co.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "mail.trademe.co.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "transactional.trademe.co.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "transactional-admin.trademe.co.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "site.trademe.co.nz", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] }
        ]
    },

    // New Zealand banks
    {
        id: "anz-nz",
        name: "ANZ New Zealand",
        aliases: ["anz", "anz bank", "anz new zealand"],
        references: [14, 81],
        domainRules: [
            { domain: "anz.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "anz.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"], notes: "ANZ Banking Group careers are hosted at careers.anz.com, including New Zealand roles. This relationship is destination context and does not make third-party recruiting senders official ANZ senders." }
        ]
    },
    {
        id: "asb",
        name: "ASB Bank",
        aliases: ["asb", "asb bank", "asb fraud"],
        references: [11],
        domainRules: [
            { domain: "asb.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "bnz",
        name: "Bank of New Zealand",
        aliases: ["bnz", "bank of new zealand", "bnz fraud"],
        references: [12],
        domainRules: [
            { domain: "bnz.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "westpac-nz",
        name: "Westpac New Zealand",
        aliases: ["westpac", "westpac nz", "westpac new zealand"],
        references: [13],
        domainRules: [
            { domain: "westpac.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "kiwibank",
        name: "Kiwibank",
        aliases: ["kiwibank", "kiwibank internet banking"],
        references: [15, 16],
        domainRules: [
            { domain: "kiwibank.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },

    // New Zealand telecommunications
    {
        id: "spark-nz",
        name: "Spark New Zealand",
        aliases: ["spark", "spark nz", "spark new zealand", "xtra", "xtra mail"],
        references: [17],
        domainRules: [
            { domain: "spark.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "one-nz",
        name: "One New Zealand",
        aliases: ["one nz", "one new zealand", "vodafone nz"],
        references: [18],
        domainRules: [
            { domain: "one.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "2degrees",
        name: "2degrees",
        aliases: ["2degrees", "2 degrees"],
        references: [19],
        domainRules: [
            { domain: "2degrees.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },

    // New Zealand grocery / retail groups
    {
        id: "foodstuffs-nz",
        name: "Foodstuffs New Zealand / Club+",
        aliases: ["foodstuffs", "new world", "club+", "club plus", "pak'n save", "pak'nsave", "paknsave", "four square"],
        references: [78],
        domainRules: [
            { domain: "foodstuffs.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"], notes: "Foodstuffs group domain observed in authenticated New World / Club+ campaign mail and supported by Foodstuffs' own brand-family documentation." },
            { domain: "newworld.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "clubplus.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },

    // New Zealand utilities
    {
        id: "contact-energy",
        name: "Contact Energy",
        aliases: ["contact energy"],
        references: [46],
        domainRules: [
            { domain: "contact.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "mercury",
        name: "Mercury",
        aliases: ["mercury", "mercury energy", "mercury nz"],
        references: [47, 84],
        domainRules: [
            { domain: "mercury.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "mercuryonline.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"], notes: "Provider validation confirmed Mercury online-bill mail signed/mailed by mercuryonline.co.nz with Reply-To on mercury.co.nz; used as one Mercury organisation family." }
        ]
    },
    {
        id: "meridian",
        name: "Meridian Energy",
        aliases: ["meridian", "meridian energy"],
        references: [48],
        domainRules: [
            { domain: "meridianenergy.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "genesis",
        name: "Genesis Energy",
        aliases: ["genesis", "genesis energy", "genesis nz"],
        references: [49],
        domainRules: [
            { domain: "genesisenergy.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },


    // Additional high-value / commonly impersonated services (Dataset v1.1)
    {
        id: "auckland-council",
        name: "Auckland Council",
        aliases: ["auckland council", "myauckland", "auckland rates"],
        references: [60],
        domainRules: [
            { domain: "aucklandcouncil.govt.nz", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] }
        ]
    },
    {
        id: "immigration-nz",
        name: "Immigration New Zealand",
        aliases: ["immigration new zealand", "immigration nz", "inz", "nz immigration"],
        references: [61],
        domainRules: [
            { domain: "immigration.govt.nz", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] }
        ]
    },
    {
        id: "health-nz",
        name: "Health New Zealand | Te Whatu Ora",
        aliases: ["health new zealand", "health nz", "te whatu ora"],
        references: [62],
        domainRules: [
            { domain: "healthnz.govt.nz", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] }
        ]
    },
    {
        id: "wise",
        name: "Wise",
        aliases: ["wise account", "wise transfer", "wise payments", "transferwise"],
        references: [63],
        domainRules: [
            { domain: "wise.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"], notes: "Wise states links in its ordinary emails direct to wise.com; research invitations may use approved third parties." }
        ]
    },
    {
        id: "stripe",
        name: "Stripe",
        aliases: ["stripe", "stripe payments", "stripe account", "stripe support"],
        references: [64],
        domainRules: [
            { domain: "stripe.com", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "stripe.dev", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "stripe.events", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "stripe.global", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "link.com", roles: ["platform"], scoreKeys: ["PLATFORM_PROVIDER"], notes: "Stripe documents this as an official web domain; kept score-neutral because it is a payment platform surface." }
        ]
    },
    {
        id: "discord",
        name: "Discord",
        aliases: ["discord", "discord support", "discord nitro"],
        references: [65],
        domainRules: [
            { domain: "discord.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "Discord itself is legitimate, but user-controlled communities/invites mean recognition is not a safety signal." }
        ]
    },
    {
        id: "github",
        name: "GitHub",
        aliases: ["github", "github security", "github account"],
        references: [66],
        domainRules: [
            { domain: "github.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], notes: "GitHub hosts user-controlled repositories and content; recognised but score-neutral." }
        ]
    },

    // Travel / shipping
    {
        id: "air-nz",
        name: "Air New Zealand",
        aliases: ["air new zealand", "air nz", "airpoints"],
        references: [53, 79],
        domainRules: [
            { domain: "airnewzealand.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "airnz.co.nz", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"], notes: "Alternate Air New Zealand domain observed in SPF/DKIM-aligned provider-validation mail; normal subdomains such as comms.airnz.co.nz and clicks.airnz.co.nz inherit this role." }
        ]
    },
    {
        id: "dhl",
        name: "DHL",
        aliases: ["dhl", "dhl express", "mydhl", "dhl delivery"],
        references: [39],
        domainRules: [
            { domain: "dhl.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] },
            { domain: "express.dhl", roles: ["first-party"], scoreKeys: ["OFFICIAL_DESTINATION"] },
            { domain: "dpdhl.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] },
            { domain: "dhl-news.com", roles: ["sender-domain"], scoreKeys: ["OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "fedex",
        name: "FedEx",
        aliases: ["fedex", "fedex delivery", "fedex tracking"],
        references: [40],
        domainRules: [
            { domain: "fedex.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    },
    {
        id: "ups",
        name: "UPS",
        aliases: ["ups", "united parcel service", "ups delivery", "ups tracking"],
        references: [41],
        domainRules: [
            { domain: "ups.com", roles: ["first-party", "sender-domain"], scoreKeys: ["OFFICIAL_DESTINATION", "OFFICIAL_SENDER_DOMAIN"] }
        ]
    }
];
