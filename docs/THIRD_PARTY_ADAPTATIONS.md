# Third-party adaptations

## Strong and Hevy CSV import contract

- Reference: `gossamr/swift-workout-importer`
- Repository: https://github.com/gossamr/swift-workout-importer
- Reviewed: 21 September 2026
- License: MIT
- Upstream material used: README schema notes describing Strong and Hevy export columns, RFC4180 behavior, units, dates, set types, RPE and repeated exercise passes.
- Local files: `src/domain/portability/csv.ts`, `src/domain/portability/workoutImport.ts`
- Adaptation: independently implemented in TypeScript for GymBroFitness domain models. No Swift source file is copied. The local importer maps only unambiguous exercises into the curated catalog, converts external loads to canonical kg, uses deterministic IDs for idempotent re-import, and reports unmapped or invalid rows before persistence.

Strong and Hevy are trademarks of their respective owners. This integration handles files exported by the user and is not affiliated with or endorsed by either service.
