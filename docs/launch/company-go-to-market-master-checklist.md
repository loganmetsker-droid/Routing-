# Trovan Company and Go-to-Market Master Checklist

Date: 2026-08-25

Scope: United States B2B SaaS company, initially operated from Missouri, launching publicly marketed and manually approved paid pilots. This is an operating checklist, not legal, tax, accounting, employment, or insurance advice. A qualified attorney and CPA should approve the items that require professional judgment.

## Executive decision

Trovan is not ready for unrestricted paid customer onboarding today. It can prepare campaigns, conduct discovery calls, show demos, and build a waitlist now, but it should not sign an agreement, accept payment, or receive real customer route data until the relevant gates below are complete.

The intended first release remains:

- Launch: $399 per month
- Scale: $899 per month
- Enterprise: custom and sales-assisted
- manually approved onboarding and operator-managed Stripe billing
- no public checkout, free trial, SMS, or uptime SLA
- period-end cancellation and refunds governed by the signed pilot agreement

## Current gate summary

`PASS` means repository evidence exists. `WARN` means the item is incomplete or cannot be verified from the repository. `FAIL` means it blocks the stated launch stage. `SKIP` means intentionally not required for the assisted-pilot release.

| Gate | Status | Current evidence and required action |
| --- | --- | --- |
| Form and operate the company | WARN | No formation certificate, EIN confirmation, operating agreement, bank/accounting setup, tax election, or license determination is evidenced in the repository. Complete and store these outside source control. |
| Own the name, brand, and software | WARN | Trovan branding exists, but trademark clearance, domain ownership record, founder/contractor IP assignments, and an IP register are not evidenced. Complete before a major public campaign or outside investment. |
| Publicly market and collect leads | WARN | The website, pricing, policy pages, contact flows, metadata, sitemap, and launch assets exist locally. Verify the production release, counsel-approved policy copy, truthful claim file, consent/marketing preferences, Postmark delivery, CRM ownership, and lead follow-up process. |
| Sign the first paid pilot | FAIL | A counsel-approved pilot agreement/MSA, order form, DPA, security exhibit, invoicing authority, tax treatment, insurance, and approval workflow are not evidenced as complete. |
| Accept customer route or driver data | FAIL | Provider-backed staging, tenant isolation, WorkOS, Postmark, R2, monitoring, retention/deletion terms, incident response, recovery exercises, security review, and privacy/subprocessor approvals remain incomplete. |
| Bill and support the first customer | FAIL | The assisted Stripe workflow, failed-payment/cancellation/refund exercises, bookkeeping reconciliation, live support channel, escalation coverage, and customer communications need retained evidence. |
| Hire employees | SKIP | Not required if Trovan has no employees. Before the first hire, payroll, unemployment registration, onboarding forms, policies, new-hire reporting, and the Missouri workers' compensation threshold/contract requirements must be evaluated. |
| Public self-serve GA | SKIP | Intentionally deferred. Requires mature automated billing/entitlements, stronger support and reliability evidence, broader compliance, and a fresh launch audit. |

## 1. Company formation and governance

### Entity and authority — required before signing contracts

- [ ] Decide the entity with an attorney and CPA. A single-member Missouri LLC is often operationally simple for a bootstrapped pilot; a Delaware C-corporation may be preferable if institutional venture financing, option grants, or near-term fundraising are part of the plan.
- [ ] Clear the legal entity name with the Missouri Secretary of State and confirm that the public brand can be used.
- [ ] File formation documents and keep the stamped certificate in the company records folder.
- [ ] Appoint and maintain a Missouri registered agent and qualifying Missouri street address. The registered agent's business office must match the entity's registered office.
- [ ] Adopt an operating agreement or corporate bylaws, even with one owner.
- [ ] Record initial manager/member or board consents: formation, bank account, contracts, tax elections, equity issuance, IP transfer, and authorized signer.
- [ ] Create a capitalization table and ownership ledger. Record every issuance, transfer, vesting term, option, note, SAFE, or founder contribution.
- [ ] Put founder vesting, departure, repurchase, deadlock, and decision rights in writing if there is more than one founder.
- [ ] Set a fiscal year and document retention location.
- [ ] Create a compliance calendar for any entity-type reports, taxes, insurance renewals, registered-agent notices, contract renewals, domain renewals, and trademark maintenance. Missouri LLCs currently have no Secretary of State annual-report filing, while corporations do.
- [ ] File any required assumed-name/DBA registration if the contracting entity is not named Trovan.
- [ ] Check city, county, home-occupation, zoning, and general business-license rules for the actual operating address.
- [ ] Confirm Trovan is selling software only. If it brokers freight, arranges transportation, employs drivers, or operates vehicles, obtain specialist transportation counsel before doing so; those activities can trigger a different licensing and insurance regime.

Missouri forms an LLC by filing Articles of Organization and requires a registered agent with a Missouri address. The current domestic LLC filing fee is $50 online or $105 on paper, and Missouri LLCs do not file annual reports with the Secretary of State. Corporations have different reporting rules. See the [Missouri Secretary of State business-entity guide](https://www.sos.mo.gov/business/corporations/business.asp), [corporations FAQ](https://www.sos.mo.gov/business/faqs), and [fee schedule](https://www.sos.mo.gov/CMSImages/Business/fees.pdf).

### Tax identity and registrations — required before sales or hiring

- [ ] Obtain the EIN directly from the IRS after the entity is formed; save the confirmation securely.
- [ ] Register with the Missouri Department of Revenue for the business-tax accounts actually required, which may include withholding or sales/use tax depending on the company's activities.
- [ ] Ask a SaaS-experienced CPA to document federal and state income-tax treatment and whether an S-corporation election is appropriate. Do not make the election from a generic checklist.
- [ ] Determine sales/use/lease-tax treatment for every customer jurisdiction, including local rules, and set an economic-nexus monitoring process before selling nationally.
- [ ] Decide whether Trovan will register proactively, use a tax service, or restrict early pilots to approved jurisdictions.
- [ ] Set quarterly estimated-tax, payroll-tax, annual return, information-return, and franchise/annual-report reminders.
- [ ] Collect a W-9 from every U.S. vendor that may need information reporting and provide Trovan's W-9 to customers through a controlled process.
- [ ] Establish a 1099-NEC process for qualifying contractors.
- [ ] Track owner contributions, distributions, reimbursable expenses, and loans separately.

The IRS says to form the entity before applying for an EIN and provides EINs directly at no charge. Missouri provides business-tax registration through the Department of Revenue; the specific accounts depend on the company's activities. See the [IRS EIN page](https://www.irs.gov/businesses/employer-identification-number) and [Missouri business-tax page](https://dor.mo.gov/taxation/business/).

As of 2026-08-25, FinCEN states that U.S.-created companies are exempt from federal BOI reporting under its final rule effective 2026-08-14. Recheck this at formation and after major legal changes; foreign-created entities registered in the United States can still have obligations. See [FinCEN's current BOI notice](https://www.fincen.gov/boi).

### Banking, accounting, and controls — required before money moves

- [ ] Open a business checking account using the exact legal entity name and EIN.
- [ ] Obtain a business credit/debit card; prohibit personal/customer funds from being mixed.
- [ ] Choose bookkeeping software and a SaaS-appropriate chart of accounts.
- [ ] Select cash or accrual accounting with the CPA and define revenue-recognition treatment for pilots, setup fees, credits, and refunds.
- [ ] Reconcile bank and Stripe balances monthly; separately reconcile invoices, payments, fees, refunds, chargebacks, and accounts receivable.
- [ ] Create invoice numbering, payment terms, late-payment, failed-payment, credit, refund, and write-off procedures.
- [ ] Establish an approval threshold for spending, refunds, contracts, vendor onboarding, and bank changes.
- [ ] Turn on MFA for bank, Stripe, tax, payroll, accounting, domain, cloud, and email administrator accounts.
- [ ] Maintain a 13-week cash forecast, monthly profit-and-loss statement, balance sheet, runway, and tax reserve.
- [ ] Set budgets for hosting, mapping/routing usage, email, storage, insurance, legal, accounting, sales, and support.

## 2. Intellectual property and brand ownership

- [ ] Run a comprehensive trademark clearance search for `Trovan`, `TryTrovan`, the wordmark, and the logo across federal records, state records, domains, app stores, social handles, and common-law use.
- [ ] Have trademark counsel evaluate confusingly similar logistics/software marks before investing heavily in the brand.
- [ ] File the appropriate federal word-mark and/or design-mark applications when cleared; maintain specimens and renewal dates.
- [ ] Confirm the company—not an individual, agency, or contractor—owns the primary domain, DNS, social accounts, repositories, cloud accounts, app listings, and creative source files.
- [ ] Execute founder IP assignment, confidentiality, and invention-assignment documents.
- [ ] Require every employee and contractor to sign confidentiality and present assignment of work product before work begins.
- [ ] Create an IP register for source code, algorithms, training content, logos, screenshots, videos, copy, datasets, domains, trademarks, and licenses.
- [ ] Inventory open-source dependencies and licenses; preserve notices and prohibit incompatible code or unapproved copied assets.
- [ ] Document provenance and commercial-use rights for fonts, icons, maps, photos, videos, music, demo data, and AI-generated assets.
- [ ] Decide whether any genuinely novel invention warrants a patent consultation before public disclosure. Do not treat a patent as a default launch requirement.

The USPTO recommends a clearance search before filing and notes that design elements should also be searched. See [USPTO federal trademark searching](https://www.uspto.gov/trademarks/search/federal-trademark-searching).

## 3. Legal document stack

All customer-facing legal documents should identify the exact contracting entity, address, contact method, effective date, governing law, precedence, and change-notice method. The policy text currently in the website is product copy, not evidence of attorney approval.

### Required for the website and lead collection

- [ ] Counsel-approved Privacy Policy covering website leads, account users, route/driver/recipient data, cookies, support records, security logs, payments, purposes, disclosures, retention, rights, and contact information.
- [ ] Terms of Use for the public website.
- [ ] Cookie notice and consent behavior that matches the technologies actually loaded. Do not claim that nonessential cookies are off unless testing proves it.
- [ ] Privacy-rights intake and identity-verification procedure, with an internal deadline/decision log.
- [ ] Marketing-email consent/source record, suppression list, physical postal address, accurate sender identity, and one-step unsubscribe process.
- [ ] Accessibility statement and a staffed way to request accommodation.
- [ ] Copyright and trademark notice.

### Required for each assisted paid pilot

- [ ] Master Services Agreement or short-form Pilot Agreement.
- [ ] Order Form naming plan, price, billing cadence, pilot dates, users/vehicles/usage assumptions, included onboarding, support target, renewal, cancellation, and taxes.
- [ ] Data Processing Addendum defining controller/business and processor/service-provider roles, security duties, subprocessors, assistance, deletion/return, incident notice, and international-transfer terms if relevant.
- [ ] Security exhibit or security overview that says only what Trovan can prove.
- [ ] Acceptable Use Policy covering illegal use, abuse, credential sharing, attacks, dangerous dispatch inputs, and third-party rights.
- [ ] No-SLA language and best-effort one-business-day support target, unless a negotiated order form expressly changes it.
- [ ] Warranty disclaimers, limitation of liability, indemnities, force majeure, suspension, termination, feedback rights, and dispute terms reviewed for Missouri law and the actual risk profile.
- [ ] Explicit customer responsibilities for lawful data collection, data accuracy, driver/device safety, final dispatch decisions, recipient communications, and obtaining required notices/consents.
- [ ] Billing, failed-payment, period-end cancellation, refund, renewal, price-change, and tax language aligned with the operator's real procedure.
- [ ] Order-of-precedence clause: signed order form/pilot agreement, DPA/security exhibit, then online terms as counsel directs.
- [ ] E-signature and contract repository with version, signer authority, dates, renewal notice, obligations, and owner.
- [ ] NDA template for discovery/procurement, but do not use an NDA as a substitute for the service agreement or DPA.
- [ ] Customer logo, quote, testimonial, benchmark, and case-study release; never assume purchase grants publicity rights.

### Required when using vendors or people

- [ ] Vendor/service-provider agreement and DPA/security review for each provider handling company or customer data.
- [ ] Contractor agreement with scope, fees, taxes, confidentiality, security, IP assignment, return/deletion, and termination.
- [ ] Employment offer, confidentiality/invention assignment, and handbook acknowledgments before employees begin.
- [ ] Referral, reseller, affiliate, or agency agreement before commissions or representations are made on Trovan's behalf.

## 4. Privacy, data governance, and compliance

- [ ] Approve the existing data inventory and name every real subprocessor, including the contracted routing-matrix and error-monitoring providers.
- [ ] For every data element, document source, purpose, legal/contractual basis, system, region, encryption, access roles, retention, deletion, export, backup behavior, and subprocessor.
- [ ] Minimize collection. Avoid unnecessary recipient details, access codes, exact location history, and free-text sensitive information.
- [ ] Define separate retention periods for leads, inactive prospects, customer accounts, jobs/routes, GPS/telemetry, proof photos/signatures, audit logs, support records, invoices, contracts, and backups.
- [ ] Implement and test access, correction, export, deletion, restriction/opt-out, and account-closure workflows.
- [ ] Define what can be deleted immediately, what remains in backups, when backups expire, and what must be retained for tax, fraud, disputes, or security.
- [ ] Map state privacy-law applicability at least quarterly and whenever revenue, consumer volume, data sales/sharing, targeted advertising, or geography changes.
- [ ] Do not sell personal data or use route/customer data to train models unless contracts, disclosures, consent/lawful basis, and controls expressly support it.
- [ ] Prohibit production customer data in demos, screenshots, analytics, issue trackers, local machines, or AI tools unless specifically approved and protected.
- [ ] Create a data-breach decision tree covering counsel, insurer, forensics, customer notice, state notice, law enforcement, evidence preservation, and communications.
- [ ] Establish a subprocessor change-notice and objection process consistent with customer contracts.
- [ ] Maintain records of privacy requests, responses, exceptions, and identity verification without retaining more identity data than necessary.
- [ ] Assess international users and data transfers before marketing outside the United States.
- [ ] Assess sector-specific rules before accepting health, financial, education, children's, biometric, government, or highly regulated data.

Do not assume a startup is exempt from privacy and security duties merely because it is below a comprehensive state privacy statute's threshold. The FTC advises businesses to collect only needed information, secure it throughout its lifecycle, oversee service providers, patch software, and maintain an incident plan. See the [FTC Start with Security guide](https://www.ftc.gov/business-guidance/resources/start-security-guide-business).

## 5. Security and technical launch

### Identity and access

- [ ] Production WorkOS organization and redirect configuration.
- [ ] Login, logout, session expiration, revocation, role changes, removed-user behavior, and recovery tests.
- [ ] Enforce MFA for privileged company/vendor accounts and offer appropriate customer identity controls.
- [ ] Least-privilege access matrix for owner, support, engineering, finance, sales, dispatcher, driver, and customer administrators.
- [ ] Quarterly access review and immediate offboarding procedure.
- [ ] Break-glass access with logging, restricted ownership, and test procedure.
- [ ] Secret manager, rotation schedule, no credentials in source/chat/evidence, and controlled production access.

### Application and infrastructure

- [ ] Deploy provider-backed Render staging with Postgres, Redis/worker, backend, routing service, WorkOS, Postmark, R2, protected metrics, monitoring, Mapbox, and contracted road-matrix service.
- [ ] Make production readiness return failure when a pilot-critical dependency is unavailable.
- [ ] Validate tenant isolation with two real organizations and fresh sessions.
- [ ] Run authenticated/unauthenticated authorization tests for APIs, Socket.IO, downloads, tracking, proofs, admin functions, webhooks, and API keys.
- [ ] Validate route-optimizer provenance and prohibit estimated/straight-line fallback from being published as a production route.
- [ ] Validate upload type/size limits, malware handling decision, object authorization, signed URL duration, and deletion.
- [ ] Validate webhook authentication, replay prevention, outbound SSRF protection, redirect/DNS/private-network rejection, timeouts, and response limits.
- [ ] Encrypt sensitive fields and storage/transit paths; complete the documented access-code backfill and rotation plan.
- [ ] Add dependency, secret, code, infrastructure, and container scanning as applicable; close every critical/high finding before launch.
- [ ] Maintain secure headers, TLS, rate limits, abuse controls, audit events, redacted logs, and error monitoring.
- [ ] Publish `security.txt` and a vulnerability-reporting address/process; decide whether a public bug bounty is appropriate later.
- [ ] Separate dev, staging, and production data/accounts; prohibit preview flags and test credentials in production.
- [ ] Deploy the exact immutable staging SHA to production with approval and retained rollback targets.

### Reliability, recovery, and incident response

- [ ] Set measurable recovery-point and recovery-time objectives internally, even though no contractual uptime SLA is offered.
- [ ] Test an isolated Postgres restore and verify application/tenant checks against it.
- [ ] Test R2 object recovery and byte integrity.
- [ ] Roll back Cloudflare and Render to retained prior versions and confirm every health/smoke check.
- [ ] Exercise a security/availability incident: detection, acknowledgement, severity, containment, customer communication, recovery, postmortem, and follow-up.
- [ ] Configure authenticated external health smoke, deployment-failure alerts, Postmark delivery/bounce alerts, error alerts, queue depth, database capacity, storage, certificate/domain expiry, and billing/provider failures.
- [ ] Name a primary and backup incident contact. If Logan is the only operator, document the unavailable-founder contingency.
- [ ] Keep a status-page/customer-notification template ready, even if a full public status page is deferred.

## 6. Billing, pricing, and revenue operations

- [ ] Keep one canonical Launch/Scale/Enterprise catalog across site, ROI calculator, settings, backend, tests, proposal, order form, and Stripe.
- [ ] Create operator-only Stripe products/prices in test and production, with self-serve disabled.
- [ ] Exercise approved-customer creation, invoice/subscription, payment success, failed payment, retry, credit, refund, dispute, period-end cancellation, reactivation, plan change, and reconciliation in test mode.
- [ ] Define exactly when access starts, changes after failed payment, and ends after cancellation or termination. Manual entitlements need a two-person or recorded approval if feasible.
- [ ] Decide whether prices are tax-exclusive and state this consistently.
- [ ] Obtain tax advice on SaaS taxability and nexus before nationwide invoicing; configure collection only where registered/required.
- [ ] Create quote/proposal and invoice templates with legal entity, address, EIN/W-9 process, payment instructions, taxes, due date, plan, service period, and contract reference.
- [ ] Define discount authority, maximum discount, setup fees, custom work, reimbursable expenses, and nonstandard-term approval.
- [ ] Define renewal notice, expansion, cancellation confirmation, refund authorization, collections, write-off, and account deletion handoffs.
- [ ] Track MRR/ARR consistently. Keep one-time services and pass-through charges separate from recurring revenue.
- [ ] Track gross margin including routing/geocoding, storage, email, support, payment fees, and cloud costs per customer.

## 7. Insurance and risk transfer

- [ ] Ask a SaaS insurance broker for written recommendations based on actual contracts, data, revenue, staff, and customer requirements.
- [ ] Obtain technology errors-and-omissions/professional liability coverage before relying on the software for paid route operations.
- [ ] Obtain cyber liability/privacy coverage, including incident response and breach counsel where appropriate.
- [ ] Obtain commercial general liability if required by customers, office arrangements, events, or contracts.
- [ ] Add workers' compensation before the first employee where required.
- [ ] Consider directors-and-officers coverage before outside investment or a formal board.
- [ ] Consider employment-practices liability before meaningful hiring.
- [ ] Consider crime/social-engineering and funds-transfer coverage because billing and account-change fraud are realistic risks.
- [ ] Align contract liability caps, indemnities, and required policy limits with actual coverage; calendar renewals and certificates of insurance.

## 8. Product and customer experience

- [ ] Define the ideal customer profile: fleet type, geography, vehicle count, dispatcher count, route density, job volume, current tools, pain, buyer, champion, and disqualifiers.
- [ ] Define the assisted-pilot promise and measurable outcome without guaranteeing savings that have not been proven.
- [ ] Validate one complete production workflow: lead → qualification → agreement → tenant setup → data import → optimization → human review → dispatch → driver use → tracking/proof → support → billing → cancellation/export/deletion.
- [ ] Confirm every empty, loading, error, offline, permission-denied, expired-session, partial-data, and destructive-action state.
- [ ] Test keyboard navigation, focus, labels, contrast, zoom, reduced motion, mobile layouts, screen-reader landmarks, accessible authentication, and error announcements.
- [ ] Target WCAG 2.2 AA and retain manual plus automated accessibility results. W3C recommends the latest WCAG version for future applicability; see [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [ ] Test current Chrome, Edge, Safari, iOS, and Android experiences appropriate to the customer base.
- [ ] Verify performance on realistic fleet datasets and ordinary mobile networks, not only demo data.
- [ ] Provide import templates, validation, previews, rollback/correction, and explicit ownership of bad source data.
- [ ] Put meaningful human confirmation before route publication and communicate that drivers/dispatchers remain responsible for safety and real-world decisions.
- [ ] Ensure support and onboarding links work from login failures and all critical workflows.
- [ ] Keep Academy, quick starts, implementation guide, FAQ, and training media versioned to the release customers receive.
- [ ] Provide in-product feedback and issue-reporting paths that capture release/browser context without secrets or customer data.

## 9. Marketing foundation

### Strategy and message

- [ ] Choose one primary ICP and one primary painful job for launch; do not market to every fleet at once.
- [ ] Write a positioning statement: target buyer, current problem, category, differentiated value, proof, and why now.
- [ ] Document competitors and substitutes, including spreadsheets, consumer maps, legacy TMS tools, manual dispatch, and doing nothing.
- [ ] Build a messaging house: one promise, three value pillars, proof for each pillar, objections, approved claims, and prohibited claims.
- [ ] Create a claim-substantiation file for every quantitative statement, comparison, testimonial, security claim, and customer result.
- [ ] Define the pilot offer, qualification criteria, capacity, start dates, onboarding effort, success measures, and clear exit/renewal path.

### Public website

- [ ] Production homepage clearly states who it is for, the outcome, what the product does, and a single primary CTA.
- [ ] Product pages use current real screenshots and explain planning, dispatch, driver, tracking, proof, and exception workflows accurately.
- [ ] Pricing states monthly assisted pilots, Launch/Scale/Enterprise, no free trial/public checkout, cancellation treatment, taxes if applicable, and what is included.
- [ ] Demo/request form uses the backend's accepted request types and persists/deduplicates/throttles leads.
- [ ] Primary CTA says `Send request`; email is only an error fallback.
- [ ] Login has bounded authentication checks, retry, support contact, and no indefinite loading state.
- [ ] Correct Trovan logo, favicon, app icons, colors, typography, image rights, and consistent entity/contact information.
- [ ] Privacy, terms, cookies, rights request, security, support, and accessibility pages are discoverable and current.
- [ ] Canonical URLs, titles, descriptions, Open Graph/Twitter cards, robots, sitemap XML content type, analytics consent, 404, and redirects are verified from the production build.
- [ ] Analytics events have an owner, retention, consent classification, test-event exclusion, and documented funnel definitions.
- [ ] Monitor uptime, broken links/forms, Search Console indexing, Core Web Vitals, and conversion errors.

### Launch assets and channels

- [ ] One-page product overview.
- [ ] Five-to-ten-minute live demo script and backup recorded demo.
- [ ] Discovery-call guide, qualification scorecard, objection guide, FAQ, and security/procurement answer sheet.
- [ ] Proposal, pilot plan, implementation timeline, ROI worksheet, and mutual action plan.
- [ ] Founder profile, company description, approved logos, screenshots, headshots, short/long boilerplate, and press/contact page.
- [ ] At least one design partner or pilot reference; if no customer proof exists, label scenarios and estimates honestly.
- [ ] Content calendar for ICP problems, implementation lessons, product proof, customer outcomes, and founder credibility.
- [ ] Channel plan ranked by expected learning and cost: founder-led outbound, warm network, associations, partners, events, SEO/content, paid acquisition.
- [ ] Campaign briefs with audience, offer, message, asset, landing page, CTA, owner, budget, dates, and success threshold.
- [ ] Domain email authentication and deliverability monitoring: SPF, DKIM, DMARC monitoring, bounce/complaint handling, reply-to ownership, and suppression.
- [ ] Compliant commercial email: accurate sender/subject, postal address, ad disclosure where required, working opt-out, suppression, and vendor oversight. CAN-SPAM also covers B2B commercial email; see the [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).
- [ ] Obtain counsel review before marketing texts, autodialed calls, purchased lists, referral incentives, contests, or international outreach.
- [ ] Never buy, fabricate, suppress, or condition rewards on positive reviews. Disclose material connections and get written customer publicity permission. See the [FTC endorsements and reviews guidance](https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews).

## 10. Sales process

- [ ] Choose a CRM and make it the source of truth for accounts, contacts, consent/source, stage, next action, value, probability, expected close, contract, onboarding, renewal, and loss reason.
- [ ] Define stages and exit criteria: target → contacted → discovery → qualified → demo → technical/security review → proposal → verbal approval → contract → closed won/lost → onboarding.
- [ ] Define qualification: business problem, authority, current process, data readiness, fleet fit, deadline, budget, security needs, implementation owner, and measurable success.
- [ ] Create discovery questions and a demo tailored to the prospect's workflow; do not expose another customer's information.
- [ ] Create pricing/discount authority and nonstandard contract approval rules.
- [ ] Create security questionnaire, procurement, DPA, insurance, W-9, and vendor-onboarding response packages.
- [ ] Establish weekly pipeline review and next-action discipline.
- [ ] Record win/loss reasons and update product/marketing decisions from evidence rather than anecdotes.
- [ ] Define sales-to-onboarding handoff with signed scope, promises, stakeholders, data, risks, dates, and success measures.
- [ ] Define renewal review 60–90 days before the end of the committed term, adjusted for actual pilot length.

## 11. Customer onboarding, support, and success

- [ ] Assign an implementation owner and customer champion for every pilot.
- [ ] Use an onboarding checklist: contract/payment, tenant, identities, roles, depot, fleet, users, import, route test, driver practice, dispatch rehearsal, production start, signoff.
- [ ] Define baseline metrics before use and success metrics with the customer: planning time, route miles/time, on-time performance, failed stops, proof completion, dispatcher interventions, and adoption.
- [ ] Separate estimates from measured customer results and record data-quality limitations.
- [ ] Provide named support email, in-app path, hours/timezone, response target, severity definitions, escalation, and emergency limitations.
- [ ] Build support macros/runbooks for login, imports, optimization, dispatch, mobile use, tracking, proof, billing, cancellation, privacy, and incident communications.
- [ ] Track every case with customer, severity, owner, timestamps, release, resolution, root cause, and follow-up.
- [ ] Define proactive check-ins, training completion, adoption review, pilot midpoint, executive outcome review, renewal, expansion, cancellation, data export, and deletion.
- [ ] Create a customer-facing change/release note process for material behavior, security, pricing, subprocessor, and contract changes.
- [ ] Establish a product feedback triage process so requested work is not accidentally promised as committed scope.
- [ ] Maintain a customer health view with implementation status, usage, value evidence, support risk, billing status, renewal, and owner.

## 12. People and employment

Complete this section before anyone begins work as an employee.

- [ ] Determine employee versus contractor status based on the real working relationship, not merely the contract label.
- [ ] Register for federal/state payroll and Missouri unemployment through UInteract; the Missouri Division of Employment Security determines whether the business is liable for unemployment tax.
- [ ] Obtain workers' compensation coverage before the statutory threshold or earlier if required by a customer, contract, risk decision, or another state. Missouri generally requires coverage at five employees, or one employee for construction employers.
- [ ] Complete Form I-9 and federal/state withholding forms; follow document and retention rules.
- [ ] Report Missouri new hires within 20 calendar days and complete unemployment-tax registration when employing workers. If liable for Missouri unemployment contributions, notify the Division of Employment Security within the required period.
- [ ] Provide required federal, state, and local workplace notices/posters, including remote-worker delivery where applicable.
- [ ] Create compliant offer letters, compensation/equity approvals, job descriptions, confidentiality/IP agreements, and background-check authorization/process if used.
- [ ] Adopt a concise handbook covering equal employment, harassment, accommodations, leave, timekeeping/overtime, expenses, security, acceptable use, remote work, confidentiality, conflicts, reporting, discipline, and separation.
- [ ] Classify exempt/nonexempt roles with employment counsel; track working time and overtime where required.
- [ ] Create onboarding/offboarding covering equipment, training, password manager, access, data return, final pay, benefits, and record preservation.
- [ ] Limit access by role and prohibit shared accounts.
- [ ] Establish performance, compensation, complaint, accommodation, and investigation processes before they are needed.

The IRS bases worker classification on behavioral control, financial control, and the parties' relationship, not just the agreement's title. See [IRS Worker Classification 101](https://www.irs.gov/newsroom/worker-classification-101-employee-or-independent-contractor). Missouri requires new-hire reporting within 20 calendar days. Entities employing workers must complete unemployment-tax registration so the Division of Employment Security can determine liability; a liable employer must notify the Division within 30 days after becoming liable. Missouri generally requires workers' compensation at five employees, or one employee in construction. See [Missouri new-hire information](https://www.missouriemployer.dss.mo.gov/newhireinfo.aspx), [Missouri unemployment registration guidance](https://labor.mo.gov/UInteract/help), [Missouri unemployment-tax responsibility](https://labor.mo.gov/media/21246/download), and [Missouri workers' compensation guidance](https://labor.mo.gov/dwc/employers).

## 13. Vendors, operations, and administration

- [ ] Maintain a vendor register with owner, purpose, data, access, agreement, DPA, security review, renewal, cost, notice period, outage dependency, and exit plan.
- [ ] Complete diligence for Render, Cloudflare, WorkOS, Postmark, Stripe, Mapbox, R2, routing matrix, monitoring, GitHub, CRM, support, analytics, accounting, payroll, e-signature, and any AI tools.
- [ ] Use company-controlled accounts, unique administrators, MFA, least privilege, backup owners, billing alerts, and recovery codes.
- [ ] Maintain domain/DNS/email ownership, renewal protection, registrar lock, DNS change controls, and recovery contacts.
- [ ] Create a company password manager, device inventory, endpoint security, disk encryption, screen lock, updates, remote wipe, and lost-device process.
- [ ] Define record locations and retention for formation, tax, accounting, banking, insurance, contracts, HR, security, privacy, product, and customer evidence.
- [ ] Maintain contact lists for counsel, CPA, insurance broker, bank, incident vendors, major providers, customers, and emergency backup operator.
- [ ] Establish business continuity for founder illness/unavailability, credential recovery, customer communication, billing, deployments, and incidents.
- [ ] Review vendor spend and access monthly during the pilot stage.

## 14. Metrics and management cadence

### Company dashboard

- [ ] Cash balance, monthly burn, runway, tax reserve, accounts receivable, and committed vendor spend.
- [ ] Qualified pipeline, new opportunities, conversion by stage, sales cycle, average contract value, and reasons lost.
- [ ] Leads by source, consent/source quality, lead-to-meeting conversion, meeting-to-pilot conversion, CAC by channel, and payback assumptions.
- [ ] Active pilots, MRR/ARR, gross margin, expansion, contraction, refunds, failed payments, churn, and revenue concentration.
- [ ] Time to first route, onboarding completion, weekly active dispatchers/drivers, routes/stops processed, proof completion, support volume, and measurable customer outcomes.
- [ ] Availability, dependency failures, incidents, mean acknowledgement/recovery time, security findings, backup/restore status, and alert health.

### Cadence

- [ ] Weekly: cash, pipeline, onboarding, customer risk, product defects, security/operations, and next actions.
- [ ] Monthly: close books, reconcile Stripe/bank, review budget/runway, vendor access/spend, funnel, retention, claims, and roadmap.
- [ ] Quarterly: taxes, access review, incident/tabletop, restore sample, privacy-law applicability, subprocessor list, insurance/contract risk, and strategic plan.
- [ ] Annually: state report, tax returns/information returns, entity records, insurance, policies, employee documents, trademark/domain renewals, and full launch/security review.

## 15. What can wait until after the assisted-pilot launch

- [ ] Public self-serve signup, card entry, automated entitlement changes, free trials, and automated refunds.
- [ ] SMS notifications and text-message marketing.
- [ ] A contractual uptime SLA or 24/7 support organization.
- [ ] SOC 2 or ISO 27001 certification, unless a signed target customer makes it a condition; build evidence-ready controls now.
- [ ] A full public status platform, enterprise SIEM, formal bug bounty, multi-region failover, or dedicated security team.
- [ ] React Router or equivalent framework migration solely for fashion; use the audited project-owned router until requirements change.
- [ ] Advanced attribution, experimentation, and behavioral analytics before consent, ownership, and retention are approved.
- [ ] DMARC enforcement beyond monitoring until delivery reports are clean for at least two weeks.
- [ ] Patents, broad international expansion, channel/reseller programs, complex equity plans, and a large paid-ad budget before product-market evidence exists.

## Ordered launch plan

### Phase 1 — Make Trovan a company that can contract and receive money

Owner: founder, business attorney, CPA, insurance broker

1. Choose/form the entity, approve governance, obtain EIN, register taxes, open bank/accounting, and create compliance calendar.
2. Transfer all software/brand/domain IP to the company and complete trademark clearance.
3. Finalize pilot agreement, order form, DPA, security exhibit, AUP, privacy, cookie, and public terms.
4. Bind appropriate tech E&O/cyber and any contract-required coverage.
5. Decide allowed customer jurisdictions and document SaaS tax treatment.

Exit evidence: formation certificate, EIN letter, approved governance/IP documents, bank/accounting verification, tax memo/registrations, signed insurance binder, counsel-approved contract/policy set, and authorized signer.

### Phase 2 — Prove Trovan can safely serve one customer

Owner: Logan Metsker as launch owner, with named backup

1. Populate protected staging configuration without putting secrets in source or chat.
2. Deploy an immutable release candidate to the complete provider-backed staging topology.
3. Pass hosted identity, tenant isolation, optimizer, lead/Postmark, R2 proof, API/webhook/socket/tracking, and assisted Stripe tests.
4. Complete security review, retention/export/deletion decisions, data inventory, subprocessor approval, and access-code protections.
5. Complete Postgres restore, R2 recovery, rollback, alert, and incident exercises with retained evidence.
6. Cut a new clean release candidate from the current intended source; the preserved 2026-08-20 audit applies only to SHA `38b7ae639e806a5c1a41175712f4fa643c1c4ae0`, while the present workspace contains later changes.

Exit evidence: every current `docs/launch-readiness.md` gate green for the exact SHA and signed approvals recorded in the protected launch evidence.

### Phase 3 — Build a repeatable customer-acquisition and delivery system

Owner: founder-led sales/marketing initially

1. Lock ICP, positioning, pilot offer, approved claims, qualification, demo, proposal, and mutual action plan.
2. Configure CRM, compliant outreach, deliverability, pipeline stages, weekly review, and lead-response ownership.
3. Verify the production website and lead path; prepare one-pager, demo, security/procurement pack, and honest proof.
4. Recruit a deliberately small pilot cohort that matches support capacity.
5. Run onboarding, baseline measurement, weekly success reviews, support, billing, and renewal/cancellation from documented playbooks.

Exit evidence: qualified pipeline, functioning lead-to-contract handoff, signed first pilot, successful onboarding rehearsal, owner coverage, and a measured—not merely estimated—customer outcome plan.

### Phase 4 — Production promotion and first customer

1. Promote the exact staging-approved SHA with explicit approval.
2. Verify production readiness, WorkOS, lead/Postmark delivery, sitemap XML, release identity, monitoring, billing, and absence of preview/test flags.
3. Close/remove synthetic lead and test-customer records.
4. Sign the approved order form/pilot agreement, confirm insurance/tax/jurisdiction, and collect payment through the operator process.
5. Accept only the minimum customer data needed, onboard through the launch docket, and hold the first live route review with human approval.
6. Hold daily internal checks during the first week and a formal customer success review at the agreed milestone.

## The first 20 concrete actions

1. Retain a Missouri startup/SaaS attorney and CPA.
2. Decide LLC versus corporation and form the entity.
3. Obtain EIN, required Missouri registrations, bank account, and bookkeeping.
4. Create the operating agreement/bylaws, cap table, resolutions, and compliance calendar.
5. Execute founder/contractor IP assignments and secure company ownership of domain/cloud/repositories.
6. Complete Trovan/TryTrovan trademark clearance.
7. Have counsel approve the pilot agreement, order form, DPA, security exhibit, privacy policy, cookie policy, Terms of Use, and AUP.
8. Obtain tech E&O and cyber insurance quotes/binder.
9. Get a written tax determination for Missouri and the planned first-customer jurisdictions.
10. Finalize the named subprocessor list, retention schedule, deletion/export procedure, and data-use boundaries.
11. Name a backup launch/incident operator.
12. Populate the protected staging environment and provider accounts.
13. Run the complete hosted staging gate with two organizations.
14. Run Stripe, Postmark, WorkOS, R2, optimizer, monitoring, webhook, tracking, and proof exercises.
15. Complete restore, recovery, rollback, alert, and incident drills.
16. Re-cut and audit a clean immutable release candidate from the intended current changes.
17. Lock ICP, positioning, claims, pilot capacity, qualification, and success metrics.
18. Configure the CRM, lead-response SLA, compliant email, deliverability, demo, proposal, and procurement pack.
19. Promote the exact approved SHA and verify production end to end.
20. Sign and onboard one carefully selected design-partner customer before expanding marketing volume.

## Definition of “fully ready to go to market”

Trovan is fully ready for its chosen assisted-pilot launch only when all of the following are true:

- the company legally exists, owns its IP, can contract, bank, insure, account, and pay taxes;
- every public claim and policy is accurate, approved, versioned, and operationally supported;
- leads are captured, consent/source is recorded, email is compliant, and follow-up has an owner;
- the sales process can qualify, contract, bill, onboard, support, renew, cancel, export, and delete;
- the exact production code has passed local and provider-backed staging gates;
- customer data has approved purpose, access, retention, security, recovery, and incident handling;
- the operator has completed billing, recovery, rollback, alert, and incident rehearsals;
- one named owner and one backup can run the company when something goes wrong;
- the first customer is a deliberate fit for the product and current support capacity;
- launch evidence is retained rather than inferred.
