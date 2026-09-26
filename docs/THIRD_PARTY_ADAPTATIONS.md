# Third-party adaptations

## VisionCamera Android frame backpressure

- Dependency: `react-native-vision-camera` 4.7.3
- Repository: https://github.com/mrousavy/react-native-vision-camera
- Reviewed: 22 September 2026
- License: MIT
- Patch tooling: `patch-package` 8.0.1, MIT
- Local files: `patches/react-native-vision-camera+4.7.3.patch`, `package.json`, `src/components/vision/FormCameraView.tsx`, `src/vision/useFormAnalysis.ts`
- Adaptation: the Android ImageAnalysis backpressure strategy is changed from `BLOCK_PRODUCER` to CameraX `KEEP_ONLY_LATEST`. Form analysis needs a current pose sample, not every camera frame, so stale frames may be discarded safely when inference is slower than capture. The app also requests a low-resolution/low-FPS camera format where hardware supports it, delays the frame processor briefly after resume, caps inference at 5 FPS, and reports rolling development metrics. The patch is reapplied after dependency installation by the `postinstall` script.
- Validation: an arm64 Android debug build was compiled and installed. Sustained emulator processing and three Home/Recents cycles completed without an application crash or application-process `maxImages`/`Unable to acquire` errors, including under deliberately slow emulator inference. Physical-device temperature, battery, and Samsung resume regression remain separate acceptance checks.

## Expo local notifications

- Dependency: `expo-notifications` 57.0.20
- Repository: https://github.com/expo/expo/tree/sdk-57/packages/expo-notifications
- Reviewed: 22 September 2026
- License: MIT
- Local files: `app.json`, `src/services/restTimerNotifications.ts`, `src/components/workout/RestTimer.tsx`
- Adaptation: only the local scheduling, permission, and Android channel APIs are imported. Push-token/Firebase APIs are intentionally excluded because the rest timer is local-first and does not require an account, backend, or network connection. A declined permission leaves the in-app deadline authoritative, shows a concise fallback, and is not requested again on every set.

## Free Exercise DB reference demonstrations

- Reference: `yuhonas/free-exercise-db`
- Repository: https://github.com/yuhonas/free-exercise-db
- Commit reviewed: `a859101d633a01c4a1a920d6a8ce41dabba0705f`
- Reviewed: 22 September 2026
- License: Unlicense / public domain (`LICENSE.md` in the upstream repository)
- Upstream material used: structured exercise metadata, instructions, and the two start/finish reference images exposed by the dataset.
- Local files: `src/domain/exercises/seed/library.json`, `src/domain/exercises/library.ts`, `src/components/exercise/ExerciseDemoModal.tsx`
- Adaptation: the existing 847-entry reference dataset remains separate from the smaller loggable catalog. Only explicit mappings or exact canonical-name matches may supply a visual reference. The custom program builder presents the two images as a controllable start/finish demonstration and keeps the local catalog's reviewed technique cues and mistakes. Runtime image URLs are pinned to the reviewed commit and use on-device disk caching plus an explicit retry. If imagery is absent or unavailable, the user gets a cue-based fallback and can still add the exercise.

No Hevy, Strong, or other proprietary application imagery, copy, or code is included in this flow.

## Strong and Hevy CSV import contract

- Reference: `gossamr/swift-workout-importer`
- Repository: https://github.com/gossamr/swift-workout-importer
- Reviewed: 21 September 2026
- License: MIT
- Upstream material used: README schema notes describing Strong and Hevy export columns, RFC4180 behavior, units, dates, set types, RPE and repeated exercise passes.
- Local files: `src/domain/portability/csv.ts`, `src/domain/portability/workoutImport.ts`
- Adaptation: independently implemented in TypeScript for GymBroFitness domain models. No Swift source file is copied. The local importer maps only unambiguous exercises into the curated catalog, converts external loads to canonical kg, uses deterministic IDs for idempotent re-import, and reports unmapped or invalid rows before persistence.

Strong and Hevy are trademarks of their respective owners. This integration handles files exported by the user and is not affiliated with or endorsed by either service.

## Mobile workout UX research

Reviewed on 21 September 2026 for interaction patterns only. No source code, assets, copy, branding, screenshots, or visual identity were copied into GymBroFitness.

- **Hevy** — official feature pages, help center, and App Store listing. Useful patterns: one-tap workout entry, previous-set visibility, clear routine hierarchy, and advanced detail kept behind the primary logging flow. Proprietary product; design reference only.
- **Strong** — official product and App Store pages. Useful patterns: notebook-like logging, low visual noise during a session, explicit timers, and progressive disclosure for advanced controls. Proprietary product; design reference only.
- **FitNotes** — official Google Play listing. Useful patterns: quick daily-log navigation, direct access to history while logging, simple routines, and clean backup/export affordances. Proprietary product; design reference only.
- **`hasaneyldrm/logpress-public`** — https://github.com/hasaneyldrm/logpress-public at commit `783879b9bc599e4d2e7c462bf6b8201da16e13a2`, MIT. Inspected its public screenshots and screen structure; no local code or assets were used.
- **`JanSzewczyk/workout-tracker`** — https://github.com/JanSzewczyk/workout-tracker at commit `49a2af5741c2bdfeac45f37c69b3cc364a8786eb`. The README declares MIT, but the inspected checkout did not include a standalone license file; treated as inspiration only and no code was reused.
- **Skulpt, LibreFit, and wger** — reviewed as local-first/open-source product references. Their GPL/AGPL licensing makes direct code reuse a distribution decision, so this UI pass used them only to compare information architecture and offline-first status communication.

The resulting changes retain GymBroFitness's black/blue visual system, muscle map, progression explanations, and local-first behavior. The adaptations are limited to clearer hierarchy, plainer labels, larger touch targets, and faster access to the set logger.
