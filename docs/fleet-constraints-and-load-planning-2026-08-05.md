# Fleet constraints and load planning

Date: 2026-08-05

## Product position

Trovan's assisted-pilot fleet workflow is an operational fleet overview plus constraint-aware route planning. It intentionally follows the useful FleetView/FleetLoader patterns—fleet status, active exceptions, vehicle properties, business rules, cargo compatibility, and load-position guidance—without copying Roadnet branding or interface assets.

Primary references:

- [Roadnet Anywhere 5.3 FleetView release notes](https://customer.omnitracs.com/public/release_notes/roadnet/rna/version/5-3.htm)
- [Roadnet Anywhere 5.4 FleetView and equipment-property release notes](https://customer.omnitracs.com/public/release_notes/roadnet/rna/version/54.htm)
- [Solera fleet-solutions brochure](https://www.solera.com/wp-content/uploads/2023/12/Solera-Fleet-Solutions-Brochure.pdf)
- [OptimoRoute vehicle load capacities](https://help.optimoroute.com/hc/en-us/articles/27432474422804-Set-up-vehicle-load-capacities)
- [OptimoRoute driver skills](https://help.optimoroute.com/hc/en-us/articles/27077930859924-Add-and-manage-driver-skills)

## Implemented workflow

### Fleet overview

- Search by vehicle, license plate, or assigned driver.
- Filter by vehicle type, operating state, active route, and active exception.
- Sort exceptions first, active routes first, pallet capacity, or name.
- Show available fleet, active routes/stops, exception count, and load-fit configuration coverage.
- Show current route state, assigned driver, stop count, vehicle limits, pallet positions, and saved operating rules.

### Vehicle rules

- Payload and volume capacity are stored canonically in kilograms and cubic meters; US-facing inputs and displays convert to pounds and cubic feet.
- Cargo envelope: interior length, width, height, door height, pallet floor positions, maximum pallet weight, stack height, and stack levels.
- Required features and handling capabilities such as liftgate, pallet jack, refrigeration, medical, or hazmat.
- Driver allow and block lists.
- Operator-authored advisory or required-review instructions.

Free-text instructions are deliberately review rules. Rules that must automatically prevent an assignment must use the structured capacity, feature, driver, certification, or compatibility fields.

### Job and stop rules

- Multiple pallet groups with independent dimensions, weight, stackability, fragility, rotation, and compatibility tags.
- Required equipment/vehicle features and allowed or prohibited vehicles.
- Required driver, driver allow/block lists, and required certifications.
- First-stop and last-stop constraints.
- Access notes, protected access code, gate instructions, and required-code indicator.
- Temperature, hazmat, and handling instructions.
- JSON/CSV import coverage for the common constraint fields.

### Load-fit estimate

The estimate calculates total weight, total volume, pallet count, and approximate floor positions. It accounts for fragile/non-stackable freight, stack limits, interior and door dimensions, pallet footprint/rotation, per-pallet weight, required equipment, cargo incompatibilities, vehicle allow/block lists, and driver/certification rules.

The same evaluator is used by the job fleet-fit panel, automatic planning, fallback allocation, dispatcher route recommendations, preview workflows, vehicle/driver reassignment, manual insertion, and batch stop moves. Manual edits return the first human-readable blocker plus structured blocker codes.

### Driver execution

- Authenticated route-run details include handling instructions and vehicle operating rules.
- Access codes are masked by default and require an explicit reveal action.
- Access codes are not added to public tracking payloads.
- Route-group fit warnings and vehicle operating rules enter the publish-readiness gate. A dispatcher must resolve them or record an audited risk-acceptance reason before publishing.

## Safety boundary

The load-fit result is planning guidance. It is not a legal payload, axle-distribution, center-of-gravity, cargo-securement, bridge-clearance, or dangerous-goods certification. Dispatch remains responsible for legal and physical loading approval.

## Before broader self-serve launch

The assisted pilot can use the implemented rough-fit workflow after hosted verification. The following are deliberate next-level features, not claims in the current product:

- compartment/bay placement and axle-level weight distribution;
- visual 2D/3D load diagrams and cargo-shift sequencing;
- reusable customer/site constraint templates and rule-effective dates;
- telematics-powered odometer, maintenance, DVIR, and fault-code workflows;
- geofenced automatic arrival/departure and exception escalation;
- rule acknowledgement audit for every required-review free-text instruction;
- field-level encryption and rotation workflow for persistent gate/access codes.

These should be prioritized from pilot evidence. Axle/legal loading and access-code encryption are required before representing Trovan as a certified load-planning system or using it for high-security facilities.
