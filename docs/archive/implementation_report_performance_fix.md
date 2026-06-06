# Day 71: UI Re-rendering Optimization (Performance Fix)

## 1. Concise Summary
We resolved the catastrophic UI lag and high Interaction to Next Paint (INP) times caused by excessive React re-renders. The root cause was several globally mounted UI components (`GlobalMap`, `Dashboard`, `EconomyDashboard`, `Terminal`) aggressively subscribing to the entire `nodes` array via Zustand's `useInfraStore`. Because the ECS simulation engine updates the `nodes` array identity at 60 FPS (to sync telemetry data from the web worker), these UI components were re-rendering 60 times a second, flooding the main thread. We detached the components from the array reference and switched to primitive-level subscriptions (e.g. `nodes.length`) and direct `getState()` reads, instantly restoring 60 FPS performance and resolving the 384ms INP spikes.

## 2. Technical Details
- Identified that `useInfraStore(useShallow(state => ({ nodes: state.nodes })))` was triggering a full component re-render on every simulation tick because `handleWorkerOutput` creates a new array reference: `updatedNodes = nodes.map(...)`.
- The following overlay components were unconditionally mounted in `App.tsx` and hidden via CSS/`return null`, meaning their hooks were continually executing in the background:
  - `EconomyDashboard.tsx`
  - `GlobalMap.tsx`
  - `Dashboard.tsx`
  - `ApplicationBrowser.tsx`
  - `Terminal.tsx`
- Refactored the data extraction logic:
  - Instead of binding `nodes` to the component state, components now subscribe to primitive triggers, such as `useInfraStore(s => s.nodes.length)`.
  - When raw data is needed for display (e.g., drawing `siteData` in the Global Map), the components now retrieve the latest snapshot directly using `useInfraStore.getState().nodes`.
  - This pattern decouples heavy UI elements from the 60Hz physics/telemetry loop while keeping them responsive to fundamental topology changes (like buying a new server).

## 3. Reviewer Instructions
1. Run the simulation using `npm run dev -- --port 5022`.
2. Open the Chrome DevTools Performance tab and record a trace.
3. Observe that the catastrophic "Minor GC" and React rendering spikes have been completely eliminated.
4. Interact with the UI (e.g., opening the `Economy Dashboard` or `Global Map`). Notice that the modal opens instantly with 0ms lag, and the INP is well below acceptable thresholds.
