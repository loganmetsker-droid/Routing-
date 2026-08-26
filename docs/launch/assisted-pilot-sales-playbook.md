# Trovan Assisted-Pilot Sales Playbook

Date: 2026-08-25

Status: operating draft. Founder approval is required before external use. Contract, privacy, tax, insurance, and production launch gates still apply.

## Initial market focus

Recommended first ICP hypothesis:

- local or regional delivery/distribution operator
- approximately 16–75 active vehicles or routes
- one identifiable dispatcher/operations manager who owns the route day
- repeated multi-stop routes with meaningful daily changes
- current workflow relies on spreadsheets, consumer maps, paper, calls, texts, or disconnected point tools
- has one representative route day available for a controlled pilot
- can provide a customer champion and a small driver cohort
- is willing to measure baseline and pilot results

Founder must validate or replace this ICP. Do not expand paid acquisition until at least three qualified conversations confirm the same painful workflow.

## Disqualifiers for the first pilot

- expects public self-service, instant checkout, or a free trial
- requires an uptime SLA, 24/7 support, SOC 2, ISO certification, healthcare compliance, formal data residency, or unimplemented SSO as a condition
- expects Trovan to make final safety decisions or guarantee route outcomes
- lacks a customer champion, representative data, or time to complete a practice route
- requires SMS at launch
- requires Trovan to broker, arrange, or perform transportation
- cannot use an approved first-customer jurisdiction
- wants production access before security, legal, data, and hosted staging gates are green

## Pilot offer

| Item | Launch | Scale | Enterprise |
| --- | --- | --- | --- |
| Price | $399/month | $899/month | Custom |
| Purchase path | Manual approval and signed Order Form | Manual approval and signed Order Form | Sales-assisted agreement |
| Trial | None | None | None unless negotiated |
| Billing | Operator-managed Stripe invoice/subscription | Operator-managed Stripe invoice/subscription | Defined in Order Form |
| Cancellation | Billing-period end unless Order Form differs | Billing-period end unless Order Form differs | Defined in Order Form |
| Support | Best-effort, one-business-day initial-response target | Same | Negotiated without implying an SLA |
| Training | Academy, Launch Docket, readiness review | Same unless scoped otherwise | Custom scope |

## CRM stages and exit criteria

| Stage | Exit criterion |
| --- | --- |
| Target | Fits ICP and has a lawful, documented contact source |
| Contacted | Personalized message sent or warm introduction requested; next action dated |
| Discovery scheduled | Buyer/champion and meeting time confirmed |
| Qualified | Pain, authority, current process, route volume, data readiness, timing, jurisdiction, implementation owner, and buying path confirmed |
| Demo completed | Prospect saw relevant workflow; gaps, objections, stakeholders, and next action recorded |
| Technical/security review | Requirements matched to current evidence; unsupported requirements rejected or explicitly deferred |
| Proposal | Commercial offer, scope, dates, success measures, responsibilities, and mutual action plan delivered |
| Contracting | Approved legal documents with authorized signers; no unrecorded promises |
| Closed won | Agreement signed, jurisdiction/tax/insurance approved, billing authorized, and onboarding owner assigned |
| Onboarding | Tenant/data access begins only after production/customer-data gates are green |
| Closed lost | Specific reason, competitor/substitute, revisit date, and permission for follow-up recorded |

## Discovery guide

1. Walk me through how tomorrow's stops become driver routes today.
2. Who builds the plan, who approves it, and when do drivers receive it?
3. What changes after dispatch, and how does the team learn about those changes?
4. Where do customer ETA/status calls come from?
5. What proof is required, and what happens when it is missing?
6. How many routes, vehicles, drivers, stops, depots, and planners are involved on a normal and difficult day?
7. What constraints actually change route feasibility: time windows, capacity, equipment, territory, skills, access, or service time?
8. What systems hold orders, customers, vehicles, drivers, and proof today?
9. What would a successful pilot measurably change? Establish baseline and measurement owner.
10. Who owns implementation, security/privacy review, procurement, legal approval, and the budget?
11. Which states/countries contain your company, drivers, recipients, and route data?
12. What is mandatory before you can use a vendor: SSO, certifications, insurance, SLA, retention, integrations, or data location?
13. What happens if the pilot does not meet the agreed success measures?
14. What date or operational event creates urgency?

## Demo structure

1. Reconfirm the prospect's route-day problem in their words.
2. Show one synthetic representative day from import to route readiness.
3. Show constraints and provider provenance; explain human review before publication.
4. Show dispatch state and exception ownership.
5. Show the driver mobile workflow without pretending desktop controls belong on mobile.
6. Show customer tracking/proof and explain data/access boundaries.
7. Show onboarding, Academy, support, and assisted-pilot boundaries.
8. End with gaps and fit: what Trovan can do now, what is deferred, and the agreed next action.

Do not show production customer data, unsupported integrations, hidden preview features, fake testimonials, certification claims, or guaranteed savings.

## Qualification record

Capture in the CRM:

- account, website, location, industry, fleet/routes/stops/depots
- buyer, champion, technical/security, procurement, legal, finance, and driver stakeholders
- current tools and workflow
- primary pain and cost/effect
- required constraints/integrations
- data availability and sensitivity
- jurisdiction and compliance requirements
- baseline and proposed success metrics
- package/price, expected start, budget, decision process, and signer
- blockers, disqualifiers, next action, owner, and due date
- contact source, consent/legitimate outreach record, unsubscribe/suppression state

## Proposal and mutual action plan requirements

- customer problem and current baseline
- intended pilot outcome and measurement method
- included workflow and explicit exclusions
- plan, price, service dates, payment terms, taxes, cancellation, refunds, and support boundary
- customer champion, Trovan owner, users/drivers, representative data, and training obligations
- security/privacy/procurement tasks and owners
- practice route, readiness review, go-live decision, midpoint, outcome review, renewal/cancellation, export/deletion milestones
- dependencies, assumptions, risks, and stop/go criteria
- reference to counsel-approved Pilot Agreement/Order Form/DPA/security exhibit

## First-contact email draft

Subject: A question about how `[COMPANY]` builds tomorrow's routes

Hi `[NAME]`,

I’m building Trovan for delivery and distribution teams that still have to move route plans, driver updates, customer status, and proof across several tools.

I noticed `[SPECIFIC, TRUTHFUL REASON THE COMPANY MAY FIT]`. I’d value 20 minutes to understand how your team builds and changes a typical route day. If there is a fit, I can show the current planning-to-proof workflow; if not, the conversation will still help me avoid building around the wrong assumptions.

Would `[TWO SPECIFIC TIMES]` work? If this is not relevant, reply no and I will close the loop.

`[FOUNDER NAME]`
Trovan
`[VALID POSTAL ADDRESS REQUIRED IN COMMERCIAL EMAIL FOOTER]`
`[UNSUBSCRIBE METHOD]`

Do not send until sender identity, postal address, unsubscribe/suppression behavior, and contact-source policy are configured.

## Weekly founder-led review

- new targets and contact-source quality
- replies, meetings, and opt-outs
- qualification and disqualification patterns
- stage movement and stale opportunities
- objections and unsupported requested features
- evidence needed for claims
- onboarding/support capacity versus possible close dates
- next actions with one owner and due date

## Launch-capacity rule

Set a hard concurrent-pilot maximum before outreach. Do not sign more customers than the named operator and backup can onboard, support, bill, and communicate with during an incident. Increase capacity only after the first pilot completes onboarding, recovery/incident controls remain green, and support load is measured.
