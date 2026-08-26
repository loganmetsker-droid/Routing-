# Trovan Professional Review Brief

Date: 2026-08-25

Purpose: give a startup/SaaS attorney, CPA/tax advisor, and insurance broker one accurate starting brief. This is not a contract or legal conclusion. Replace bracketed fields privately and do not commit sensitive personal, tax, banking, credential, or signed-contract information to the repository.

## Company and product summary

Public brand: Trovan / TryTrovan

Proposed contracting entity: `[TO BE CONFIRMED]`

Formation state: Missouri, based on the founder's confirmed location; counsel/CPA to confirm whether a Missouri LLC or another structure is appropriate.

Business model: B2B software-as-a-service for route planning, dispatch, driver execution, customer tracking, proof of delivery, and route analytics.

Launch model:

- publicly marketed, manually approved paid pilots
- Launch at $399/month
- Scale at $899/month
- Enterprise custom
- operator-managed Stripe invoice/subscription after approval
- no public checkout or free trial
- cancellation effective at the end of the billing period unless the signed order form says otherwise
- refunds governed by the signed pilot agreement
- email and in-app notification only; SMS disabled
- best-effort one-business-day support target
- no contractual uptime SLA unless a signed order form expressly adds one

Planned first customers: U.S. delivery/distribution operators; exact states and fleet profile `[TO BE CONFIRMED]`.

Important business boundary: Trovan intends to license software. It does not intend to act as a motor carrier, freight broker, delivery company, employer of customer drivers, or payment intermediary. Counsel should confirm that product copy, contracts, and operations preserve that boundary.

## Attorney review request

Please advise and prepare/approve:

1. Entity choice, formation, governing documents, initial consents, cap table, founder vesting if applicable, authorized signer, assumed name, and local license requirements.
2. Founder/employee/contractor confidentiality and present IP/invention assignments covering existing and future source code, algorithms, branding, domains, documentation, content, media, and data assets.
3. Trademark clearance and filing strategy for Trovan, TryTrovan, the wordmark, and logo in the appropriate software/services classes.
4. Assisted Pilot Agreement or MSA plus Order Form that accurately captures pricing, scope, term, payment, renewal, period-end cancellation, refunds, taxes, support, no SLA, implementation, customer responsibilities, and precedence.
5. DPA and security exhibit covering processor/service-provider roles, customer/end-customer data, subprocessors, security measures, deletion/return, assistance, incident notice, and any transfer restrictions.
6. Public Website Terms/Terms of Use, Privacy Policy, Cookie Policy, privacy-rights procedure, Accessibility Statement, Acceptable Use Policy, and security/vulnerability-reporting language.
7. Confidentiality, warranty disclaimers, limitation of liability, indemnity, acceptable use, suspension/termination, feedback, publicity, case-study permission, force majeure, governing law, and dispute terms.
8. Customer responsibility for lawful route/driver/recipient data, data accuracy, driver/device safety, communications/consents, final dispatch decisions, and compliance with transportation obligations.
9. State privacy-law applicability and a breach-notification/incident workflow for expected states and data types.
10. Whether any planned outreach, phone calls, purchased data, referrals, or future SMS requires additional consent or telemarketing controls.
11. Whether any activity could make Trovan a transportation broker/carrier or create sector-specific obligations.
12. Contractor/employee classification, employment documents, handbook requirements, equity plan, and state registrations before hiring.

### Contract positions for counsel to confirm

| Topic | Requested business position |
| --- | --- |
| Offer | Manually approved assisted pilot; no public trial or checkout |
| Plans | Launch $399/month; Scale $899/month; Enterprise custom |
| Term | Monthly unless an Order Form states a committed pilot term |
| Cancellation | Effective at current billing-period end unless Order Form differs |
| Refunds | Only as stated in signed agreement or approved exception |
| Support | Best effort; initial response target within one business day |
| SLA | None unless expressly added in signed Order Form |
| SMS | Not offered at launch |
| Customer data | Customer controls submitted route/driver/recipient/proof data; Trovan processes it to provide and secure the service |
| Safety | Customer/dispatcher/driver retains responsibility for real-world and safety-critical decisions |
| Publicity | No customer name, logo, quote, benchmark, or case study without written permission |
| Precedence | Counsel to define Order Form/Pilot Agreement/DPA/security exhibit/online-terms order |

## CPA and tax review request

Please advise and document:

1. LLC versus corporation and default/elected federal/state tax treatment, including whether and when an S-corporation election is appropriate.
2. Owner contributions, reimbursements, compensation, draws/distributions, payroll, estimated taxes, and retirement/benefit implications.
3. Missouri Department of Revenue registration, Missouri unemployment registration when employing workers, and the recurring federal/state/local filing calendar.
4. Revenue recognition and bookkeeping for monthly subscriptions, implementation/custom work, credits, refunds, disputes, Stripe fees, deferred revenue, and accounts receivable.
5. SaaS sales/use tax treatment for Missouri, the founder's city/county, and every planned first-customer jurisdiction.
6. Economic-nexus monitoring, registration triggers, exemption certificate handling, invoice presentation, and whether a tax engine is warranted.
7. Contractor W-9/1099-NEC and future employee payroll/information-return processes.
8. A SaaS chart of accounts, monthly close checklist, 13-week cash forecast, tax reserve, and management reporting.

Requested deliverable: a short written memo listing allowed first-customer jurisdictions, required registrations, invoice tax treatment, due dates, accounting method, owner-pay rules, and the specific facts that would trigger re-review.

## Insurance broker review request

Please quote and explain:

- technology errors and omissions / professional liability
- cyber/privacy liability with breach response, counsel, forensics, notification, ransomware/social engineering, and business interruption as appropriate
- commercial general liability
- crime/funds-transfer/social-engineering coverage
- directors and officers before outside investment or formal board exposure
- employment practices liability before meaningful hiring
- workers' compensation before employees

Please compare exclusions and coverage to the proposed customer agreement, including contractual liability, professional services, privacy/security incidents, dependent business interruption, funds transfer, social engineering, retroactive date, claims-made notice, subcontractors, and required customer limits.

## Evidence available for diligence

- company and GTM checklist: `docs/launch/company-go-to-market-master-checklist.md`
- current launch gate: `docs/launch-readiness.md`
- assisted-pilot operations: `docs/launch/assisted-pilot-operations.md`
- data inventory/subprocessors: `docs/launch/data-inventory-and-subprocessors.md`
- security baseline: `docs/security-baseline.md`
- staging configuration: `docs/staging-setup.md`
- preserved audit: `.codex/launch-audit/latest-report.md`

Do not send repository secrets or customer data. Provide sanitized documents or a controlled diligence folder.

## Decisions to return to the project

Record only non-sensitive outcomes in the repository:

- legal entity name and public business contact
- approved plan/term/cancellation/refund/support language
- policy effective dates and version identifiers
- allowed customer jurisdictions and whether invoice tax is calculated
- approved data purposes, retention categories, rights workflow, and subprocessor names
- approved contract/security claims and prohibited claims
- coverage types/limits and renewal date without policy numbers
- annual/quarterly compliance deadlines
- hiring preconditions
