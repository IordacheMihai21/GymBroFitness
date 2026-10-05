# GymBroFitness — Project Assessment & Roadmap

> Historical document. For the current implementation order and revised scientific assumptions, use [the integrated plan dated September 20, 2026](IMPLEMENTATION_MASTER_PLAN.md). Some implementation-status statements below are outdated.

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

| App                     | Model                                                     | Notes                                                                                                                              |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Hevy**                | Free logger + social                                      | Most popular; polished UI, follow friends, copy routines, generous free tier (unlimited workouts/routines, 400+ exercise library). |
| **Strong**              | Bring-your-own-program logger                             | Fastest pure logger, no auto-programming. $29.99/yr or $99.99 lifetime.                                                            |
| **Fitbod**              | AI auto-programming                                       | Generates each session from your logged history, recovery, and muscle balance. $95.99/yr.                                          |
| **Boostcamp**           | Free program library + logger                             | Large catalog of known strength/hypertrophy templates you log against; doesn't generate custom plans.                              |
| **RP Hypertrophy**      | Auto-regulated programming (Mike Israetel/RP methodology) | Subscription-only, $34.99/mo or $299.99/yr — closest philosophical match to this repo's progression engine.                        |
| **JeFit / StrengthLog** | Logger + community programs                               | Similar tier to Hevy/Strong, less polish.                                                                                          |

**Where GymBroFitness fits:** the existing domain layer (auto-generated splits + double-progression engine with deload/readiness logic) puts this app closer to **Fitbod / RP Hypertrophy's "auto-regulated programming" category** than to Hevy/Strong's "pure logger" category — that's the harder, more defensible product to build, and it's already mostly written here. The market gap is that the auto-programming apps are all paid ($96–$350/yr); a free or low-cost app with transparent, explainable progression logic (the engine already returns _why_ a decision was made, not just what) is a real differentiator against black-box AI competitors.

Sources: [mesostrength.com hypertrophy app comparison](https://mesostrength.com/blog/best-hypertrophy-training-apps), [Boostcamp vs Hevy](https://www.boostcamp.app/vs/hevy), [sensai.fit fitness app comparison](https://www.sensai.fit/blog/fitness-app-comparison), [pontefuerteai.com Hevy alternatives](https://www.pontefuerteai.com/blog/best-hevy-alternatives-2026)

## Tooling notes (2026-09-10)

- **Theme**: dark + electric blue (not teal) — [tokens.ts](../src/theme/tokens.ts) uses a cool blue-tinted neutral scale plus a dedicated blue `brand` scale; `success` was split out to its own green so PR/completion states don't read as generic brand blue. App is forced dark (`FORCE_DARK` in [theme/index.ts](../src/theme/index.ts)) since the whole visual identity assumes it; a light-mode toggle can reuse the existing `lightColors` later.
- **21st.dev**: connected and working — used as a component/pattern reference via `get_inspiration` (free) rather than pulling paid `get_component` code directly, since its output is React-web/Tailwind/shadcn and this is a native app; patterns get hand-adapted into RN.
- **anime.js is not usable in this app** — confirmed by direct test: importing it inside the RN/Hermes runtime throws `ReferenceError: document is not defined` (its core module references `document` unconditionally at import time), not just underperforms. Removed from dependencies. All motion goes through `react-native-reanimated` (already a dependency) instead — it's the correct native-thread animation engine for RN and has no functionality gap (easing, springs, timing).
- **Expo Go crashes on Android for this project** — a native segfault in `libhermesvm.so`/`libworklets.so` (reanimated 4.5/react-native-worklets 0.10) during startup, confirmed via crash tombstone. Root cause: Expo Go's bundled native binaries don't match these package versions. **Resolved**: built a custom dev client (`npx expo run:android`) instead — needed JDK 17 (installed via `brew install openjdk@17`, scoped to the build via `JAVA_HOME`, not made a system-wide default) and `android/local.properties` pointing `sdk.dir` at the SDK. Verified working end-to-end on the `Medium_Phone_API_36.1` emulator: Home screen renders correctly (ring, blur card, animated numbers) and tab navigation (Home/Workout/Library/Profile) switches cleanly with no crash. Going forward, use `npx expo run:android` (first build ~12 min; rebuild only needed when native deps change) then `npx expo start --dev-client` for JS iteration.
- **Android emulator**: `Medium_Phone_API_36.1` AVD already existed on this machine (`~/Library/Android/sdk/emulator -avd Medium_Phone_API_36.1`); no new emulator setup needed.
- First screen built as a visual/architecture checkpoint: Home screen ([src/app/(tabs)/index.tsx](<../src/app/(tabs)/index.tsx>)) plus reusable primitives `Card` (glassmorphic, `expo-blur`), `ProgressRing` (`react-native-svg` + reanimated), `PrimaryButton`, `AnimatedNumber` under [src/components/ui/](../src/components/ui/). Verified visually via the web target (`expo start --web`) while the Android dev client was being set up.

## Exercise data — resolved (2026-09-10)

Verified and integrated **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** (Unlicense/public domain, 1.8k GitHub stars, confirmed live): 876 exercises with instructions and images. Import pipeline: [scripts/import-exercise-library.mjs](../scripts/import-exercise-library.mjs) fetches the upstream JSON, maps its muscle/equipment vocabulary onto ours (dropping the handful of tags with no honest equivalent — neck, abductors, adductors — rather than mislabeling them), and writes a static bundled seed at [src/domain/exercises/seed/library.json](../src/domain/exercises/seed/library.json) (847 exercises made it through the mapping, ~1.1MB of text, images stay remote URLs).

This deliberately stays **separate from `EXERCISE_CATALOG`** ([catalog.ts](../src/domain/exercises/catalog.ts)): the hand-tagged catalog (movementPattern, trackingType, laterality) is what the program generator consumes and stays hand-curated; free-exercise-db powers a new `LibraryExercise` type ([library.ts](../src/domain/exercises/library.ts)) for **browse/search only** — forcing 876 exercises into the generator's strict schema would mean guessing biomechanical classification we can't infer from a name string. Built the real [Exercise Library screen](<../src/app/(tabs)/library.tsx>) on top of it: search + muscle filter chips + image thumbnails, verified live on the Android dev client.

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
- It assumes the user's self-reported 1RM is accurate and prescribes exact weights 4 weeks out from that guess. **This app already does better**: `generator.ts` deliberately starts new exercises with no prescribed load (`recommendedLoad` is optional) and the engine returns a `CALIBRATING_LOAD` decision on first exposure — the lifter logs whatever's honest for the target rep range _live_, and the engine calibrates from there. That's a safer, more defensible mechanic than trusting a remembered 1RM, and it's already built — the pattern in the prompt would be a regression, not an upgrade.

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

Built [src/app/(tabs)/workout.tsx](<../src/app/(tabs)/workout.tsx>): the first screen where the domain engine's actual output drives the UI, not mock data. It calls the real `generateProgram()` against a sample `TrainingPreferences`, builds a `WorkoutSession` via a new [session.ts](../src/domain/workouts/session.ts) helper, and renders real prescriptions (rep ranges, target RIR, rest seconds) per exercise. Per-set weight/reps entry ([SetRow.tsx](../src/components/workout/SetRow.tsx)), calibration messaging when there's no load history yet, and a non-blocking rest timer that auto-starts on set completion ([RestTimer.tsx](../src/components/workout/RestTimer.tsx)) — verified live on the Android dev client end to end (typed a set, marked it complete, timer started at the prescription's rest duration). Finishing a workout shows total volume via the existing `sessionVolumeKg` analytics function — first real wiring of `workouts/analytics.ts` into the UI.

Known gap, by design at this stage: workout state is local React state only, not yet persisted (Supabase/offline storage is Phase 3/4) — closing the app mid-workout currently loses progress. Onboarding (equipment/experience/goals feeding real `TrainingPreferences` instead of the hardcoded demo one) also isn't built yet.

## Home screen — redesigned from real references (2026-09-10)

Rebuilt [index.tsx](<../src/app/(tabs)/index.tsx>) after live-checking Hevy's and Liftosaur's actual home/workout tabs (via their App Store screenshots and, for Liftosaur, its live web app) rather than assuming — both turned out to be far more utilitarian than the earlier AI-mockup reference: Hevy's tab is a "Quick Start" + list of routine cards, each with a one-tap Start button; Liftosaur's is a minimal week-calendar strip + a single start-workout prompt. Neither has anything like a "readiness score" hero — that concept from the original mockups was dropped.

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

- **Mesocycle periodization is real, new domain logic**: [programs/mesocycle.ts](../src/domain/programs/mesocycle.ts) (unit tested, 5 tests) computes block/week/phase (accumulation → overreaching → deload) and days-to-deload from a block definition. This sits _alongside_ the existing reactive engine (`progression/engine.ts` still auto-regulates load/reps and can still flag an early deload from real signals) rather than replacing it — two complementary layers: planned (mesocycle) and reactive (per-set signals).
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

**Real bug found and fixed mid-swap**: `hideAxesAndRules` (a prop that only appears in this library's `BubbleChart`/`BarChart` docs, never `LineChart`) silently blanked the _entire rest of the Home screen_ below the chart when passed to `LineChart` — not a redbox crash, a silent render failure. Found by bisecting props back to the documented minimal example and re-adding one at a time. Fixed by dropping that prop and using `xAxisThickness={0}`/`yAxisThickness={0}` plus a fixed-size `overflow: hidden` wrapper to force the "full chart" component into a true compact sparkline footprint.

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
- **Python** is excellent for backend/ML services (e.g. a future model-based auto-regulation or coaching layer) but has no serious mobile-client story. If a heavier server-side component is ever needed beyond Supabase (Postgres + edge functions, which already cover most backend needs), a Python microservice is a reasonable _addition_, not a replacement for the client.
- **Supabase edge functions** (Deno/TypeScript) keep the entire stack in one language if/when server-side logic is needed, which simplifies sharing types between the domain engine and backend.

Net: no language change needed. The gap is UI and persistence, not the tech stack.

## Premium-tier research and roadmap (2026-09-13)

Goal: take the app from "solid demo" toward something an experienced lifter would consider worth a premium price. Ran three parallel research passes before writing any code — exercise science, competitor premium UX, and GitHub/npm due diligence — so the roadmap below is grounded rather than guessed.

**Exercise science findings.** RP-style volume landmarks (MEV/MAV/MRV, roughly 10–20 hard sets/week per muscle depending on the muscle and the lifter) are the standard framework serious lifters use to judge if a program is dosed correctly, and none of our existing analytics classify volume against them — `setsByMuscle` computed raw counts but never said whether that was too little or too much. Advanced-lifter periodization beyond double progression (DUP, APRE) is best modeled as a rule table layered on the existing RIR engine, not a rewrite. Advanced set types (drop sets, rest-pause, myo-reps, cluster sets, top-set-plus-backoff) all reduce to one schema: a parent set containing a list of sub-efforts — worth building as one flexible type rather than five bespoke ones, deferred to a later phase since it touches `PerformedSet` everywhere. Deload triggers should be performance-based (e1RM drop while RIR holds, repeated misses) rather than purely calendar-based — our `progression/engine.ts` already does this per-exercise (`suggest_deload` / `DELOAD_SIGNALS`), which is ahead of what the research flagged as the common failure mode (most apps: calendar-only), so it was left alone rather than duplicated.

**Competitor UX findings (Hevy/Strong/Boostcamp/RP/Fitbod/JEFIT/StrengthLog).** The mechanisms that specifically read as "premium" rather than just "more screens": inline plate-math attached directly to the weight input (not a separate calculator screen, with a "closest achievable weight" fallback); a previous-performance overlay shown next to the input row while logging; an e1RM trend line on the exercise history chart; a muscle-group heatmap used both for insight and as next-workout navigation; auto-computed %-of-training-max fields that recalc when a training max changes; volume landmarks rendered as a visual gauge/dial per muscle rather than RP's own static-text presentation (explicitly called out as their weak point); one-tap "save this workout as a template"; and long-press on a set to reveal drop-set/rest-pause sub-entry. Explicit anti-pattern: Hevy's social feed is called an unwanted nag by users who just want a logger — any social layer here should stay fully optional.

**GitHub/npm due diligence.** `yuhonas/free-exercise-db` (Unlicense/public-domain, 800+ exercises with images, 1.9k★, pushed 2026-08-30) is a real candidate to merge into `exercises/catalog.ts`'s ~80 hand-seeded entries — deferred to its own phase since it needs a muscle/equipment taxonomy mapping pass, not a quick drop-in. `@quidone/react-native-wheel-picker` (MIT, 321★, active, no peer conflicts) is the right primitive for an RPE/RIR wheel input — no dedicated RPE component package exists, so the picker mechanics come from a real package while the domain-specific chrome around it is ours to build. `react-native-fast-confetti` (MIT, 571★, reanimated 4.5.1-compatible) is a real option for PR celebrations, but it pulls in `@shopify/react-native-skia` as a new native dependency — worth a deliberate call before adding, not a silent default. Dedicated 1RM-formula and plate-math npm packages are all 2+ years stale or single-maintainer with no adoption — confirmed as the correct exception to "don't hand-build": both are ~30 lines of published arithmetic, no UI, nothing a package meaningfully abstracts.

**Phase 1 (shipped today) — volume-landmark and load-math domain foundation**, all pure TypeScript, zero new dependencies, fully tested:

- [`volumeLandmarks.ts`](../src/domain/workouts/volumeLandmarks.ts) — MEV/MAV/MRV table per muscle group and `classifyWeeklyVolume`/`classifyWeeklyVolumeByMuscle`, returning a zone (`below_mv`/`maintenance`/`growth`/`frontier`/`excessive`) and a 0–1+ gauge fraction so a future UI can render RP's own weak spot (their static-text volume landmarks) as an actual gauge.
- [`plateMath.ts`](../src/domain/workouts/plateMath.ts) — `plateBreakdown()` greedy per-side plate calculation with kg/lb defaults and a configurable inventory, plus `formatPlateBreakdown()`; this is the domain logic the Hevy/Strong "inline plate math" pattern needs before it can be wired into the weight input.
- [`history.ts`](../src/domain/workouts/history.ts) — `WorkoutExerciseSummary` now carries `bestE1rmKg` per exercise (reusing the existing Epley `estimateOneRepMax`, not a new formula), the data foundation for an e1RM trend line.
- Added [`volumeLandmarks.test.ts`](../src/domain/workouts/__tests__/volumeLandmarks.test.ts) and [`plateMath.test.ts`](../src/domain/workouts/__tests__/plateMath.test.ts); 42/42 tests passing, typecheck/lint clean.

**Phase 2 (shipped today) — wired Phase 1 into UI:**

- [`SetRow.tsx`](../src/components/workout/SetRow.tsx) now shows a live "Per side · 25 + 15" plate breakdown beneath the kg input whenever the active exercise's equipment includes a plate-loaded bar (barbell/smith machine at 20kg, EZ bar at 10kg), using `plateMath.ts` directly — this is the Hevy/Strong "inline plate math on the weight field" pattern from the research, not a separate calculator screen. Verified live: entering 100kg on Barbell Bench Press immediately shows "Per side · 25 + 15".
- The Analytics "Hypertrophy balance" card was replaced with a real **Volume landmarks** card: `computeMuscleLoads` in [analytics.tsx](<../src/app/(tabs)/analytics.tsx>) now calls `classifyWeeklyVolume` instead of the old arbitrary `scoreMuscleDose`/`statusForSets` heuristic, so each muscle row shows its actual zone and MEV–MRV numbers (e.g. "Back · 15 sets/wk · Growth zone (MEV 10–MRV 28)") with the bar chart and body-map color now driven by the same real zone data. Verified live on-device — this directly addresses the research finding that RP's own app under-executes this exact feature visually.
- `bestE1rmKg` from Phase 1 is wired into `history.ts`'s summaries but not yet surfaced as a chart — that's the remaining piece of the original Phase 2 scope, folded into Phase 3 below since it belongs on a per-exercise history view that doesn't exist yet.
- Typecheck/lint/42 tests all clean after wiring; no new dependencies.

**Phase 3 (shipped today) — previous-performance overlay:**

- New [`lastPerformance.ts`](../src/domain/workouts/lastPerformance.ts) — `findLastPerformedExercise` scans pre-sorted history for the most recent session that trained a given exercise, `previousSetAtIndex`/`formatPreviousSet` produce a per-set "Last: 100 kg × 8 @ RIR 2" label. Added [`lastPerformance.test.ts`](../src/domain/workouts/__tests__/lastPerformance.test.ts).
- [`workout.tsx`](<../src/app/(tabs)/workout.tsx>) now loads `listWorkoutHistory()` once on mount and looks up the active exercise's last performance; [`SetRow.tsx`](../src/components/workout/SetRow.tsx) shows that label under the target range (only while the set is still open) — the Hevy "previous performance next to the input row" pattern from the research.
- Verified live end-to-end on-device: completed a real Barbell Bench Press set (100kg × 88), finished the session (confirmed persisted via the on-device AsyncStorage/SQLite file, not just the UI), started a fresh Upper A run, and the new Set 1 correctly showed "Last: 100 kg × 88 @ RIR 22" — proving the cross-session lookup, not just same-session copy.
- The e1RM trend chart and one-tap template-save are deferred — they belong on a per-exercise history/detail screen that doesn't exist yet, folded into Phase 4 below.
- 47/47 tests passing, typecheck/lint clean, no new dependencies.

**Phase 4 (shipped today) — per-exercise history screen + e1RM trend:**

- New [`exerciseTrend.ts`](../src/domain/workouts/exerciseTrend.ts) — `buildExerciseTrend` walks history for one exercise and returns an oldest-first `{sessionId, date, e1rmKg, volumeKg, completedSets}[]`. Added [`exerciseTrend.test.ts`](../src/domain/workouts/__tests__/exerciseTrend.test.ts).
- New route [`app/exercise/[id].tsx`](../src/app/exercise/[id].tsx) — e1RM trend chart (same verified-safe `LineChart` prop configuration as the Analytics strength-trend card) plus a reverse-chronological session list. Wired in from two places: Atlas's `SelectedExerciseCard` ("View training history") and each exercise row inside a History session card.
- **Bug caught and fixed during this build, before it ever ran on-device**: the screen originally called `requireExercise(id)`, which throws for any id outside the curated ~80-exercise `EXERCISE_CATALOG`. Atlas browses a _separate_, already-imported 847-exercise `EXERCISE_LIBRARY` (the free-exercise-db dataset — this turned out to already exist from an earlier session, disjoint id namespace, see `library.ts`'s own doc comment). Tapping "View training history" on any of the ~767 library-only exercises would have crashed. Fixed by resolving the name from either dataset (`getExercise` first, `EXERCISE_LIBRARY` fallback) and letting `buildExerciseTrend` return its natural empty state for exercises the workout engine has never logged — confirmed correct by inspection since `WorkoutSession.exercises[].exerciseId` only ever contains catalog ids.
- 51/51 tests passing, typecheck/lint clean, no new dependencies.
- **On-device verification status: blocked by host resource exhaustion, not a code issue.** The emulator hit a persistent System UI ANR loop that survived a guest OS reboot and two full cold emulator restarts (fresh AVD state each time, same result immediately on app launch). Host-level `top`/`vm_stat` showed the actual cause: host load average ~6, ~225MB physical memory free, heavy swap compression, and the emulator's own qemu process alone at 1.8-5GB RSS — genuine host saturation, confirmed by the failure reproducing identically on a completely fresh emulator instance. Phases 1-3 above were verified live on-device earlier in the same session before this resource pressure built up. Phase 4 should get the same on-device pass once the host has headroom (closing one of the two concurrently-running Metro instances on ports 8081/8098 would help, since only one is needed).

**Phase 5 (shipped today) — advanced set logging:**

- [`types/index.ts`](../src/types/index.ts) — added `SetTechnique` (`standard`/`drop_set`/`rest_pause`/`myo_reps`/`cluster_set`/`top_backoff`) and `SubEffort` (`loadKg`, `reps`, `restSeconds`), both attached to `PerformedSet` as **optional** fields (`technique?`, `subEfforts?`) specifically so every already-persisted AsyncStorage session — real device data from Phases 1-4 testing — keeps parsing with no migration.
- [`analytics.ts`](../src/domain/workouts/analytics.ts) — new `setEfforts(set)` flattens a set's primary effort with its sub-efforts into one list; `volumeLoadKg` and `detectPersonalRecords` (both `max_load` and `best_e1rm`) now run over that flattened list, so a drop set's continuations count toward volume and a PR can come from any sub-effort, not just the primary one.
- [`history.ts`](../src/domain/workouts/history.ts) — `bestEstimatedOneRepMax` and `bestSetLabel` updated the same way.
- [`SetRow.tsx`](../src/components/workout/SetRow.tsx) — a per-set technique picker (Paper `Menu`, fire icon, disabled once the set is locked in) and, when a technique is selected, an inline sub-effort list (kg/reps per row, remove button, "+ Add drop / Add cluster / Add backoff" — the label itself changes per technique) rendered inside the same set card.
- No changes to `progression/engine.ts` — the double-progression math deliberately still reads only the primary set's load/reps/RIR, so drop-set/rest-pause continuations inform volume and PRs but don't skew the load-progression decision, which is the correct behavior (progression should track the clean working set, not an assisted extension of it).
- New [`analytics.test.ts`](../src/domain/workouts/__tests__/analytics.test.ts) (5 tests: `setEfforts` flattening, volume with sub-efforts, a PR found in a sub-effort rather than the primary set) plus a new case in `history.test.ts`. **57/57 tests passing, typecheck/lint clean, no new dependencies.**
- **On-device verification: blocked; leading theories checked and ruled out.** `adb reverse tcp:8081 tcp:8081` is correctly registered and raw TCP connectivity from inside the emulator to the host succeeds (`nc -z localhost 8081` from the guest shell), Metro answers `/status` with 200, but no bundle request from the emulator ever reaches Metro's request log across a dozen retry strategies (full app relaunches, an explicit `gymbrofitness://expo-development-client/?url=...` deep link, an `adb kill-server`/`start-server` cycle, two from-scratch emulator instances). Suspected Android's cleartext-traffic (HTTP) policy — checked directly by pulling the installed APK and dumping its manifest: `android:usesCleartextTraffic="true"` is already set and there is no `networkSecurityConfig` or bundled `network_security_config.xml` restricting it, so that's ruled out, not just untested. Also attempted a native rebuild (`npx expo run:android`) to rule out a stale dev-client binary — blocked by a separate, unrelated host issue (Gradle needs JVM 17, this Mac only has JDK 11 installed via Corretto); did not install a new JDK since that's a system-wide environment change outside this task's scope, not something to do unilaterally. The remaining candidates (emulator virtual-network/DNS state, OkHttp-level session corruption from this session's many emulator restarts) are harder to isolate without a fresh pair of eyes or a physical device over USB — recommend trying a real device, or a clean `emulator -wipe-data` pass, next time this needs a visual pass. All five shipped phases are verified correct by typecheck + 57 tests; Phases 1-3 additionally got full live on-device confirmation earlier in this same session, before this connectivity issue appeared.

**Phase 6 (shipped today) — RPE/RIR wheel input:**

- Installed `@quidone/react-native-wheel-picker` (MIT, v1.7.1, no peer conflicts with React 19.2.3/RN 0.86.3 — the exact package the Phase-1 GitHub research vetted for this) after confirming its own runtime dependency `@rozhkov/react-useful-hooks` is healthy (peer `react ^16.8 || ... || ^19`, actively maintained).
- New [`rir.ts`](../src/domain/workouts/rir.ts) — `RIR_VALUES` (0 to 5 in half-point steps, matching the ±0.2-rep precision the exercise-science research found trained lifters actually use) and `formatRir`, kept as a plain module (not inside the component file) specifically so it stays unit-testable without pulling React Native's component tree into a Jest run — see the note below. Added [`rir.test.ts`](../src/domain/workouts/__tests__/rir.test.ts).
- New [`RirPickerSheet.tsx`](../src/components/workout/RirPickerSheet.tsx) — a `@gorhom/bottom-sheet` `BottomSheetModal` (same pattern as the existing `HomeActionSheet`) hosting the wheel picker; confirms via a "Set RIR X" button rather than committing on every scroll tick.
- [`SetRow.tsx`](../src/components/workout/SetRow.tsx) — the old numeric RIR `TextInput` is replaced with a pressable chip (styled to match the kg/reps inputs) showing the current value or "–", opening the sheet on tap; disabled once the set is locked in, matching the kg/reps/technique inputs' existing behavior.
- [`workout.tsx`](<../src/app/(tabs)/workout.tsx>) — owns the sheet's ref and the "which set is being edited" state (`rirSetIndex`), the same ownership pattern as the existing rest-timer and home-screen action sheets.
- **Lesson applied from a lint failure, not just a style nit**: the first draft reset the sheet's local `draft` state from a `useEffect` on the `value` prop — ESLint's `react-hooks/set-state-in-effect` correctly flagged this as the cascading-render anti-pattern. Fixed using React's documented render-time "adjust state when a prop changes" pattern (compare against a tracked previous value and call `setState` directly in the render body) instead of suppressing the rule.
- No changes needed to `progression/engine.ts` or anywhere else that reads `PerformedSet.rir` — it already tolerated fractional RIR (the engine's own `rirOk` check already used a `± 0.5` tolerance), so half-point precision required no downstream changes, only the input mechanism.
- **59/59 tests passing, typecheck/lint clean.**
- **On-device verification: still blocked by the same connectivity issue as Phases 4-5** (see that entry above — root cause not yet found, cleartext-traffic and network-security-config theories both explicitly ruled out this session). Not re-attempted this phase since nothing about the diagnosis changed; revisit device verification for Phases 4-6 together once that's resolved.

**Phase 7 (shipped today) — one-tap template save:**

- New [`templates.ts`](../src/domain/programs/templates.ts) — `buildTemplateFromSession` turns a completed session straight into a replayable `ProgramDay`. Deliberately does **not** recompute anything: every `PerformedExercise` already carries the exact `ExercisePrescription` it ran under, so a template is just those prescriptions in exercise order. Falls back to every exercise if none had a completed set (an instantly-saved session), and derives `focus` from the trained exercises' primary muscles. `defaultTemplateName` produces "Upper A template · Sep 14" so the save is genuinely one-tap — no naming dialog.
- New [`templateStore.ts`](../src/domain/programs/templateStore.ts) — AsyncStorage CRUD (`listTemplates`/`saveTemplate`/`deleteTemplate`), byte-for-byte the same shape as `historyStore.ts` (same runtime-validated parse guard, same sort-and-cap-at-N pattern) rather than inventing a second persistence convention.
- [`workout.tsx`](<../src/app/(tabs)/workout.tsx>) — a "Save as template" button on the session-complete card (right where Hevy puts it); `WorkoutScreen` now also accepts a `templateId` route param, loads that template's `day` from the store, and hands it to the same `WorkoutSessionView` a generated program day would use — a template isn't a separate code path, it's just another `ProgramDay` source.
- [`history.tsx`](../src/app/history.tsx) — a new "Saved templates" section lists every saved template with a Start button (`router.push({pathname:'/workout', params:{templateId}})`) and a delete action, so the save has an actual, reachable use — the loop closes, this isn't a write-only feature.
- New [`templates.test.ts`](../src/domain/programs/__tests__/templates.test.ts) (6 tests: prescription order preserved, focus derived correctly, partial-completion filtering, the all-incomplete fallback, real-duration passthrough, default-name format) — all passed on the first run.
- **65/65 tests passing, typecheck/lint clean, no new dependencies.**
- **On-device verification: still blocked by the same connectivity issue as Phases 4-6** — not re-attempted, nothing about the diagnosis changed.

**Phase 8 (shipped today) — PR celebration micro-interaction:**

- Went with the reanimated-only option over `react-native-fast-confetti`, and it's a real trade-off worth recording, not a default: the Skia-based package needs a native rebuild to add, and this session's `npx expo run:android` attempt is blocked by an unrelated host issue (Gradle needs JVM 17, this Mac only has JDK 11 via Corretto — see the Phase 5 entry). Installing a JDK is a system-wide change outside this task's scope to do unilaterally. Rather than land a dependency nobody can build yet, built the celebration with `react-native-reanimated`, already a core dependency with nothing new to install or verify.
- New [`PrCelebration.tsx`](../src/components/workout/PrCelebration.tsx) — 18 small pieces burst outward from a point and fade over 650ms, each driven by its own `useSharedValue`/`withTiming`, then the component calls `onDone` and the caller unmounts it. Deliberately a **one-shot** animation, not a loop — this app has a documented prior incident (the original `ReadinessCommandCard`, replaced in an earlier phase) where a continuously-looping 16-`MotiView` animation pegged the emulator's CPU near 100% and cascaded into System UI ANRs. Every piece's `withTiming` runs exactly once; there is no `repeat`/`loop` anywhere in the component.
- [`workout.tsx`](<../src/app/(tabs)/workout.tsx>) — fires when `finishSession` detects at least one new PR, rendered over the existing completion card; resets alongside the rest of the completion state when "Start another run" is pressed.
- No dedicated test — this codebase has no component-render tests for any of its existing animation components either (`Reveal.tsx`, `RestTimer.tsx`, etc.), confirmed by checking before skipping one here rather than assuming.
- **Typecheck/lint clean, 65/65 existing tests unaffected, no new dependencies.**
- **On-device verification: still blocked by the same connectivity issue as Phases 4-7.**

This closes all 8 phases of the premium-tier roadmap from today's research. Everything is code-complete, typecheck/lint clean, and covered by 65 domain-layer tests; Phases 1-3 got full live on-device confirmation earlier in this session, Phases 4-8 are waiting on the unresolved dev-client connectivity issue for the same treatment.

Note: the exercise-database upgrade originally planned as its own phase turned out to already be done — `EXERCISE_LIBRARY` (847 exercises, `src/domain/exercises/seed/library.json`, free-exercise-db/Unlicense) already exists as a browse/search dataset separate from the curated `EXERCISE_CATALOG` the workout engine uses (see `library.ts`'s doc comment). Discovered while fixing the Phase 4 bug above.

## Architecture decision: local-first SQLite, cloud sync as an optional layer (2026-09-14)

Asked directly: "how are similar apps actually built, apply the same structure, don't reinvent the wheel." Rather than guess, cloned and read the source of two real, current, publicly-available RN fitness apps.

**[LiamMorrow/LiftLog](https://github.com/LiamMorrow/LiftLog)** (568★, MIT/AGPL mixed, pushed within the last day) is the single most relevant reference available: it runs the **exact same stack this app runs** — Expo ~57, React Native 0.86, React 19, expo-router, React Native Paper (Material 3) — built by an experienced team, actively shipping. Its own `AGENTS.md` states the architecture plainly: **Redux Toolkit** for state, **Drizzle ORM + expo-sqlite** for local storage, a **.NET backend that "usually does not need changing to add app features"** — i.e. the backend is optional plumbing (end-to-end-encrypted social feed, AI planner), not the source of truth. The local SQLite schema (`app/src/db/schema.ts`) uses a deliberately simple pattern: every table is `id` (primary key) + `payload` (a JSON column typed to a **versioned** domain type, e.g. `AnyVersionSessionJSON`), plus real SQL where it earns its keep — a partial unique index enforces "at most one active session" at the database level instead of in application code. A `services/data-migrations/` layer upgrades old JSON payloads forward when the shape changes. Their `store/backends/` slice treats "which backend, if any, is configured" as just more state — sync is a feature you can turn on, not a foundation the app depends on to function.

**[hasaneyldrm/logpress-public](https://github.com/hasaneyldrm/logpress-public)** (245★, MIT, bare RN + React Navigation, not Expo) is the contrasting real data point: Redux Toolkit again, but `@supabase/supabase-js` as a cloud-first backend with AsyncStorage as a thin secondary cache, no local SQL layer, plus Adapty for subscription paywalls. Two independent real apps converging on **Redux Toolkit** for state (not Zustand, despite that being this repo's own earlier plan and this session's own generic research-agent recommendation) is a meaningfully stronger signal than either suggestion in isolation — real shipped code beats generic advice.

**Relevant discovery made mid-research**: this repo's own `package.json` already has `@supabase/supabase-js`, `zustand`, `@tanstack/react-query`, `react-hook-form`, and `zod` installed — traced via `git show HEAD:package.json` to the existing "Base Skeleton" commit, not a live conflict with concurrent work. They were staged early (matching this project's very first planning pass, before any of the phase work above) and never wired up. That's compatible with the decision below, not contradicted by it — see the synthesis.

**Decision — combine what's already staged with the structural lesson from the real comparable app**:

1. **Local SQLite (`expo-sqlite` + `drizzle-orm`) is the on-device source of truth**, replacing the flat AsyncStorage JSON-array stores (`historyStore.ts`, `templateStore.ts` today re-read-and-rewrite an entire array on every save — fine at dozens of sessions, not hundreds). Use LiftLog's exact `id` + versioned-`payload` table shape rather than deep normalization: it keeps the existing, carefully-designed domain types (`WorkoutSession`, `PerformedSet` with its `technique`/`subEfforts`) completely unchanged, while real SQL gives indexed lookups and DB-level invariants (e.g. "one in-progress session") that a JS `.filter()` over a fully-loaded array can't. `drizzle-kit` (already in the same family as `drizzle-orm ^0.45.2`, matching LiftLog's own pin) generates migrations when the payload shape changes.
2. **Already-installed `zustand` stays, does not become Redux Toolkit.** The two-real-apps signal favors Redux, but Zustand is a legitimate, simpler choice for this app's actual need (the single active `WorkoutSession` object mutated set-by-set) and ripping out an already-installed, uncontroversial dependency to match a stack preference isn't worth the churn — the load-bearing lesson from LiftLog is "local SQLite is truth, backend is optional," not "Redux specifically beats Zustand." Use Zustand for in-session workout state exactly as this repo's own original plan intended.
3. **Already-installed `@supabase/supabase-js` + `@tanstack/react-query` become the _optional sync layer_ on top of SQLite — not the primary store.** TanStack Query's mutation-pause-and-resume (`persistQueryClient` + `resumePausedMutations`) fetches/pushes against Supabase when a session exists and connectivity allows; the app must work fully offline with zero code path depending on Supabase being reachable, matching both LiftLog's "backend usually doesn't need changing" posture and the hard reality of gym-basement signal.
4. **Already-installed `react-hook-form` + `zod` are exactly right for the onboarding wizard and Settings screen** (both currently missing/stubbed) — no change to this piece of the original plan.
5. **Onboarding**: build a `welcome-wizard`-equivalent (LiftLog's own naming: `components/smart/welcome-wizard.tsx`) that replaces `DEMO_PREFERENCES`/`DEMO_USER_ID` with real captured equipment/experience/goals/days-per-week, feeding the existing generator/progression engine real input for the first time.

**Phased execution plan** (not yet started, this entry is the decision record):

- **Step 1 — SQLite foundation**: `src/db/schema.ts` (Drizzle schema, id+payload tables for sessions/templates/records, matching `WorkoutSession`/`WorkoutTemplate` shapes 1:1), `src/db/client.ts` (opens the expo-sqlite DB via `drizzle-orm/expo-sqlite`), and a Jest test shim redirecting `expo-sqlite` to `better-sqlite3` in tests — the exact technique LiftLog uses for Vitest, ported to this repo's Jest config, so the storage layer gets real SQL-executing test coverage instead of shipping unverified (device verification is still blocked, so this is the only way to test it meaningfully right now).
- **Step 2 — Migrate `historyStore.ts` first** (proof of concept, most-used store) keeping its exact exported function signatures so `workout.tsx`/`history.tsx`/`exercise/[id].tsx` need zero changes; then `templateStore.ts` once the pattern is proven.
- **Step 3 — Zustand session store**: extract `workout.tsx`'s sprawling local `useState` (session, active exercise index, rest timer, RIR sheet target, template-save state, celebration — currently ~10 separate `useState` calls in one component) into a proper store.
- **Step 4 — Onboarding wizard** using `react-hook-form` + `zod`, replacing the demo constants.
- **Step 5 — Supabase as opt-in sync**: auth screens, schema/RLS matching the Drizzle schema, TanStack Query wiring — deliberately last, since it's additive on top of a working offline app rather than a prerequisite for one.

### Step 1 + Step 2 shipped (2026-09-14)

**Step 1 — SQLite foundation:**

- [`src/db/schema.ts`](../src/db/schema.ts) — `workoutSessionsTable`/`workoutTemplatesTable`, LiftLog's `id` + versioned-`payload` shape. `startedAt`/`status` are pulled out as real indexed columns alongside the JSON payload specifically so a partial unique index can enforce **"at most one in-progress session"** at the database level — a DB-level invariant the previous AsyncStorage array never had. Hand-written idempotent bootstrap DDL (`BOOTSTRAP_SQL`) instead of a drizzle-kit migration pipeline — deliberate, documented in the file: two tables with no relational constraints between them doesn't yet justify migrations that would need bundling into the native app.
- [`src/db/types.ts`](../src/db/types.ts) — the one-line insight that unlocked testing without a shim: `drizzle-orm/expo-sqlite`'s `ExpoSQLiteDatabase` and `drizzle-orm/better-sqlite3`'s `BetterSQLite3Database` both extend the exact same `BaseSQLiteDatabase<'sync', ...>` base class. Repository code written against that shared type runs identically, unmocked, against either driver.
- [`src/db/client.ts`](../src/db/client.ts) — the real app database.
- [`src/db/createTestDb.ts`](../src/db/createTestDb.ts) — an in-memory `better-sqlite3` database running the same bootstrap DDL, for tests.
- [`src/db/__tests__/schema.test.ts`](../src/db/__tests__/schema.test.ts) — proves the foundation actually works: a full `WorkoutSession` (including a nested drop-set `subEfforts` array) round-trips through the JSON payload column intact, and the partial unique index genuinely rejects a second in-progress session insert while still allowing multiple completed ones.
- Added `drizzle-orm`, `expo-sqlite` (dependencies) and `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit` (devDependencies) — all checked for version health and peer-dep compatibility with React 19.2.3/RN 0.86.3 before installing.

**Step 2 — migrated `historyStore.ts` (the proof of concept):**

- New [`historyRepository.ts`](../src/domain/workouts/historyRepository.ts) — driver-agnostic SQL (`listWorkoutHistorySql`, `saveWorkoutSessionSql`, `importSessionsSql`, `clearWorkoutHistorySql`, `countWorkoutHistorySql`), fully unit-tested in [`historyRepository.test.ts`](../src/domain/workouts/__tests__/historyRepository.test.ts) (7 tests: upsert-by-id, oldest-session pruning past 100, newest-first ordering, status-preserving import, idempotent re-import).
- [`historyStore.ts`](../src/domain/workouts/historyStore.ts) keeps its **exact previous public API** (`listWorkoutHistory`/`saveWorkoutSession`/`clearWorkoutHistory`) — `workout.tsx`, `history.tsx`, and `exercise/[id].tsx` needed zero changes. It now delegates to the SQL repository, with a one-time, idempotent migration that imports any pre-existing AsyncStorage history into SQLite on first access and clears the old key — the "claim your local history" pattern from the research, applied for real instead of just cited.
- `templateStore.ts` deliberately **not** migrated yet — same pattern, next increment, not started so this change stays reviewable as one coherent step.

**A real bug caught before it shipped, not after**: the first version of `client.ts` opened the real SQLite database as a _module-load-time side effect_ (`SQLite.openDatabaseSync(...)` at the top of the file). Verified this the hard way — wrote a throwaway probe test that merely _imported_ `historyStore.ts` and it crashed instantly (`NativeDatabase is not a constructor`), because `jest-expo` doesn't provide a working native SQLite module in the test environment. Anything that ever imports `historyStore.ts`, even transitively and without calling any of its functions, would have crashed under Jest. Fixed by making the database open lazily (`getDb()`, opened on first call, not on import) — a better pattern regardless of testing, and it avoided needing LiftLog's heavier Vitest-plugin-based module-resolution shim entirely.

**76/76 tests passing (14 new), typecheck/lint clean.** On-device verification is still blocked by the unresolved dev-client connectivity issue (confirmed still present today, independent of host load — checked again before starting this work) — this is the reason the Jest-based verification above matters more than usual: it's real, executing-SQL proof the storage layer works, not a placeholder standing in for a screenshot that can't be taken right now.

### Dev-client connectivity issue: root cause found and fixed (2026-09-14)

The installed dev-client APK was simply **stale** — it needed a fresh native rebuild, which had been blocked all session by a _different_, previously-undiagnosed problem: `npx expo run:android`'s Gradle build requires JVM 17+, and this Mac's only installed JDK is Amazon Corretto 11 (confirmed via `/usr/libexec/java_home -V`). Every earlier attempt to fix the "Unable to load script" error (emulator reboots, `adb reverse` resets, cleartext-traffic and network-security-config checks, `adb kill-server`) was treating a symptom of this, not the cause — none of them could have worked, because the real fix required a native rebuild that was never attempted (it failed silently, or rather loudly with a Gradle version error, the first time it was tried, before that error was connected back to this specific problem).

**The fix, without installing anything new:** Android Studio (already installed on this machine) bundles its own JDK 21 at `/Applications/Android Studio.app/Contents/jbr/Contents/Home` — a JetBrains Runtime shipped with an app the user already has, not a new system-wide install. Pointed `JAVA_HOME` at it for one command:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npx expo run:android
```

Build succeeded in 1m31s, installed the fresh APK, and the app connected to Metro immediately — no more `adb reverse` juggling needed at all; `expo run:android` handles the dev-client-to-packager handshake itself (it opened the app via `gymbrofitness://expo-development-client/?url=http://192.168.0.217:8081`, the machine's LAN IP, not `localhost`).

**Full on-device verification followed, covering everything built since the connectivity issue first appeared** (Phases 4-8 plus the new SQLite work, none of which had ever been seen running):

- RIR wheel picker sheet opens, scrolls, and commits correctly (confirmed "Set RIR 2" → the set's RIR chip updates to "2").
- The technique-picker fire icon, plate math ("Per side · 25 + 15" for a 100kg bench set), and previous-performance overlay all render together on the same set row with no conflicts.
- `finishSession()` → `saveWorkoutSession()` completed against the new SQLite-backed `historyStore.ts` for the first time on a real device: session showed "Session saved, 1 working sets logged with 800kg total volume, 3 PR" — no crash.
- Navigated to History and confirmed the session read back correctly through `listWorkoutHistory()`: "1 sessions, 1 sets, 800kg volume," with the exercise breakdown ("Barbell Bench Press · 1 sets · 800kg · best 100 kg x 8") intact — proof the SQLite write-then-read round trip works for real, not just against `better-sqlite3` in Jest.
- One false alarm caught and correctly ruled out during this pass: a set's kg/reps briefly appeared to reset to empty after being marked complete. Reproduced deliberately with a clean, careful retest (fresh coordinates read from a live `uiautomator dump` instead of reused/guessed ones) and confirmed the data persisted correctly — the original observation was caused by tapping the wrong screen coordinate (a stale y-offset from before a layout shift), not a real data-loss bug in the app.
- Test session cleared from the device afterward (`rm` on the SQLite db files) so it doesn't pollute real usage data; confirmed the app recreates a fresh, working database automatically on next launch.

The device is now a reliable verification tool again for future phases.

### templateStore.ts migrated to SQLite (2026-09-14)

Same pattern as `historyStore.ts`, applied a second time now that it's proven: new [`templateRepository.ts`](../src/domain/programs/templateRepository.ts) (driver-agnostic SQL, 5 tests in [`templateRepository.test.ts`](../src/domain/programs/__tests__/templateRepository.test.ts)), `templateStore.ts` keeps its exact public API with a one-time legacy-AsyncStorage import. 81/81 tests at the time, typecheck/lint clean.

### Real hand-off: Codex picked up concurrent work on this repo

Between sessions, Codex (not this session) built three substantial additions on top of the above, verified compatible (96/96 tests, typecheck/lint clean once both bodies of work landed together):

- **`historyInsights.ts`** — real streak/level/PR/strength-trend/weekly-volume analytics computed from actual persisted history, replacing the `DEMO_*` constants that Home/Analytics/Profile had been reading from all session.
- **`setAutofill.ts`** — set-value suggestions with a fallback chain (this-set-last-session → top-set-last-session → previous-set-this-session → prescription floor), building directly on `lastPerformance.ts`.
- **Draft-session autosave/resume**: `historyRepository.ts` gained `getInProgressWorkoutSessionSql`/`saveInProgressWorkoutSessionSql`/`discardInProgressWorkoutSessionSql`; `workout.tsx` now debounce-autosaves the in-progress session and also saves on backgrounding (`AppState`), with a resume-or-discard dialog on relaunch — closes the "app dies mid-workout, all progress lost" gap this app had all session.

### Hand-built-widget audit: swapped `PrCelebration` for a real package (2026-09-14)

Asked directly to replace anything "AI-looking" and hand-built with real, established packages. Audited the home-screen cards (`HomePreflightRail`, `MesocycleCard`, `PrWatchCard`, `TodayWorkoutHero`) for custom-drawn SVG/animation loops — all clean (`PrWatchCard` uses `expo-linear-gradient`, a real package; the rest are plain Paper components with no custom animation). The one genuine hand-built visual left was `PrCelebration.tsx`'s confetti burst, built with raw `react-native-reanimated` primitives specifically because `react-native-fast-confetti` needed a native rebuild that was blocked all session by the JDK issue (see above) — now that's fixed.

Installed `@shopify/react-native-skia` 2.6.2 and `react-native-fast-confetti` 2.0.2 (both current, peer deps satisfied by React 19.2.3/RN 0.86.3/reanimated 4.5.1/worklets 0.10.1 — checked via `npm view` before installing). Rewrote `PrCelebration.tsx` around the real `<PIConfetti>` component (point-of-impact burst, the exact pattern the hand-built version was already imitating) — same external API (`onDone` callback), so `workout.tsx` needed zero changes. 96/96 tests, typecheck/lint clean. Verified live on-device: real physics-based confetti fired correctly on a 3-PR completion.

## Superset / circuit logging (2026-09-14)

Chosen as the first item to build from the ranked "what more functionalities" research report (activity heatmap, extra stats, warm-up calculator, settings/onboarding, export, manual program editor were the other ranked options — all deferred, not rejected). Superset/circuit training (pairing two exercises back-to-back with no rest between them) is a staple pattern in Hevy/Strong/JEFIT that this app's adjacency-ordered `ExercisePrescription[]` data model was already naturally suited for, without needing wger's heavier structural Slot→SlotEntry redesign.

- [`types/index.ts`](../src/types/index.ts) — added `supersetWithNext?: boolean` to `ExercisePrescription`. Adjacency-based (chains the exercise to the very next one in the list) rather than a group id, matching how a day/session already stores exercises as an ordered array — a run of exercises chains together (A→B→C) by flagging each except the last.
- New [`supersetNavigation.ts`](../src/domain/workouts/supersetNavigation.ts) — `supersetChainBounds` finds the `[start, end]` span of chained exercises around a given index; `navigateAfterSetCompletion` decides where to go after a set is completed: outside a chain, unchanged sequential behavior (advance only once the exercise is fully done, normal rest); inside a chain, every completed set advances to the next incomplete exercise in the chain (cycling back to an earlier one if needed) with **no rest**, until the whole chain is done, at which point normal rest resumes. 8 tests in [`supersetNavigation.test.ts`](../src/domain/workouts/__tests__/supersetNavigation.test.ts) covering single-exercise, 2- and 3-exercise chains, and post-chain continuation.
- [`workout.tsx`](<../src/app/(tabs)/workout.tsx>) — `toggleComplete` now calls `navigateAfterSetCompletion` instead of the old local `nextOpenExerciseIndex` helper (deleted, superseded by the domain module) to decide whether to skip the rest timer and which exercise to jump to. New `toggleSupersetWithNext` flips the flag on the active exercise. UI additions: a small chain-link icon (⛓) between chips in the exercise rail when two adjacent exercises are paired; a chip on the active-lift card reading "Group with next lift" (untoggled) or "Paired with <Next Exercise> · no rest" (toggled), hidden on the last exercise.
- 104/104 tests passing, typecheck/lint clean, no new dependencies.
- **Verified live on-device, full end-to-end**: toggled "Group with next lift" on Barbell Bench Press → chip read "Paired with Row · no rest," chain icon appeared in the rail. Logged Set 1 on Bench Press (100kg×8) and completed it: app correctly jumped straight to Barbell Row with the rest timer staying at "ready" (not counting down) instead of advancing sequentially. Logged and completed Row Set 1 (60kg×10): app correctly cycled back to Bench Press for Set 2, with Set 1's data and completed state intact and the pairing label still accurate — confirming the A→B→A interleaving, no-rest transitions, and per-exercise set-tracking all work exactly as designed, not just as unit-tested. Also incidentally re-confirmed the draft-autosave/resume feature (Codex's work) survives a background exercise-toggle round trip correctly.

## Activity heatmap calendar (2026-09-14)

Second item from the ranked report. Re-checked the npm ecosystem before hand-building anything (the standing rule this session): `react-native-calendar-heatmap` is the only real candidate and it's stale since 2022 (same rejection category as `react-native-svg-charts`/`react-native-circular-progress-indicator` earlier this session) — no other named package exists. Built on plain `View`/`Pressable` cells instead of `react-native-svg` (simpler than SVG for a flat color grid, and gets free tap targets for the inspect-a-day interaction) — both are the same "glue an already-installed primitive together for a domain need" exception documented earlier for `AnimatedNumber`.

- New [`activityHeatmap.ts`](../src/domain/workouts/activityHeatmap.ts) — `buildActivityHeatmap` buckets finished sessions (skips in-progress/discarded ones and zero-completed-set sessions) into UTC calendar days over a trailing window (default 18 weeks/126 days), same `Date.UTC` day-bucketing convention `gamification.ts`'s `computeStreak` already established rather than a new one. Two same-day sessions merge into one day. Each day gets a 0-4 `level` relative to the busiest day _within the window_ (GitHub-contribution-graph style, not an absolute scale) for shading. 7 tests in [`activityHeatmap.test.ts`](../src/domain/workouts/__tests__/activityHeatmap.test.ts): window bounds, real volume bucketing, in-progress/zero-set exclusion, same-day merging, relative-level scaling, out-of-window filtering.
- New [`ActivityHeatmapCard.tsx`](../src/components/progress/ActivityHeatmapCard.tsx) — a horizontally-scrollable week-column grid (GitHub layout: columns = weeks, rows = Sun-Sat), a Less→More legend matching the same 5-level scale, and a tap-to-inspect interaction (selecting a cell shows "Sep 14 · 2 sets · 1600kg" in place of the default "Tap a day for details" caption) rather than a separate tooltip component.
- Wired into [analytics.tsx](<../src/app/(tabs)/analytics.tsx>) right after the Volume landmarks card (`buildActivityHeatmap(history)` alongside the screen's existing `listWorkoutHistory()` load); bumped the subsequent `Reveal` stagger indices by one to keep the entrance animation sequential.
- 111/111 tests passing (7 new), typecheck/lint clean, no new dependencies.
- **Verified live on-device**: card renders real data ("1 training days", "1.6t volume"), grid shows the correct single highlighted cell in the correct column/row for today's date, legend renders all 5 shades correctly, and tapping the cell selects it (visible border highlight) and updates the caption to the exact real session data ("Sep 14 · 2 sets · 1600kg") — confirming both the domain bucketing and the tap-to-inspect interaction work end-to-end, not just in isolation.

Next up (from the ranked report, in priority order): extra stats (workouts/week, sets/week, avg session duration, heaviest-lift-ever PR, bodyweight trend), then the warm-up-set calculator, real settings/onboarding, CSV/JSON export, and — as the largest, deliberately-deferred effort — the full manual program editor.

## Real-time exercise form analysis — audit & Phase 1 (2026-09-15)

New, user-directed feature, explicitly building on [gouthamx67/ai-gym-trainer](https://github.com/gouthamx67/ai-gym-trainer) with the author's permission. Cloned and read the full repo (not just its README) before writing anything.

**Audit finding that shaped everything else**: ai-gym-trainer is a Next.js _web_ app — its camera/pose layer (`WebCamFeed.tsx`) is built entirely on `getUserMedia`/`<video>`/`<canvas>`/`@mediapipe/pose` (loaded from a CDN as browser WASM). None of that runs in React Native; there is no direct port for the vision pipeline. What _is_ directly reusable: `biomechanics.ts` (angle/lean/symmetry math — pure functions over a `{x,y,z,visibility}` landmark shape, zero DOM) and the shape of `repCounter.ts`'s hysteresis-banded state machine and `ExerciseConfig` schema. Its `Dashboard.tsx`/`obsessionEngine.ts`/`streaks.ts` (server-fetched gamification) and `server/services/aiCoach.js` (Gemini-based coaching text) were **not** reused — they duplicate GymBro's own already-shipped `gamification.ts`, and a cloud LLM coach directly conflicts with this project's own standing decision (see "On the AI coach prompt pattern" above) and with the feature's explicit client-side requirement.

**Camera/pose-model replacement, chosen after real due diligence** (same `npm view` version/peer-dep/license discipline used all project): rejected `react-native-mediapipe` (stale since Dec 2024, pinned to a since-twice-broken VisionCamera API), `@tensorflow-models/pose-detection`/`@tensorflow/tfjs-react-native` (stale since late 2023, pinned to `expo-camera@^13` against our v57), and `react-native-pose-estimation`/`quickpose-*` (surfaced in search, don't actually exist on npm — 404s). Landed on **`react-native-vision-camera` v5.2.3 + `react-native-vision-camera-worklets` v5.2.3 + `react-native-fast-tflite` v3.0.1** — all three co-maintained by the same author (Margelo), all updated within the last month, MIT-licensed, built on `react-native-nitro-modules` (0.37.1). Frame processors run on `react-native-worklets`, the exact package already installed for Reanimated 4 (0.10.1) — no competing worklets runtime. Pose model: **MoveNet Lightning** (TFLite, Apache-2.0, 17 COCO keypoints) via `react-native-fast-tflite`, the documented reference architecture from VisionCamera's own author. Checked MoveNet's 17 keypoints against every landmark the 5 target exercises need (shoulder/elbow/wrist/hip/knee/ankle/nose) — full coverage, no BlazePose-only points (fingers/heel/foot-index) required yet. `@shopify/react-native-skia` (already installed and proven, from `PrCelebration`) will do the skeleton overlay — one less new native surface. Net new native deps for Phase 2: 4, plus a bundled ~5MB `.tflite` model asset.

**Folder architecture**: `src/domain/vision/` (framework-free, mirrors `src/domain/workouts/`) for everything testable without a camera; `src/vision/` (native glue: frame processor, model loading) and `src/components/vision/` (camera UI) for Phase 2; new `src/app/form-check/[exerciseId].tsx` route. Vision exercise configs are **keyed by `MovementPattern`, not exercise slug** — GymBro's catalog has several equipment variants per movement (`barbell-curl`/`dumbbell-curl`/`ez-bar-curl`/`hammer-curl`/`cable-curl`/`preacher-curl` all share `movementPattern: 'elbow_flexion'`; confirmed the same pattern for squat/overhead-press/lateral-raise/push-up by reading the seed files) and the camera-based biomechanics are identical across them — one config automatically covers every variant instead of duplicating per slug.

**Phase 1 (shipped today) — pure-TS vision domain layer, zero new dependencies, 86 new tests:**

- [`landmarks.ts`](../src/domain/vision/landmarks.ts) — `Landmark`/`KeyJoints` typed for MoveNet's 17-point COCO order (not BlazePose's 33 — see above).
- [`biomechanics.ts`](../src/domain/vision/biomechanics.ts) — `calculateAngle`/`getTorsoLean`/`getSymmetryRatio`/`VelocityTracker` ported from ai-gym-trainer; **caught and fixed a real bug during the port**: the original port's `VelocityTracker.update` overwrote `prevAngle` before computing the velocity delta against it, so every call after the first returned exactly 0 — fixed by capturing the previous value before reassigning. New: `getBodyScale`/`normalizedDistance`/`normalizedHorizontalOffset`/`normalizedVerticalOffset` — ai-gym-trainer's distance-based form rules compare raw normalized-image-space deltas (e.g. `elbow.x - shoulder.x > 0.12`), which only holds for one specific body size and camera distance; scaling by a body-proportional reference (shoulder-to-hip span) makes the same rule correct across different heights and camera distances (improvement #4 from the brief).
- [`smoothing.ts`](../src/domain/vision/smoothing.ts) — a One Euro Filter (Casiez et al. 2012, the same adaptive low-pass filter MediaPipe itself uses internally) per-landmark, per-axis — heavy smoothing at rest, backing off automatically as motion speeds up so a fast rep doesn't lag (improvement #2).
- [`confidence.ts`](../src/domain/vision/confidence.ts) — `assessTrackingQuality`/`hasRequiredJoints` gate biomechanics math behind per-joint visibility thresholds (improvement #3).
- [`temporalFilter.ts`](../src/domain/vision/temporalFilter.ts) — a generic per-key debouncer so a form violation must persist for a configurable duration before it's confirmed, instead of flashing on one bad frame (improvement #1).
- [`repStateMachine.ts`](../src/domain/vision/repStateMachine.ts) — the hysteresis-banded rep counter (ported concept, 12° tolerance band prevents duplicate reps from pose noise — improvement #5), extended with a 4-phase cycle (`start`/`rising`/`peak`/`falling`) instead of a raw up/down flag. **A real correctness issue caught before writing tests**: naively assuming "rising toward the ROM's far endpoint" always means "concentric" is wrong for squat and push-up — both are descend-first movements where the true concentric (muscle-shortening) drive runs the opposite direction through the rep cycle compared to lift-first movements like curl/lateral-raise/overhead-press. Fixed by keeping the state machine's phases purely motion-directional (`rising`/`falling`, no physiology assumption) and adding an explicit `concentricDirection` field to each exercise config that a separate mapping layer (`formScoring.ts`) uses to correctly attribute which measured duration is truly concentric vs. eccentric.
- [`formScoring.ts`](../src/domain/vision/formScoring.ts) — `scoreRep()` produces the exact per-rep shape the brief specified (`romScore`/`stabilityScore`/`alignmentScore`/`tempoScore`/`symmetryScore`/`violations`/`overallScore`), weighted per-exercise via `scoringWeights` (improvement #6). Also generates two "synthetic" violations not tied to any single per-frame form rule — `control-eccentric` (eccentric phase rushed relative to the exercise's ideal tempo) and `asymmetric-movement` (left/right symmetry ratio below threshold) — matching two of the brief's example coaching messages that aren't really per-frame joint-position checks.
- [`sessionSummary.ts`](../src/domain/vision/sessionSummary.ts) — `buildSetSummary()` aggregates a set's reps into the exact summary shape requested: average score, best/worst rep, most common issue, average ROM/tempo, and rule-based (not LLM) recommendations (improvement #7).
- [`feedbackPriority.ts`](../src/domain/vision/feedbackPriority.ts) — `pickTopViolation()` ranks active violations by priority (errors default ahead of warnings) and returns exactly one — never more than one coaching cue on screen at once (improvement #8).
- [`exerciseVisionConfigs/`](../src/domain/vision/exerciseVisionConfigs) — the 5 target exercises (curl, squat, lateral raise, push-up, overhead press), each with camera angle, required joints, angle formula, thresholds, minimum ROM, `concentricDirection`, ideal tempo, form rules (with per-rule `persistMs` and severity), and scoring weights. Rules rewritten with the brief's example coaching messages where they genuinely fit ("Don't swing your torso.", "Keep your chest up.", "Go deeper.", "Keep your knees tracking over your toes.", "Fully extend your arms.", "Keep your elbows closer to your body.") rather than reusing ai-gym-trainer's originals verbatim.
- Deliberately not started: MediaPipe Hands / grip analysis — per instruction, no stub was even added yet, since it belongs in the Phase 2 native layer that doesn't exist.
- **86/86 new tests passing (223/223 project-wide), typecheck/lint clean.** Every module hit at least one real bug or design flaw during test-writing rather than after (the `VelocityTracker` bug, the concentric-direction bug, and one test-data issue where synthetic "hold" frames were jittery enough to read as still-moving — fixed by making the test's hold sequence genuinely flat, matching what the upstream `LandmarkSmoother` would actually produce in real usage).

**Not started yet (Phase 2, flagged as its own step given the native-dependency size)**: installing the 4 packages above, an Expo config plugin for camera permissions, a native rebuild, the actual frame processor + MoveNet inference + Skia skeleton overlay, and the `FormCameraView`/`LiveFeedbackBanner`/`SetSummaryCard` UI wired to today's domain layer via a new `/form-check/[exerciseId]` route reachable from the active-lift card's "Analyze form" affordance (not yet added — holding off on a UI entry point until it leads somewhere real, rather than shipping a dead-end button).

## Real-time exercise form analysis — Phase 2, native pipeline (2026-09-16)

**Dependency pivot from the Phase 1 plan**: `react-native-vision-camera` v5.2.3 turned out to be a ground-up architectural rewrite (`CameraFrameOutput`/`FrameRenderer`/`HybridFrameConverter`) with no public `react-native-fast-tflite` integration — fast-tflite's own README states a v5 integration exists only as a private, sponsor-gated project. Rather than build against undocumented internals, pivoted to **VisionCamera v4.7.3** (last stable pre-rewrite release) + **`react-native-worklets-core`** (the v4 frame-processor worklet runtime — distinct from, and coexisting with, `react-native-worklets` which Reanimated 4 already uses) + **`vision-camera-resize-plugin@3.2.0`**, matching fast-tflite's own documented working example exactly.

**Shipped**: `src/domain/vision/moveNetDecode.ts` (decodes MoveNet's `[y, x, confidence]`-per-keypoint output — note the y-before-x order, the opposite of this app's own `{x, y}` field order) and `skeletonConnections.ts`, both unit-tested; `src/vision/poseModel.ts` (loads the bundled `.tflite` asset via `useTensorflowModel`) and `src/vision/useFormAnalysis.ts` (the full pipeline: a `useSkiaFrameProcessor` worklet does inference + raw-landmark skeleton drawing statelessly on the VisionCamera thread, bridging each frame's landmarks to the JS thread via `useRunOnJS`, where all stateful logic — smoothing, rep state, scoring — runs as the already-tested Phase 1 domain code); `FormCameraView`/`LiveFeedbackBanner`/`SetSummaryCard` components; the `/form-check/[exerciseId]` route (extended by Codex with session/exercise/set attach params to save a completed set's analysis back onto a workout set); and an "Analyze form" entry point on the active-lift card in `workout.tsx` (renamed/extended by Codex to "Form AI · side" with camera-angle info).

**Two real infra bugs found and fixed**, both specific to this project's Expo setup rather than generic Expo/VisionCamera issues:

1. **Missing camera permission silently no-op'd** — `app.json`'s `react-native-vision-camera` plugin config never reached `AndroidManifest.xml` because this project's `android/` directory is gitignored/regenerable, and `npx expo run:android` does not re-run `expo prebuild` when `android/` already exists. Fixed with `npx expo prebuild --platform android --clean` (which also wipes `android/local.properties`, requiring it to be recreated).
2. **`HardwareBuffers` crash** — the frame processor's `getNativeBuffer()` call requires Android API 26+; fixed by adding `expo-build-properties` with `minSdkVersion: 26` to `app.json`.

**On-device verification (Android emulator)**: confirmed end-to-end — camera permission grant, MoveNet model load, live inference (`CameraView: invokeOnAverageFpsChanged` firing continuously in logcat), and the JS-side pipeline (landmark decode → smoothing → `assessTrackingQuality` → rep state machine) all run correctly, evidenced by the tracking-quality banner correctly showing "Step into frame — full body not visible" against the emulator's bodyless synthetic camera feed. **One unresolved emulator-specific visual issue**: the Skia-rendered camera preview + skeleton overlay reliably goes solid black once the frame processor starts inference-driven drawing (`model.runSync` + `frame.drawLine`/`drawCircle`), while the underlying analysis pipeline demonstrably keeps running correctly underneath (tracking-quality state keeps updating, FPS counter keeps incrementing) — this points to an emulator GPU/Skia rendering limitation rather than a pipeline bug, but the visual overlay itself still needs confirming on a physical Android device. Real rep-counting/scoring accuracy also still needs a physical device with an actual person in frame, since the emulator's camera is a synthetic test-pattern feed (flagged as a known limitation before Phase 2 began).

**Full regression check after all Phase 2 native/config changes**: typecheck clean, lint clean (including all new `src/vision`/`src/domain/vision`/`src/components/vision` files), 251/251 tests passing project-wide.

## Real-time exercise form analysis — voice coaching (2026-09-16)

Highest-value gap identified when comparing this feature against premium coached-form products (Tempo, Future) rather than logging-first apps (Hevy, Strong, which have no camera-based form AI at all): a lifter mid-set can't watch the screen, so visual-only feedback (`LiveFeedbackBanner`) goes largely unseen during the set itself.

**Added**: [`voiceCoaching.ts`](../src/domain/vision/voiceCoaching.ts) — a pure, unit-tested `VoiceCoach` class deciding which single phrase to speak next from a rep completion or the current top violation. Rules: a rep completion always gets a fresh, distinct cue (the top issue's own message when the rep scored below 90, else "Nice rep."); an ongoing violation is re-announced only after a 4s cooldown so a persisting fault isn't repeated every frame; nothing is ever spoken within 1.5s of the last utterance, so cues can't stack mid-sentence. Wired into `useFormAnalysis.ts` via `expo-speech` (`Speech.speak`/`Speech.stop`, no config plugin or native permission required). A mute toggle (`speechEnabled`/`setSpeechEnabled`) is exposed from the hook and rendered as an icon button over the camera preview in `FormCameraView.tsx` — muting calls `Speech.stop()` immediately rather than only suppressing future cues.

**Verification**: 10 new tests covering the debounce/cooldown/priority rules, typecheck and lint clean, full suite green (261/261). **Not yet live-verified on device** — `expo-speech` is a native module without a config plugin, so it needs a fresh native build (Gradle autolinking) to be picked up, which was not attempted this session given how unreliable the Android emulator proved during Phase 2's on-device pass (see above). Next on-device session should confirm cues are audible and correctly timed against a real set.

## Real-time exercise form analysis — camera-angle detection & severity-aware banner (2026-09-16)

Second gap closed from the same competitive comparison: the "Side angle"/"Front angle" chip on the form-check preflight screen was purely instructional copy — nothing checked whether the lifter actually complied, so every exercise's measurements silently assumed correct camera placement.

**Added**: [`cameraOrientation.ts`](../src/domain/vision/cameraOrientation.ts) — `detectCameraOrientation()` classifies front/side/front-45 from shoulder separation relative to `getBodyScale()` (side-on, the shoulders nearly coincide in the 2D image since they're aligned along the camera's line of sight; front-on, they're clearly separated — the same distance-invariant normalization trick as `biomechanics.ts`'s `normalized*` helpers, so it holds across heights and camera distances). `isCameraAngleMismatched()` compares the detected orientation against the exercise's `recommendedCameraAngle`, treating `front-45` as compatible with either neighbor. Wired into `useFormAnalysis.ts`, debounced through the same `TemporalFilter` instance the per-exercise form rules already use, at an elevated priority (-10) so a wrong angle outranks any in-rep form fault — a bad setup undermines every other measurement. Deliberately **not** added to `repViolationsRef` (so it never counts against the rep's alignment score in `scoreRep`): it's a setup problem, not a per-rep fault.

**Caught while wiring this in**: `resetSet()` reset every other tracker (`smoother`, `velocityTracker`, now `voiceCoach`) but never `temporalFilter` — so a form rule's debounce state (and now the camera-angle key) leaked across sets. Fixed by adding `temporalFilter.reset()` to `resetSet()`.

**Also fixed while touching the violation-display path**: `FormAnalysisState.topViolationMessage` (a bare string) lost the violation's severity, so `LiveFeedbackBanner` rendered every active violation in the same red "danger" styling regardless of whether it was an `error` or a `warning` — all 5 exercise configs mix both severities. Changed the state field to carry the full `FormViolation` (`topViolation`) so the banner now renders `error` in red and `warning` in amber, matching the same color pattern already used for tracking-quality issues.

**Verification**: 7 new tests for `cameraOrientation.ts` (front/side/front-45 classification, mismatch logic, message copy). One bug caught by the tests themselves: `getBodyScale()` always returns a positive number by design (it floors to shoulder width, then to 1), so an initial `'unknown'` classification for degenerate input was dead code with an untestable branch — removed rather than shipped with a wrong test. Typecheck clean, lint clean, full suite green (**268/268 tests**). The specific separation-ratio thresholds (0.45 front / 0.22 side) are a first-pass heuristic from reasoning about typical MoveNet-normalized coordinates, not calibrated against real capture — flag for tuning once tested against an actual phone at actual gym distances.

## Real-time exercise form analysis — real-device fix: dropped Skia frame processing (2026-09-17)

**The bug**: on a physical Samsung Galaxy S24 (SM-S921B, first real-hardware test of this feature — everything prior was only verified on the Android emulator), opening the form-check camera screen threw `Uncaught Error: Exception in HostFunction: Failed to convert NativeBuffer to SkImage!` on every single frame, sourced from `useSkiaFrameProcessor.ts` inside `react-native-vision-camera` itself. Traced the exact throw site into `@shopify/react-native-skia`'s `JsiSkImageFactory.h`: `Skia.Image.MakeImageFromNativeBuffer()` — which `useSkiaFrameProcessor`'s `frame.render()` calls internally to wrap the camera's raw `AHardwareBuffer` as a drawable `SkImage` — returned null. This is a real device/GPU incompatibility, not a logic bug: this Samsung camera pipeline produces a hardware buffer format Skia's Android GPU-import path (EGL/AHardwareBuffer) doesn't recognize, and it fails on _every_ frame regardless of `pixelFormat` (confirmed VisionCamera v4's default is already `'yuv'`, the documented-safe choice — the failure is at the GPU-buffer level, below where that setting has any effect). This class of Skia/camera-hardware-buffer incompatibility is a known pain point on certain Android vendors' camera HALs, and explains the "black preview, pipeline still running underneath" behavior seen throughout the emulator testing earlier — the emulator's _software_ GPU silently swallowed the same failure instead of throwing.

**The fix**: stopped routing the live camera frame through Skia entirely.

- `useFormAnalysis.ts`'s frame processor is now a plain `useFrameProcessor` (not `useSkiaFrameProcessor`) — inference (`resize` → `model.runSync` → `decodeMoveNetOutput` → `reportLandmarks`) never touched Skia in the first place, so this is a pure subtraction: removed `frame.render()` and the `frame.drawLine`/`frame.drawCircle` calls, and the `skeletonPaint`/`jointPaint` Skia paint objects. The camera preview itself was never Skia's responsibility either — VisionCamera's native `<Camera>` view renders its own preview `Surface` regardless of what the frame processor does, so removing Skia here doesn't touch preview rendering at all.
- Added `landmarks: PoseLandmarks | null` to `FormAnalysisState`, populated every frame in `onFrameLandmarks` (the smoothed landmarks — already computed there for scoring — rather than the noisier raw ones, an incidental quality improvement over the old in-worklet drawing).
- New [`SkeletonOverlay.tsx`](../src/components/vision/SkeletonOverlay.tsx): draws the same skeleton using `react-native-svg` (already a dependency elsewhere in the app, so no new native module and no rebuild needed for this fix at all — it was hot-reloadable over the same Metro connection). Mirrors the x-coordinate by default to match VisionCamera's horizontally-mirrored front-camera preview.
- This is a strictly more portable architecture: Skia is no longer coupled to the camera's native buffer format at all, so this whole class of device incompatibility can't recur on other hardware.

**Verified on the physical Samsung device**: camera opens, permission grants correctly, live preview renders in full color (previously only ever seen as the emulator's blocky synthetic pattern), inference runs continuously at **~25 FPS** with zero errors in logcat. This was a JS-only fix — no new native module, so no Gradle rebuild was needed, just a Metro reload. Typecheck clean, lint clean, full suite green (268/268 tests unaffected, since none of this touches domain logic).

**Still open**: skeleton-overlay mirroring/alignment was implemented from reasoning about VisionCamera's standard front-camera mirroring, not yet confirmed by actually looking at a person in frame next to their live overlay — worth a visual check next real-device session. Voice cues and camera-angle detection are now running on real camera input for the first time but still need a real _person_ in frame (this test was an empty ceiling) to confirm they fire correctly.

## Real-time exercise form analysis — voice coaching confirmation loop (2026-09-25)

Following a competitive deep-dive comparing GymBroFitness against current AI-form-feedback products: **Peloton IQ** (Oct 2025) flags a fault mid-rep, then confirms on the _next_ rep whether the lifter fixed it — a materially more coach-like loop than only ever calling out faults going forward with no acknowledgment when one clears.

**Added**: `useFormAnalysis.ts` now diffs each newly-completed rep's violations against the previous rep's, right before pushing it onto `repsRef` (`fixedViolationId` — the id of a violation present last rep but absent this one). `VoiceCoach.decide()` takes this as an optional `fixedViolationId`; `repCompletionCue()` now prioritizes a still-active top issue (unchanged behavior), then a confirmed fix ("Fixed — nice adjustment."), then falls back to the existing generic "Nice rep." No new state, storage, or native surface — this composes entirely from data the pipeline already computes per rep.

**Verification**: 3 new tests (confirms a fix, prioritizes a still-active different fault over confirming an unrelated fix, stays silent about fixes when the caller reports none) — all 10 pre-existing `VoiceCoach` tests pass unchanged, confirming this was additive, not a behavior change to the existing paths. Typecheck clean, lint clean, full suite green (**366/366 tests**). Not yet verified against a real rep sequence on a physical device — same caveat as the rest of the voice-coaching feature.

**Deliberately not implemented from that same research pass**: a ghost-overlay reference-rep replay (no lifting tracker has shipped this yet, per the research — genuine differentiation opportunity) and bar-speed/velocity-loss tracking (natural extension of the existing pose pipeline) were both identified as high-value, but both need new capabilities this session didn't build — ghost overlay needs per-frame landmark _recording_ for a rep (nothing currently persists a rep's landmark trajectory, only its scores), and velocity tracking needs a linear-displacement metric distinct from the existing angular-velocity tracker. Flagging as scoped-but-not-attempted rather than silently skipping them.

## workout.tsx size regression — first extraction pass (2026-09-25)

The Sep 20 audit flagged `workout.tsx` at 1,762 lines as too large to maintain safely; by this pass it had grown to 2,340 lines instead of shrinking. Two other items from the same research-driven fix pass turned out to already be solved and weren't touched: the progression engine's rule-chain "fix" would have been a downgrade (this engine already handles deload detection, pain gating, and RIR auto-regulation that the simpler reference model doesn't), and set-row technique modifiers (drop-set/rest-pause) are already surfaced inline via an always-visible badge plus a one-tap contextual menu — the audit's framing was stale, not current-code.

**Extracted, in two verified stages, both pure moves with no behavior change:**

1. **`workout.helpers.ts`** (new, colocated with the screen) — 16 pure functions with zero dependency on the screen's live state (`countCompletedSets`, `countHandledSets`, `isExerciseDone`, `isResumableSession`, `firstOpenSetIndex`, `shortExerciseName`, `formatRest`, `autosaveIcon`/`autosaveLabel`/`formatClock`, `compactSuggestionValue`, `sourceLabel`, `buildCustomWorkoutDay`, `attachFormAnalysisResult`, `techniqueLabel`, `cameraAngleLabel`) plus the `AutosaveState` type. These were previously untestable in isolation (buried as unexported locals in a 2,340-line component); extraction is what made the 28 new tests in `__tests__/workout.helpers.test.ts` possible at all.
2. **[`WorkoutReviewBlocks.tsx`](../src/components/workout/WorkoutReviewBlocks.tsx)** (new) — the 10 presentational sub-components used by the finish/review summary (`Metric`, `AssistantFact`, `FinishMetric`, `TopExerciseRow`, `MuscleDoseRow`, `RirQualityBlock`, `FormQualityBlock`, `QualityBlock`, `ProgressionTargetPanel`, `ProgressionReviewRow`), each already taking explicit props with no closure over `WorkoutSessionView`'s state. Each component's few layout-only style objects (no color literals) were duplicated into this file's own local `StyleSheet` rather than exported/shared from `workout.tsx`, so the two files aren't coupled through a half-used styles object.

**Result**: `workout.tsx` 2,340 → 1,935 lines (17% reduction). Verified after each stage independently (not just at the end): typecheck clean, lint clean (caught and removed ~10 now-dead imports lint flagged after each move), full suite green throughout, ending at **394/394 tests** (28 new).

**Deliberately not attempted in this pass**: extracting `WorkoutSessionView`'s ~30 `useState` calls, ~20 effects/handlers, and the review-mode JSX into a `useWorkoutSession` hook — the harder, higher-value part of the original audit recommendation. That refactor means moving many interdependent closures at once with real behavioral-regression risk, and this session had no physical device or emulator connected to verify against visually — mechanical, low-risk extractions only. Worth a dedicated pass with on-device verification available.

## workout.tsx size regression — the deeper extraction (2026-09-25, same day)

Completed the harder part flagged above as not-yet-attempted, with no physical device available either — so the approach had to make the compiler the safety net instead of a human eye:

**Method**: moved literally every piece of `WorkoutSessionView`'s session-lifecycle code — ~20 `useState` calls, 3 refs, 4 effects, `useFocusEffect`, 2 `useMemo`s, and all ~25 handler functions (`updateSet`, `toggleComplete`, `endLiveWorkout`, `saveCompletedSession`, etc.) — verbatim into a new [`useWorkoutSession(day, userId, preferences)`](<../src/app/(tabs)/useWorkoutSession.ts>) hook, which returns every one of those names in one object. `WorkoutSessionView` calls the hook once at the top and destructures the same names it already referenced, so the JSX itself needed zero edits — only its top ~530 lines (state/effects/handlers) collapsed into one hook call.

**Why this was safe despite the size**: any name the JSX still needed that the hook's return object didn't yet include is a TypeScript compile error, not a silent runtime bug (`Cannot find name 'setRirTarget'`, etc.) — so `tsc --noEmit` was run after the first attempt specifically to find every miss, rather than trying to trace ~1,200 lines of JSX by eye for every reference. It caught 9 missed setters (`setRirTarget`, `setFinished`, `setSaveError`, `setNewRecordCount`, `setTemplateSaved`, `setAutosaveState`, `setLastAutosavedAt`, `setCheckInSkipped`) and one helper (`isExerciseDone`, re-imported directly from `workout.helpers.ts` instead of round-tripped through the hook, since it's a pure function with no session-state dependency) on the first pass; zero on the second.

**Result**: `workout.tsx` 2,340 → **1,443 lines total across this whole size-regression fix (38% reduction)**, split as `useWorkoutSession.ts` (694 lines, the session controller), `workout.helpers.ts` (196 lines, pure formatting/lookup functions), and `WorkoutReviewBlocks.tsx` (341 lines, presentational sub-components). Typecheck clean, lint clean (0 warnings across all four files — including cleaning up ~45 now-dead imports lint flagged after the move), full suite green, **394/394 tests unchanged** — no new tests were needed for this stage since it's a pure code-motion with no new logic, and the prior stage's 28 tests plus the rest of the suite already cover the moved behavior.

**Still not attempted**: this hook now returns ~70 properties, which is itself a sign the underlying state shape could be simplified (e.g. a reducer, or splitting "draft persistence" from "set editing" from "session lifecycle" into separate hooks) — that would be a real redesign, not an extraction, and needs its own deliberate pass rather than riding along with a "fix the size regression" task. On-device/emulator verification of the live workout flow is still outstanding, same caveat as the rest of this refactor.

## program.tsx size regression — full extraction in one pass (2026-09-25, same day)

Applied the exact same three-file pattern proven on `workout.tsx` (pure helpers / presentational blocks / state-and-handlers hook) to the Plan screen — the other file the Sep 20 audit flagged as oversized (1,224 lines then, 1,362 by this pass). Unlike `workout.tsx`, this one had a much smaller, more tractable logic surface (8 `useState`, 1 effect, 9 handlers, no refs, no autosave timers, no `AppState` listener) — low enough risk to do the full extraction in one pass rather than staging it across two sessions.

**Extracted:**

1. **`program.helpers.ts`** (new) — 12 pure functions (`formatGoal`, `formatEquipmentSummary`, `buildSwapOptions`, `computeProgramMuscleLoads`, `buildBodyData`, `summarizeDay`, `formatRepRange`, `formatRest`, `formatShortRest`, `formatTechnique`, `clamp`, `withAlpha`) plus the `SwapTarget`/`ProgramMuscleLoad` types.
2. **[`ProgramBlocks.tsx`](../src/components/program/ProgramBlocks.tsx)** (new) — the 9 presentational sub-components (`DetailCard`, `MetricBlock`, `ProgressionCockpit`, `ProgressionTargetRow`, `ProgramReadinessRow`, `ProgramExerciseRow`, `StepperControl`, `SwapPanel`, `VolumeRow`), each already taking explicit props. Caught one real duplicate during the move: a sed pass meant to point the stepper's inline clamp calls at the shared `clamp` import accidentally rewrote the local `function clamp(...)` declaration to the same name too, creating a silent duplicate — caught immediately because it's a same-file name collision, deleted the now-redundant local copy.
3. **`useProgramScreen.ts`** (new) — the screen's session/persistence logic as one hook, same "return every name the JSX already references" method as `useWorkoutSession`.

**Verification method, same as workout.tsx**: let `tsc --noEmit` find every name the JSX still needed that the hook's return object didn't yet cover, rather than tracing ~370 lines of JSX by eye. This time it was clean on the very first attempt — the smaller, simpler state shape left less room to miss a binding.

**Result**: `program.tsx` **1,362 → 623 lines (54% reduction)**, split as `useProgramScreen.ts` (209 lines), `program.helpers.ts` (153 lines), `ProgramBlocks.tsx` (628 lines — larger than the code it replaced, mostly from reformatting long single-line prop signatures for readability, not added logic). Typecheck clean, lint clean (0 warnings across all four touched/created files, first pass), full suite green, **394/394 tests unchanged** — again a pure code-motion needing no new tests.

Both files the Sep 20 audit originally flagged as oversized are now addressed. `workout.tsx`'s `useWorkoutSession` hook and this one's `useProgramScreen` share the same open item: each returns a large flat object (~70 and ~30 properties respectively), which is a legitimate signal for a future state-shape redesign (reducers, or splitting concerns into smaller hooks) — deliberately out of scope for a same-day size-regression fix.

## Extra tab-bar entries — files misplaced in the router tree (2026-09-25, same day)

On first on-device verification of the `workout.tsx`/`program.tsx` extraction (see above), the bottom tab bar showed ~10 entries instead of the intended 5. Root cause: `program.helpers.ts`, `useProgramScreen.ts`, `workout.helpers.ts`, `useWorkoutSession.ts`, and a `__tests__/` folder had all been created directly inside `src/app/(tabs)/` during the extraction, colocated with the screen files they support. Expo Router treats every file under `src/app` as a route by default — per its own documented rule ("non-navigation components live outside the `src/app` directory... if you put a non-route inside `src/app`, Expo Router will attempt to treat it like a route"), so each of these plain modules became an extra, broken tab (Metro's "missing the required default export" warnings for these exact files were visible in the logs the whole time and had been misread as harmless).

**Fix**: moved all four non-route files to a new `src/features/` directory (`src/features/program/{program.helpers,useProgramScreen}.ts`, `src/features/workout/{workout.helpers,useWorkoutSession}.ts`, test file alongside), updated the four import sites (`workout.tsx`, `program.tsx`, `useProgramScreen.ts`'s own internal import, and `ProgramBlocks.tsx` which had been reaching back into `../../app/(tabs)/program.helpers`). `src/app/(tabs)/` now contains only the 7 real routes (5 visible tabs + `profile`/`workout` hidden via `href: null`). Verified: tsc clean, eslint clean, 394/394 tests still passing (moved test file included), and confirmed on the physical device (Galaxy S24) — tab bar back to exactly Today/Plan/Body/Progress/Exercises.

This also surfaced a second, unrelated on-device issue while rebuilding: the installed dev-client APK predated `expo-notifications` being added as a native dependency, so `getPermissionsAsync` (imported eagerly by `restTimerNotifications.ts` → `useWorkoutSession.ts`) threw `Cannot find native module 'ExpoNotificationPermissionsModule'` at startup. Fixed by rebuilding the dev client (`npx expo run:android`, ~26s incremental since only the changed native link needed relinking) rather than anything JS-side — a reminder that adding a native-module dependency always needs a dev-client rebuild, not just a Metro reload.

## Body Map visual-craft pass (2026-09-25, same day)

First `/impeccable shape` pass run in this project: a discovery round (AskUserQuestion, 3 questions) confirmed scope before any code — focus on visual craft/hierarchy (not new analytical metrics), refinement of the existing screen structure (not a restructure), and Body staying one of five equal tabs (not promoted to a flagship surface). Grounding first: `body.tsx`'s data layer already had everything needed — `MuscleTrainingLoad.volume` (a full `VolumeClassification` from `classifyWeeklyVolume`, the same RP MEV/MAV/MRV classifier used on the Plan screen) was already flowing into the screen; the gap was purely presentational, not missing domain logic.

**Two changes, both consuming only already-computed data (no new domain logic, no new metrics):**

1. **The body diagram** ([body.tsx](<../src/app/(tabs)/body.tsx>)) — previously a flat `surfaceRaised` box with a plain hairline border. Now wrapped in a shadow frame (colored, non-zero offset + soft blur, tinted to the selected muscle's zone color) with a diagonal `LinearGradient` tint and a matching low-alpha border ring, so the interactive diagram — the single most distinctive visual asset on the screen — reads as a hero element rather than a boxed-in widget.
2. **The volume gauge** — previously a single-color `ProgressBar` showing only `gaugeFraction` (0 at MEV, 1 at MRV), which couldn't distinguish below-MV from maintenance from exactly-at-MEV (all rendered as an empty bar). Replaced with a new `VolumeLandmarkGauge` component: a segmented track (below_mv/maintenance/growth/frontier/excessive zones, each colored via the existing `BODY_HEAT_COLORS`) spanning 0 through past MRV, with a thin marker at the muscle's actual weekly-set position — closer to a real gauge than a loading bar, and honest about volume not being a "more is better" metric.

Verified: tsc clean, eslint clean, 394/394 tests unchanged (both changes are presentational-only), and confirmed on-device (Galaxy S24) — screenshotted both the hero diagram (visible gradient + ambient glow against the black theme) and the gauge (clean 5-zone segmentation with a visible marker at 0 sets for a fresh profile).

Also added: a minimize/expand toggle on the persistent "Resume workout" floating bar ([_layout.tsx](<../src/app/(tabs)/_layout.tsx>)) — it previously had no way to get out of the way on non-workout tabs. Tapping a new chevron collapses it to a small corner pill; tapping the pill restores it. Animated with Moti (matching `Reveal.tsx`'s existing convention) rather than an instant swap — the bar spring-shrinks toward the corner while the pill grows in from that spot, and reverses on expand — respecting `useReducedMotion` the same way `Reveal` does.

## Volume gauge reuse across Body/Plan/Progress (2026-09-26)

Checked whether the Body Map's new visual-craft treatment should extend elsewhere before assuming so — reading `analytics.tsx` (Progress) and `ProgramBlocks.tsx`'s `VolumeRow` (Plan) confirmed both still used the old flat single-color `ProgressBar` for the exact same MEV/MRV data Body just fixed, so all three screens were showing the same landmarks three different, inconsistent ways.

**Fix**: extracted `VolumeLandmarkGauge` out of `body.tsx` into a shared [`src/components/muscles/VolumeLandmarkGauge.tsx`](../src/components/muscles/VolumeLandmarkGauge.tsx), and wired it into all three call sites instead of each screen's own flat bar. Both `ProgramMuscleLoad` ([program.helpers.ts](../src/features/program/program.helpers.ts)) and analytics' local `MuscleLoad` type gained a `landmarks: VolumeLandmarks` field (previously they only kept `mev`/`mrv`, dropping `mv`/`mav`, which the segmented gauge needs) — populated straight from `classifyWeeklyVolume`'s existing return value, no new domain logic. `VolumeRow` and the Progress per-muscle rows switched from a horizontal label+narrow-meter layout to a vertical label-then-full-width-gauge stack, matching Body's layout.

Verified: tsc clean, eslint clean, 394/394 tests unchanged, confirmed on-device — Body and Plan (Plan's `muscleLoads` comes from the _program's prescribed_ sets, so it renders real segmented data regardless of logged history) both show the identical gauge. Progress's own per-muscle rows use the same component and props shape but couldn't be visually confirmed on this device — `computeMuscleLoads` there is history-driven and filters to muscles with `sets > 0`, and this profile has zero logged workouts, so the row list is currently empty (correctly falls back to its existing empty state) rather than broken.

## Papercut hunt, hook state-shape split, and velocity-loss tracking (2026-09-26)

Asked to work through the three remaining backlog items from the earlier gap-closure list (UI papercuts, the `useWorkoutSession`/`useProgramScreen` hook debt, and ghost-overlay/velocity-loss tracking). Treated each on its own merits rather than forcing equal-sized work into all three.

**Papercut hunt**: walked the actual live-workout logging flow on-device (start a set, autofill assistant, rest timer, post-workout review's "Prefill all open" and "Log N open sets" bulk actions, load validation, review↔live state transitions). Found nothing broken — a genuine, useful outcome of a hunt, not a non-result. This is also what caught the extra-tabs bug and the stale-notification-module bug from the previous session, so the hunt method itself is validated even though this pass came up clean.

**`useWorkoutSession` hook split**: re-examined the "~70 returned properties" complaint from the earlier size-regression fix. The return object's size is inherent to how `workout.tsx` consumes it and wasn't touched — shrinking it would mean restructuring `workout.tsx` too, a separate and riskier task. What _was_ real debt: 3 of the hook's 5 effects (draft autosave + AppState background-save, rest-timer OS notification sync, Form AI result attachment) were interleaved with the session's set-editing logic despite having no real coupling to it. Extracted each into its own hook — [`useWorkoutAutosave.ts`](../src/features/workout/useWorkoutAutosave.ts), [`useRestTimerNotification.ts`](../src/features/workout/useRestTimerNotification.ts), [`useFormAnalysisAttachment.ts`](../src/features/workout/useFormAnalysisAttachment.ts) — leaving the genuinely-interdependent set-mutation functions (`toggleComplete`, `fillOpenSets`, etc., which all need direct `session`/`setSession` access and call each other) together in the main hook, since those can't be cleanly separated without deep cross-hook coupling. `useWorkoutSession.ts`: 694 → 598 lines. Checked `useProgramScreen.ts` too (~30 properties) — it has one effect and no autosave/notification/focus-effect tangle, so it doesn't carry the same debt; declined to split it further rather than doing busywork to look thorough.

Verified: tsc clean, eslint clean, 394/394 tests unchanged (pure code motion), confirmed on-device — force-stopped and relaunched mid-session, watched the persisted draft correctly restore (autosave state, active exercise index) and watched a fresh "Autosaved HH:MM AM" chip appear after transitioning out of review mode, both driven by the new `useWorkoutAutosave` hook.

**Velocity-loss tracking**: the other half of the deferred Form AI item (ghost-overlay rep replay) needs new per-frame landmark-_recording_ infrastructure and can only be meaningfully verified by an actual person performing reps in front of the camera — neither is true here, so it's left deliberately untouched rather than shipping something unverifiable. Velocity-loss auto-regulation (stop-set signal from a set's concentric-speed drop) was buildable and testable without a camera: the rep state machine already threads a per-frame angular velocity through `updateRepMachine` (for phase detection) and already resolves which phase is concentric per-exercise (`concentricDirection` in `exerciseVisionConfigs`) — the only missing piece was _retaining_ the peak velocity instead of discarding it every frame.

Chain: [`repStateMachine.ts`](../src/domain/vision/repStateMachine.ts) now tracks peak |angular velocity| per rising/falling phase, resetting each rep, and exposes both in `CompletedRepTiming` → [`formScoring.ts`](../src/domain/vision/formScoring.ts) resolves the concentric one (same ternary pattern already used for `concentricMs`/`eccentricMs`) into `RepAnalysis.peakConcentricVelocityDegPerSec` → new [`velocityLoss.ts`](../src/domain/vision/velocityLoss.ts) computes % drop from the set's first measured rep and classifies a zone (`fresh`/`moderate_loss`/`high_loss`/`stop_recommended`) against a caller-supplied stop threshold (no hardcoded goal-based default — strength vs. hypertrophy work call for different thresholds, ~15-20% vs ~25-35%, and this module doesn't know the trainee's goal) → [`sessionSummary.ts`](../src/domain/vision/sessionSummary.ts)'s `buildSetSummary` surfaces the latest reading → `SetFormAnalysis.velocityLossPct` (new field) persists it onto the completed set → [`SetRow.tsx`](../src/components/workout/SetRow.tsx)'s existing "ROM · Tempo" stat line gains a third `· VL n%` entry when present.

Uses angular velocity (deg/sec) as the speed proxy, not true linear bar speed — this pipeline has no barbell/object detection, and for a single tracked joint with fixed limb length, angular velocity is monotonically related to the hand/bar's linear speed, which is all a _relative_, within-set loss metric needs.

Verified: tsc clean, eslint clean, 411/411 tests (17 new — 11 for `velocityLoss.ts`'s zone classification and baseline handling, 3 for `repStateMachine`'s peak-tracking and per-rep reset, 3 for `sessionSummary`'s threshold-sensitive zone output), confirmed the app still builds/bundles/runs with no runtime errors on-device. **Explicitly not verified**: whether real camera pose data produces sane, usable velocity numbers in practice — that needs a live test with an actual person performing reps in front of the camera, which this session could not do. Flagging honestly rather than claiming a verification that didn't happen.

## Exercise demo images + home-screen greeting (2026-09-26)

Two user-reported gaps: exercises had no visual demonstration when adding them to a plan or browsing the library (despite the app already bundling the free-exercise-db photo dataset), and the Today screen jumped straight to "Today" with no personal greeting.

**Exercise demo images.** Root cause was coverage, not missing infrastructure: [`ExerciseDemoModal.tsx`](../src/components/exercise/ExerciseDemoModal.tsx) — a fully-built full-screen 2-frame demo (start/finish position, technique cues, common mistakes) — already existed and was already wired into `custom-workout.tsx`, `program-builder.tsx`, and `library.tsx`, but only 15 of the 87 loggable catalog exercises had a reviewed photo mapping in `REFERENCE_TO_CATALOG_ID`; the rest silently fell through to "no demo available." Built a Node matching script (jaccard token-overlap over exercise names, cross-checked against equipment) to propose candidates from the 847-exercise free-exercise-db dataset, then manually reviewed every candidate — accepting equipment-adjacent-but-same-movement matches (e.g. a barbell photo for a smith-machine variant), rejecting matches that would misrepresent the movement (e.g. an upright row photo was rejected for `barbell-row`, a bent-over row). Coverage: 15 → 82 of 87 (94%). Left 5 deliberately unmapped rather than force a misleading image: `band-row`, `band-curl`, `nordic-curl`, `pike-push-up` (no accurate reference exists in the dataset) and `single-leg-calf-raise` (only candidate is a seated variant, a materially different movement).

Since several catalog variants legitimately share one photo (no machine-specific shot exists for `machine-hip-thrust`, so it reuses `hip-thrust`'s barbell photo), and the existing `REFERENCE_TO_CATALOG_ID` map is keyed by reference id (each key must be unique, so one reference id can't serve two catalog slugs), added a second map `CATALOG_IMAGE_OVERRIDES` (catalog slug → reference id) checked first in `referenceExerciseForCatalog`, rather than restructuring the original map and risking its other consumer (`loggableExerciseForReference`, library→catalog lookup, unrelated to images).

Also found the demo modal was reachable (tap a row to open it) but each row itself still showed a generic dumbbell icon instead of a thumbnail — and the Plan tab's swap-exercise panel didn't reference the modal at all. New shared [`ExerciseThumbnail.tsx`](../src/components/exercise/ExerciseThumbnail.tsx) component (thumbnail image, falls back to the dumbbell icon when no mapping exists) now renders in `custom-workout.tsx`'s and `program-builder.tsx`'s exercise-picker rows and in `SwapPanel`'s swap-candidate rows.

**Home-screen greeting.** New pure [`dailyQuote.ts`](../src/domain/motivation/dailyQuote.ts) — a small curated list, deterministic by calendar day (same quote all day, changes tomorrow) rather than random per launch, so it reads as "today's quote." `index.tsx` now shows "Hello, {displayName}" (already-captured onboarding field, previously unused on this screen) and the quote directly above "Today."

Verified: tsc clean, eslint clean, 418/418 tests (7 new — 4 for `dailyQuote`, 3 for the new `CATALOG_IMAGE_OVERRIDES` mapping and the one-reference-many-catalog-slugs case), confirmed on-device — screenshotted the Today greeting, the custom-workout exercise picker showing real thumbnails for previously-image-less exercises (Band-Assisted Pull-Up, Barbell Hip Thrust, Bench Dip, etc.), and the full-screen demo modal opening with a real photo on tap.

## Exercises library redesign (2026-09-26, same day)

The library screen (`(tabs)/library.tsx`) pinned a large "Selected Exercise" card at the top of the list's `ListHeaderComponent` — tapping a row swapped that card's content rather than opening a real detail view, so seeing the actual list meant scrolling past the card + three filter rows first, and there was no dedicated "pressed = show details" interaction.

**Restructured**: the header is now just title/count, search, and the three compact filter rows — the full scrollable list of exercises (thumbnail + name + equipment/muscle) is visible immediately below with no competing pinned card. Tapping a row opens a new full-screen `LibraryExerciseDetailModal` (matching `ExerciseDemoModal`'s established visual language elsewhere in the app: header with close button + favorite toggle, `Modal` with `presentationStyle="fullScreen"`) showing, in order: a large demo image with a Start/Finish toggle when the entry has both frames, target-muscle chip + equipment/level/mechanic chips + loggable/reference-only/Form-AI chips, the muscle body diagram plus a "Targets X — also works Y" line, numbered step-by-step instructions, and (when the entry maps to a loggable catalog exercise) a training-history link and Add-to-workout/Form-check footer buttons — reusing the same `loggableExerciseForReference`/`getVisionConfigForMovementPattern` bridge logic the old pinned card already had, just presented as an opened view instead of an always-visible one.

Verified: tsc clean, eslint clean, 418/418 tests unchanged (presentational restructuring only, no domain logic touched), confirmed on-device — screenshotted the new compact list (full "847 exercises" visible immediately), opened a reference-only entry (3/4 Sit-Up: target chip, muscle diagram, instructions, correct "no linked training history" state) and a loggable one (Barbell Bench Press - Medium Grip: confirmed the Start/Finish image toggle actually swaps frames), and confirmed Close returns cleanly to the list with no errors in logcat.

## Live-feeling exercise demo animation (2026-09-26, same day)

Asked for the two-photo demo (start/finish position) to feel like the image is performing the exercise, not a manual toggle. Built a shared [`ExerciseDemoStage.tsx`](../src/components/exercise/ExerciseDemoStage.tsx) — a continuous cross-fade between the two reference photos with a slight synced zoom, entirely shared-value driven (Reanimated, UI thread) so it stays smooth regardless of JS load — and replaced the manual `SegmentedButtons` Start/Finish toggle + `setInterval`-based autoplay in both `ExerciseDemoModal.tsx` and the new `LibraryExerciseDetailModal` with it, removing the now-duplicated frame-cycling/retry logic from both (kept a play/pause control and the retry-on-load-failure fallback, both migrated into the shared component).

First pass used a constant back-and-forth opacity fade the whole cycle, which read as a blur rather than motion — two different photos blended at 50/50 opacity just look muddy, they don't "morph." Fixed by switching to a hold–move–hold–move sequence (500ms clearly on the start photo, 650ms eased transition, 500ms clearly on the finish photo, 650ms back) instead of a continuous sine-like blend — this is what actually reads as "holding a position, then moving," matching how a real rep looks, rather than a wobble between two exposures.

Verified: tsc clean, eslint clean, 418/418 tests unchanged, confirmed on-device — screenshotted two separate moments during playback and got a clean, fully-resolved "flat position" frame and a clean "crunched position" frame (no ghosting in either, confirming the hold phases work), plus an earlier capture during the transition itself showing genuine cross-fade blending; no errors in logcat.

## Security audit against a 20-item generic checklist (2026-09-26, same day)

Given a generic "before you launch" security checklist (hide API keys, RLS, DB keys, encrypt sensitive data, server-side auth, session cookies, password hashing, rate-limit login, bot protection, parameterized queries, input validation, escape user content, file uploads, trim API responses, security headers, force HTTPS, scan dependencies, etc.). Rather than mechanically ticking 20 boxes, checked what's actually true for this codebase first — most of the list assumes a live client-server web app with user auth, and **GymBroFitness has no backend wired up yet**: `@supabase/supabase-js` is an installed dependency with zero usages anywhere in `src` (confirmed by grep), matching the earlier architecture note that it's deferred as an optional sync layer, not the primary store. Applying RLS/session-cookie/login-rate-limit advice to a backend that doesn't exist would mean inventing infrastructure, not securing code.

**Actually checked, with findings:**

- **Secrets**: no `.env` ever committed (only a blank `.env.example` template); no hardcoded API keys/tokens/private-key patterns anywhere in `src`; git history clean. `.gitignore` already correctly excludes `.env`, keystores (`*.jks`, `*.p12`), and provisioning profiles.
- **Dependency scan** (`npm audit --omit=dev`): 21 advisories (16 moderate, 5 high, 0 critical), every one traced to Expo's own build toolchain (`@expo/config-plugins`, `xcode`, `xmldom`, `js-yaml`, `browserslist`, `image-size`, `uuid` via `xcode`) — these run during `expo prebuild`/native builds on the dev machine, never inside the shipped app. `npm audit fix --force` would force breaking Expo SDK downgrades/version churn to silence advisories in tools that never reach a user's device — not worth it; noted rather than forced.
- **Untrusted input** (the one genuine "attacker-controlled data" surface this app has: backup-file import and Hevy/Strong CSV import): both already validate thoroughly — [`backup.ts`](../src/domain/portability/backup.ts)'s `parseBackup` checks schema version, source tag, date validity, cross-references profile/program ownership, rejects duplicate IDs, and validates every session/template through a schema `safeParse` before accepting it; [`workoutImport.ts`](../src/domain/portability/workoutImport.ts) validates every numeric/date field per row and fails loudly on rows that don't parse. Both were already solid before this pass.
- **SQL**: grepped for raw/concatenated SQL — the only `sql\`...\``usage in`db/schema.ts` is static schema DDL (a fixed partial-unique-index constraint), never string-built from input. No injection surface.
- **No WebView anywhere** in the app (grepped for `WebView`/`dangerouslySetInnerHTML`), which rules out the entire class of HTML/script-injection risk a hybrid app would otherwise carry.
- **Found and fixed one real gap**: `workoutHistoryToCsv`'s cell-escaping guarded against CSV structural injection (quotes/commas/newlines) but not formula injection — a workout day named e.g. `=cmd|/c calc` would be interpreted as a live formula if the exported CSV were later opened in Excel/Sheets/LibreOffice. Added a leading-character guard (`=`, `+`, `-`, `@`, tab, CR) that prefixes a neutralizing `'` on string cells only (never on numeric cells, where a leading `-` is a legitimate negative value). New test in [`backup.test.ts`](../src/domain/portability/__tests__/backup.test.ts).

**Explicitly not applicable yet** (would need inventing, not securing): row-level security, a real "DB key" beyond Supabase's already-correctly-named `EXPO_PUBLIC_SUPABASE_ANON_KEY` placeholder, server-side auth enforcement, session cookies, password hashing, login rate-limiting, bot protection, API response trimming, security headers, HTTPS enforcement at a server. All of these become real work items **when** the deferred Supabase sync layer is actually built — worth a fresh pass at that point, not now.

Verified: tsc clean, eslint clean, 419/419 tests (1 new, for the CSV formula-injection fix). No on-device check needed — pure data-transformation function, already covered by unit tests.

## Supabase client wired with secure session storage (2026-09-26, same day)

User created the actual Supabase project and gave the URL + anon key, so `.env` now holds real values (still correctly gitignored — confirmed with `git check-ignore`) instead of the blank `.env.example` template. That covers checklist item #3 ("use public db key") — the anon key is designed to be public/client-embeddable, matching the existing `EXPO_PUBLIC_` naming already scaffolded.

Built [`src/services/supabase/client.ts`](../src/services/supabase/client.ts) (an empty directory already existed at this exact path, clearly scaffolded for this in an earlier session and never filled in) — a lazy `getSupabaseClient()` getter mirroring `db/client.ts`'s `getDb()` pattern exactly (module import must never require real env vars or native modules; only calling the getter does; returns `null` when unconfigured rather than throwing, matching `.env.example`'s "runs fully in demo mode without these" promise). Used context7 to pull Supabase's current official Expo/React Native guide rather than relying on memory, since session-storage setup for RN specifically has a real gotcha: plain AsyncStorage stores the session (including the refresh token) in cleartext, and `expo-secure-store` alone can't hold it because SecureStore rejects values over ~2048 bytes and a Supabase session exceeds that. Implemented the documented fix (`LargeSecureStore`): a random AES-256 key lives in SecureStore (small, hardware-backed), the actual session ciphertext lives in AsyncStorage — so the session is never persisted in plaintext without hitting SecureStore's size limit. Addresses checklist item #9 (secure session storage).

New native dependencies: `aes-js` + `react-native-get-random-values` (the AES/CSPRNG primitives the above needs) + `@types/aes-js` (dev). `react-native-get-random-values` ships native code — same class of issue as the earlier `expo-notifications` incident this session (installed but the running dev-client APK predates it) — so rebuilt the dev client (`npx expo run:android`, 48s) before considering this done, rather than assuming a JS-only reload would pick it up.

Verified: tsc clean, eslint clean, 422/422 tests (3 new — unconfigured returns null, configured returns a real client, and the instance is memoized across calls, using `jest.resetModules()` + dynamic `require()` since the module reads env vars once at load time). Confirmed on-device after the rebuild: app boots with no crash, no "cannot find native module" error, existing screens unaffected — nothing calls `getSupabaseClient()` yet, so this is foundation only.

**Deliberately not built**: actual auth (sign-up/sign-in screens, which auth method), RLS policies (no tables exist yet to write policies against), and sync logic (what data syncs, conflict resolution with existing local SQLite history). All of these are real product/architecture decisions — which auth method, what the sync schema looks like, how conflicts resolve — not something to invent unprompted just because a security checklist item exists for them. Asked the user how they want auth to work before building further.

## Email/password auth — optional, not a gate (2026-09-26, same day)

User created the real Supabase project (URL + anon key now in `.env`, confirmed gitignored) and chose email/password auth. Built [`services/supabase/auth.ts`](../src/services/supabase/auth.ts) (thin wrappers over `signUp`/`signInWithPassword`/`signOut`/`getSession`/`onAuthStateChange`, each throwing one clear "sync is not configured" error instead of scattering null-checks everywhere) and [`hooks/useSupabaseSession.ts`](../src/hooks/useSupabaseSession.ts) (current session + live auth-state updates).

**Deliberately did not gate the app behind sign-in.** `PRODUCT.md` and the onboarding copy both state the app is local-first and "No account required" — a mandatory login screen would directly contradict that positioning, and the user only asked how sign-in should _work_, not that the app should _require_ it. Built [`AccountCard.tsx`](../src/components/settings/AccountCard.tsx) instead: an optional "Sync → Account" section in Settings (right after Identity), rendering nothing at all when `isSupabaseConfigured()` is false, and offering sign-in/create-account/sign-out only as something the user opts into for backup, never blocking any existing screen. Client-side validation (email format, 6+ char password) mirrors the existing `settings.tsx` display-name pattern (`TextInput` + `HelperText`, same styling).

## Whole-snapshot cloud sync, built and wired into Settings (2026-09-26, same day)

Asked what "sync" would even mean here, given the app already has a manual export/import (backup) feature. Answer: reuse the same backup shape as the automatic path instead of designing a second data model — one Postgres row per user (`backups`: `user_id` PK, `payload` jsonb, `updated_at`), applied as two Supabase migrations via the `mcp__supabase__*` tools against the user's real project (`ddyqwuiqgdrjicsweite`): `create_backups_table` (table + RLS, all four policies scoped to `auth.uid() = user_id`) and `backups_server_stamped_updated_at` (a `security invoker` trigger that stamps `updated_at` from the server clock on every insert/update — deliberately never client-supplied, since a device's clock can be wrong and this timestamp is the whole basis for conflict resolution). `get_advisors` confirmed no new security findings from either migration (one pre-existing, unrelated `rls_auto_enable()` warning noted, not touched).

[`services/supabase/sync.ts`](../src/services/supabase/sync.ts): `syncWithCloud(userId)` compares the remote row's server-stamped `updated_at` against this device's own locally-persisted `lastSyncedAt` marker (AsyncStorage, not the local backup's own `exportedAt`, which is always "now" and would make local look perpetually newer regardless of actual staleness) — remote newer means another device published changes, so pull + `restoreBackup`; otherwise push this device's `createBackupSnapshot()` up via upsert. Whole-blob last-write-wins was an explicit, disclosed tradeoff the user approved: a device with unsynced local edits that ends up pulling has those edits overwritten, not merged — acceptable for a single-user backup-style sync, not attempting a real merge algorithm.

Wired into [`AccountCard.tsx`](../src/components/settings/AccountCard.tsx): signed-in state has an explicit "Sync now" button. Sign-in never starts a hidden restore. If an unseen/newer cloud backup exists, the app previews its workout/template counts and asks the user to choose between restoring it or keeping this device; the copy discloses that restore merges history/templates but replaces the profile and active plan. Sync markers are namespaced per Supabase user. The two applied database migrations are checked into [`supabase/migrations`](../supabase/migrations) so the table, trigger, grants, and RLS policies can be reproduced outside the original hosted project.

One real bug hit and fixed while writing `sync.test.ts`: `jest.resetAllMocks()` in `beforeEach` silently wiped the _global_ AsyncStorage/SecureStore jest mocks set up once in `jest.setup.js` (not just this file's own local mocks), turning every `getItem`/`setItem` into a no-op resolving to `undefined` — every assertion that read a value back was failing for that reason, not a bug in `sync.ts` itself. Fixed by resetting only this file's own mock references instead of the blanket reset.

Verified: tsc clean, eslint clean, 439/439 tests (8 new for `sync.ts` — configured/unconfigured, push-when-empty, pull-on-fresh-device, pull-when-remote-is-newer, push-when-device-already-current, both Supabase-error paths, and marker-clearing). Confirmed on-device: Settings screen renders correctly with the signed-out Sign in/Create account state, no crashes, no logcat errors. **Did not sign in with the real Supabase credentials to screenshot the signed-in "Sync now" state** — submitting the actual sign-in form against a live third-party account isn't something done on the user's behalf; that step needs the user themselves.

Verified: tsc clean, eslint clean, 431/431 tests (9 new for `auth.ts` — unconfigured errors, successful sign-up with and without email confirmation, sign-in failure propagates the real Supabase error message, sign-out/getSession no-op when unconfigured, auth-state-change subscription forwards events and unsubscribes cleanly). Confirmed on-device: Settings shows the new Account card correctly (copy, Sign in/Create account toggle switches the button label, email/password fields, disabled-submit state while invalid), no crash, no errors in logcat. **Did not submit the sign-in/sign-up form myself** — creating an account on a live third-party service (even the user's own Supabase project) isn't an action to take on the user's behalf; left the actual account creation for the user to do.

User confirmed sync works end-to-end on their own device. Session continued with the two remaining items from the original three-part ask: plain-language wording and a security/deployment pass.

## Plain-language glossary for science jargon (2026-09-26, same day)

`PRODUCT.md` already commits to this ("Scientific labels need plain-language equivalents so both advanced and casual lifters can use the same product"), but nothing enforced it. Audited every `.tsx` file under `src/app`/`src/components` for the actual jargon terms this app's engine surfaces (RIR, e1RM, MEV/MAV/MRV, ROM, tempo) — not `mesocycle`/`concentric`/`eccentric`/`ACWR`, which turned out to never leak into UI copy at all, only into domain code and comments.

Two different fixes for two different problems:
- **RIR** turned out to already be well-handled at its one real input surface — [`RirPickerSheet.tsx`](../src/components/workout/RirPickerSheet.tsx) already spells out "Reps in reserve" with a "0 = failure · 5 = very easy" caption. Left the bare "RIR" chips elsewhere alone; they're referencing a concept already introduced, the same way "kg" doesn't need re-explaining every time.
- **MEV/MAV/MRV (volume landmarks), e1RM, ROM, and tempo** had zero explanation anywhere — raw abbreviations in analytics/program screens with no way to learn what they mean short of leaving the app. Built [`domain/glossary/terms.ts`](../src/domain/glossary/terms.ts) (a small plain-English dictionary, unit tested) and [`components/ui/InfoHint.tsx`](../src/components/ui/InfoHint.tsx) (a tap-to-reveal definition, `Pressable` + `hitSlop` + a `Dialog`/`Portal` matching the app's existing dialog pattern from `settings.tsx`). Wired one hint per section header rather than per number, so it's discoverable without being noisy: analytics.tsx's "Strength trend" (e1RM) and "Volume landmarks" (MEV/MAV/MRV) headers, the Plan tab's "Muscle volume" card (added an optional `titleRight` slot to `ProgramBlocks.tsx`'s shared `DetailCard` for this), and `SetSummaryCard.tsx`'s "Avg ROM"/"Avg tempo" stats from the Form-AI feature.
- Also caught and fixed a small inconsistency while in this code: `WeekLogCard.tsx`'s "Volume trend" section was captioned "Tonnage only counts completed work" right below a headline stat labeled "volume" — two words for one concept on the same card. Changed the caption to say "Volume" too.

**Real bug caught during on-device verification**: the first `InfoHint` implementation used Paper's `IconButton` sized down to 16px with a negative margin, which shrank the actual tap target enough that it was nearly untappable — confirmed by repeatedly missing it on-device and hitting the scroll view underneath instead (triggered pull-to-refresh, not the dialog). Fixed by switching to a plain `Pressable` wrapping a small `Icon`, with an explicit `hitSlop={12}` — the icon can stay visually small while the actual touch target stays generous, which is the standard fix for this exact class of bug.

Verified: tsc clean, eslint clean, 448/448 tests (2 new for the glossary dictionary). Confirmed on-device (Progress tab): both info icons render correctly next to their section headers.

## Security audit, round 2 — now that a real backend exists (2026-09-26, same day)

The first security pass (checklist item above) was done before Supabase was wired up and correctly deferred anything backend-shaped. Re-ran `get_advisors` now that `backups` + auth are real:

- **Fixed a real performance/security-adjacent finding**: all four RLS policies on `public.backups` re-evaluated `auth.uid()` per row instead of once per query (`auth_rls_initplan` advisory) — applied migration `backups_rls_initplan_fix`, rewriting each policy to `(select auth.uid()) = user_id`. Confirmed via `get_advisors(type: performance)` — zero findings after.
- **Investigated, confirmed harmless**: `public.rls_auto_enable()`, flagged again as a publicly-executable `SECURITY DEFINER` function. Read its actual definition via `execute_sql` this time instead of taking the linter's word for it — it's an `event trigger` function (`returns event_trigger`, reads `pg_event_trigger_ddl_commands()`), which only does anything when Postgres fires it automatically on `CREATE TABLE`. Called directly via its flagged `/rest/v1/rpc/rls_auto_enable` path, it has no event-trigger context to read and is a no-op. Confirmed pre-existing (Supabase's own dashboard tooling, not created by this project) and confirmed safe to leave — the linter can't distinguish "callable" from "does anything when called."
- **Cannot fix myself, needs the user**: "Leaked Password Protection Disabled" (`auth_leaked_password_protection`) — Supabase Auth's HaveIBeenPwned check for new passwords. No MCP tool exposes Auth config (only schema/SQL-level tools), so this is a Dashboard-only toggle: **Authentication → Policies → Password Security** in the Supabase dashboard for this project. One toggle, no code change needed.

## Deployment readiness pass — first real look (2026-09-26, same day)

Nothing had been done here yet: no `eas.json`, no privacy policy, a placeholder Android package name, and the Play Store's account-deletion policy created a new, concrete gap the moment real email/password accounts existed. Asked the user two questions this genuinely needed their input on (package name is permanent after first Play Console upload; whether to build account deletion now vs. later) rather than deciding either unprompted.

**Package name changed**: `com.anonymous.GymBroFitness` → `com.iordachemihai21.gymbrofitness` (user's choice, matching their GitHub handle). Confirmed no other file referenced the old id (no `google-services.json`, nothing outside the gitignored/regeneratable `android/` directory) before changing `app.json` and regenerating: `npx expo prebuild --clean --platform android`, confirmed the new `applicationId`/`namespace` landed in `android/app/build.gradle`, uninstalled the old-package-id build from the test emulator, rebuilt with `npx expo run:android` (needed `JAVA_HOME` pointed at the project's existing Homebrew `openjdk@17` again — the default `java` on this machine is still JDK 11, same gotcha as the original dev-client setup on 2026-09-10, just not persisted as a shell default since then).

**`eas.json` added** (previously didn't exist at all): `development`/`preview`/`production` build profiles, Android APK for the first two and an app bundle (`.aab`, what Play Store requires) for production, `appVersionSource: "remote"` + `autoIncrement` on production so `versionCode` is managed by EAS instead of hand-bumped in `app.json`.

**`PRIVACY.md` drafted**: accurate to what this app actually does — local-first by default, camera frames for Form Check processed on-device and never uploaded, optional Supabase account (email + the same local workout-data snapshot, opt-in only), no ads or third-party analytics SDKs (confirmed by grep — none installed). Left `[INSERT SUPPORT EMAIL]` as an explicit placeholder rather than filling in the user's personal address myself — publishing someone's personal email on a public page is their call, not mine to make for them.

**Account deletion built** (Play policy requires self-serve deletion, in-app *and* via a web page, for any app with account creation — this app now has account creation): applied migration `self_service_account_deletion`, adding `public.delete_own_account()` — `security definer`, `set search_path = ''`, and deliberately takes **no parameters**, only ever acting on `(select auth.uid())`, so there's no way to pass another user's id. `public.backups`'s existing `on delete cascade` FK to `auth.users` means deleting the auth user automatically removes their backup row too — no separate delete statement needed. Confirmed via `get_advisors` that the only new finding is the expected "callable by authenticated" warning, which is the intended, correct behavior for a self-service deletion RPC.

Wired client-side: `deleteOwnAccount()` in `services/supabase/auth.ts` (calls the RPC, throws the real error on failure), and a "Delete account" destructive action in [`AccountCard.tsx`](../src/components/settings/AccountCard.tsx)'s signed-in view — confirmation `Dialog` first (states plainly this deletes the account and cloud backup, not local device data, and can't be undone), then on confirm: delete the account, clear the local sync marker, sign out locally (a deleted user's JWT can otherwise remain technically valid until natural expiry, per Supabase's own docs — signing out locally closes that gap immediately on this device).

Also built [`account-deletion.html`](../account-deletion.html) — the web-based deletion path Play's policy separately requires, reachable without opening the app. A small static page (no backend of its own) that signs in with the same email/password and calls the same `delete_own_account()` RPC directly via `@supabase/supabase-js` from the browser, using the same public anon key already embedded in the mobile app — same threat model, nothing new exposed. Needs to be hosted somewhere (GitHub Pages, Netlify, etc.) and linked from the Play Console listing once it has a real URL.

Verified: tsc clean, eslint clean, 451/451 tests (3 new for `deleteOwnAccount`). Confirmed on-device after the package-name rebuild that the app installs and boots under the new id with no crash. **Did not test the delete-account flow against the real backend myself** — same boundary as sign-up: irreversibly deleting a real account isn't something to exercise on the user's behalf. Also did not fill in a real support email in `PRIVACY.md`/`account-deletion.html`, and did not attempt to toggle Supabase's leaked-password-protection setting (no tool access) — both need the user directly.

**Still open before this can actually ship to Play Store** (not code — content/account work only the user can do): host `PRIVACY.md` and `account-deletion.html` somewhere with a real URL, fill in a real support email in both, create a Play Console developer account if one doesn't exist, and prepare the actual store listing (screenshots, feature graphic, description, Data Safety form declaring email + fitness data collection).

## Whole-app device check + two corrections (2026-09-26, same day)

User connected their physical phone and asked for a full pass over the app plus a summary of where to look. Installed the new-package-name build on the phone (had been emulator-only), walked the entire first-run path — onboarding (Profile → Goal → Week → Setup → Plan), the generated program landing on Home with a real photo and calibration card, Settings' Account card, and the Progress tab's new e1RM `InfoHint` (tapped it live — dialog opened correctly, confirming the earlier `Pressable`/`hitSlop` fix actually works on real hardware, not just in theory). Logcat across the whole session: zero app errors, one pre-existing harmless camera-library naming warning.

**Real, non-code finding**: the phone (running a newer Android version than the test emulator) surfaced an "Android App Compatibility" warning the emulator never showed — several native libraries (`libgesturehandler`, `libtensorflowlite_jni`, `libVisionCameraResizePlugin`, `libexpo-modules-core`, `libreanimated`) aren't 16 KB-page-size aligned. Google Play has required 16 KB support for new apps/updates on Android 15+ devices since November 2025. The dialog itself only appears on debuggable builds, but the underlying alignment gap is real and will need checking (mostly a wait-on-upstream-library-versions problem) before a real Play Store submission — flagged, not fixed, since it's not something this session's code changes caused or can quickly resolve.

**Corrected a wrong claim from earlier the same day**: told the user to flip "Leaked Password Protection" under Authentication → Policies. Wrong on two counts — Supabase's own docs place that toggle under **Authentication → Sign In / Providers → Email**, not Policies, and more importantly `get_organization` confirmed this project's org (`iordachemihai434@gmail.com's Org`) is on the **Free plan** — Supabase's docs are explicit that leaked-password protection is Pro-plan-and-above only, so the user likely couldn't find it because it isn't offered at their tier, not because they were looking in the wrong place. Asked the user directly rather than assuming: they chose to stay on Free and leave it off for now (client-side password rules — email format, 6+ characters — still apply regardless), revisit if this ever nears a real public launch.

Verified: tsc clean, eslint clean, 451/451 tests, unchanged (this pass was verification and one dashboard-navigation correction, no code touched).

## Set-kind wiring + a second competitive research pass, ahead of the user's own test workout (2026-09-27)

Asked for "one last deep dive" before training on the app for real, plus a full functional test. Reviewed the live-workout critical path end to end (autosave/persistence controller, wall-clock rest timer + background notification, set validation) and found it solid, with one real gap: `PerformedSet.kind` (warmup/working/failure) already existed in the data model and was already correctly excluded from volume/progression by `completedWorkingSets()` everywhere it's used — but nothing in the UI ever let a user actually set it. Wired it into [`SetRow.tsx`](../src/components/workout/SetRow.tsx)'s existing "⋯" menu: Working set / Warm-up set / To failure, with a badge, and marking a set "To failure" now also sets RIR to 0 automatically.

Full device test on the user's phone: onboarding → generated program → logged a set (60kg × 6, live plate math correct) → RIR picker → "Fill open" set-assistant autofill → the new warm-up/failure menu (confirmed the "Failure" badge and RIR-auto-0 behavior on real hardware, not just in code) → skip/restore → progression card correctly said "no completed working sets, plan unchanged." Zero crashes or errors in logcat across the whole session.

Also did a second competitive pass (same method as before: web search across Hevy/Fitbod/JEFIT reviews). One finding turned out to be a false alarm caught before it caused any concern: Google now requires new Android apps to target API 36 (as of 2026-08-31) — checked the actual built APK directly with `aapt2 dump badging` rather than trust Expo's own docs table or a stale default in `expo-modules-autolinking`'s source, and confirmed this app already targets 36. The one real, repeatedly-cited gap across every source: **body measurements + progress photos**, the one thing every reviewed competitor has that this app didn't.

Verified: tsc clean, eslint clean, 455/455 tests. Confirmed on-device.

## Body tracking: weight, measurements, and progress photos (2026-09-27, same day)

User approved building the body-tracking gap immediately (not deferred), local-only — matching the app's local-first design, with cloud sync as a later, separate decision if ever added.

**Data layer**: two new SQLite tables, `body_measurements` and `progress_photos`, added straight to `CORE_SCHEMA_SQL` (no migration needed — brand-new tables, nothing to migrate) and following the exact id+versioned-JSON-payload shape every other table already uses. New domain modules [`domain/body/measurements.ts`](../src/domain/body/measurements.ts) (8 tracked circumference sites — neck/chest/waist/hips/biceps/thighs — plus body weight; `latestMeasurementDeltas()` compares only the two most recent entries and silently omits any site not present in both, rather than fabricating a zero) and [`domain/body/progressPhotos.ts`](../src/domain/body/progressPhotos.ts), each with a driver-agnostic `*Repository.ts` (unit tested against `createTestDb()`, same pattern as `historyRepository.ts`) and a thin async `bodyTrackingStore.ts` binding to the real `getDb()`.

**Photo storage**: new dependency `expo-image-picker` (native rebuild required). [`services/media/progressPhotoStorage.ts`](../src/services/media/progressPhotoStorage.ts) copies whatever the OS picker/camera returns into this app's own document directory (`expo-file-system`'s current `File`/`Directory`/`Paths` API, confirmed via context7 rather than assumed, since this API changed shape across recent Expo SDKs) — the original picker asset can be cache-scoped or user-revocable, so the app keeps its own durable copy, exactly like `account-deletion.html`'s "nothing leaves the device" claim needs to stay true. Deleting a photo entry also deletes that file.

**UI**: new modal route [`app/body-log.tsx`](../src/app/body-log.tsx) (log-today form: weight + a collapsible measurements grid; "since last entry" deltas; a horizontal photo strip with a pose picker dialog — front/side/back/skip — on add; history list with per-entry delete), reachable from a new icon button in the existing Body tab's header. Deliberately did not repurpose the existing "Body" tab's own content for this — that tab is about muscle-training records, a different meaning of "body" than a literal weight/photo log — kept them as separate, clearly-labeled surfaces instead of overloading one screen with two unrelated meanings of the same word.

Updated `PRIVACY.md` and `PRODUCT.md` to reflect the new local-only photo storage and the now-complete capabilities list.

Verified: tsc clean, eslint clean, 470/470 tests (15 new). Native rebuild in progress for the new `expo-image-picker` dependency; on-device verification to follow.

## Visual overhaul: from card dashboard to training log (2026-10-04)

The user asked for a total overhaul because the UI looked "too complicated and AI slop". An audit counted 142 `Card`s, 102 `Chip`s and 154 micro eyebrow labels across about 20 screens, plus duplicate Resume buttons on Today, a header with four stacked text layers before any content, a placeholder bottom sheet, and a blue/purple/pink heat palette next to the blue accent. Direction chosen: a Strong/Hevy-style training log. True neutrals, one orange accent (`#FF7A3D`), Geist plus Geist Mono, lists with hairlines instead of a card per section. Inspiration came from 21st.dev, cult-ui and anime.js. They are web Tailwind or DOM libraries, so they were used as references only, not as code (anime.js cannot run in React Native).

**Foundation** (cascades everywhere): rewritten `tokens.ts` (palette, radius scale, typography roles in Geist/Geist Mono), `paperTheme.ts` (`configureFonts`, flat elevation), and an `inputTheme` passed to every Paper `TextInput`, because MD3 derives input radius from `roundness`. Muscle heat, rank tiers and the muscle map now use a single orange ramp. New shared primitives in `src/components/ui`: `ListRow`, `Stat`, `Pill`, `Segmented`.

**Screens rebuilt** with logic, data and navigation untouched: Today, the tab bar plus active-workout bar, the live workout and its review and finished views (`SetRow`, `RestTimer`, `ReadinessCheckInCard`, `WorkoutReviewBlocks`), Plan (`ProgramBlocks`: prescription editing now sits behind a per-exercise "Edit" toggle instead of always-visible steppers), Body, Progress, Exercises plus the detail modal, Profile, Settings plus the account section, History, exercise detail, custom workout, program library, program builder, day editor, body log, onboarding, form check and Form AI summary. There are no `Card` or `Chip` usages left. Em dashes and "·" separators are gone from UI copy.

**Removed as dead code**: the 7 old home cards, `LevelCard`, `StreakCard`, `PersonalRecordCard`, `AnimatedNumber`, the `autosaveIcon` helper and the Progress bar chart, which duplicated the per-muscle rows.

`DESIGN.md` was rewritten to document the new rules: no eyebrows, no chip metadata, one raised surface per screen, the radius scale and the primitives.

**Process note**: a repo-wide `prettier --write src` reformatted about 30 domain and seed files that had never been prettier-clean. Those files were restored with `git checkout`, so this change only touches UI files.

Verified: tsc clean, eslint clean, 479/479 tests. Every tab and every secondary screen was checked on the Android emulator. Not yet seen on the physical phone.

## Original colors back, motion system, Today as a session preview (2026-10-04, same day)

The user asked for the original colors back (electric blue on cool near-black). They also said the app still looked a bit AI-generated, and wanted animations inspired by cult-ui, anime.js and 21st.dev without losing the serious gym-log feel. The palette, heat map and rank colors were restored byte-for-byte from git. Geist and the list-first structure stayed.

Research: Hevy's own docs on set rows (clear active and checked states, a vibration on PRs, rest timer in ±15 s steps) and open-source React Native workout trackers built on Reanimated. cult-ui, 21st.dev and anime.js are DOM or Tailwind libraries, so their patterns were rebuilt natively with Reanimated 4 (APIs checked against current docs through context7):
- the number ticker;
- animated tabs;
- tactile press;
- stagger;
- shimmer.

New primitives: `motion.ts`, a focus-triggered `Reveal`, `PressableScale`, `AnimatedNumber`, `ProgressLine`, `Skeleton`, and a sliding `Segmented`. Applied in these places:
- **Set completion:** left-to-right success sweep plus a check pop, the signature moment.
- **Workout screen:**
  - the progress line springs forward;
  - the active exercise slides in when you change it;
  - the exercise rail uses press-scale;
  - a skeleton replaces the restore spinner.
- **Rest timer:** spring entrance, continuous fill, a pulse when rest is over.
- **Finished screen:** count-ups and staggered sections; muscle-dose bars glide in.
- **Tabs:** icons kick with a spring and a selection haptic; the active-workout bar springs in with its own progress line.
- **Plan:** the exercise editor expands with a layout transition.
- **Bars:** the level and rank bars glide.

On Today, the "Hi, name" greeting and the three-number hero were removed because they read as the generic AI-app template. The day name is now the title. The hero lists the actual session, one line per exercise (for example "3×  Barbell Bench Press  6-10", or done/total sets while a workout is in progress), followed by the first lift's target and the Start button. The daily quote moved to the bottom in muted italics.

Verified: tsc clean, eslint clean, 479/479 tests.

## Bento dashboard pass: Home a lifter checks daily (2026-10-04, same day)

The user said Home did not look good and the other screens felt empty. Research covered:
- Dribbble and 2026 dark-mode fitness dashboard roundups;
- JEFIT, Fitbod and Lift X pieces on what lifters track daily (e1RM, weekly volume per muscle, muscle freshness, PRs, bodyweight);
- the web-only cult-ui, 21st.dev and anime.js patterns, rebuilt in Reanimated and react-native-svg.

New pure, tested domain module `domain/workouts/dashboard.ts`:
- `muscleFreshness`: worked under 24 h, recovering under 72 h, fresh otherwise;
- `weeklyVolumeSeries`: Monday-start weeks;
- `bodyweightSnapshot`.

Six new tests, 485 in total. New visuals: `Tile` (bento unit with an optional accent glow), `Sparkline` (draws itself in), `BarSeries` (staggered spring bars, tap to inspect), `ProgressRing`, `RecoveryMap` (front and back silhouettes coloured by freshness), `ExerciseStrip` (demo-image cards), `DayCard` (per-day muscle silhouette), and a live `ElapsedClock`.

Screen changes:
- **Home** became a bento dashboard:
  - today's session hero with exercise images, big stats and the first-lift target;
  - a week ring with day dots, volume and RIR;
  - a recovery map;
  - Strength (e1RM sparkline and delta) and Bodyweight (sparkline and delta) side by side;
  - an 8-week volume chart with the week-over-week change;
  - last session with best sets, recent records, and the quote last.
  Every tile opens its detail screen.
- **Progress:**
  - an all-time hero with workouts, total lifted, records and level;
  - a **lift picker**, so the e1RM chart works for any logged lift, not only the primary one;
  - every section is a tile.
- **Plan:**
  - the day pills became `DayCard`s with silhouettes;
  - the selected day is a hero with big stats and the exercise image strip;
  - `DetailCard` now renders as a `Tile`, so all Plan sections went bento in one change.
- **Body:** the weight entry tile shows the latest weigh-in with a sparkline; the map, the selected muscle and the lists are tiles.
- **Profile:** tiles.
- **Workout:**
  - a live elapsed clock in the header (minus paused time);
  - a 72 pt exercise image next to the exercise name that opens the exercise detail.

Long durations now render as "16h 55m" via `formatMinutes`.

Verified: tsc clean, eslint clean, 485/485 tests. Checked live on the user's phone through the dev client, then reinstalled the release build.

## Exercise library audit and image pass (2026-10-04, same day)

Added a new repeatable audit, `npx tsx --tsconfig tsconfig.json scripts/audit-exercise-media.ts <repdb exercises.json>`. It reports:
- where each catalog image comes from;
- reference-library gaps;
- RepDB upgrade candidates;
- every image URL in use.

Findings before this pass:
- **Loggable catalog** (98 exercises): 77 RepDB, 9 free-exercise-db photos, 12 with no image at all.
- **Reference library** (847 entries):
  - 3 entries without images (the kettlebell halo variants);
  - 5 without instructions;
  - 1 duplicate name ("Squat with band").
- **RepDB:** the free tier now has 609 exercises (601 at our pinned commit) and we used 77 of them.
- **URL health:** all 1,727 image URLs returned 200.

Changes:
- **Reviewed RepDB mappings** in `scripts/import-repdb-media.mjs` for 8 catalog exercises:
  - Incline Smith Machine Bench Press, Lower Back Extension Machine, Abdominal Crunch Machine, Close-Grip Machine Row (seated cable row) and Independent-Arm Lat Pulldown, which previously had no image;
  - Weighted Push-Up, Band Triceps Pushdown and Slider Leg Curl, which move from photos to the consistent illustration style.
  Dragon Flag and Incline Treadmill Walk now match automatically. Result: 87 RepDB, 5 photos, 5 without an image.
- **Deliberately left unmapped:** Kelso Shrug, Bayesian Cable Curl, Machine Oblique Crunch, Resistance Band Row and Resistance Band Curl. RepDB has no correct version of these, and a look-alike image would teach the wrong movement.
- **Reference twins:** the importer now also writes a `references` map. These are free-exercise-db entries whose RepDB exercise has the exact same normalized name (122 of them), and `library.ts` shows the RepDB illustration for them. The library browser no longer mixes photo styles for those exercises. All 183 new URLs return 200.
- **Attribution restored** to RepDB's required wording, "Exercise data by RepDB (repdb.co)", in Settings > Credits. The visual redesign had shortened it to "RepDB".

Verified: tsc clean, eslint clean, 485/485 tests.

## 300 more loggable exercises from the RepDB free tier (2026-10-04, same day)

The user asked for the best free source of exercise imagery. Options checked:
- ExerciseDB's free API: 1,500 GIFs, non-commercial only.
- ExerciseDB.io: 1,394 exercises, $199-599.
- RepDB Standard: animated, $499.
- MuscleWiki: video, $10-200 per month.
- wger: 917 exercises but only 378 images, CC-BY-SA.
- free-exercise-db: already in the app.

The best free option is the **RepDB free tier**: one consistent illustration style, commercial in-app use allowed with attribution, and 601 exercises at our pinned commit, of which the curated catalog used 87.

New `scripts/import-repdb-catalog.mjs` turns RepDB's strength exercises into loggable `Exercise` entries using reviewed mapping tables:
- **muscles:** anatomical names mapped to our 12 groups;
- **equipment:** RepDB equipment mapped to our `EquipmentType`, skipping rings, sleds, suspension trainers and stability balls rather than mislabelling them;
- **movement pattern:** ordered name rules, with glute kickbacks classed as hip extension, not triceps;
- **supports:** a bench or rack is added when the name implies one;
- **tracking:** holds become time-tracked, and bodyweight, band and bar work becomes reps-only.

Result: **300 exercises**, all 584 image URLs return 200. Skipped:
- 85 duplicates of curated exercises;
- 68 with no clear pattern or that are drills;
- 33 with unmappable equipment;
- 5 with no mappable muscle;
- 110 non-strength (stretching, cardio, olympic).

**Licensing:** this GitHub repo is **public**, and RepDB forbids republishing its data as a dataset. The generated `src/domain/exercises/seed/repdb-catalog.generated.json` is therefore **git-ignored** and built on `npm install` (postinstall) and before builds, so the data ships inside the app, never in the repo. An offline install writes an empty catalog and the app still builds with the curated 98. `repdb-media.json` (committed) only holds image paths for the curated set.

**Integration (`catalog.ts`):**
- `EXTENDED_EXERCISES` and `ALL_EXERCISES` were added;
- `getExercise` and `requireExercise` resolve every exercise, with curated names keeping priority in the name index;
- `availableExercises(…, { includeExtended: true })` is used only where the user picks exercises by hand: custom workouts, day editor, plan builder, Hevy/Strong import and its mapping dialog;
- the program generator, plan library and swap suggestions stay on the curated catalog, so generated plans are unchanged;
- curated exercises rank first on ties.

**Integration (`library.ts`):** extended exercises appear in the library with their images, and free-exercise-db twins link to them, so they become loggable instead of duplicated.

Numbers:
- **Loggable exercises:** 98 → **398**.
- **Library:** 1,134 entries, **1,123 with images**.
- **Exercises available to pick:** 383 with full-gym equipment, 188 with a home gym.

New scripts: `npm run exercises:repdb` (regenerate both RepDB files) and `npm run exercises:audit`.

Verified: tsc clean, eslint clean, 489/489 tests (4 new).

### Follow-up: keeping the extended catalog honest to the hypertrophy logic (same day)

The user pointed out that the whole app exists to maximize muscle growth. The first import admitted movements that would have quietly corrupted that logic if logged. Three fixes:

1. **Low-hypertrophy movements are excluded** in `import-repdb-catalog.mjs` (46 removed: carries, farmer's walks, kettlebell swings, cleans, jerks, thrusters, planks, holds, wall sits, twists, windmills, crawls). Logged sets of these would have counted as direct sets against MEV/MAV/MRV.
2. **One directly trained muscle per exercise,** matching the curated catalog's convention. The main muscle comes from the movement pattern (hinge → hamstrings, squat and lunge → quadriceps, horizontal push → chest, and so on); RepDB's other "primary" muscles become secondary, i.e. indirect exposure only. This is applied to the data, so every consumer (weekly volume, plan volume, readiness, recovery, ranks, muscle intelligence) follows the rule without code changes. The curated 98 are untouched.
3. **Visible marker:** the shared `isAutoProgrammed()` helper. The library detail says "You can log this, but automatic plans do not use it", the exercise detail explains the same, and manual pickers rank curated exercises first on ties.

Result: **265** extended exercises (363 loggable in total), none time-tracked, all single-primary.

Tests lock the rules in: single primary, no low-hypertrophy names, and `setsByMuscle` counts an extended exercise only for its main muscle. 491/491 passing.

## Chest-day feedback: one side at a time, three-tap logging, a finished workout shows up everywhere (2026-10-05)

The user trained chest/arms with the app and reported three problems.

**1. One-sided work had no home.** Bayesian curls were done 2 sets per arm, lateral raises the same, and hammer curls were done on a machine instead of dumbbells. Nobody could tell whether the load field meant one dumbbell, one side or the whole bar, so progression could compare 12 kg with 24 kg.
- `laterality.ts`: `isPerSide` resolves in order: the session choice, then the plan's `perSide`, then the exercise's `laterality`. A per-side set is **1 set** for MEV/MAV/MRV volume (each side got one set of stimulus) and **×2 for tonnage** (`performedVolumeKg`). Load and reps are always what one side did, the convention used by MyFitCoach, Steady and most trackers.
- The load column is labelled by meaning: "kg/side", "kg each" (dumbbells, kettlebells), "kg total" (barbell, EZ bar, Smith) or plain "kg" (machine or stack), with a one-line hint above the table.
- Workout screen: a "One side at a time" toggle (hidden for barbells) and **Swap**, a searchable sheet ranked by same muscles first that includes the extended library, so the machine hammer curl is one tap away. Swapping is refused once a set is logged, and the original id is kept in `replacedExerciseId`. A new session inherits last time's per-side choice.

**2. Logging took too many taps.** Rebuilt around one rule: a set can be ticked with nothing typed.
- `setFlow.ts`: ticking fills empty fields from the suggestion (last session, or the plan), effort defaults to the plan's RIR target, and **RIR 0 marks the set as failure automatically**, so nobody tags "failure" by hand.
- **Next exercise** logs every open set that has typed or suggested numbers, then moves on; on the last exercise the button becomes **Finish workout**. Sets with nothing to go on stay open rather than being saved as zeros.
- **Add set** and **Delete set** (unlogged sets only) live in the set table. `SetRow` became a single table row: set / last time / load / reps / RIR / check.
- Removed "Fill next" and "Fill all". The target panel is one tappable line, and the readiness check-in is a one-line prompt that expands.
- Typical exercise: about 3 to 4 taps (tick, tick, tick, Next).

**3. The finished workout appeared in only two places.** Root causes:
- A draft's `startedAt` came from the previous evening, which put the workout in last week. `normalizeSessionTiming` fixes this on save and on read.
- Autosave created phantom drafts, so Resume showed workouts never started (`hasSessionActivity`).
- Today was locked to plan day 0. `pickTodayPlan` maps weekdays to plan days, shows "Done for today" and points to the next session.
- Plan didn't mark done days or show last performance (`lastPerformanceLabel`).

**Found on the phone, fixed the same day:**
- Set 2's greyed suggestion was copied from set 1's pre-filled planned load (80 kg, no reps) instead of its own planned 75 kg. Now only a set actually ticked today counts as "previous set", and a remembered set missing a field borrows it from the plan.
- With a 1-30 rep plan, "Next exercise" would have logged untouched sets as 1 rep @ RIR 0. Bulk completion now trusts only typed numbers, last session, or sets done today. The plan's rep floor is a target, not a record. A single tick still uses the plan, since the lifter sees the greyed value first.
- The screen stays awake while a workout is live (`expo-keep-awake`, as Hevy does).

Verified on the phone (SM-S921B): Today shows "Done for today. Next tomorrow"; This week shows 1/6 with Monday ticked; Recovery shows chest, shoulders and biceps; Plan has Day 1 ticked with "Last: …" per exercise; Body and Progress count both workouts. tsc clean, eslint clean, 510/510 tests (13 new in `setFlow.test.ts`, plus dashboard tests).

## Lock-screen logging, RP-style set feedback, automatic warm-ups (2026-10-05, same day)

These are the top three ideas from the competitor deep dive (Hevy, RP Hypertrophy, Skulpt, Gravl).

**1. Lock-screen notification (Hevy-style Live Activity, Android).** expo-notifications cannot show a live countdown, so this is a small local Expo module, `modules/workout-live` (Kotlin, autolinked from `modules/`).
- An ongoing, silent, low-importance notification shows:
  - the exercise and set ("Dumbbell Curl · Set 2 of 3") and the numbers it will be logged with ("Next: 14 kg each × 11 reps");
  - a **live rest countdown** (chronometer), or elapsed workout time when not resting;
  - a progress bar.
- Buttons: **Log set** (only when the set can be logged without typing), **+30 s** and **Skip rest**. They come back to JavaScript as `onAction` events through a non-exported broadcast receiver.
- Content is a pure function, `domain/workouts/liveNotification.ts`, and is tested.
- Autosave writes immediately when the app is not in the foreground, because Android pauses JS timers there. A set logged from the lock screen is therefore on disk right away.
- The notification hides in review, after saving and on discard, and times out after 4 h as a safety net.

**2. Per-muscle feedback that changes set counts (RP Hypertrophy).** `domain/workouts/muscleFeedback.ts`:
- **At a muscle's first exercise** (if it was trained in the last 14 days): "since last time" — Never sore / Healed early / Just in time / Still sore. One tap.
- **After its last exercise:** Pump (Low / Moderate / Great), Workload (Easy / Right / Hard / Too much), Joints (Fine / Some / A lot). Three taps or Skip; the card also appears in Review for the last muscle.
- **Decision rules** (`setDeltaFromFeedback`):

  | Ratings | Change |
  |---|---|
  | joints "a lot", workload "too much", or still sore + hard | −1 set |
  | still sore, some joint pain, recovered just in time, hard, or great pump at a fair workload | hold |
  | recovered, and easy or just-right work | +1 set |

- **Applied at the next session for that muscle** (`applyFeedbackVolume`):
  - The change is stored as `setOffset` relative to the plan, so plan edits still apply and offsets accumulate week to week.
  - Clamped to 1–5 sets per exercise and the muscle's weekly MRV across the whole plan.
  - Added sets are spread across the muscle's exercises.
  - Each rating is applied once.
  - Two weeks off starts again from the plan.
- The session shows why: "One more set today. It recovered with room to spare, so one set is added."

**3. Warm-up calculator (Hevy).** `domain/workouts/warmup.ts`, with a "Warm up (n)" button on the exercise:

| Exercise | Ramp |
|---|---|
| First compound for a muscle | 50% × 8, 70% × 5, 85% × 2 |
| Compound, muscle already warm | 60% × 6, 80% × 3 |
| First isolation for a muscle | 50% × 10, 75% × 5 |
| Isolation, muscle already warm | 60% × 8 |

- Loads are rounded to what the equipment can make: an empty 20 kg bar, a 10 kg EZ bar, 2 kg dumbbells, or the machine increment. Steps that collapse onto each other are dropped.
- Warm-ups get a 60 s rest, no RIR, never count for volume or progression, and **don't shift which working set is compared with last time**: history and plan lookups now use the working-set index.

Verified: tsc clean, eslint clean, 534/534 tests (+24: warm-up 7, muscle feedback 11, live notification 6).

## Learned load jumps and smarter supersets (2026-10-05, same day)

These are ideas 4 and 5 from the deep dive.

**4. Load jumps learned per lifter and per exercise (Gravl-style).** `domain/progression/learning.ts`:
- **What it learns from:** every past load increase on an exercise is checked after the fact. A jump **held** if every working set at the new load still reached the rep floor; its margin is the lowest reps minus the floor.
- **The three modes:**

  | Mode | When | Effect on the engine (step 9, rule version 3) |
  |---|---|---|
  | `early` | The last two jumps both held with ≥ 2 reps to spare | Load goes up when every set is within one rep of the top and at least one reached it (`TOP_OF_RANGE_LEARNED_EARLY`) |
  | `patient` | The last jump missed, or 2 of the last 3 did | Hitting the top once holds the load (`CONFIRM_BEFORE_LOAD`); it goes up after a second session at the top at the same load |
  | `standard` | Otherwise | Unchanged double progression |

- **Scope:** it only changes *when* load goes up, never the increment or the safety rails. Pain holds, missing RIR, deloads and the 10% cap still come first.
- **Visible to the lifter:** the exercise page shows "Load jumps held: 3 of 4. Next jump comes a rep early." and the explanation says why. `supportingMetrics` records `loadJumpsHeld` and `loadJumpMode`.

**5. Supersets (Hevy-style auto-advance), fixed and labelled.**
- **Auto-advance** to the partner after each set already existed, but it skipped rest on *every* move inside a chain, including the wrap from B back to A. A superset is A1, B1, rest, A2, B2, rest: moving forward in the round is back-to-back, and wrapping to the start of the chain now starts the rest timer. The old test encoded the bug and was corrected.
- **Warm-up sets** never jump to the partner; they are done in a row first.
- **Round label** under the exercise name: "Superset, round 2 of 3, with Lat Pulldown".

Verified: tsc clean, eslint clean, 541/541 tests (+7: learning 5, superset 2).

## Left/right logging, Health Connect, one side in the plan (2026-10-05, same day)

These are ideas 6, 7 and 8 from the deep dive.

**6. Left and right logged separately (imbalances).** `domain/workouts/sides.ts`:
- **How to turn it on:** on one-side-at-a-time exercises, "Log each side" splits the reps field into L and R. The header reads "L / R", and the next session remembers the choice.
- **`reps` stays the weaker side** (min of L and R), so double progression asks the weaker side to earn the next load. This is the standard advice for fixing an imbalance.
- **Tonnage** uses the real L + R reps instead of ×2.
- **Filling:** ticking an empty split set fills both sides from last time; "Last" shows "12 kg × 10/8"; the lock-screen notification shows "L10 R9".
- **Exercise page, "Left vs right"** (last 6 sessions with both sides): total L and R reps and which side is behind and by how much. Within 5% counts as balanced. The advice is to start with the weaker side and stop the other at the same reps.

**7. Android Health Connect.**
- `react-native-health-connect` 4.1.3. Its Expo module registers the permission delegate itself, so `MainActivity` is untouched.
- `app.json` adds only the 3 permissions used: READ_WEIGHT, READ_HEART_RATE and WRITE_EXERCISE. The plugin adds the privacy-rationale intent filter and the Android 14 activity alias.
- **Profile card "Health Connect":** connect (the lifter picks what to share in the system screen), see what is on, import weight now, manage access, disconnect. Hidden where Health Connect does not exist; "Get Health Connect" when it needs installing.
- **Weight → Body tab:**
  - One entry per local day, the latest weigh-in; readings outside 25–350 kg are ignored.
  - A weight typed in the app always wins; a day with only tape measurements gets the weight added.
  - Synced on Body tab focus, at most every 6 h, looking back 180 days.
- **Heart rate:** average and max during the workout are read on save (3 s timeout, so it never delays saving). Shown on the finish screen and in history ("142 bpm avg").
- **Workouts out:** saved workouts are written as STRENGTH_TRAINING exercise sessions.
  - The start is 5 min before the first set, the same rule as the draft-timing fix.
  - `clientRecordId` is `gymbro-<workout id>`, so re-exports replace instead of duplicating.
- **Pure rules** live in `domain/health/healthSync.ts` and are tested; `services/healthConnect.ts` swallows every native failure.
- **Fixed in passing:** the body log used the UTC date, so a 01:00 weigh-in in Romania landed on the previous day. It now uses `toDateOnly`, the phone's local date.

**8. "One side at a time" in the plan editor.** The exercise editor has a checkbox, hidden for barbell lifts. The row shows the tag, and sessions open that way: the plan's `perSide` comes after the session choice and before the exercise default.

**Build notes:**
- `expo prebuild` regenerates `android/` (gitignored) and deletes `android/local.properties`. Recreate it with `sdk.dir=$HOME/Library/Android/sdk`.
- The release build needs a JDK of 17 or newer: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. The system default is Corretto 11.
- Signing stays the template debug keystore. Before `adb install -r`, compare certificates with `apksigner verify --print-certs`: a mismatch would force an uninstall, which wipes the phone's data.

Verified: tsc clean, eslint clean, 556/556 tests (+15: Health Connect 7, sides 8).
