# Trovan Company Launch Action Board

Date: 2026-08-25

Use this board with `company-go-to-market-master-checklist.md`. It separates work Codex can complete from decisions, credentials, signatures, and professional approvals that must come from the founder or licensed advisors.

## Responsibility map

| Work type | Codex can do | Founder must do | Professional/external party must do |
| --- | --- | --- | --- |
| Company formation | Prepare decision brief, filing checklist, records structure, resolutions checklist, and compliance calendar | Choose entity, provide identity/address/owners, authorize filing, sign, pay fees | Attorney/formation provider files or reviews; CPA advises tax election |
| Tax and accounting | Prepare CPA question list, chart-of-accounts requirements, revenue/refund workflow, nexus tracker, and recurring calendar | Open accounts, provide financial facts, authorize registrations, make payments | CPA determines elections, taxability, registrations, returns, and accounting treatment |
| Banking | Prepare banking-control checklist and reconciliation procedure | Open and control bank/credit accounts; approve signers | Bank verifies identity and opens accounts |
| Contracts and policies | Draft product-specific issue lists, commercial terms, order-form fields, DPA/security requirements, and counsel redlines | Choose business positions and authorized signer | Attorney drafts/approves final legal text and jurisdiction-specific terms |
| Trademark and IP | Inventory assets, document provenance, prepare clearance/search brief, and identify assignment gaps | Confirm creators/owners and authorize filings | Trademark counsel clears and files; parties sign assignments |
| Insurance | Prepare risk profile, application data checklist, coverage/contract comparison | Apply, answer underwriting questions, bind and pay | Licensed broker/carrier recommends and issues coverage |
| Website | Implement and test pages, metadata, accessibility, forms, truthful copy, sitemap, headers, and launch assets | Approve identity/contact/claims and authorize deployment | Counsel approves legal copy; providers host/deliver services |
| Marketing | Define ICP draft, positioning, message, claims register, content plan, campaign briefs, email templates, and measurement | Approve audience/voice/budget; provide genuine proof; authorize sends | Customers approve publicity; counsel reviews regulated outreach when needed |
| Sales | Build CRM schema, stages, qualification, discovery, demo, proposal requirements, mutual action plan, and handoff | Run/approve outreach, negotiate, make promises, sign deals | Counsel reviews nonstandard contracts; customer procurement approves |
| Product/security | Inspect/fix repository, tests, release gates, security controls, runbooks, evidence schemas, and staging scripts | Supply provider accounts/credentials and approve deployment | Providers provision accounts; external reviewer performs independent review if desired |
| Billing | Build/test operator workflows, catalog consistency, reconciliation, cancellation/refund runbooks | Create/own Stripe account, approve prices/refunds, authorize charges | Stripe processes payments; CPA determines tax/accounting treatment |
| Privacy/data | Build inventory, retention worksheet, rights workflow, subprocessor register, and technical controls | Choose business purposes/retention and approve subprocessors | Counsel approves privacy/DPA/legal basis; providers supply contractual details |
| Hiring | Prepare role, onboarding/offboarding, access, equipment, and document checklists | Choose/hire/manage people and approve compensation | Employment counsel/payroll/broker handle legal classification, payroll, benefits, insurance |
| Production/customer operations | Build checklists, dashboards, support macros, incident/rollback/restore procedures, and evidence records | Approve go-live, own customer communication, provide operator coverage | Cloud/provider systems execute hosted operations; customer supplies approvals/data |

## Active workstream

| ID | Deliverable | Owner | Status | Completion evidence / next action |
| --- | --- | --- | --- | --- |
| CL-01 | Company-and-GTM master checklist | Codex | PASS | `docs/launch/company-go-to-market-master-checklist.md` |
| CL-02 | Responsibility and launch action board | Codex | PASS | This document; review owner assignments with founder |
| CL-03 | Attorney/CPA/insurance handoff brief | Codex → founder | PASS | `docs/launch/professional-review-brief.md`; founder adds private facts outside source control and sends it |
| CL-04 | Approved marketing claims register | Codex → founder | PASS | `docs/launch/marketing-claims-register.md`; founder must approve evidence owners and prohibit unsupported claims |
| CL-05 | Assisted-pilot sales playbook | Codex → founder | PASS | `docs/launch/assisted-pilot-sales-playbook.md`; founder selects initial ICP and capacity |
| CL-06 | Public accessibility statement | Codex | PASS | `/accessibility` implemented locally without claiming certified conformance |
| CL-07 | Public vulnerability disclosure locator | Codex | PASS | `frontend/public/.well-known/security.txt` uses web contact and security policy URLs; production content type still requires live verification |
| CL-08 | Entity selection and formation | Founder + attorney/CPA | FAIL | Choose LLC/corporation, file, sign governing documents, and retain certificate outside source control |
| CL-09 | EIN, Missouri registrations, bank, and accounting | Founder + CPA/bank | FAIL | Complete required accounts and registrations; store evidence outside repository |
| CL-10 | IP assignments and trademark clearance | Founder + attorney | FAIL | Identify every contributor and asset owner; sign assignments; clear Trovan/TryTrovan/marks |
| CL-11 | Final customer legal stack | Attorney + founder | FAIL | Approve Pilot Agreement/MSA, Order Form, DPA, Security Exhibit, AUP, public policies, and precedence |
| CL-12 | Insurance binder | Founder + broker | FAIL | Bind tech E&O/cyber and any required CGL; reconcile contract limits |
| CL-13 | SaaS tax/jurisdiction memo | CPA/tax counsel | FAIL | Approve first-customer jurisdictions, invoice tax treatment, and nexus tracking |
| CL-14 | Data retention and subprocessors | Founder + counsel + Codex | FAIL | Name routing/monitoring providers, measure hosted retention/recovery, approve purposes and terms |
| CL-15 | Protected provider-backed staging | Founder credentials + Codex | FAIL | Supply provider accounts/secret names; Codex can deploy/test after authorization without recording secret values |
| CL-16 | Restore, rollback, alert, and incident evidence | Codex + founder | FAIL | Requires staging/provider access and a named backup operator |
| CL-17 | Assisted Stripe lifecycle evidence | Codex + founder | FAIL | Requires founder-owned Stripe test configuration and approval to exercise test objects |
| CL-18 | CRM and outbound channel | Founder + Codex | WARN | Founder chooses/authorizes CRM and sending domain; Codex can configure schema, imports, templates, and reporting |
| CL-19 | First design-partner pipeline | Founder + Codex | WARN | Founder selects network/target list and approves contact; Codex can research, personalize, draft, and track within authorized tools |
| CL-20 | Exact-SHA production promotion | Founder approval + Codex | FAIL | Re-cut current release candidate, pass all local/hosted gates, then promote same approved SHA |

## Founder inputs needed without storing secrets here

Provide these in a secure conversation or directly to the relevant professional/provider. Do not commit identity documents, tax IDs, bank details, credentials, or signed private contracts to this repository.

- desired legal entity and formation state
- legal name, business address, registered-agent choice, owners, ownership percentages, and authorized signer
- fundraising/equity plans for the next 18 months
- whether any other person or contractor contributed code, brand, copy, data, or designs
- first planned customer states/countries and the Missouri city/county where the company will operate
- whether Trovan will only license software or also broker/arrange/perform transportation
- target pilot fleet profile and maximum simultaneous pilots
- actual support, security, privacy, sales, and billing contacts
- intended contract term, payment terms, liability position, and discount authority
- provider account ownership and readiness for Cloudflare, Render, WorkOS, Postmark, Stripe, R2, Mapbox, routing matrix, monitoring, CRM, accounting, and e-signature
- whether employees or contractors will be engaged before launch

## Immediate founder decisions

These decisions unlock the most Codex-executable work:

1. Confirm Missouri LLC versus corporation after attorney/CPA consultation.
2. Confirm the initial ICP and maximum number of concurrent assisted pilots.
3. Confirm the company-controlled contact paths to publish.
4. Confirm the first permitted customer jurisdictions.
5. Confirm provider accounts are founder-owned and authorize staging-only configuration/testing.
6. Name a backup launch and incident operator.
7. Approve sending the professional review brief to counsel, CPA, and insurance broker.
