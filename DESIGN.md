# GymBroFitness design system

## Direction

GymBroFitness is a dark-first mobile training tool used one-handed between sets. The interface is serious, quiet and high-contrast: black and cool-neutral surfaces carry the structure, while electric blue identifies actions and selected state. Training data must be legible before it is decorative.

## Navigation and hierarchy

- The four primary destinations are **Today**, **Plan**, **Progress** and **Exercises**.
- Profile and Settings are contextual destinations opened from the Today header. Body is a detailed view opened from Progress.
- A resumable workout is the highest-priority state. Its persistent bar sits above the tab bar, respects the safe area and disappears while the keyboard or workout screen is active.
- Top-level screens lead with the current task or decision. Supporting metrics follow; detailed rationale remains available without displacing the primary action.

## Color roles

Components consume semantic roles from `src/theme/tokens.ts`, never palette values directly.

- `background`: application canvas.
- `surface`, `surfaceRaised`, `surfacePressed`: structural elevation and interaction states.
- `textPrimary`, `textSecondary`, `textMuted`: reading hierarchy. Muted text is never used for critical instructions or errors.
- `accent`, `accentPressed`, `accentSoft`, `onAccent`: primary actions, selected controls and focus.
- `success`, `warning`, `danger`, `info` and their soft variants: semantic feedback. Every color signal is accompanied by text or an icon label.
- Borders separate adjacent surfaces; shadows are reserved for floating navigation or overlays.

## Typography

Use the system font through the roles in `src/theme/tokens.ts`: `jumbo`, `display`, `title`, `heading`, `subheading`, `body`, `caption`, `micro` and `numeric`. Numeric results use `numeric`; labels do not imitate data typography. Avoid fixed container heights around text so larger accessibility sizes can wrap.

## Spacing and shape

- Use the shared 2–56 spacing scale. Related controls stay close; distinct sections receive at least `lg` separation.
- Cards normally use `radius.lg` or `radius.xl`; pills are reserved for compact chips and statuses.
- Interactive controls have a minimum 44 pt target on iOS and should reach 48 dp where Android layout permits.
- Screen content respects safe-area and keyboard insets. Scroll screens retain enough bottom padding for tabs and the active-workout bar.

## Components

- Filled buttons are reserved for the primary action in a section. Tonal and outlined buttons are secondary; text buttons navigate back or dismiss.
- Inputs use visible labels, explicit error copy and a recovery action where relevant.
- Chips select a short option or filter; they do not replace navigation or hide long explanations.
- Bottom sheets hold reversible contextual choices. Destructive or data-loss decisions require a clearly named confirmation.
- Empty states state what is missing, why it matters and the next available action. Missing data is never replaced with demo scores.

## Motion and feedback

Motion clarifies entry or state change and stays brief. `Reveal` provides the standard entrance; when Reduce Motion is enabled it renders without animation. Haptics acknowledge deliberate workout actions, not routine scrolling. Loading, saved, retry and disabled states must remain visible in text.

## Accessibility checklist

- Give icon-only controls an accessibility label and interactive semantics.
- Do not encode success, warning, muscle dose or workout state with color alone.
- Preserve screen-reader order: title, current state, primary action, supporting detail.
- Allow text wrapping and system font scaling; verify narrow screens and long localized labels.
- Keep the active workout reachable across primary tabs but hide its overlay when the keyboard is visible.
- Validate contrast and touch targets on both Android and iOS before beta sign-off.
