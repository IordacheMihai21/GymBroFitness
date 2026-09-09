# GymBroFitness

Expo/React Native fitness app focused on science-informed hypertrophy programming. The current codebase contains an Expo configuration plus a framework-free TypeScript domain layer for exercise selection, program generation, workout analytics, readiness checks, and progression decisions.

## Features

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
