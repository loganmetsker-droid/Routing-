#!/usr/bin/env python3
"""Build Trovan's versioned customer launch docket and companion files."""

from __future__ import annotations

import csv
import os
import zipfile
from pathlib import Path

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "downloads"
TMP = ROOT / "tmp" / "pdfs"
VERSION = "1.2"
ACADEMY_URL = "https://trytrovan.com/academy"
GUIDE_SCREENSHOTS = ROOT / "frontend" / "public" / "training" / "guides"

NAVY = colors.HexColor("#071829")
NAVY_2 = colors.HexColor("#0E2539")
COPPER = colors.HexColor("#B97129")
COPPER_LIGHT = colors.HexColor("#F2E4D5")
CREAM = colors.HexColor("#FFF8ED")
STONE = colors.HexColor("#F5F1EA")
INK = colors.HexColor("#1F1A17")
MUTED = colors.HexColor("#655D57")
GREEN = colors.HexColor("#2E7D5B")


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=28, leading=31, textColor=CREAM, spaceAfter=12),
        "cover_sub": ParagraphStyle("CoverSub", parent=base["BodyText"], fontName="Helvetica", fontSize=12, leading=18, textColor=colors.HexColor("#D9E2EA")),
        "h1": ParagraphStyle("H1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=21, leading=24, textColor=NAVY, spaceBefore=4, spaceAfter=10),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=COPPER, spaceBefore=10, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.4, leading=13.5, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("Small", parent=base["BodyText"], fontName="Helvetica", fontSize=7.7, leading=10.5, textColor=MUTED),
        "bullet": ParagraphStyle("Bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2, leading=13, textColor=INK, leftIndent=12, firstLineIndent=-7, bulletIndent=0, spaceAfter=3),
        "callout": ParagraphStyle("Callout", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=NAVY, backColor=COPPER_LIGHT, borderColor=COPPER, borderWidth=0.8, borderPadding=8, spaceBefore=5, spaceAfter=10),
        "table": ParagraphStyle("Table", parent=base["BodyText"], fontName="Helvetica", fontSize=7.7, leading=10, textColor=INK),
        "table_head": ParagraphStyle("TableHead", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=7.6, leading=9.5, textColor=CREAM),
        "center": ParagraphStyle("Center", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=11, leading=14, alignment=TA_CENTER, textColor=NAVY),
    }


S = styles()


def P(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    return [P(f"• {item}", "bullet") for item in items]


def qr_code(url: str, size: float = 0.85 * inch):
    code = qr.QrCodeWidget(url)
    bounds = code.getBounds()
    drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(code)
    return drawing


class DocketDoc(BaseDocTemplate):
    def __init__(self, filename, cover_page=True, **kwargs):
        self.cover_page = cover_page
        super().__init__(filename, pagesize=letter, leftMargin=0.58 * inch, rightMargin=0.58 * inch, topMargin=0.68 * inch, bottomMargin=0.55 * inch, **kwargs)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="body")
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self.header_footer)])

    def header_footer(self, canvas, doc):
        canvas.saveState()
        if doc.page == 1 and self.cover_page:
            canvas.setFillColor(NAVY)
            canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
            canvas.setFillColor(COPPER)
            canvas.rect(0, letter[1] - 0.18 * inch, letter[0], 0.18 * inch, fill=1, stroke=0)
        else:
            canvas.setStrokeColor(colors.HexColor("#D9D2C9"))
            canvas.line(self.leftMargin, letter[1] - 0.42 * inch, letter[0] - self.rightMargin, letter[1] - 0.42 * inch)
            canvas.setFont("Helvetica-Bold", 7.5)
            canvas.setFillColor(NAVY)
            canvas.drawString(self.leftMargin, letter[1] - 0.31 * inch, "TROVAN CUSTOMER LAUNCH DOCKET")
            canvas.setFont("Helvetica", 7.2)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(letter[0] - self.rightMargin, letter[1] - 0.31 * inch, f"Version {VERSION} | 2026-08-19")
            canvas.line(self.leftMargin, 0.4 * inch, letter[0] - self.rightMargin, 0.4 * inch)
            canvas.drawString(self.leftMargin, 0.24 * inch, "Canonical instructions: trytrovan.com/academy")
            canvas.drawRightString(letter[0] - self.rightMargin, 0.24 * inch, f"Page {doc.page}")
        canvas.restoreState()


def table(data, widths, header=True):
    formatted = []
    for row_index, row in enumerate(data):
        formatted.append([P(str(cell), "table_head" if header and row_index == 0 else "table") for cell in row])
    result = Table(formatted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY if header else STONE),
        ("TEXTCOLOR", (0, 0), (-1, 0), CREAM if header else INK),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CFC6BA")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row in range(1, len(data)):
        if row % 2 == 0:
            commands.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#FAF8F4")))
    result.setStyle(TableStyle(commands))
    return result


def cover():
    return [
        Spacer(1, 1.15 * inch),
        P("TROVAN", "cover_sub"),
        Spacer(1, 0.15 * inch),
        P("Customer Launch Docket", "title"),
        P("A customer-led implementation packet for setup, role-based training, one practice route, proof, and launch-readiness review.", "cover_sub"),
        Spacer(1, 0.55 * inch),
        Table(
            [[P("VERSION", "table_head"), P("OWNER", "table_head"), P("STANDARD LIVE SUPPORT", "table_head")],
             [P(f"{VERSION} | August 19, 2026", "table"), P("Customer Champion", "table"), P("One 30-minute readiness review", "table")]],
            colWidths=[1.7 * inch, 2.0 * inch, 2.65 * inch],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COPPER),
                ("BACKGROUND", (0, 1), (-1, 1), CREAM),
                ("GRID", (0, 0), (-1, -1), 0.7, COPPER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]),
        ),
        Spacer(1, 0.55 * inch),
        Table([[qr_code(ACADEMY_URL, 1.05 * inch), P("SCAN TO OPEN TROVAN ACADEMY<br/><br/><font name='Helvetica' size='9'>Searchable lessons are canonical. Use this packet for handoff, facilitation, and quick reference.</font>", "cover_sub")]], colWidths=[1.25 * inch, 4.8 * inch], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")])),
        Spacer(1, 0.7 * inch),
        P("Use sanitized operational data during training. Never place passwords, API tokens, access codes, or private customer records in support messages.", "cover_sub"),
        PageBreak(),
    ]


def main_story():
    story = cover()
    story += [P("Index and how to use this docket", "h1"), P("Use the Academy for searchable, current instructions and completion tracking. Use this PDF as the printable implementation handoff.", "callout"), table([
        ["Section", "Use it for"],
        ["1. Start here", "Implementation ownership and service boundary"],
        ["2. Seven-day schedule", "Daily rollout sequence and evidence"],
        ["3. Roles", "Champion, Dispatcher, Driver, Viewer, and support boundaries"],
        ["4. Data preparation", "Import fields and acceptance checks"],
        ["5. Practice-route checklist", "Eight evidence-backed readiness steps"],
        ["6. Dispatcher runbook", "Before, during, and after the pilot route"],
        ["7. Exception ownership", "First owner, required response, and escalation"],
        ["8. Driver Quick Start", "Mobile stop flow and proof"],
        ["9. Security, privacy, support", "Safe data handling and request details"],
        ["10. Signoff", "Customer launch-readiness acknowledgement"],
        ["11. KPI review", "Week-one and day-30 measures"],
        ["Appendix A. 21 click-by-click procedures", "Eight stages with annotated screenshots, exact controls, and success evidence"],
        ["Appendix B. Troubleshooting", "Symptoms, likely causes, ordered fixes, and escalation points"],
        ["Appendix C. Common Q&amp;A", "Frequent implementation and route-day questions"],
    ], [2.25 * inch, 4.05 * inch]), P("How to follow a procedure", "h2")] + bullets([
        "Choose video, written, or both. The Academy video chapters and Appendix A procedures cover the same implementation stages.",
        "Confirm you are signed in with the audience role shown for the procedure.",
        "Find the numbered copper callout in the screenshot, then click the matching control in your workspace.",
        "Read the Confirm statement before moving to the next step; intent is not accepted in place of saved evidence.",
        "If the expected result does not appear, stop and use Appendix B rather than forcing the workflow forward.",
    ]) + [PageBreak()]
    story += [P("1. Start here", "h1"), P("Outcome: the customer can reach launch readiness with self-guided materials and one focused checkpoint.", "callout")]
    story += bullets([
        "The customer Champion owns data preparation, team scheduling, lesson completion, the practice route, and internal reinforcement.",
        "Trovan owns accurate Academy content, the launch docket, product support, and final assisted-pilot readiness review.",
        "Start with one depot, one Dispatcher, one Driver, one ready vehicle, and one representative route day.",
        "Do not treat the 30-minute readiness review as a general training session; arrive with the checklist and practice evidence complete.",
    ])
    story += [P("Standard service boundary", "h2"), table([
        ["Included", "Separately scoped"],
        ["Trovan Academy and this docket", "Customer data cleanup or conversion"],
        ["Best-effort support; one-business-day initial response target", "Custom integrations or customer-specific process design"],
        ["One 30-minute launch-readiness review", "Live team training, onsite work, or managed implementation"],
        ["Product defect investigation", "Additional enablement or operational consulting"],
    ], [3.15 * inch, 3.15 * inch]), PageBreak()]

    story += [P("2. Seven-day implementation schedule", "h1"), table([
        ["Day", "Customer Champion outcome", "Evidence"],
        ["1", "Confirm Champion, roles, timezone, depot, and support contact.", "Owner/Admin, Dispatcher, and pilot Driver can sign in."],
        ["2", "Prepare one active driver, one ready vehicle, customers, and route-day data.", "Fleet and customer records match the practice scope."],
        ["3", "Import jobs and correct every location or constraint blocker.", "All pilot jobs are routable or deliberately excluded."],
        ["4", "Create a provider-backed plan and review unassigned work.", "Optimizer provenance is live, no unsupported fallback is used."],
        ["5", "Complete Driver Quick Start and dispatch the practice route.", "Driver assignment, dispatch state, and team completion are recorded."],
        ["6", "Capture proof, rehearse one exception, and complete signoff.", "Proof artifact, message/escalation path, and KPI baseline exist."],
        ["7", "Complete the 30-minute Trovan readiness review.", "Blockers, owner, fallback procedure, and launch date are confirmed."],
    ], [0.45 * inch, 3.0 * inch, 2.85 * inch]),
    P("Stop the sequence when a prerequisite is incomplete. Do not hide a data, provider, permissions, or proof blocker simply to preserve the calendar.", "callout"), PageBreak()]

    story += [P("3. Roles and responsibilities", "h1"), table([
        ["Role", "Owns", "Does not own"],
        ["Customer Champion (Owner/Admin)", "Implementation schedule, team completion, data readiness, practice route, signoff", "Daily driving or every dispatch decision"],
        ["Dispatcher", "Import review, route planning, publish readiness, driver assignment, live exceptions", "Organization security policy or billing"],
        ["Driver", "Assigned route execution, arrival/departure, proof, exceptions, dispatch messages", "Route optimization or administrative configuration"],
        ["Viewer", "Read-only dashboard, tracking, proof, and reporting review", "Changing operational records"],
        ["Trovan", "Materials, product support, readiness review, platform defects", "Routine customer data cleanup or internal team management"],
    ], [1.35 * inch, 2.75 * inch, 2.2 * inch]),
    P("Required Academy tracks", "h2"), table([
        ["Track", "Audience", "Target", "Completion evidence"],
        ["Start Here", "Champion, Owner, Admin", "15 min", "Knowledge check passed"],
        ["Workspace Setup", "Champion, Admin", "25 min", "Knowledge check plus saved depot/fleet/users"],
        ["Route Operations", "Champion, Dispatcher, Admin", "40 min", "Knowledge check plus practice route"],
        ["Driver Quick Start", "Pilot Driver", "15 min", "Knowledge check plus practice stop/proof"],
        ["Go-Live", "Champion", "15 min", "Knowledge check and signoff"],
        ["Viewer Basics", "Viewer", "5 min", "Optional"],
    ], [1.35 * inch, 1.75 * inch, 0.7 * inch, 2.5 * inch]), PageBreak()]

    story += [P("4. Data preparation", "h1"), P("Use the included CSV template for one representative route day. Start with the minimum fields, then add routing-critical constraints only when they affect the actual operation.", "body"),
    table([
        ["Field", "Required", "Purpose / example"],
        ["customerName", "Yes", "Receiver or location display name"],
        ["deliveryAddress", "Yes", "Complete street, city, state, and postal code"],
        ["timeWindowStart / timeWindowEnd", "Recommended", "ISO timestamp or agreed import format"],
        ["serviceDuration", "Recommended", "Minutes expected at the stop"],
        ["weight / volume / pallet dimensions", "When applicable", "Vehicle capacity and floor-position fit"],
        ["requiredEquipment / certifications", "When applicable", "Liftgate, refrigeration, hazmat, credential rules"],
        ["accessCode / gateInstructions", "Sensitive", "Enter only in approved Trovan fields; never email or paste into tickets"],
        ["temperature / hazmat / handling", "When applicable", "Safety and compatibility constraints"],
    ], [1.85 * inch, 1.05 * inch, 3.4 * inch]),
    P("Import acceptance checklist", "h2")] + bullets([
        "Every row has a recognizable customer name and complete delivery address.",
        "Time windows use one timezone and do not contradict each other.",
        "Loads use consistent units and include dimensions when pallet fit matters.",
        "Driver, equipment, access, temperature, and hazmat rules are intentional.",
        "Duplicate external references are resolved before import.",
        "Sensitive access instructions remain inside approved product fields.",
    ]) + [PageBreak()]

    story += [P("5. Eight-step practice-route checklist", "h1"), table([
        ["#", "Readiness step", "Complete when", "Owner"],
        ["1", "Confirm primary depot", "The correct service location and timezone are saved.", "Champion"],
        ["2", "Add active driver", "The pilot Driver identity and contact information are active.", "Champion"],
        ["3", "Add ready vehicle", "An available vehicle has realistic capacity and equipment.", "Fleet owner"],
        ["4", "Import route day", "One representative job file is persisted.", "Dispatcher"],
        ["5", "Validate locations", "Every pilot job has a routable pickup or delivery location.", "Dispatcher"],
        ["6", "Create provider-backed route", "Road-network provenance is live and publish blockers are resolved.", "Dispatcher"],
        ["7", "Dispatch practice route", "The trained Driver is assigned and the route is dispatched.", "Dispatcher"],
        ["8", "Capture proof", "At least one required proof artifact is persisted and reviewable.", "Driver"],
    ], [0.35 * inch, 1.75 * inch, 3.25 * inch, 0.95 * inch]),
    P("The Academy readiness card combines these workspace facts with Champion and Driver training completion. Browser-local checkboxes are not accepted as launch evidence.", "callout"), PageBreak()]

    story += [P("6. Dispatcher pilot-day runbook", "h1"), P("Before dispatch", "h2")] + bullets([
        "Confirm the runtime status is live and required services are healthy.",
        "Verify the service date, depot, drivers, vehicles, time windows, and customer instructions.",
        "Review unassigned jobs and every capacity, appointment, equipment, driver, or access blocker.",
        "Confirm provider-backed road-network provenance and no unsupported fallback.",
        "Assign the trained pilot Driver and communicate the support/escalation path.",
    ]) + [P("During the route", "h2")] + bullets([
        "Monitor status, messages, ETA changes, exceptions, and proof requirements from Dispatch.",
        "Keep route changes in Trovan so the operational record and audit trail remain complete.",
        "For failed stops, record the reason, customer impact, owner, and next action.",
        "Do not exchange access codes, tokens, or private customer data in unapproved messages.",
    ]) + [P("After the route", "h2")] + bullets([
        "Resolve every route and stop state; do not leave a silent skipped stop.",
        "Verify required proof is persisted and visible in Proof of Delivery.",
        "Record what confused the team and search the knowledge base before opening support.",
        "Capture planning time, mileage, late-risk stops, failed deliveries, and proof completion.",
    ]) + [PageBreak()]

    story += [P("7. Exception ownership and escalation", "h1"), table([
        ["Condition", "First owner", "Required response", "Escalate when"],
        ["Bad or ambiguous address", "Dispatcher", "Correct or validate location; rerun readiness.", "Location remains unresolved or geocoder is unavailable."],
        ["Capacity / equipment mismatch", "Dispatcher", "Choose an eligible vehicle or correct load data.", "No eligible asset exists or policy is unclear."],
        ["Driver cannot complete stop", "Driver", "Record exception, reason, note, and message Dispatch.", "Safety, customer impact, access, or route timing changes."],
        ["Route provider degraded", "Dispatcher", "Stop publication; preserve warning/provenance details.", "Hosted road-network input is unavailable or fallback appears."],
        ["Proof missing or failed", "Driver", "Retry at the stop; record why proof cannot be captured.", "Device/storage failure or policy exception persists."],
        ["Access / permissions issue", "Owner/Admin", "Review membership and least-privileged role.", "Invite, session, SSO, or tenant boundary appears incorrect."],
        ["Possible security/privacy incident", "Champion", "Stop sharing, preserve IDs, contact Trovan immediately.", "Always; do not include secrets in the message."],
    ], [1.25 * inch, 0.85 * inch, 2.55 * inch, 1.65 * inch]),
    P("Support request template", "h2"), P("Organization: ______  Role: ______  Page: ______  Route/job ID: ______<br/>Expected: _______________________________________________<br/>Observed: _______________________________________________<br/>Request ID: ______  Time/timezone: ______  Redacted screenshot attached: Yes / No", "callout"), PageBreak()]

    story += [P("8. Driver Quick Start", "h1"), P("Use the mobile Driver workspace only with your assigned authenticated identity.", "callout"),
    table([
        ["Step", "Driver action", "Evidence"],
        ["1. Review", "Open the assigned route; check stop order, timing, and instructions.", "Correct route and vehicle are visible."],
        ["2. Start", "Start the route only when ready to leave.", "Route enters active execution."],
        ["3. Arrive", "Record arrival when physically at the stop.", "Arrival timestamp is attached to the stop."],
        ["4. Prove", "Capture required photo, signature, recipient, or note before leaving.", "Proof is persisted and reviewable."],
        ["5. Except", "When service fails, choose the exception path and explain what happened.", "Reason and customer impact are visible to Dispatch."],
        ["6. Message", "Notify Dispatch when the exception affects timing, route, or customer expectations.", "Message stays attached to the route."],
        ["7. Depart", "Record departure, then continue to the next stop.", "Stop state is resolved."],
        ["8. Complete", "Finish the route only after every stop is resolved.", "Route history is complete."],
    ], [0.8 * inch, 3.3 * inch, 2.2 * inch]),
    P("Never forward access codes, proof images, customer details, or tracking links outside approved operational channels.", "callout"), PageBreak()]

    story += [P("9. Security, privacy, and support", "h1")] + bullets([
        "Use the least-privileged role and individual accounts; do not share sessions.",
        "Treat route, driver, customer, location, proof, and access-instruction data as operationally sensitive.",
        "Include identifiers and request IDs in support requests, but redact tokens, passwords, access codes, signatures, and unnecessary customer data.",
        "Public tracking links are scoped to one delivery context; report unexpected exposure immediately.",
        "The assisted pilot offers best-effort support with a target initial response within one business day and no contractual uptime SLA unless the order form says otherwise.",
        "Billing and production onboarding remain manually approved; there is no public self-service checkout or free trial.",
    ]) + [P("Common questions", "h2"), table([
        ["Question", "Answer"],
        ["Why is my job blocked?", "Open job readiness and correct the named location, capacity, appointment, equipment, driver, or site constraint."],
        ["Why can’t I dispatch?", "Confirm publish state, eligible Driver/vehicle assignment, readiness blockers, and reroute state."],
        ["What counts as proof?", "The configured photo, signature, recipient, note, and timestamps attached to the stop."],
        ["Is live training included?", "No. The standard plan includes Academy, docket, support, and one readiness review."],
        ["What belongs in support?", "Organization, role, page, record ID, expected/observed behavior, request ID, time, and redacted screenshot."],
    ], [2.15 * inch, 4.15 * inch]), PageBreak()]

    story += [P("10. Launch-readiness signoff", "h1"), P("The Customer Champion completes this page after the practice route and before the Trovan readiness review.", "body"),
    table([
        ["Confirmation", "Initial / date"],
        ["Champion, Dispatcher, and pilot Driver roles and access are correct.", "________________"],
        ["Required Academy tracks are complete with passing knowledge checks.", "________________"],
        ["Depot, driver, vehicle, jobs, and every pilot location are ready.", "________________"],
        ["The provider-backed practice route was published and dispatched.", "________________"],
        ["At least one stop captured persisted proof.", "________________"],
        ["The team rehearsed one exception and knows the escalation path.", "________________"],
        ["Customer responsibilities and separately scoped work are understood.", "________________"],
        ["Week-one and day-30 KPI owners and review dates are set.", "________________"],
    ], [5.1 * inch, 1.2 * inch]),
    Spacer(1, 0.25 * inch),
    P("Customer Champion: _______________________________  Date: ______________", "body"),
    P("Trovan readiness reviewer: _________________________  Date: ______________", "body"),
    P("Approved launch date / next action: ____________________________________________", "body"), PageBreak()]

    story += [P("11. First-week and day-30 KPI review", "h1"), table([
        ["Metric", "Baseline", "Week 1", "Day 30", "Owner / action"],
        ["Minutes to prepare and publish route day", "", "", "", ""],
        ["Planned and actual route miles", "", "", "", ""],
        ["Unassigned / blocked jobs", "", "", "", ""],
        ["Late-risk or missed-window stops", "", "", "", ""],
        ["Failed deliveries", "", "", "", ""],
        ["Required proof completion rate", "", "", "", ""],
        ["Driver / Dispatcher support questions", "", "", "", ""],
        ["Knowledge-base searches without an answer", "", "", "", ""],
    ], [2.4 * inch, 0.75 * inch, 0.75 * inch, 0.75 * inch, 1.65 * inch]),
    P("Review questions", "h2")] + bullets([
        "Which step still depends on a spreadsheet, text thread, or repeated manual explanation?",
        "Which support question should become an Academy article or checklist instruction?",
        "Which route constraints or customer instructions were missing at import time?",
        "Did Driver status and proof match what Dispatch expected?",
        "What must be fixed before expanding to another depot, team, or route day?",
    ]) + [Spacer(1, 0.25 * inch), Table([[qr_code(ACADEMY_URL), P("Open Trovan Academy for the latest lesson text, captions, knowledge checks, and persisted readiness status.", "center")]], colWidths=[1.05 * inch, 5.15 * inch], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.8, COPPER), ("BACKGROUND", (0, 0), (-1, -1), COPPER_LIGHT), ("PADDING", (0, 0), (-1, -1), 8)]))]
    story += written_guide_appendices()
    return story


def written_guide_appendices():
    procedures = [
        ("Assign the Customer Champion", "Owner or Admin", "academy-readiness.png", [
            ("Open", "Account menu > Help & Training", "The required Champion lessons and Launch readiness panel are visible."),
            ("Assign", "Customer Champion > Select Champion", "The selected Owner/Admin remains after refresh."),
            ("Prepare", "Download launch docket", "The PDF and editable roster, import, and KPI files open."),
        ], "Champion, Dispatcher, Driver, practice date, and escalation contact are recorded."),
        ("Complete the first-login system tour", "Champion, Owner, or Admin", "dashboard-navigation.png", [
            ("Verify", "Account menu > organization name", "The correct work identity, organization, and role are active."),
            ("Orient", "Dashboard > Jobs > Routing > Dispatch > Tracking", "The Champion can explain where each phase of route work occurs."),
            ("Find help", "Account menu > Help & Training", "Academy, written guide, Q&A, troubleshooting, and Support open."),
        ], "The Champion can identify the tenant, explain the Jobs-to-Tracking flow, and find help."),
        ("Confirm users and roles", "Champion or Admin", "settings-team.png", [
            ("Review", "Settings > Team", "Every pilot participant appears once with the correct work email."),
            ("Set roles", "Role selector beside each user", "Owner/Admin, Dispatcher, Driver, and Viewer boundaries match the person's work."),
            ("Test", "Send or resend invitation", "Each person signs in and sees the correct role-based workspace."),
        ], "The pilot team can sign in without shared accounts or unnecessary Admin access."),
        ("Set timezone and depot", "Champion or Admin", "settings-operations.png", [
            ("Open", "Settings > Operations", "The service timezone matches the local operating day."),
            ("Save", "Primary depot > Save", "The real vehicle origin persists and readiness marks the depot complete."),
        ], "One accurate primary depot and timezone persist after refresh."),
        ("Create the pilot Driver", "Champion, Admin, or fleet owner", "drivers-add.png", [
            ("Open", "Drivers > Add Driver", "The form uses the invited Driver's real work identity."),
            ("Qualify", "License and certification fields", "License, certifications, territory, shift, and restrictions match the work."),
            ("Save", "Save Driver", "The active Driver persists and Academy recognizes the record."),
        ], "The pilot Driver is active, qualified, and linked to the invited Driver identity."),
        ("Create the practice vehicle", "Champion, Admin, or fleet owner", "vehicles-add.png", [
            ("Open", "Vehicles > Add Vehicle", "The unit, type, status, and home depot identify the real vehicle."),
            ("Constrain", "Capacity and equipment fields", "Approved weight, volume, equipment, territory, and Driver limits are recorded."),
            ("Save", "Save Vehicle", "The vehicle persists, is available, and is compatible with the pilot Driver."),
        ], "One active, available, accurately constrained vehicle is ready for the pilot."),
        ("Add pilot customers", "Champion, Admin, or Dispatcher", "customers-add.png", [
            ("Create", "Customers > Add Customer", "Name, service address, contact, and reference are accurate."),
            ("Describe", "Service details and notes", "Windows, access, equipment, duration, and safe instructions are usable."),
            ("Verify", "Save Customer", "The saved map location represents the intended service entrance."),
        ], "Every pilot customer has an accurate service location and safe operating instructions."),
        ("Import the route day", "Dispatcher, Champion, or Admin", "jobs-import.png", [
            ("Prepare", "Docket > Job import CSV", "Headers remain unchanged and every row represents one intended stop."),
            ("Import", "Jobs > Import CSV", "The preview has the intended row count and identifies invalid data."),
            ("Correct", "Job row > readiness details", "Every pilot location is routable and constraint blockers are explained."),
        ], "All intended jobs are saved and excluded rows have an explicit reason."),
        ("Review imported jobs", "Dispatcher or Champion", "jobs-import.png", [
            ("Reconcile", "Jobs > service-date filter", "Saved, rejected, duplicate, and excluded counts explain every source row."),
            ("Inspect", "Open a representative job", "Address, time, service, quantity, units, and constraints match the source."),
            ("Clear", "Job readiness details", "All included jobs are routable and exclusions have a reason and owner."),
        ], "The saved count is reconciled, a sample is field-checked, and included jobs are ready."),
        ("Create a provider-backed route", "Dispatcher or Admin", "routing-exceptions.png", [
            ("Draft", "Routing > Generate route draft", "Assigned and unassigned work are separated for review."),
            ("Resolve", "Exceptions only", "No required job remains unassigned without a documented decision."),
            ("Verify", "Optimizer provenance", "Road-network provider details are live with no simulated fallback."),
        ], "The plan is provider-backed and every assignment or exclusion is explainable."),
        ("Review, adjust, and publish the route", "Dispatcher", "routing-selected.png", [
            ("Review", "Selected route", "Sequence, drive time, service, windows, load, return, and shift are feasible."),
            ("Adjust", "Stop timeline or route action menu", "Any operational change is recalculated and constraints remain valid."),
            ("Publish", "Publish route plan", "The approved version, timestamp, and provider provenance are visible."),
        ], "One identifiable, fully reviewed, provider-backed version is published."),
        ("Dispatch the practice route", "Dispatcher", "dispatch-attention.png", [
            ("Check", "Dispatch > Needs attention", "The practice route has no missing assignment or pending decision."),
            ("Assign", "Route > Driver and vehicle", "The trained Driver and eligible vehicle appear without warnings."),
            ("Release", "Publish, then Dispatch", "The route appears in the authenticated Driver workspace."),
        ], "Dispatch and Driver see the same route, vehicle, version, and state."),
        ("Start the assigned Driver route", "Pilot Driver", "driver-start.png", [
            ("Sign in", "Driver sign-in > assigned route", "Date, route, Driver, and vehicle match the Dispatch handoff."),
            ("Review", "Route summary and stop list", "The Driver understands stops, windows, instructions, and support path."),
            ("Start", "Start stop flow", "The route becomes active and Dispatch sees the same state."),
        ], "The authenticated Driver starts the correct dispatched route and vehicle."),
        ("Complete a Driver practice stop", "Pilot Driver", "driver-arrive.png", [
            ("Review", "Driver workspace > Start stop flow", "Route, vehicle, stop order, and instructions match the assignment."),
            ("Arrive", "Arrive", "The physical arrival timestamp is attached to the stop."),
            ("Resolve", "Add proof or Report exception", "Saved proof or the real exception remains attached after refresh."),
            ("Depart", "Depart", "Dispatch sees the same resolved stop state."),
        ], "Arrival, proof or exception, message when needed, and departure are visible to Dispatch."),
        ("Record and resolve an exception", "Driver and Dispatcher", "route-run-exception.png", [
            ("Create", "Route run > New exception", "Reason, severity, time, customer impact, and route/stop context are saved."),
            ("Coordinate", "Driver Messages > Message driver", "The next action, owner, and update time are visible to both roles."),
            ("Close", "Exceptions > Acknowledge or Resolve", "Owner, action, outcome, and final status persist after refresh."),
        ], "One practice exception has context, an owner, message history, outcome, and resolved status."),
        ("Monitor route progress", "Dispatcher or Champion", "tracking-view.png", [
            ("Open", "Tracking > Both", "The intended route, Driver, vehicle, stops, state, and latest signal are visible."),
            ("Assess", "Refresh signals", "Current progress, signal age, ETA, windows, and exceptions explain the risk."),
            ("Act", "Open route run or exception", "The next action and owner are recorded in the operational system."),
        ], "The team identifies a practice risk and records the correct action and owner."),
        ("Verify proof", "Dispatcher or Champion", "proof-filters.png", [
            ("Find", "Proof of Delivery > Filters", "The practice route and expected stop appear."),
            ("Inspect", "Proof record", "Required artifacts and timestamps load in the correct stop context."),
            ("Close", "Exceptions > open item", "Every failed or delayed stop has a reason, owner, and next action."),
        ], "At least one persisted proof is verified and no practice exception is ownerless."),
        ("Review as a Viewer", "Viewer", "tracking-view.png", [
            ("Locate", "Navigation > Tracking", "Route progress, ETA, completion, and exceptions are visible."),
            ("Inspect", "Proof of Delivery or Analytics", "The business question is answered without editing route records."),
        ], "The Viewer knows where to look and when a Dispatcher must make the change."),
        ("Complete launch signoff", "Customer Champion", "academy-readiness.png", [
            ("Clear", "Launch readiness > next action", "Every requirement is backed by saved workspace or training evidence."),
            ("Sign", "Go-Live > responsibility acknowledgement", "Customer signoff, escalation, fallback, KPI owner, and date persist."),
            ("Request", "Request review", "The checkpoint request names the launch date and any remaining owner/blocker."),
        ], "Academy says Ready for Review and matches the signed docket."),
        ("Review first-week and day-30 KPIs", "Champion, Owner, or Viewer", "analytics-export.png", [
            ("Scope", "Analytics > date range > View", "The period and population match the signed launch plan."),
            ("Review", "KPI summary", "Adoption, dispatch, service, exceptions, proof, and support have values or reasons."),
            ("Assign", "Export", "The report is saved and every off-target KPI has an owner and due date."),
        ], "Week-one and day-30 reviews are scheduled with named owners and corrective actions."),
        ("Use support and escalation", "All roles; Champion coordinates", "support-search.png", [
            ("Search", "Support > Search knowledge base", "A relevant article or troubleshooting item supplies a safe next action."),
            ("Own", "Docket > exception and escalation matrix", "The issue has one owner, priority, impact, and next update time."),
            ("Request", "Support > Request access/support", "The request safely includes organization, role, page, IDs, time, result, and checks."),
        ], "The Champion can classify the issue, identify the owner, and prepare a safe complete request."),
    ]

    story = [
        PageBreak(),
        P("Appendix A. 21 click-by-click implementation procedures", "h1"),
        P("The Academy version is searchable and canonical. Choose video, written, or both; each format follows the same eight-stage implementation program. These printable pages point to the exact control in the sanitized product interface.", "callout"),
        table([
            ["Stage", "Procedures"],
            ["1. Kickoff and ownership", "A1-A2"],
            ["2. Workspace foundation", "A3-A4"],
            ["3. Operational records", "A5-A7"],
            ["4. Route-day data", "A8-A9"],
            ["5. Plan and approve", "A10-A11"],
            ["6. Dispatch and practice", "A12-A15"],
            ["7. Monitor and close", "A16-A18"],
            ["8. Readiness and first 30 days", "A19-A21"],
        ], [3.7 * inch, 2.6 * inch]),
        PageBreak(),
    ]
    for index, (title, audience, image_name, steps, complete_when) in enumerate(procedures, 1):
        image_path = GUIDE_SCREENSHOTS / image_name
        if not image_path.exists():
            raise FileNotFoundError(f"Missing guide screenshot: {image_path}. Run npm run training:capture:guide first.")
        story += [P(f"A{index}. {title}", "h1"), P(f"Audience: {audience}", "body"), RLImage(str(image_path), width=6.3 * inch, height=3.54375 * inch), Spacer(1, 0.12 * inch), table([
            ["Step", "Click", "Confirm"],
            *[[name, click, confirm] for name, click, confirm in steps],
        ], [0.72 * inch, 2.15 * inch, 3.43 * inch]), P(f"Complete when: {complete_when}", "callout")]
        if index != len(procedures):
            story.append(PageBreak())

    troubleshooting = [
        ("Invitation or sign-in fails", "Wrong email, expired invite, revoked membership, or stale session.", "Confirm the invited address; resend from Settings > Team; sign out of other organizations; retry in a current browser.", "Correct active membership still fails in a clean session."),
        ("Expected page or action is missing", "Wrong role or signed-in identity.", "Compare the guide audience with the membership; confirm the email; correct the role only when the responsibility truly requires it.", "Correct role and identity still do not expose the documented control."),
        ("CSV import is rejected", "Changed headers, encoding, invalid dates, quoted commas, or inconsistent rows.", "Restart from the template; keep headers; export UTF-8 CSV; test a two-row sample.", "A minimal sanitized template file still fails."),
        ("Job is blocked from routing", "Address or appointment, capacity, equipment, certification, territory, access, temperature, or hazmat constraint.", "Open job readiness; correct the named field; revalidate before optimizing.", "Readiness conflicts with the saved record after refresh."),
        ("Optimization is degraded", "Provider configuration, coverage, timeout, or unreachable location.", "Read provenance; validate locations; retry once after correction; do not publish a fallback.", "Covered validated locations repeatedly fail with the same request details."),
        ("Route cannot publish", "Unassigned work, unresolved blocker, degraded provider result, or pending risk decision.", "Use Exceptions only; resolve or deliberately exclude each job; confirm provider-backed provenance; regenerate.", "Publish remains blocked after readiness shows no blockers."),
        ("Route cannot dispatch", "Missing/ineligible Driver or vehicle, stale route version, open exception, or pending reroute.", "Use Needs attention; confirm published state; assign eligible resources; resolve pending decisions.", "The route shows ready but Dispatch rejects it."),
        ("Driver cannot see route", "Wrong Driver identity, route not dispatched, or changed assignment.", "Confirm work identity; have Dispatch confirm state and assignment; refresh; never share another Driver session.", "Both workspaces agree but the route remains absent."),
        ("Stop status or proof will not save", "Network, required field, camera/location permission, or stale stop state.", "Keep page open; read inline error; restore permission/network; note saved state; message Dispatch before leaving.", "The action repeatedly fails after connectivity returns."),
        ("Proof exists but readiness is incomplete", "Unsaved artifact, wrong stop/route, or missing configured requirement.", "Filter to the practice route; verify association, artifacts, and timestamps; refresh Academy.", "The correct persisted proof is visible but readiness remains incomplete."),
        ("Training completion disappeared", "Major-version recertification or another user identity.", "Confirm identity and version; complete the updated knowledge check when required.", "A minor edit removed same-user, same-organization completion."),
        ("Readiness does not match workspace", "Unsaved record, wrong organization, incomplete role requirement, or refresh delay.", "Use next action; save the source record; confirm organization and Champion; refresh once.", "Source data and readiness remain inconsistent."),
    ]
    story += [PageBreak(), P("Appendix B. Troubleshooting", "h1"), P("Start with the symptom. Follow the checks in order. Preserve record IDs and the visible request ID, but never send passwords, tokens, access codes, signatures, or unrelated customer data.", "callout")]
    for symptom, cause, resolution, escalate in troubleshooting:
        story.append(KeepTogether([P(symptom, "h2"), table([
            ["Likely cause", cause],
            ["Resolve", resolution],
            ["Escalate when", escalate],
        ], [1.15 * inch, 5.15 * inch], header=False), Spacer(1, 0.08 * inch)]))
    story += [P("If the issue still needs support", "h2"), P("Copy this information into the request. Redact customer-sensitive data before attaching a screenshot.", "body"), P("Organization: ______  Role: ______  Page: ______  Route/job/stop ID: ______<br/>Expected result: __________________________________________<br/>Observed result: __________________________________________<br/>Request ID: ______  Local time/timezone: ______<br/>Checks already completed: __________________________________", "callout")]

    faqs = [
        ("Where should a customer begin?", "Assign an Owner/Admin Champion, download the docket, and record the pilot team, depot, vehicle, date, and escalation contact."),
        ("Should we import everything before the pilot?", "No. Prove one representative route day with one depot, Driver, and vehicle before expanding."),
        ("Why can a user not see this guide's page?", "Confirm the invited identity and required role. Do not grant Admin simply to bypass an access problem."),
        ("Can we rename CSV columns?", "Keep supported headers. customerName and deliveryAddress are required; optional constraints may be blank only when they do not apply."),
        ("What does provider-backed mean?", "The route used road-network travel inputs. Confirm solver, matrix mode, coverage, fallback state, solve time, and warnings."),
        ("What should happen to an unassigned job?", "Resolve the underlying blocker or deliberately exclude the job with a recorded reason."),
        ("What if the Driver sees the wrong route or vehicle?", "Do not start. Confirm identity and have Dispatch correct the assignment until both workspaces match."),
        ("What counts as proof?", "A persisted artifact attached to the correct stop, including each configured photo, signature, recipient, note, or timestamp."),
        ("Can readiness be checked manually?", "No. Training and operational steps come from saved evidence. Use the next-action link to correct the source record."),
        ("What belongs in support?", "Organization, role, page, record ID, expected and observed behavior, local time, request ID, and a redacted screenshot."),
    ]
    story += [PageBreak(), P("Appendix C. Common implementation Q&amp;A", "h1")]
    for question, answer in faqs:
        story.append(KeepTogether([P(question, "h2"), P(answer, "body")]))
    return story


def build_driver_quick_start(path: Path):
    doc = DocketDoc(str(path), cover_page=False, title="Trovan Driver Quick Start", author="Trovan")
    story = cover()[:0]
    story += [
        P("Driver Quick Start", "h1"),
        P("Review route. Start. Arrive. Prove. Except. Message. Depart. Complete.", "callout"),
        table([
            ["Step", "What to do"],
            ["Review", "Open only your assigned route. Check stop order, timing, address, and special instructions."],
            ["Start", "Start the route when you are ready to leave with the assigned vehicle."],
            ["Arrive", "Record arrival when physically at the stop."],
            ["Prove", "Before leaving, capture every required photo, signature, recipient, or note."],
            ["Except", "If service fails, use the exception path and record the real reason."],
            ["Message", "Tell Dispatch when the issue changes timing, route order, or customer expectations."],
            ["Depart", "Record departure, then continue to the next stop."],
            ["Complete", "Finish the route only after every stop is completed or resolved."],
        ], [1.0 * inch, 5.3 * inch]),
        P("Safety and privacy", "h2"),
        *bullets([
            "Do not use another Driver's session or device identity.",
            "Do not forward access codes, proof images, customer data, or tracking links.",
            "Stop and contact Dispatch for unsafe conditions or instructions that do not match the stop.",
            "When asking for support, provide the route/stop ID and request ID - never a password or token.",
        ]),
        Spacer(1, 0.15 * inch),
        Table([[qr_code("https://trytrovan.com/driver/help"), P("Open Driver Quick Start in Trovan for the captioned video, full instructions, and required knowledge check.", "center")]], colWidths=[1.05 * inch, 5.15 * inch], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.8, COPPER), ("BACKGROUND", (0, 0), (-1, -1), COPPER_LIGHT), ("PADDING", (0, 0), (-1, -1), 8)])),
    ]
    doc.build(story)


def write_csv(path: Path, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerows(rows)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    docket = OUTPUT / "trovan-customer-launch-docket-v1.pdf"
    DocketDoc(str(docket), title="Trovan Customer Launch Docket", author="Trovan").build(main_story())

    driver_pdf = OUTPUT / "trovan-driver-quick-start-v1.pdf"
    build_driver_quick_start(driver_pdf)

    job_csv = OUTPUT / "trovan-job-import-template.csv"
    write_csv(job_csv, [
        ["customerName", "deliveryAddress", "timeWindowStart", "timeWindowEnd", "serviceDuration", "weight", "volume", "palletLength", "palletWidth", "palletHeight", "requiredEquipment", "requiredCertifications", "accessCode", "gateInstructions", "temperature", "hazmat", "handling"],
        ["Sample Receiver", "123 Example St, Kansas City, MO 64106", "2026-08-24T09:00:00-05:00", "2026-08-24T11:00:00-05:00", "20", "450", "2.4", "48", "40", "52", "liftgate", "", "", "Call receiving on arrival", "ambient", "false", "Keep upright"],
    ])

    roster_csv = OUTPUT / "trovan-implementation-roster.csv"
    write_csv(roster_csv, [
        ["type", "name", "email_or_identifier", "role_or_status", "owner", "training_required", "training_completed", "notes"],
        ["Champion", "", "", "OWNER or ADMIN", "", "Start Here; Workspace Setup; Route Operations; Go-Live", "", ""],
        ["User", "", "", "DISPATCHER", "Champion", "Route Operations", "", ""],
        ["User", "", "", "DRIVER", "Champion", "Driver Quick Start", "", ""],
        ["Depot", "", "", "Primary", "Champion", "", "", ""],
        ["Vehicle", "", "", "Available", "Fleet owner", "", "", ""],
        ["Escalation", "", "", "Support contact", "Champion", "", "", ""],
    ])

    kpi_csv = OUTPUT / "trovan-launch-kpi-template.csv"
    write_csv(kpi_csv, [
        ["metric", "baseline", "week_1", "day_30", "owner", "action"],
        ["Minutes to prepare and publish route day", "", "", "", "", ""],
        ["Planned and actual route miles", "", "", "", "", ""],
        ["Unassigned or blocked jobs", "", "", "", "", ""],
        ["Late-risk or missed-window stops", "", "", "", "", ""],
        ["Failed deliveries", "", "", "", "", ""],
        ["Required proof completion rate", "", "", "", "", ""],
        ["Driver or Dispatcher support questions", "", "", "", "", ""],
        ["Knowledge-base searches without an answer", "", "", "", "", ""],
    ])

    readme = OUTPUT / "README-TROVAN-LAUNCH-DOCKET.txt"
    readme.write_text(
        f"TROVAN CUSTOMER LAUNCH DOCKET v{VERSION}\n\n"
        "Start with trovan-customer-launch-docket-v1.pdf.\n"
        "The PDF includes an index, annotated click-by-click instructions, common Q&A, and troubleshooting.\n"
        "Use https://trytrovan.com/academy/guide for canonical searchable instructions and persisted completion.\n"
        "Use only sanitized data during training. Never share passwords, tokens, access codes, or private customer data in support messages.\n",
        encoding="utf-8",
    )

    archive = OUTPUT / "trovan-customer-launch-docket-v1.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for file in [docket, driver_pdf, job_csv, roster_csv, kpi_csv, readme]:
            bundle.write(file, arcname=file.name)
        for screenshot in sorted(GUIDE_SCREENSHOTS.glob("*.png")):
            bundle.write(screenshot, arcname=f"guide-screenshots/{screenshot.name}")

    print(f"Created {docket}")
    print(f"Created {driver_pdf}")
    print(f"Created {archive}")


if __name__ == "__main__":
    main()
