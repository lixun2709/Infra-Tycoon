# Implementation Report: Day 4 (Infrastructure Career Mode)

## 1. Gameplay Summary
The simulation has evolved from an open sandbox into a structured hyperscaler startup experience. Players now start with $100,000 (down from $1,000,000) and must secure service contracts or corporate debt to expand their datacenter infrastructure.

## 2. Implementation Summary
- **Banking & Debt System**: Introduced a new `BankLoan` entity in the economy slice.
- **Corporate Banking UI**: Expanded the `EconomyDashboard.tsx` to include a dedicated tab for managing capital and debt.
- **Bankruptcy Mechanics**: The simulation tracks consecutive negative months, freezing procurement if the enterprise becomes insolvent.

## 3. Architectural Impact
- No changes to the core ECS simulation rendering. The economy operates securely within the main thread's `processEconomyTick`.
- Added state fields to `useInfraStore.ts` to persistently track `loans`, `consecutiveNegativeMonths`, and `isBankrupt`.

## 4. Gameplay Impact
- Players must now weigh the cost of expansion against the reality of monthly debt interest. Overextending with a "Hyperscaler Mega-Debt" loan will require significant MRR (Monthly Recurring Revenue) to avoid bankruptcy.
- Gating hardware purchases when balance is negative ensures consequences for poor financial planning.

## 5. Scalability & Performance Notes
- The loan processing runs inside the existing once-per-month (every 3600 real-time seconds) tick check. This has absolutely zero impact on frame-to-frame FPS or worker-thread synchronization.

## 6. Operational Realism Improvements
- Datacenters run on massive capital expenditure (CapEx) and operating expenses (OpEx). Simulating the debt required to build new server halls perfectly aligns with enterprise operational realities.

## 7. Immersion Improvements
- Receiving a "DEBT SERVICING" alert when money is automatically drafted from the corporate account creates a realistic sense of financial pressure.

## 8. Documentation Synchronization
- The `walkthrough.md` has been updated with the new workflows.
- `Game_plan.md` has been updated to mark Day 4 complete.

## 9. Manual Verification Steps
1. Open the Economy Dashboard (Finance & Logistics).
2. Navigate to the **Corporate Banking** tab.
3. Accept the **Startup Seed Capital** loan.
4. Verify the enterprise balance instantly increases by `$50,000`.
5. Observe the monthly payout deduction for debt servicing at the end of the simulation month.
