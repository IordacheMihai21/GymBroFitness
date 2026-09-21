# GymBroFitness

Expo/React Native fitness app focused on science-informed hypertrophy programming. The current codebase contains an Expo configuration plus a framework-free TypeScript domain layer for exercise selection, program generation, workout analytics, readiness checks, and progression decisions.

## Features

Implementation roadmap: [integrated implementation plan](docs/IMPLEMENTATION_MASTER_PLAN.md), combining the technical/design audit and fitness research. Research and domain-rule rationale: [fitness knowledge base](docs/FITNESS_KNOWLEDGE_BASE.md) and [fitness application plan](docs/FITNESS_APPLICATION_PLAN.md), reviewed September 20, 2026. These plans distinguish proposed changes from implemented behavior.

- Exercise catalog grouped by muscle, movement pattern, equipment, difficulty, and tracking type.
- Program generator that builds full-body, upper/lower, upper/lower/full-body, and push/pull/legs splits from user preferences.
- Preference-aware exercise selection for equipment, experience level, muscle priorities, preferred exercises, disliked exercises, exclusions, and discomfort flags.
- Session time budgeting that trims optional exercise slots before core movements.
- Double-progression engine using rep ranges, RIR, load increments, deload signals, and pain/readiness guardrails.
- Workout analytics for working sets, volume load, estimated one-rep max, muscle set distribution, and personal records.
- Optional Supabase configuration for backend persistence when the app shell uses it.

## Tech Stack

- Expo 57 and React Native 0.86
- React 19 and Expo Router
- TypeScript
- Supabase client
- TanStack Query
- Zustand
- Zod and React Hook Form
- Jest and Testing Library for React Native

## Project Structure

```text
src/domain/exercises/       Exercise definitions, catalog, seed data, and replacements
src/domain/programs/        Split templates, program generation, and programming defaults
src/domain/progression/     Progression constraints, engine, and explanations
src/domain/workouts/        Readiness checks and workout analytics
src/types/                  Shared app/domain types
src/utils/                  IDs, dates, and unit helpers
src/theme/                  Design tokens
assets/                     Expo icons, splash images, and app assets
```

## Requirements

- Node.js
- npm
- Expo tooling through the package scripts
- iOS Simulator, Android Emulator, Expo Go, or a physical device
- Optional Supabase project

## Environment Setup

The app can run in demo mode without Supabase credentials. To connect Supabase, copy the example file:

```sh
cp .env.example .env
```

Then fill:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Only use public Expo variables for client-safe values. Do not place service-role keys or private backend secrets in the mobile app environment.

## Install

```sh
npm install
```

## Run

```sh
npm start
```

Platform-specific commands:

```sh
npm run ios
npm run android
npm run web
```

### Camera/Form AI feature needs a dev-client build, not Expo Go

Most of the app runs fine in plain Expo Go. The real-time form-analysis feature (`src/vision/`, `src/components/vision/`, the `/form-check` route) uses native modules — `react-native-vision-camera`, `react-native-fast-tflite`, `react-native-nitro-modules`, `react-native-worklets-core` — that Expo Go does not include. Opening Expo Go and navigating to that screen fails with `react-native-vision-camera is not supported in Expo Go!`. You need a custom **development build** instead:

```sh
npx expo run:android              # emulator, or a device already selected by adb
npx expo run:android --device <serial>   # a specific device from `adb devices`
```

If `--device <serial>` doesn't match, set `ANDROID_SERIAL=<serial>` as an env var instead and drop the flag.

Gradle needs **JDK 17+**. If you see `Gradle requires JVM 17 or later`, point `JAVA_HOME` at Android Studio's bundled JDK before building:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Rebuild (`npx expo run:android`) any time a new native module is added — plain JS/TS changes just hot-reload through the already-installed dev-client via Metro.

### Connecting a dev-client build without USB

A dev-client fetches its JS from Metro over the network, so it needs to reach your machine:

- **Over USB**: `npx expo run:android --device <serial>` sets up an `adb reverse tcp:8081 tcp:8081` tunnel automatically. If the cable is ever unplugged/replugged, that tunnel drops and the app hangs on its splash screen until you run `adb reverse tcp:8081 tcp:8081` again.
- **Over Wi-Fi (no cable needed)**: put your Mac and phone on the *same Wi-Fi network*, then force one connection via the LAN address (find your Mac's IP with `ipconfig getifaddr en0`):
  ```sh
  adb shell am start -a android.intent.action.VIEW \
    -d "gymbrofitness://expo-development-client/?url=http%3A%2F%2F<mac-lan-ip>%3A8081"
  ```
  After that first successful connection it's remembered, and future launches just work over Wi-Fi — no USB, no tunnel command.
- Watch out for **Expo Go**: an `exp://` link can open Expo Go instead of the dev-client. Always launch the actual **GymBroFitness** icon on the device, not Expo Go — Expo Go can never run the camera feature (see above).

### Standalone testing (no Metro, no Mac at all)

For a build that needs nothing running on this machine — e.g. handing the phone to someone else — build the **release** variant instead of debug. Release bundles the JS directly into the APK at build time:

```sh
npx expo run:android --variant release --device <serial>
```

This takes noticeably longer than a debug build (it compiles native code for all 4 Android CPU architectures instead of just the one your device needs), but the installed app is fully standalone afterward. Rebuild+reinstall whenever you want that standalone copy to reflect newer code.

## Quality Checks

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
```

## Current Development Notes

- The domain engine is the main implemented area in this checkout.
- The previous sample Expo screens are removed in the current working tree, so app startup depends on the active UI shell being present or restored.
- Programming logic is deterministic where possible so generated plans and progression decisions are explainable and testable.
