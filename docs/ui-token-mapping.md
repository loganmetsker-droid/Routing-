# Trovan UI Token Mapping

Updated: 2026-06-09

The prototype tokens in `/Users/logan/Downloads/trovan-ui-prototype/design-tokens.json` are now mapped into the MUI token layer in `frontend/src/theme/designTokens.ts` and `frontend/src/theme/trovanTheme.ts`.

| Prototype token | App token destination | Value |
|---|---|---|
| `brand.copper` | `trovanColors.copper[500]` | `#B66A3C` |
| `brand.copperHover` | `trovanColors.copper[400]` | `#CC7F45` |
| `brand.copperPressed` | `trovanColors.copper[700]` | `#8F4B25` |
| `brand.navy950` | `trovanColors.brand.navy950` | `#061421` |
| `brand.navy900` | `trovanColors.brand.navy900` | `#071928` |
| `brand.navy850` | `trovanColors.brand.navy850` | `#0B1B28` |
| `brand.navy800` | `trovanColors.brand.navy800` | `#0F2030` |
| `semantic.success` | `trovanColors.semantic.success` | `#23B26D` |
| `semantic.blue` | `trovanColors.semantic.blue/info` | `#2E90FA` |
| `semantic.purple` | `trovanColors.semantic.purple` | `#855CF8` |
| `semantic.amber` | `trovanColors.semantic.amber/warning` | `#F79009` |
| `semantic.danger` | `trovanColors.semantic.danger/red` | `#F04438` |
| `semantic.teal` | `trovanColors.semantic.teal` | `#20C5A3` |
| `light.*` | `trovanColors.light.*` | Prototype light app background, surface, border, text, muted, sidebar |
| `dark.*` | `trovanColors.dark.*` | Prototype dark app background, surface, panel, border, text, muted, sidebar |
| `radii.sm/md` | `trovanLayout.controlRadius/panelRadius` | `9px` / `13px` |
| leafy map images | `frontend/public/prototype-assets/*.png` and `trovanMapTokens.*Image` | Copied from prototype assets |

Compatibility note: older `black`, `stone`, `utility`, and semantic alias keys remain available so existing components can migrate incrementally without breaking imports.
