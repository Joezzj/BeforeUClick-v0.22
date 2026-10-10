/**
 * BeforeUClick - Shared Hosting / User-Content Platform References (Dataset v1.4)
 *
 * PURPOSE
 * Recognise legitimate infrastructure that can host arbitrary user content.
 * Recognition is deliberately score-neutral: these domains are neither treated as
 * malicious nor as proof that a destination is trustworthy.
 */

const BUC_SHARED_PLATFORM_REFERENCES = [
    { id: "github-pages", name: "GitHub Pages", ownerOrganisationId: "github", domain: "github.io", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [66] },
    { id: "netlify", name: "Netlify", domain: "netlify.app", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [67] },
    { id: "vercel", name: "Vercel", domain: "vercel.app", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [68] },
    { id: "cloudflare-pages", name: "Cloudflare Pages", domain: "pages.dev", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [69] },
    { id: "firebase-web", name: "Firebase Hosting", ownerOrganisationId: "google", domain: "web.app", roles: ["infrastructure", "user-content"], scoreKeys: ["INFRASTRUCTURE_DOMAIN", "USER_CONTENT_HOST"], references: [70] },
    { id: "firebase-app", name: "Firebase Hosting", ownerOrganisationId: "google", domain: "firebaseapp.com", roles: ["infrastructure", "user-content"], scoreKeys: ["INFRASTRUCTURE_DOMAIN", "USER_CONTENT_HOST"], references: [70] },
    { id: "wix", name: "Wix", domain: "wixsite.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [71] },
    { id: "shopify", name: "Shopify", domain: "myshopify.com", roles: ["platform", "user-content"], scoreKeys: ["PLATFORM_PROVIDER", "USER_CONTENT_HOST"], references: [72] },
    { id: "mailchimp-tracking", name: "Mailchimp click tracking", domain: "list-manage.com", roles: ["infrastructure", "tracking-redirect"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [73] },
    { id: "mailchimp-delivery", name: "Mailchimp delivery infrastructure", domain: "mcdlv.net", roles: ["infrastructure", "mail-delivery"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [73] },
    { id: "customerio-tracking", name: "Customer.io click tracking", domain: "customeriomail.com", roles: ["infrastructure", "tracking-redirect", "mail-delivery"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [75] },
    { id: "mandrill-tracking", name: "Mailchimp Transactional / Mandrill tracking", domain: "mandrillapp.com", roles: ["infrastructure", "tracking-redirect", "mail-delivery"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [76] },
    { id: "exclaimer-tracking", name: "Exclaimer signature click tracking", domain: "exclaimer.net", roles: ["infrastructure", "tracking-redirect", "signature-link"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [77] },
    { id: "comosense-tracking", name: "Como / ComoSense email tracking", domain: "comosense.com", roles: ["infrastructure", "tracking-redirect", "mail-delivery"], scoreKeys: ["INFRASTRUCTURE_DOMAIN"], references: [83] }
];
