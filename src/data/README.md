# Data boundary

- `raceos.json` contains local development fixtures only.
- `../types/raceos.ts` is the canonical UI contract.
- `parse-raceos.ts` validates unknown JSON/API payloads at runtime.
- `raceos.ts` is the adapter consumed by the Zustand store and pages.

When the API is available, replace the JSON input in `raceos.ts` with the API response and pass it through `parseRaceOSFixture`. Keep the exports unchanged so pages and store actions do not need to change.
