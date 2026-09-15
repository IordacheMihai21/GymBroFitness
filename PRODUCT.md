# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

GymBroFitness serves lifters who already train with intent and want a fast, trustworthy way to run hypertrophy-focused gym sessions. It must also work for people who do not care about training terminology and simply want to track what they lifted, beat the right target, and see progress without friction.

## Product Purpose

The product is a local-first training tracker and program cockpit for muscle growth. Success means the user can open the app, know what to train, log the session quickly, and later inspect progress, fatigue, records, and muscle-specific training dose.

## Positioning

GymBroFitness combines a simple workout logger with an evidence-aware hypertrophy engine: programs, progression, RIR, volume landmarks, muscle fatigue, records, and a body map all draw from the same logged training data.

## Operating Context

The app is used on a phone in the gym, often between sets, with one hand, low patience, and high need for legible targets. The same user may later review analytics at home and inspect program logic, exercise substitutions, muscle ranks, and recovery signals.

## Capabilities and Constraints

Confirmed capabilities include generated hypertrophy programs, active workout logging, RIR input, rest timer, local SQLite workout history, personal records, analytics, exercise atlas, interactive body map, local settings, and saved workout templates. Authentication, onboarding, Supabase sync, program editing, and import/export are planned but not complete.

## Brand Commitments

The app name is GymBroFitness. The working visual direction is dark-first, premium, predominantly black, with blue as the main accent and selective heat colors for muscle state. The interface should feel serious, high-performance, and practical rather than cute, social, or generic.

## Evidence on Hand

The repo contains the current Expo/React Native app, domain tests, research/product plan at `docs/RESEARCH_PRODUCT_PLAN.md`, local SQLite persistence, generated exercise catalog, workout history logic, and multiple implemented screens under `src/app`.

## Product Principles

- Keep the gym workflow faster than paper notes.
- Put training science in the engine, not in the user's way.
- Let advanced users inspect the rationale behind progression, fatigue, and volume decisions.
- Make the same data power Home, Workout, Body, Analytics, Atlas, Profile, and Program.
- Prefer local-first reliability before cloud features.

## Accessibility & Inclusion

The app should preserve high contrast, large touch targets, clear labels, and readable dense data on mobile screens. Scientific labels need plain-language equivalents so both advanced and casual lifters can use the same product.
