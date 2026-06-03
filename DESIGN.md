---
name: CoopChain
description: Trusted cooperative-office workspace for Chaiyaphum public-service operations.
colors:
  primary-green: "#169b62"
  primary-bright: "#10b981"
  primary-dark: "#059669"
  service-teal: "#168c96"
  action-blue: "#2563eb"
  warning-amber: "#f0a020"
  danger-red: "#d94b4b"
  navy-sidebar: "#142033"
  ink: "#0f172a"
  ink-soft: "#172033"
  muted: "#64748b"
  muted-cool: "#667085"
  surface: "#ffffff"
  app-bg: "#f7f9fb"
  app-bg-cool: "#eef2f7"
  border: "#e2e8f0"
  border-soft: "#e4e9f2"
  success-soft: "#ecfdf5"
  blue-soft: "#eff6ff"
  amber-soft: "#fff4dc"
typography:
  display:
    fontFamily: "Sarabun, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "0"
  headline:
    fontFamily: "Sarabun, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Sarabun, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Sarabun, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Sarabun, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.action-blue}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "48px"
  chip-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: CoopChain

## 1. Overview

**Creative North Star: "Trusted Cooperative Workspace"**

CoopChain should feel like a dependable public-service workspace: modern enough to reduce friction, restrained enough to stay credible, and clear enough for repeated operational use. The system is not a marketing site. It is a working interface for staff, cooperatives, and farmer groups who need status, records, forms, and deadlines without visual noise.

The current implementation uses Bootstrap 5, Sarabun, soft surfaces, green and teal accents, data cards, tables, badges, and familiar navigation patterns. Route-specific tools may develop their own density or palette accents, but the CoopChain baseline should stay readable, official, and consistent.

This system explicitly rejects loud marketing pages, over-decorated dashboards, heavy animation, low-contrast gray text, playful color palettes, and generic SaaS templates that obscure the public-office context.

**Key Characteristics:**
- Task-first product UI with familiar Bootstrap affordances.
- Green and teal as the official service identity, with blue and amber reserved for secondary actions and status.
- White cards on cool light backgrounds, using borders before heavy shadows.
- Sarabun as the single Thai-first family for body, labels, headings, and data.
- Mobile-readable layouts with desktop density where tables and dashboards need it.

## 2. Colors

The palette is a restrained public-service palette: green carries the CoopChain identity, teal supports service dashboards, blue marks links or secondary action, amber and red are reserved for status.

### Primary
- **Cooperative Green** (#169b62): Primary actions, success states, selected navigation, and official service identity.
- **Fresh Service Green** (#10b981): Existing app theme color and brighter gradient stop for navbars, hero panels, and emphasis.
- **Deep Cooperative Green** (#059669): Hover states, success text, and high-contrast green labels.

### Secondary
- **Service Teal** (#168c96): Dashboard accents, hero gradients, progress surfaces, and operational highlights that should not read as plain success.
- **Action Blue** (#2563eb): Links, secondary buttons, informational chips, and route-specific tools such as promotion/admin screens.

### Tertiary
- **Deadline Amber** (#f0a020): Warning counts, pending states, and due-date emphasis.
- **Attention Red** (#d94b4b): Destructive actions, errors, and high-risk warnings only.

### Neutral
- **Ink Slate** (#0f172a): Primary headings and table body text.
- **Soft Ink** (#172033): Dashboard page copy and strong labels.
- **Muted Slate** (#64748b): Secondary metadata. Use only when contrast remains readable.
- **Cool Muted Slate** (#667085): Form hints, dashboard captions, and secondary labels on white.
- **Surface White** (#ffffff): Cards, modals, forms, and table panels.
- **Cool App Background** (#eef2f7): Dashboard canvas and page background.
- **App Mist** (#f7f9fb): Global body background for standard pages.
- **Border Slate** (#e2e8f0): Table separators, card borders, input strokes.
- **Soft Border** (#e4e9f2): Dashboard panel edges and low-emphasis dividers.

### Named Rules
**The Official Accent Rule.** Green or teal should carry the primary action on CoopChain operational screens. Blue can support links and subsystems, but it should not replace the official green identity across the whole app.

**The Status Color Rule.** Amber, red, and bright blue are semantic. Do not use them as decoration when they are not communicating warning, danger, or information.

## 3. Typography

**Display Font:** Sarabun with system sans fallbacks  
**Body Font:** Sarabun with system sans fallbacks  
**Label/Mono Font:** Sarabun for labels; system monospace only for codes and identifiers

**Character:** Sarabun gives CoopChain a Thai-first, government-appropriate voice. The system should use weight and spacing for hierarchy rather than introducing decorative fonts.

### Hierarchy
- **Display** (700, 2.5rem, 1.18): Hero headings and large dashboard headers. Keep line lengths short and avoid fluid type in compact app panels.
- **Headline** (700, 1.5rem, 1.25): Page titles and major sections.
- **Title** (700, 1rem, 1.35): Card titles, modal headings, table block titles, and navigation labels.
- **Body** (400, 0.875rem, 1.6): Standard copy, table cells, descriptions, and form helper text. Keep prose to roughly 65 to 75 characters per line where the layout allows.
- **Label** (700, 0.82rem, 1.3): Badges, chips, compact metadata, and form labels. Avoid all-caps English labels unless they are short system statuses.

### Named Rules
**The One Family Rule.** Use Sarabun everywhere unless rendering codes, IDs, or technical values that benefit from monospace alignment.

**The Data Readability Rule.** Tables and dashboards may be dense, but text must remain legible on mobile. Reduce columns, wrap labels, or use responsive cards before shrinking type below readable sizes.

## 4. Elevation

CoopChain uses a hybrid of tonal layering, thin borders, and soft shadows. Default surfaces should be calm: white panels, cool backgrounds, and subtle borders. Strong shadows are reserved for dashboard hero panels, active hover states, modals, and fixed overlays.

### Shadow Vocabulary
- **Card Low** (`box-shadow: 0 10px 25px rgba(20, 32, 51, .06)`): Default dashboard cards and calm panels.
- **Card Raised** (`box-shadow: 0 18px 45px rgba(20, 32, 51, .08)`): Hero cards, important login panels, and hovered summary cards.
- **Legacy Card** (`box-shadow: 0 12px 30px rgba(15, 23, 42, .05)`): Existing shared public pages and report cards.
- **Modal High** (`box-shadow: 0 1.4rem 4rem rgba(20, 32, 51, .2)`): Dialogs and overlays above the app shell.

### Named Rules
**The Border First Rule.** Use borders and tonal backgrounds for structure before adding large shadows. Shadows should signal hierarchy, hover, or overlays.

**The Hover Lift Rule.** Hover movement should be small, usually 1 to 3px. Avoid dramatic card jumps in dense product screens.

## 5. Components

### Buttons
- **Shape:** Rectangular with practical rounding, usually 8px to 12px. Larger promotion surfaces may use 14px to 16px when the page is more campaign-like.
- **Primary:** Cooperative Green or a green-to-teal gradient, white text, 44px to 52px height, and bold labels that name the action.
- **Hover / Focus:** Slight lift, brightness shift, or stronger border. Focus rings must remain visible and high contrast.
- **Secondary / Ghost / Tertiary:** White or soft-tinted backgrounds with a clear border. Use Bootstrap outline patterns where possible.

### Chips
- **Style:** Soft background tint, rounded pill or 8px badge, bold label, and semantic color.
- **State:** Use green for completed or active, amber for pending, blue for informational, red for dangerous or failed states.

### Cards / Containers
- **Corner Style:** Core dashboard cards use 8px in newer app shells; legacy shared cards often use 16px. Avoid nesting cards inside cards.
- **Background:** White cards on cool light backgrounds. Admin and promotion subsystems may use a stronger blue or slate shell when the workflow is distinct.
- **Shadow Strategy:** Low shadow by default, raised shadow for hover or primary panels.
- **Border:** Use #e2e8f0 or rgba slate borders for structure.
- **Internal Padding:** 16px for dense cards, 24px to 32px for hero or major panels.

### Inputs / Fields
- **Style:** White or near-white fill, thin border, 8px to 12px radius, clear labels above fields.
- **Focus:** Green-tinted focus ring for standard CoopChain flows. Blue focus is acceptable in blue subsystem contexts.
- **Error / Disabled:** Error states use red text and border, not color alone. Disabled fields should remain readable with lowered contrast but clear affordance.

### Navigation
- **Style:** Standard pages use Bootstrap navbars with green gradients and white nav text. Dashboard shells may use a dark navy sidebar with green icon accents.
- **Typography:** Bold enough to scan, never decorative.
- **States:** Active nav must be visibly selected through background, underline, or color. Hover should not be the only state.
- **Mobile:** Collapse sidebars into stacked navigation or Bootstrap collapse patterns. Keep tap targets at least 44px tall.

### Data Tables
- **Style:** White surface, muted header row, strong body text, and clear row separation.
- **Density:** Dense is acceptable for staff dashboards, but columns should remain readable on mobile via responsive tables or card views.
- **Badges:** Status cells should use badges with text labels, not color alone.

### Modals
- **Style:** Bootstrap modal structure, white surface, clear title, close button, and scrollable body for long lists.
- **Behavior:** Use modals for focused inspection or confirmation. Avoid using a modal as the first solution for every workflow.

## 6. Do's and Don'ts

### Do:
- **Do** use Cooperative Green (#169b62 or #10b981) for primary actions and official identity cues.
- **Do** keep table text and dashboard counts readable before adding decoration.
- **Do** use Sarabun consistently across headings, labels, forms, and tables.
- **Do** preserve familiar Bootstrap affordances for forms, buttons, navbars, modals, and tooltips.
- **Do** give status colors text labels, especially in tables and badges.
- **Do** design route-specific tools as focused subsystems while preserving core CoopChain credibility.
- **Do** test mobile layouts for horizontal overflow and readable Thai wrapping.

### Don't:
- **Don't** make CoopChain feel like a loud marketing page.
- **Don't** over-decorate dashboards with visual spectacle that competes with status and workflow.
- **Don't** use heavy animation. Motion should support state changes and respect reduced motion.
- **Don't** use low-contrast gray text on light or tinted backgrounds.
- **Don't** use playful color palettes that weaken public-office trust.
- **Don't** prioritize generic SaaS template styling over official, task-focused usability.
- **Don't** rely on color alone for pending, success, warning, or danger states.
- **Don't** nest cards inside cards or use modals when inline disclosure is clearer.
