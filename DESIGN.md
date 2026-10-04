# GymBroFitness design system

## Direction

GymBroFitness is a dark-first training log used one-handed between sets. It should feel like a well-made instrument, closer to Strong or Hevy than to a dashboard: cool near-black surfaces, one electric-blue accent, numbers set in a mono face, and lists instead of stacks of cards. If a screen needs a label to explain what a box is, the box is probably not needed.

Rules that keep it from drifting back into "AI dashboard" territory:

- Top-level screens are bento dashboards: each `Tile` holds one metric or one action, 12 pt apart, and the screen's lead tile gets the soft accent `glow`. Inside a tile, lists are rows with hairlines. No eyebrow labels above titles.
- Every tile earns its place with real data or a real image: exercise demo photos, muscle maps, sparklines, bars, rings. Empty tiles show an icon and one sentence on how to fill them, never a blank box.
- No chips for read-only metadata. Write it as a caption sentence ("Chest, barbell, Form AI") instead.
- No em dashes or "·" separators in UI copy. Use commas and short sentences.
- No gradients, glows or coloured shadows.

## Navigation and hierarchy

- The five primary destinations are **Today**, **Plan**, **Body**, **Progress** and **Exercises**.
- Profile opens from the avatar on Today; Settings and History open from Profile. Body links to weight and progress photos (`/body-log`).
- A resumable workout is the highest-priority state. Its bar sits above the tab bar and hides on Today (which already shows Resume), on the workout screen and while the keyboard is open.
- Every screen leads with a display-size title, a one-line status in body text, then the primary action. Detail and rationale come last, usually as a muted caption.

## Color roles

Components consume semantic roles from `src/theme/tokens.ts`, never palette values directly.

- `background` `#030509`: the canvas. `surface` / `surfaceRaised` / `surfacePressed`: the few raised areas and press states, with a quiet cool edge.
- `textPrimary`, `textSecondary`, `textMuted`: reading hierarchy. Muted text is never the only carrier of an instruction or an error.
- `accent` `#4A95FF` (electric blue, deliberately not purple) and `onAccent`: the single primary action per screen, active progress, and the one number that matters most. Selected filters invert to `textPrimary` instead of using the accent, so blue stays meaningful.
- `success`, `warning`, `danger`: feedback only, always paired with text. `success` also tints completed sets.
- Muscle heat and volume gauges use `BODY_HEAT_COLORS` in `src/domain/muscles/muscleMap.ts` (slate, sky, blue, violet, rose for above range); rank tiers use `RANK_TIER_COLORS`.

## Typography

Geist for text, Geist Mono for numbers, loaded in `src/app/_layout.tsx`. On Android each weight is its own family, so styles set `fontFamily` (via the typography roles) and never `fontWeight`.

Roles: `jumbo` (mono, hero numbers), `display` (screen titles), `title`, `heading` (section titles), `subheading`, `body`, `bodyBold`, `caption`, `captionBold`, `micro` (legends only), `numeric` (mono). `ListRow` and `Stat` pick the mono face automatically when a value contains digits.

## Spacing and shape

- Shared 2 to 56 spacing scale. Sections are separated by `xl`; related lines inside a section by `xs` to `md`.
- Radius scale: `sm` 6, `md` 10 (inputs, small controls), `lg` 12 (buttons, thumbnails), `xl` 16 (the rare surface), `pill` for filter pills and segmented controls.
- Paper's MD3 inputs derive their radius from `roundness`, so every `TextInput` passes `theme={inputTheme}`.
- Touch targets stay at least 44 pt / 48 dp. Screens respect safe-area and keyboard insets and keep bottom padding for the tab bar and workout bar.

## Components

Shared building blocks live in `src/components/ui` and `src/components/charts`:

- `Tile`: the bento unit. Optional title, aside, chevron when pressable, `glow` for the lead tile.
- `Sparkline` (self-drawing trend line), `BarSeries` (staggered, tappable bars), `ProgressRing` (sweeping ring).
- `ExerciseStrip` and `DayCard`: exercise demo images and per-day muscle silhouettes, so a plan reads before any text.

- `ListRow`: title, optional subtitle, optional right-aligned value, chevron when pressable, hairline divider. The default way to show any list.
- `Stat`: value over a caption label, used in rows of two or three. `emphasis` turns the value orange.
- `Pill`: filter or option pill. Active pills invert to light on dark.
- `Segmented`: two to five mutually exclusive views of the same data (Front/Back, 4W/12W/All, Sign in/Create account).

Buttons: one contained button per section for the primary action, outlined for a real secondary action, text buttons for everything else. Destructive actions always go through a named confirmation dialog. Empty states are one caption sentence that says what to do next; missing data is never replaced with demo numbers.

## Motion and feedback

Motion lives in `src/components/ui` and shares one vocabulary from `motion.ts`: the `easeOutExpo` curve (anime.js's signature ease), a firm `snappySpring`, a bouncier `popSpring`, and a 45 ms stagger.

- **Signature moment: completing a set.** The row fills with the success tint from left to right while the check button pops, a haptic fires, and the workout progress line springs forward. Everything else is quieter than this.
- `Reveal`: staggered fade-and-rise for screen sections, triggered on focus (never an off-screen `entering` animation, which left hidden tabs blank).
- `PressableScale`: rows, pills, rail items and timer buttons sink slightly under the thumb. `Pill` and `Segmented` add a selection haptic.
- `Segmented`: the highlight slides between options on a spring.
- `AnimatedNumber`: stats count up on easeOutExpo; `Stat` uses it automatically.
- `ProgressLine`: every bar glides to its value; set progress springs.
- `Skeleton`: shaped shimmer placeholders instead of spinners.
- Rest timer slides up on a spring, its fill glides continuously on the UI thread, and the clock pulses once when rest is over.

Every animation respects Reduce Motion through `useReducedMotion`. No looping decoration besides skeleton shimmer. Loading, saved, retry and disabled states stay visible as text.

## Accessibility checklist

- Icon-only controls have an accessibility label and role.
- Muscle dose, readiness and workout state are never encoded by colour alone.
- Screen-reader order follows title, current state, primary action, detail.
- Text wraps at large font scales; no fixed heights around text.
- Check contrast and touch targets on Android and iOS before beta sign-off.
