# Type Hardening & Technical Debt Backlog

## Current Status
- Zero TypeScript compiler errors.
- Strict null checks enforced in ECS core.
- Store slices decouple successful.

## Backlog Items
- [ ] Migrate any remaining generic Record<string, any> payloads to strict Zod schemas for save file validation.
- [ ] Implement strict discriminated unions for all network packet types.
- [ ] Replace any implicit any returns in testing utilities.
- [ ] Audit React Context providers to ensure no stale closure references.
- [ ] Abstract magic strings in terminal command registry to strongly typed Enums.
