# GymBroFitness — Project Assessment & Roadmap

_Last updated: 2026-09-10_

## What this project currently is

An Expo/React Native (TypeScript) mobile app scaffold for a **science-informed hypertrophy training app**. The codebase is lopsided in an interesting way:

- **Domain logic: strong, ~3,400 lines, framework-free TS** ([src/domain](../src/domain))
  - [exercises/](../src/domain/exercises) — catalog of 80+ exercises seeded by muscle group (chest, back, shoulders, arms, legs, calves/core), each with movement pattern, equipment, difficulty, tracking type, and swap/replacement logic.
  - [programs/](../src/domain/programs) — split templates (full-body, upper/lower, upper/lower/full-body, PPL) and a generator that builds a program from user preferences (equipment, experience, priorities, exclusions, session time budget).
  - [progression/](../src/domain/progression) — a double-progression engine: rep ranges, RIR, load increments, deload signals, pain/readiness guardrails, plus human-readable explanations for why a decision was made.
  - [workouts/](../src/domain/workouts) — analytics (working sets, volume load, estimated 1RM, muscle-group set distribution, PRs) and readiness checks.
  - [theme/](../src/theme), [utils/](../src/utils), [types/](../src/types) — design tokens, unit/date helpers, shared domain types.
- **UI: not built yet.** [src/app](../src/app) (the Expo Router screen tree) is empty — the README confirms the original sample screens were intentionally removed and never replaced.
- **Backend: scaffolded, not implemented.** `@supabase/supabase-js` is a dependency and `.env.example` expects a Supabase URL/anon key, but the [supabase/](../supabase) directory has no schema or migrations yet.
- **Tooling is solid**: Jest + Testing Library, ESLint, Prettier, TypeScript strict config, and a few existing unit tests for the catalog and unit-conversion utils.

**In short: this is a well-designed training-logic engine with no face and no persistence yet.** The hardest, most differentiating part (auto-regulated programming) is already written; the parts every fitness app needs (screens, auth, data sync) are the gap.

## Competitive landscape (2026)

| App | Model | Notes |
|---|---|---|
| **Hevy** | Free logger + social | Most popular; polished UI, follow friends, copy routines, generous free tier (unlimited workouts/routines, 400+ exercise library). |
| **Strong** | Bring-your-own-program logger | Fastest pure logger, no auto-programming. $29.99/yr or $99.99 lifetime. |
| **Fitbod** | AI auto-programming | Generates each session from your logged history, recovery, and muscle balance. $95.99/yr. |
| **Boostcamp** | Free program library + logger | Large catalog of known strength/hypertrophy templates you log against; doesn't generate custom plans. |
| **RP Hypertrophy** | Auto-regulated programming (Mike Israetel/RP methodology) | Subscription-only, $34.99/mo or $299.99/yr — closest philosophical match to this repo's progression engine. |
| **JeFit / StrengthLog** | Logger + community programs | Similar tier to Hevy/Strong, less polish. |

**Where GymBroFitness fits:** the existing domain layer (auto-generated splits + double-progression engine with deload/readiness logic) puts this app closer to **Fitbod / RP Hypertrophy's "auto-regulated programming" category** than to Hevy/Strong's "pure logger" category — that's the harder, more defensible product to build, and it's already mostly written here. The market gap is that the auto-programming apps are all paid ($96–$350/yr); a free or low-cost app with transparent, explainable progression logic (the engine already returns *why* a decision was made, not just what) is a real differentiator against black-box AI competitors.

Sources: [mesostrength.com hypertrophy app comparison](https://mesostrength.com/blog/best-hypertrophy-training-apps), [Boostcamp vs Hevy](https://www.boostcamp.app/vs/hevy), [sensai.fit fitness app comparison](https://www.sensai.fit/blog/fitness-app-comparison), [pontefuerteai.com Hevy alternatives](https://www.pontefuerteai.com/blog/best-hevy-alternatives-2026)

## Tooling notes (2026-09-10)

- **Theme**: dark + electric blue (not teal) — [tokens.ts](../src/theme/tokens.ts) uses a cool blue-tinted neutral scale plus a dedicated blue `brand` scale; `success` was split out to its own green so PR/completion states don't read as generic brand blue. App is forced dark (`FORCE_DARK` in [theme/index.ts](../src/theme/index.ts)) since the whole visual identity assumes it; a light-mode toggle can reuse the existing `lightColors` later.
- **21st.dev**: connected and working — used as a component/pattern reference via `get_inspiration` (free) rather than pulling paid `get_component` code directly, since its output is React-web/Tailwind/shadcn and this is a native app; patterns get hand-adapted into RN.
- **anime.js is not usable in this app** — confirmed by direct test: importing it inside the RN/Hermes runtime throws `ReferenceError: document is not defined` (its core module references `document` unconditionally at import time), not just underperforms. Removed from dependencies. All motion goes through `react-native-reanimated` (already a dependency) instead — it's the correct native-thread animation engine for RN and has no functionality gap (easing, springs, timing).
- **Expo Go crashes on Android for this project** — a native segfault in `libhermesvm.so`/`libworklets.so` (reanimated 4.5/react-native-worklets 0.10) during startup, confirmed via crash tombstone. Root cause: Expo Go's bundled native binaries don't match these package versions. **Resolved**: built a custom dev client (`npx expo run:android`) instead — needed JDK 17 (installed via `brew install openjdk@17`, scoped to the build via `JAVA_HOME`, not made a system-wide default) and `android/local.properties` pointing `sdk.dir` at the SDK. Verified working end-to-end on the `Medium_Phone_API_36.1` emulator: Home screen renders correctly (ring, blur card, animated numbers) and tab navigation (Home/Workout/Library/Profile) switches cleanly with no crash. Going forward, use `npx expo run:android` (first build ~12 min; rebuild only needed when native deps change) then `npx expo start --dev-client` for JS iteration.
- **Android emulator**: `Medium_Phone_API_36.1` AVD already existed on this machine (`~/Library/Android/sdk/emulator -avd Medium_Phone_API_36.1`); no new emulator setup needed.
- First screen built as a visual/architecture checkpoint: Home screen ([src/app/(tabs)/index.tsx](../src/app/(tabs)/index.tsx)) plus reusable primitives `Card` (glassmorphic, `expo-blur`), `ProgressRing` (`react-native-svg` + reanimated), `PrimaryButton`, `AnimatedNumber` under [src/components/ui/](../src/components/ui/). Verified visually via the web target (`expo start --web`) while the Android dev client was being set up.

## Exercise data — resolved (2026-09-10)

Verified and integrated **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** (Unlicense/public domain, 1.8k GitHub stars, confirmed live): 876 exercises with instructions and images. Import pipeline: [scripts/import-exercise-library.mjs](../scripts/import-exercise-library.mjs) fetches the upstream JSON, maps its muscle/equipment vocabulary onto ours (dropping the handful of tags with no honest equivalent — neck, abductors, adductors — rather than mislabeling them), and writes a static bundled seed at [src/domain/exercises/seed/library.json](../src/domain/exercises/seed/library.json) (847 exercises made it through the mapping, ~1.1MB of text, images stay remote URLs).

This deliberately stays **separate from `EXERCISE_CATALOG`** ([catalog.ts](../src/domain/exercises/catalog.ts)): the hand-tagged catalog (movementPattern, trackingType, laterality) is what the program generator consumes and stays hand-curated; free-exercise-db powers a new `LibraryExercise` type ([library.ts](../src/domain/exercises/library.ts)) for **browse/search only** — forcing 876 exercises into the generator's strict schema would mean guessing biomechanical classification we can't infer from a name string. Built the real [Exercise Library screen](../src/app/(tabs)/library.tsx) on top of it: search + muscle filter chips + image thumbnails, verified live on the Android dev client.

UX research applied (Hevy/Strong/Fitbod pattern review): sticky muscle filter + search are table stakes for a library screen (done); for the upcoming Active Workout screen, the two principles that matter most are (1) pre-populate each set's weight/reps from the lifter's last performance of that exercise rather than a blank field, and (2) the rest timer should start automatically on set completion and alert without forcing a screen change.

## Architecture research — Liftosaur & wger (2026-09-10)

Looked at two real open-source projects in this space to sanity-check our structure:

- **[Liftosaur](https://github.com/astashov/liftosaur)** (TS, React Native + web, AGPL-3.0, 700+ stars) — closest analog to this app. Its `src/models/` directory (`program.ts`, `programExercise.ts`, `progress.ts`, `history.ts`, `exercise.ts`, `settings.ts`, `storage.ts`, ...) is structurally the same idea as our `src/domain/` + `src/types/` split — good external validation that the current architecture isn't off base. Its standout feature is **Liftoscript**, a custom scripting DSL so any progression scheme can be user-authored and evaluated at runtime. Deliberately **not adopting this**: it's built for power users ("workouts for coders" is its own tagline), and our differentiation is the opposite bet — a transparent but fixed, well-tested engine, not a programmable one. The one concrete thing worth borrowing: a **versioned local-storage/migration model** (their `storage.ts`) — we don't have this yet and will need it for Phase 4 (offline-first).
- **[wger](https://github.com/wger-project/wger)** (Python/Django, AGPL-3.0, self-hosted) — validates the backend shape we already picked: Postgres + REST API + community exercise data. Supabase (Postgres + auto-generated REST via PostgREST) gets us the same capability without maintaining a Django backend ourselves.

Note both are AGPL-3.0 — inspiration and architecture patterns are fine to learn from, but no code gets copied from either (AGPL would force this app's source open, which conflicts with the freemium/commercial plan).

## On the "AI coach prompt" pattern

Evaluated the ChatGPT-prompt-style program generator you found (paste your current lifts → get an exact 4-week weight/rep table from an LLM). Recommending against building the app's core around this pattern, for reasons specific to what's already in this codebase:

- It's **non-deterministic** (same inputs, different output each run) and costs an API call per generation — our engine is free, instant, and reproducible.
- It has no readiness/pain/deload guardrails — `progression/engine.ts` already has these (see `readiness.ts`, deload signals), and an LLM free-texting a plan bypasses them entirely.
- It assumes the user's self-reported 1RM is accurate and prescribes exact weights 4 weeks out from that guess. **This app already does better**: `generator.ts` deliberately starts new exercises with no prescribed load (`recommendedLoad` is optional) and the engine returns a `CALIBRATING_LOAD` decision on first exposure — the lifter logs whatever's honest for the target rep range *live*, and the engine calibrates from there. That's a safer, more defensible mechanic than trusting a remembered 1RM, and it's already built — the pattern in the prompt would be a regression, not an upgrade.

The feature the prompt is actually pointing at — "generate my program from what I can lift" — is legitimate and already served by the existing engine; it just needs the calibration-first UI, which is now built (see below).

## Locked decisions (2026-09-10)

- **Platform priority**: Android first (built/tested primarily against an Android emulator), iOS ships from the same Expo/RN codebase with no extra work required.
- **Monetization**: Freemium. Requires an `entitlements` concept from day one, not bolted on later.
- **Backend**: Claude provisions and owns the Supabase project (only org on the account: `iordachemihai434@gmail.com's Org`), cost confirmed before creation.
- **Exercise data**: one-time import from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public-domain JSON, ~800 exercises with images, no API key/rate limit) into our own Supabase `exercises` table, merged with the richer tagging already in [catalog.ts](../src/domain/exercises/catalog.ts) (movement pattern, equipment, difficulty). No live third-party API calls at runtime — own the data, avoid vendor lock and latency. (Note: some search results pushing a "WorkoutX" API were self-promotional vendor blog content, not independent reviews — discounted.)
- **Scope**: training-only for v1. Nutrition/calorie/hydration tracking (shown in the reference mockups) is explicitly **deferred to a later phase** — it needs its own food-database API and data model and would double the surface area before anything ships.
- **Gamification**: lightweight version included in v1 (workout streak counter, tiered achievement levels) since it's cheap to derive from data `analytics.ts` already computes (PRs, volume, consistency) and matches the reference visual direction.

## Visual design system (from reference mockups)

The mockups are AI-generated concept renders (garbled label text like "Rimmary" / "Dar10, 2022" is generation noise, not real copy) but the direction is consistent and usable:

- **Theme**: dark-first. [theme/tokens.ts](../src/theme/tokens.ts) already has a deliberate dark mode with a teal brand color ("not AI purple") — this is most of the way there already, not a rebuild.
- **Accent**: push the existing teal (`brand400 #2FBF94`) slightly more cyan/saturated to match the mockups' brighter glow (e.g. toward `#2FD9C7`–`#3AE0D8` range) — small palette tweak, not a new system.
- **Typography**: add a bold, condensed, often all-caps display style for headline moments ("YOUR BODY IS READY", section titles) — current `typography.display` (700 weight, 30px) is close but not condensed; evaluate a condensed system font stack or a single bundled display font.
- **Cards**: glassmorphic surfaces (semi-transparent, blurred, subtle border) over the dark background for stat tiles and chart cards — build as a reusable `Card`/`StatTile` primitive early since every screen leans on it.
- **Iconography/motifs**: circular progress rings (readiness %, streak), line/bar charts (1RM trend, weekly volume), a floating pill-shaped primary action button, bottom tab bar (Home / Workout / Library / Profile).
- **Gamification visuals**: PR cards, streak ring, tiered "level" badges — straightforward to build off existing `analytics.ts` output plus a simple streak/level calculation.

## Information architecture (v1, training-only)

Mapped from the reference screens, minus nutrition:

1. **Home** — readiness/status summary, "Start Workout" CTA, weekly progress snapshot.
2. **Active workout** — current session card, per-exercise set logging, live progress (%, elapsed time), pulls from `generator.ts` output and feeds `engine.ts`.
3. **Exercise library** — body-map muscle selector + filterable list, backed by the merged `catalog.ts` + free-exercise-db dataset.
4. **Progress/analytics** — estimated 1RM trend, weekly volume chart, current training-block completion — all values `workouts/analytics.ts` already computes.
5. **Profile** — PRs, workout streak, achievement level, account/entitlement status (free vs. paid).

## Active Workout screen — shipped (2026-09-10)

Built [src/app/(tabs)/workout.tsx](../src/app/(tabs)/workout.tsx): the first screen where the domain engine's actual output drives the UI, not mock data. It calls the real `generateProgram()` against a sample `TrainingPreferences`, builds a `WorkoutSession` via a new [session.ts](../src/domain/workouts/session.ts) helper, and renders real prescriptions (rep ranges, target RIR, rest seconds) per exercise. Per-set weight/reps entry ([SetRow.tsx](../src/components/workout/SetRow.tsx)), calibration messaging when there's no load history yet, and a non-blocking rest timer that auto-starts on set completion ([RestTimer.tsx](../src/components/workout/RestTimer.tsx)) — verified live on the Android dev client end to end (typed a set, marked it complete, timer started at the prescription's rest duration). Finishing a workout shows total volume via the existing `sessionVolumeKg` analytics function — first real wiring of `workouts/analytics.ts` into the UI.

Known gap, by design at this stage: workout state is local React state only, not yet persisted (Supabase/offline storage is Phase 3/4) — closing the app mid-workout currently loses progress. Onboarding (equipment/experience/goals feeding real `TrainingPreferences` instead of the hardcoded demo one) also isn't built yet.

## Home screen — redesigned from real references (2026-09-10)

Rebuilt [index.tsx](../src/app/(tabs)/index.tsx) after live-checking Hevy's and Liftosaur's actual home/workout tabs (via their App Store screenshots and, for Liftosaur, its live web app) rather than assuming — both turned out to be far more utilitarian than the earlier AI-mockup reference: Hevy's tab is a "Quick Start" + list of routine cards, each with a one-tap Start button; Liftosaur's is a minimal week-calendar strip + a single start-workout prompt. Neither has anything like a "readiness score" hero — that concept from the original mockups was dropped.

New Home is a synthesis: [WeekStrip](../src/components/home/WeekStrip.tsx) (Liftosaur's calendar idea) + [ProgramDayCard](../src/components/home/ProgramDayCard.tsx) (Hevy's routine-card idea), but auto-populated from our own `generateProgram()` output instead of user-picked routines — "Today" gets an emphasized card, the rest of the split lists below as "Up next." Tapping any card's "Start Workout" deep-links to that exact day via `router.push({ pathname: '/workout', params: { day } })`, verified live: starting "Lower A" from Home opens Lower A's actual exercises, not whatever was last open. Extracted the shared demo `TrainingPreferences` into [demoPreferences.ts](../src/domain/programs/demoPreferences.ts) so Home and Workout generate against the same program until real onboarding exists.

## Home screen — premium visual pass (2026-09-10)

Pulled concrete execution patterns from [21st.dev](https://21st.dev) (staggered spring entrance for list items, pill-badge metadata, icon-forward cards) and applied them on top of the Hevy/Liftosaur structure: icon badge + name per day, a duration pill with a clock glyph, muscle focus as small dot-chips instead of plain text, a soft accent-gradient sheen (`expo-linear-gradient`, new native dep — dev client rebuilt) plus a glow shadow on the "Today" card, a glowing accent circle on the week strip's today-marker, and a reusable [Reveal](../src/components/ui/Reveal.tsx) wrapper (reanimated `FadeInDown`, staggered by index) used across the whole screen. Verified live on the Android dev client after a native rebuild (new dependency needed one; ~46s since most of the build was cached).

## Profile screen (2026-09-11)

Built out the last stub tab. New domain module [gamification.ts](../src/domain/workouts/gamification.ts) (unit tested) computes a consecutive-day streak and a workout-count level tier (Rookie → Grinder → Beast → Titan → Legend) from real session data — no hardcoded UI numbers. Screen shows a glowing streak card, a level card with progress-to-next-tier, and a personal-records grid, all pulling exercise names and e1RM math from the existing `catalog.ts`/`analytics.ts` domain functions. Runs on demo history data (`demoHistory.ts`) until real persistence lands in Phase 3/4, same pattern as Home/Workout. Verified live on the Android dev client (no crash, correct math end-to-end).

All four tabs (Home, Workout, Library, Profile) are now real, data-driven screens with the same premium visual language (icon badges, pill chips, glow accents, staggered `Reveal` entrance) — not placeholders.

## Home page rebuild v3 (2026-09-11)

Rebuilt Home to match a reference screenshot's structure (menu/notification top bar, gradient hero progress ring, 4-tile stat row, single "Today's Workout" card with a circular play button, "Quick Access" grid, gradient promo banner) — kept our dark theme and blue accent per explicit decision rather than the reference's light/purple. Key adaptations, agreed with the user first:

- **Stat row is a deliberate mix**: Volume and Streak are real numbers from our own engine (`sessionVolumeKg` rollup, `computeStreak`); Steps/Sleep render a muted "No data" placeholder state (`StatTile connected={false}`) since we have no Health Connect/HealthKit integration yet. Wiring that up (Android Health Connect first, since we're Android-first) is a distinct, larger follow-up task — new native permissions and a platform-specific data source, not a quick add.
- **Quick Access swapped Body Tracker/Nutrition** (deferred features) for **Progress** (→ Profile tab) and **Settings** (new stub route, `src/app/settings.tsx`, presented modally from the root stack — first non-tab route in the app).
- **"Weekly Progress" replaces "Daily Progress"**: the reference's ring metric doesn't have an honest daily equivalent yet without session persistence; weekly-completion-rate is closer to real and will become an actual `completedThisWeek / daysPerWeek` calculation once sessions are saved (currently `DEMO_WEEKLY_PROGRESS` placeholder, same pattern as other demo constants).
- Added `brandGradientStart/End` theme tokens (rather than hardcoding a gradient in one component) so any future screen can reuse the same hero-gradient treatment.
- No stock photo asset for the promo banner (avoids sourcing/licensing a photo); used a large low-opacity icon watermark instead.

Verified live on the Android dev client — Home renders correctly, Settings modal opens/closes via the header back arrow.

## Home page v5 — experienced-lifter vision (2026-09-11)

Rebuilt Home around the user's ASCII wireframe: greeting + quote, Pre-Fuel card, a dominant "Today's Workout" hero with a real progressive-overload target, a week-to-date training log, and a mesocycle block card. Resolved per the user's explicit answers:

- **Mesocycle periodization is real, new domain logic**: [programs/mesocycle.ts](../src/domain/programs/mesocycle.ts) (unit tested, 5 tests) computes block/week/phase (accumulation → overreaching → deload) and days-to-deload from a block definition. This sits *alongside* the existing reactive engine (`progression/engine.ts` still auto-regulates load/reps and can still flag an early deload from real signals) rather than replacing it — two complementary layers: planned (mesocycle) and reactive (per-set signals).
- **"Target to Beat Today" is genuine engine output, not UI text**: [workouts/targetToBeat.ts](../src/domain/workouts/targetToBeat.ts) feeds a fabricated "last session" through the real `runProgression()` and displays whatever it actually decides (e.g. 40kg×10@RIR2 → 42.5kg×10, a real `increase_load` decision, not a hardcoded number).
- **Pre-Routine (supplement tracking)**: per instruction, home-page-interface only for now — [workouts/preRoutine.ts](../src/domain/workouts/preRoutine.ts) does real elapsed/peak-window time math on a demo constant, but there's no logging screen or real data model yet. Full build-out (own tab, substance/dose logging) is future work, same as Nutrition.
- **Tab bar restructured**: Home / Analytics / Atlas (renamed Library) / Profile. "Workout" is no longer a persistent tab (`href: null`, still a real route Home pushes to) — starting a session now flows through Home's hero card. Profile split in two: **Analytics** (`analytics.tsx`) owns streak/level/PRs (moved from the old Profile screen), **Profile** (`profile.tsx`) is now a lean identity screen with a Settings entry point. Pre-Routine isn't a tab yet since it's deferred.
- Avoided quoting a real, identifiable public figure's catchphrase (the reference's "Ronnie C." attribution) — used an unattributed generic line instead, for publicity-rights/copyright caution in a commercial app.
- New shared demo data in [demoHistory.ts](../src/domain/workouts/demoHistory.ts): a week-log table (day-by-day split/volume/status, computed relative to the real current day so it's always correct), a mesocycle block, and a pre-workout log — same "real math on placeholder constants" pattern used throughout, so each piece swaps to true persistence independently later.

Verified live on the Android dev client: Home, day-swap, Analytics, Profile, and Settings modal all confirmed working, no crashes. 27/27 tests passing.

## Component library: react-native-paper + Moti (2026-09-11)

Per instruction to stop hand-building widgets and use pre-existing ones: attempted **gluestack-ui** first (the user's original ask alongside anime.js/21st.dev), but its installer is labeled "v5 alpha" by its own CLI output and failed to actually install its required packages (`@gluestack-ui/core`, `nativewind`) despite reporting success — left a broken scaffold that didn't typecheck. Reverted cleanly (`git checkout` + fresh `npm install`), verified back to a healthy state, then swapped to **react-native-paper** (stable, v5.15.3, pure StyleSheet — no Tailwind/NativeWind conflict with the existing reanimated 4.5.0 setup) plus **Moti** (already installed, now actually wired into [Reveal.tsx](../src/components/ui/Reveal.tsx) instead of raw reanimated primitives).

Rebuilt every screen on real Paper widgets in place of hand-rolled ones: `Button`, `Card`, `Chip`, `ProgressBar`, `Avatar.Text`/`Avatar.Icon`, `List.Item`, `TextInput`, `IconButton`, `TouchableRipple`, `Icon`, `Snackbar`, `Divider`. Deleted the now-dead hand-built `PrimaryButton`, `FilterChip`, and the unused glass `Card` component. A theme bridge ([paperTheme.ts](../src/theme/paperTheme.ts)) maps our existing semantic tokens onto Paper's MD3 theme contract, so Paper components pick up our blue/dark branding automatically via `PaperProvider` in the root layout.

One real bug found and fixed along the way: Paper's `Snackbar` (v5) does **not** self-portal — its own docs say to wrap it in `Portal` for popup behavior, which [RestTimer.tsx](../src/components/workout/RestTimer.tsx) wasn't doing, so our floating tab bar (also `position: absolute`) was rendering on top of it, making the rest-timer invisible. Fixed by wrapping in `<Portal>`. Also caught `duration={Number.MAX_SAFE_INTEGER}` overflowing JS's 32-bit `setTimeout` range (auto-dismissing instantly) — replaced with a safe 24-hour value.

Kept as genuinely custom (no off-the-shelf equivalent covers these): `AnimatedNumber` (tweened counter), `ProgressRing` (SVG ring for the Home hero), and the domain-specific card compositions themselves (StreakCard, MesocycleCard, TodayWorkoutHero, etc.) — Paper supplies their chrome (Card, ProgressBar, Chip) but the domain content inside is necessarily bespoke.

Verified end-to-end on the Android dev client: Home, Analytics, Atlas, Profile, Workout (including the set-completion → rest-timer Snackbar flow) all confirmed working, no crashes. Typecheck/lint clean, 27/27 tests passing.

## Dependency alignment (2026-09-13)

`expo-doctor` flagged a real, applicable issue: `expo@57.0.7`/`react-native@0.86.0` (exactly what was installed) carries a documented Hermes regression that "drastically increases memory usage in apps importing `react-native-worklets` or `react-native-reanimated`" — which is every screen in this app. Fixed upstream in `expo@57.0.9+`.

Ran `npx expo install --fix` (two passes — the first hit a transient npm peer-conflict on `react-native@0.86.3`/`@react-native/jest-preset`, resolved with `--legacy-peer-deps`, consistent with how this project has handled peer conflicts before) to align all 23 flagged packages to their SDK 57.0.22-compatible versions: `expo` 57.0.7→57.0.22, `react-native` 0.86.0→0.86.3, `react-native-reanimated` 4.5.0→4.5.1, `react-native-worklets` 0.10.0→0.10.1, plus `expo-router`, `expo-image`, `react-native-screens`, and the rest of the `expo-*` family. `npx expo-doctor` now reports 21/21 checks passing (was 2 failing). Typecheck/lint/tests unaffected (still 27/27 passing).

Also caught in passing: `@gorhom/bottom-sheet` (native code, used by the new `HomeActionSheet`) had been added to `package.json` after the last native Android build, so the installed dev client predated it — rebuilding now picks up both that and the version bump in one pass.

**Rebuild + verification (same session)**: full native rebuild succeeded (7m37s). Hit and fixed one real Worklets error post-rebuild — `[Worklets] Mismatch between JavaScript code version and Worklets Babel plugin version (0.10.1 vs 0.10.0)` — a stale Metro transform cache from before the version bump; fixed with `expo start --clear`.

**Real bug found while verifying, not an infra issue**: [ReadinessCommandCard.tsx](../src/components/home/ReadinessCommandCard.tsx)'s decorative "scan rail" ran **16 simultaneous Moti animations with `loop: true, repeatReverse: true`** — i.e. infinite, forever, for as long as Home is mounted. This pegged the emulator at 90-100%+ CPU continuously and was the actual root cause of a string of system-wide ANRs ("Pixel Launcher isn't responding", "System UI isn't responding") that looked like emulator flakiness but weren't — confirmed by CPU dropping to single digits immediately after removing the loop. This would have been a real battery/performance drain on physical devices too. Fixed to animate once on mount instead of looping forever. Checked the rest of the new Home cards (`OverloadRunwayCard`, `MuscleFocusMap`, `PrWatchCard`, `RecoveryProtocolCard`) for the same `loop:`/`repeatReverse` pattern — none found.

Verified end-to-end on-device post-fix: Home (all cards, including the newer `OverloadRunwayCard`/`MuscleFocusMap`/`PrWatchCard`/`RecoveryProtocolCard`), the `HomeActionSheet` bottom sheet (swap-day action correctly cascades through the overload target, muscle allocation, and PR watchlist), and stable CPU throughout. Typecheck/lint/tests unaffected (27/27 passing).

## Competitor-research design pass (2026-09-13)

Researched Strong, Fitbod, Boostcamp, StrengthLog, and JEFIT's home/dashboard screens (current App Store screenshots) and implemented all 5 findings:

1. **Body-silhouette muscle heatmap** — new [BodyHeatmap.tsx](../src/components/home/BodyHeatmap.tsx), a stylized (non-anatomical) front+back SVG figure pair, wired into `MuscleFocusMap`. Every serious competitor (Fitbod, StrengthLog, JEFIT) uses a real body illustration instead of bars; ours was the odd one out. Built from simple `react-native-svg` rects/circles per muscle region, tinted by `colors.accent` at intensity-proportional opacity — no new dependency.
2. **PR celebration hero card** — `PrWatchCard`'s most recent record now gets a gradient hero treatment (trophy watermark, jumbo number, "NEW RECORD" badge) matching Fitbod's photo-card pattern, minus a stock photo (none licensed — used an icon watermark instead, consistent with the promo banner precedent).
3. **Bolder stat typography** — added a `typography.jumbo` token (44px/800 weight); applied to the PR hero number and `WeekLogCard`'s volume stat (17px → 30px `display`), following Boostcamp's oversized-number pattern.
4. **Colorful gamification badges** — `LevelCard` now maps each tier (Rookie/Grinder/Beast/Titan/Legend) to a distinct icon + semantic color (gray/green/amber/red/blue) instead of one static shield icon, matching StrengthLog's colorful circular achievements.
5. **Fixed fabricated "upcoming" data in `WeekLogCard`** — found while implementing the JEFIT forward-plan-view idea: the volume trend sparkline and per-row descriptions were showing hardcoded tonnage for days that haven't happened yet (`status: 'upcoming'`), contradicting the card's own "Tonnage only counts completed work" caption. Both now correctly zero out for non-`done` days; upcoming days show "Upcoming" instead of a fake number.

Verified end-to-end on-device: Home (heatmap, PR hero, week log) and Analytics (tier badge) all confirmed rendering correctly, no crashes. Typecheck/lint/tests unaffected (27/27 passing). No new native dependencies — pure JS/SVG, no rebuild needed.

## Auditing hand-built pieces against real packages (2026-09-13)

Per instruction to import everything possible rather than hand-build, audited every remaining custom visual primitive against the real npm/GitHub ecosystem, verifying peer-dependency health before installing anything (the gluestack-ui lesson from earlier applied here too — checked `npm view <pkg> peerDependencies` for every candidate before adopting).

**Adopted:**
- **[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)** (MIT, react-native-svg@^15.9.0 peer — matches our installed 15.15.5) replaces the hand-built `BodyHeatmap.tsx` (deleted) in `MuscleFocusMap`. Its 24 body-part slugs map almost 1:1 onto our 12 `MuscleGroup` values (`chest→chest`, `back→upper-back`, `shoulders→deltoids`, etc.) — a real anatomical front+back illustration instead of an approximated block figure.
- **[react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts)** replaces the hand-rolled `Polyline` sparkline in `WeekLogCard`. Rejected `react-native-svg-charts` first despite a higher "benchmark score" — its peer dependency is pinned to `react-native-svg ^6/^7` (we're on v15), the same stale-dependency trap as the earlier gluestack-ui attempt.
- Deleted `ProgressRing.tsx` — confirmed fully unused dead code from an earlier Home iteration, no replacement needed.

**Real bug found and fixed mid-swap**: `hideAxesAndRules` (a prop that only appears in this library's `BubbleChart`/`BarChart` docs, never `LineChart`) silently blanked the *entire rest of the Home screen* below the chart when passed to `LineChart` — not a redbox crash, a silent render failure. Found by bisecting props back to the documented minimal example and re-adding one at a time. Fixed by dropping that prop and using `xAxisThickness={0}`/`yAxisThickness={0}` plus a fixed-size `overflow: hidden` wrapper to force the "full chart" component into a true compact sparkline footprint.

**Checked and deliberately not swapped** (documented so this isn't silent scope-cutting):
- **`AnimatedNumber.tsx`** (tween-to-value counter, used in `StreakCard`/`PrWatchCard`) — the two candidate packages found (`react-native-countup` v0.0.2 from 2022 using the pre-hooks `react-timer-mixin`; `react-native-number-animate` v1.0.3 from 2023, zero declared dependencies despite claiming a reanimated dependency) are both effectively unmaintained single-maintainer packages with real compatibility risk against React 19/new architecture. Kept our ~20-line hook, which is a thin wrapper directly on `react-native-reanimated` (an already-imported, vetted library) — this is gluing imported primitives together for a domain need, not hand-building an animation engine.
- **Week-strip day markers** — the one candidate (`react-native-calendar-strip`) is from 2022, pulls in `moment` (unused elsewhere in this codebase) and, oddly, a `node-git-hooks` runtime dependency — a red flag for a UI library. Not worth the risk for 7 static day pills.
- **`Reveal.tsx`** — already a thin Moti wrapper, not hand-built animation logic.

Verified end-to-end on-device: Muscle Allocation (real body diagram, front+back, correct muscle highlighting) and Week to date (real chart, correct trend line, no layout regression) both confirmed working after the fix. Typecheck/lint/tests unaffected (27/27 passing). No native rebuild needed (both packages are pure JS/SVG).

## Command Check redesign — Whoop-inspired (2026-09-13)

Hevy has no readiness/recovery concept to draw from, so researched the app that actually owns this pattern — Whoop's Recovery card (current App Store screenshots): a colored circular ring (green/yellow/red by band) with the score centered inside, and a metric breakdown below with a colored dot per row.

Installed **[react-native-circular-progress](https://github.com/bartgryszko/react-native-circular-progress)** (`AnimatedCircularProgress`, MIT, react-native-svg@>=7.0.0 peer — comfortably satisfied by our v15) after checking three gauge-package candidates' peer-dependency health first (one, `react-native-circular-progress-indicator`, was rejected for pulling in `react-native-redash` and being stale since Dec 2022 — same category of risk as the earlier `react-native-svg-charts` rejection).

Rewrote [ReadinessCommandCard.tsx](../src/components/home/ReadinessCommandCard.tsx): removed the hand-built 16-`MotiView` "scan rail" entirely, replaced with the real gauge ring. Added a genuine `bandFor()`/`bandColor()` mapping (good/caution/hold at 0.8/0.55 thresholds) driving **real color-coding** throughout — the ring color, the "GREEN LIGHT"/"CAUTION"/"HOLD BACK" status badge, and each signal-gate's dot + progress-bar color are now all data-driven from the same band logic, not hardcoded green everywhere like before.

Verified live on-device: green ring, correctly color-coded signal dots (amber Fuel, green Intent/Fatigue) matching real band values, no crashes. Typecheck/lint/tests unaffected (27/27 passing). Pure JS/SVG package, no native rebuild needed.

## Proposed roadmap

**Phase 0 — Harden the domain layer**
Expand Jest coverage for `programs/generator.ts` and `progression/engine.ts` (currently only `exercises/catalog.ts` and `utils/units.ts` have tests). This is the core IP; lock it down before building UI on top of it.

**Phase 1 — Backend schema & exercise data**
Design Supabase tables: `users`, `user_preferences`, `exercises`, `programs`, `program_exercises`, `workout_sessions`, `sets`, `progression_state`, `personal_records`, `entitlements`. Add migrations under `supabase/migrations`, enable Row Level Security per-user, wire `src/lib/supabase.ts` client using `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`. Import free-exercise-db into `exercises`, merged with `catalog.ts` tags.

**Phase 2 — Core UI shell** (Expo Router, `src/app`), Android-first
1. Onboarding: equipment, experience level, muscle priorities, exclusions/pain flags → feeds `generator.ts`.
2. Home: readiness summary + start workout, styled per the design system above.
3. Program view: generated split, editable exercise slots, swap via `replacement.ts`.
4. Active workout screen: set logging (weight/reps/RIR), rest timer, live progression suggestions from `engine.ts`.
5. Progress/analytics dashboard: volume load, e1RM trend, PRs, muscle distribution (`analytics.ts` already computes these).
6. Exercise library browser: body-map selector + search/filter over merged catalog.
7. Profile: PRs, streak, achievement level, entitlement/plan status.

**Phase 3 — State & data wiring**
Zustand for in-session workout state (fast, local, no network round-trip mid-set), TanStack Query for Supabase reads/writes and caching, React Hook Form + Zod for onboarding/preferences forms.

**Phase 4 — Offline-first**
AsyncStorage/SecureStore write-through cache so logging works mid-workout without connectivity; background sync to Supabase on reconnect. This matters more for a gym app than most — gym basements have terrible signal.

**Phase 5 — Freemium gating & gamification**
Entitlements check gating advanced features (e.g. free = 1 active program + basic logging, paid = full auto-progression engine, unlimited programs, advanced analytics — exact split adjustable later); streak/achievement-level calculation off existing analytics data.

**Phase 6 — Polish**
Rest-timer notifications, haptics on set completion (`expo-haptics` already a dependency), theming per the design-system tweaks above, empty/error states.

**Phase 7 — QA & release**
Expand unit tests, add an E2E pass (Maestro or Detox) for the onboarding → generate → log → view-progress flow, internal Play/TestFlight testing, then store submission.

**Phase 8 — Later: nutrition** (deferred, not v1)
Food/calorie/hydration tracking, macro goals, meal logging — needs its own data model (`meals`, `nutrition_logs`, `nutrition_goals`) and a food-database API decision (Open Food Facts, USDA FoodData Central, or Nutritionix) once the training core is stable.

## Language / stack recommendation

**Keep TypeScript + React Native/Expo.** This isn't a close call:

- The app needs one codebase across iOS, Android, and (via `react-native-web`) web — Expo/RN is the standard tool for that, and ~3,400 lines of working domain logic are already written in TS against this stack.
- **C++** is a systems/performance language — no mobile UI framework advantage here, and you'd be hand-rolling native UI per platform (or wrapping RN in C++ anyway via JSI, which is what React Native already does under the hood). Reach for it only if you later need custom on-device signal processing (e.g. wearable sensor fusion), which this app doesn't.
- **Python** is excellent for backend/ML services (e.g. a future model-based auto-regulation or coaching layer) but has no serious mobile-client story. If a heavier server-side component is ever needed beyond Supabase (Postgres + edge functions, which already cover most backend needs), a Python microservice is a reasonable *addition*, not a replacement for the client.
- **Supabase edge functions** (Deno/TypeScript) keep the entire stack in one language if/when server-side logic is needed, which simplifies sharing types between the domain engine and backend.

Net: no language change needed. The gap is UI and persistence, not the tech stack.
