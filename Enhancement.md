# Infra-Tycoon Enhancement Roadmap

## Executive Summary

The current codebase provides an excellent foundation for a data center simulation game. Based on analyzing the architecture, this document outlines enhancements to achieve the vision of a gamified 3D data center learning experience with realistic hardware, networking, and configuration workflows.

## 🚀 Core Vision Alignment

### Current Strengths
- Robust Zustand state management with persistence
- Realistic 3D scene using React Three Fiber
- Comprehensive hardware catalog with enterprise specs
- Terminal-based kernel for hardware management
- Power/thermal simulation engine
- Network patching system

### Target Vision Gap Analysis

| Requirement | Current State | Target State | Priority |
|-------------|---------------|--------------|----------|
| Realistic cable visualization | Basic connections | Dual-layer cables with data flow | 🔴 HIGH |
| 3D mounting mechanics | Instant placement | Physics-based mounting | 🔴 HIGH |
| Learning progression | Manual only | Guided tutorials + sandbox | 🟡 MEDIUM |
| Cable routing simulation | None | Realistic cable management | 🔴 HIGH |
| Service installation flow | Terminal-based | Visual + terminal hybrid | 🟡 MEDIUM |
| Hardware lifecycle realism | Basic aging | Component-level simulation | 🟢 LOW |

## 🔧 Phase 1: Realistic Cables & Networking (PRIORITY 1)

### 1.1 Dual-Layer Cable System
**Current Issue**: Connections are simple lines without visual feedback
**Component**: `/src/components/world/Scene.tsx`, `/src/store/useInfraStore.ts`

```typescript
// New Connection Interface
interface CableConnection extends Connection {
  visualComponents: {
    outerSheath: string;  // Cable jacket color by type
    innerFlow: 'idle' | 'active' | 'error';
    dataFlow: {           // Visual data packets moving
      packets: Array<{
        position: number;  // 0-1 along cable length
        size: number;
        color: string;
      }>;
    };
  };
  validationState: 'untested' | 'validated' | 'miswired';
}
```

**Implementation Steps**:
1. Create `CableSystem.tsx` component in `/src/components/world/`
2. Implement shader-based cable rendering with inner/outer layers
3. Add data packet flow animation using Three.js instanced meshes
4. Port type validation (network-power mismatch = visual error)
5. Bandwidth throttling visualization (saturated = red glow)

**Visual Requirements**:
- Power cables: Black/gray outer, no inner flow
- Network cables: Blue outer, green flowing data when active
- FC/SAS cables: Orange outer, amber flowing data for storage
- Cable bundles should merge when parallel (reduces visual clutter)

### 1.2 Cable Routing & Management
**New Feature**: Physical cable routing constraints
**Files to create**: `CableManager.tsx`, `CablePhysics.ts`

**Core Mechanics**:
- Cables must route through cable management arms (if equipped)
- Length limitations (cannot connect across rooms without extenders)
- Cable collision detection (can't pass through other hardware)
- Rack-level cable management:
  - Front rack: Network/storage
  - Rear rack: Power only
  - Side channels: Cross-rack connections

**Implementation**:
```typescript
// Cable routing validation
checkCablePath(from: Vector3, to: Vector3, obstacles: InfraNode[]): boolean {
  // A* pathfinding avoiding hardware collision boxes
  // Return valid path or show "Cable too short" error
}
```

**UI Elements**:
- Cable deployment preview (ghost cable showing proposed path)
- Cable length counter and distance UI
- Cable management score (affects cooling efficiency)

### 1.3 Network Discovery & Diagnostics
**Enhancement**: Add visual network mappers
**Legacy**: From `GlobalNetwork.tsx` - upgrade to 3D

**New Features**:
- `ping` command visual trace (lit cable path)
- `traceroute` showing actual network hops in 3D
- Cable tester tool (sends test packets, visual response)
- Network topology auto-discovery when patches are complete

## 🖼️ Phase 2: 3D Hardware Mounting Realism (PRIORITY 2)

### 2.1 Physics-Based Mounting
**Current Issue**: Hardware instantly appears in slots
**File**: `/src/physics/snapping.ts` and `Scene.tsx`

**New Physics Engine**:
```typescript
class MountingPhysics {
  // Simulate real mounting forces
  static simulateInsertion(node: InfraNode, rack: InfraNode): {
    alignment: number;  // 0-1, affects boot success rate
    cableReach: Map<PortType, number>;  // How far cables can reach
    thermalZone: number;  // Rack position affects cooling
  }
}
```

**Mounting Workflow**:
1. Select hardware from catalog
2. Preview in ghost mode at target U position
3. Click to start insertion animation
4. Hardware slides into rack with physics (wiggle, alignment)
5. "Click" sound when seated properly
6. Rail mounting for larger hardware (2U+)
7. Screw-in animation for 1U equipment

**Quality Score**:
- Perfect mount: No performance impact
- Poor alignment: +5% failure rate
- Needs reseating alert if rushed

### 2.2 Port-Level Configuration
**Enhancement**: Physical port selection and configuration
**New Component**: `PortConfigurator.tsx`

**Mechanics**:
- Click specific port to configure (not just device-level)
- Port LEDs show status (green=active, amber=link, red=error)
- Speed/duplex negotiation animation
- Port security settings visual feedback
- Cable inserted "click" + LED test

**Manual Port Configuration**:
```typescript
interface PortConfig {
  speedGbps: 1 | 10 | 25 | 40 | 100;
  duplex: 'full' | 'half';
  enabled: boolean;
  poeEnabled?: boolean;  // For power injectors
  vlans: number[];
}
```

### 2.3 Component-Level Realism
**Addition**: Show internal components for education
**New Component**: `ComponentViewer.tsx`

**Features**:
- Remove server panels to see internals (CPU, RAM, drives)
- Replaceable component simulation:
  - Hot-swap drives (requires carrier)
  - RAM sticks (affects performance curve)
  - Power supplies (N+1 redundancy)
- Component failure modes based on thermal history

## 📚 Phase 3: Learning Progression System (PRIORITY 3)

### 3.1 Guided Tutorial Engine
**Current**: Operator handbook is static
**New System**: Interactive tutorials with voice-over

**Tutorial Types**:
```typescript
interface Tutorial {
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  objectives: Objective[];
  guidance: GuideStep[];
}

interface Objective {
  id: string;
  description: string;
  validation: (state: InfraState) => boolean;
  hint: string;
  completionXp: number;
}

interface GuideStep {
  elementId: string;  // UI element to highlight
  message: string;      // Voice-over/Subtitles
  required: boolean;    // Must complete to advance
  advanceCondition?: (state: InfraState) => boolean;
}
```

**Tutorial Pipeline**:

**Beginner**: "Your First Rack"
1. Objective: Mount first rack
   - Hint: "Racks are the foundation - start with 42U"
   - Validation: Check if rack exists with position

2. Objective: Deploy first server
   - Guide: "Click the rack at U20, select the 1U compute node"
   - Validate: Hardware placed in rack with catalogKey

3. Objective: Connect power
   - Guide: "Click the PDU input, trace to server power ports"
   - Validate: Power connection exists, status shows power

4. Objective: Power on sequence
   - Guide: "Open terminal, run 'poweron', wait for boot"
   - Validate: systemState === 'running'

**Intermediate**: "Building a Web Stack"
1. Deploy LAMP/LEMP stack across multiple nodes
2. Configure load balancer
3. Set up monitoring
4. Simulate traffic spike

**Advanced**: "Multi-Site DR"
1. Cross-site replication
2. Failover testing
3. Compliance audits
4. Capacity planning

### 3.2 Certifications & Achievements
**New File**: `/src/store/achievements.ts`

**Certification System**:
- **Net+**: Basic networking (patching, VLANs, routing)
- **Server+**: Hardware deployment & lifecycle
- **Security+**: Firewalls, IDS, compliance
- **Cloud+**: Multi-site, replication, cloud tiering
- **DCIM Expert**: Master all systems

**Achievement Examples**:
- "First Boot": Successfully boot first server
- "Power User": Max out rack capacity safely
- "Cable Whisperer": 100 correct patches in a row
- "Five Nines": 99.999% uptime for 30 days
- "Cryptominer": Deploy GPU cluster

## 🎛️ Phase 4: Enhanced Terminal Realism (PRIORITY 1)

### 4.1 Physical Terminal Locations
**Current**: Global terminal in overlay
**Enhancement**: Terminal deployed on actual hardware

**Mechanics**:
- Terminal runs ON a specific server (requires console server)
- Split terminals: Can SSH into other nodes
- Terminal session persists across server reboots
- Serial console access for unresponsive nodes

```typescript
interface TerminalDeployment {
  hostNodeId: string;    // Where terminal daemon runs
  consolePorts: string[]; // Which ports are console servers
  sessions: Array<{
    targetNodeId: string;
    type: 'ssh' | 'serial' | 'ipmi';
    isActive: boolean;
  }>;
}
```

**Visual Terminal Indicator**:
- Show terminal session on hardware (green LED strip)
- Terminal window shows current node's hostname in title
- Cannot access terminal if host node is down

### 4.2 BIOS/UEFI Simulation
**New Component**: `BiosSimulator.tsx`

**Realistic Boot Process**:
1. POST screen (memory test animation)
2. BIOS/UEFI menu (interactive - ESC to enter)
3. Boot device selection
4. GRUB/OS selection menu
5. Kernel boot logs
6. SystemD service startup

**BIOS Settings**:
- Boot order (affects recovery speed)
- Power management (affects thermal)
- Network boot (PXE for mass deployment)
- Hardware monitoring (fan curves based on position)

### 4.3 Error Messages & Logs
**Enhancement**: Realistic error conditions with learnable solutions

**Error Library**:
- "POST beep codes" audio feedback
- BIOS error screens (missing boot device)
- Kernel panic (misconfigured hardware)
- Network timeouts (cable not connected)
- Power supply fault (overloaded circuit)
- Thermal shutdown (poor rack planning)

**Debugging Tools**:
- `dmesg` output for hardware events
- `ethtool` for NIC diagnostics
- `smartctl` for drive health
- `ipmitool` for BMC management

## 📊 Phase 5: Service & Application Layer (PRIORITY 2)

### 5.1 Application Deployment
**Current**: Service installation is basic
**Enhancement**: Full application lifecycle

**Application Catalog**:
```typescript
interface Application {
  id: string;
  name: string;
  tier: 'web' | 'app' | 'db' | 'cache';
  requirements: {
    minStorageGB: number;
    minRAMGB: number;
    minCores: number;
    optionalServices: ServiceType[];
  };
  deploymentSteps: DeploymentAction[];
}
```

**Sample Applications**:
- **WordPress**: Web + PHP + MySQL stack
- **PostgreSQL**: Database with replication
- **Redis**: In-memory cache
- **Kubernetes**: Container orchestration (multi-node)
- **Elasticsearch**: Search cluster

**Deployment Flow**:
1. Allocate hardware according to spec
2. Install base OS (via terminal or image)
3. Run deployment script
4. Monitor installation progress
5. Configure load balancers
6. Set up monitoring
7. Validate with health checks

### 5.2 Monitoring & Observability
**Current**: Basic health status
**Enhancement**: Full metrics and dashboards

**New Component**: `/src/components/ui/MetricsDashboard.tsx`

**Metrics to Visualize**:
- **Hardware**: Temperature, power draw, fan speeds
- **Network**: Throughput per port, error rates, latency
- **Storage**: IOPS, capacity, replication lag
- **System**: Load average, memory usage, uptime
- **Application**: Response times, error rates, saturation

**Visual Representation**:
- Overlaid charts in 3D scene (floating above each rack)
- Real-time LED bars on hardware faces
- Heat gradient showing thermal load
- Blip-verts for network packets (like "The Matrix")

## 💰 Phase 6: Economy & Progression (PRIORITY 3)

### 6.1 Budget & Procurement Enhancements
**Current**: Basic purchase system
**Enhancement**: Full financial simulation

**Economic Model**:
```typescript
interface FinancialState {
  operatingBudget: number;    // Monthly recurring
  capitalBudget: number;      // One-time purchases
  energyCostPerKwh: number;    // Varies by region
  coloRental: number;          // Per rack per month

  revenue: {
    customerSubscriptions: number;  // Revenue per uptime
    slaPenalties: number;          // Downtime penalties
    dataEgress: number;            // Cloud tier
  };
}
```

**Procurement Constraints**:
- Hardware quotes expire after 7 days
- Lead times affect deployment timing
- Volume discounts for bulk purchases
- Second market for used/refurbished (cheaper, higher failure rate)
- Budget approval workflow for large purchases

### 6.2 Corporate Contracts & SLAs
**New System**: Customer-facing objectives

**Contract Types**:
- **Starter Host**: Single server, 95% uptime, $500/mo
- **E-commerce**: Load balanced, 99.9% uptime, $5000/mo
- **Enterprise**: Multi-site, 99.99% uptime, $50000/mo
- **Government**: Compliance heavy, high security, $100k+/mo

**SLA Penalties**:
- Downtime calculation based on critical path
- Financial penalties for breaches
- Reputation system affecting new contracts
- Insurance for critical systems

## 🌐 Phase 7: Multi-Site & Scalability (PRIORITY 3)

### 7.1 Global Map Enhancements
**Current**: Basic map with site pins
**Enhancement**: Full global infrastructure simulation

**Regional Variations**:
- **Power costs**: Cheaper in hydro regions (Canada), expensive in cities (London)
- **Network latency**: Based on physical distance
- **Regulations**: EU (GDPR), US (CCPA), China (data localization)
- **Natural disasters**: Earthquakes, hurricanes, floods (affect uptime)

**Site Link Visualization**:
- Undersea cables (thick bundles, protected)
- Terrestrial fiber (vulnerable to construction)
- Satellite links (high latency, weather-dependent)
- MPLS networks (private, expensive)

### 7.2 Edge & CDN
**New Feature**: Geographically distributed edge nodes

**Mechanics**:
- Deploy edge caches in POPs (Points of Presence)
- Cache hit rate based on proximity to users
- Dynamic routing based on load and latency
- Edge computing for IoT data processing

## 🏆 Phase 8: Advanced Simulation Features (PRIORITY 4)

### 8.1 Chaos Engineering
**Current**: Random failures exist
**Enhancement**: Planned chaos experiments

**Chaos Tools**:
```typescript
interface ChaosExperiment {
  name: string;
  target: 'node' | 'rack' | 'site' | 'connection';
  action: 'terminate' | 'delay' | 'packet_loss' | 'disk_full';
  blastRadius: number;  // % of infrastructure affected
  hypothesis: string;   // Expected outcome
}
```

**Sample Experiments**:
- Terminate random server (test HA)
- Saturate network link (test QoS)
- Fill disk to 100% (test monitoring)
- Split-brain network (test consensus)

### 8.2 Incident Response Simulation
**New Feature**: On-call pager alerts with SLAs

**Incident Flow**:
1. Alert fires (visual + audio pager sound)
2. ACK within SLA or penalty accrues
3. Diagnose via logs/metrics
4. Apply mitigations (failover, restart, patch)
5. Write post-mortem (affects reputation)
6. Schedule preventive work

### 8.3 Compliance Audits
**New Feature**: Regular audits with financial impact

**Audit Types**:
- **Security**: Firewall rules, encryption, access controls
- **Data Sovereignty**: Geographic restrictions (GDPR)
- **Capacity**: Future capacity planning required
- **Environmental**: Power efficiency targets

**Compliance Requirements**
- Provide documentation (auto-generated from config)
- Demonstrate controls (show firewall rules)
- Remediate findings (or face penalties)

## 🎨 Phase 9: Visual & Audio Polish (PRIORITY 2)

### 9.1 3D Asset Improvements
**Current**: Basic boxes and colors
**Enhancement**: Detailed models with PBR materials

**New 3D Models Needed**:
- Actual server models (Dell, HP, Supermicro styling)
- Detailed networking equipment (Cisco-style switches)
- Realistic cable models (Cat6, fiber, power)
- Animated components (fans spinning, drives blinking)

**Materials Library**:
- Server front panels: Painted metal with branding
- Drive bays: Aluminum with drive-status LEDs
- Network ports: Gold-plated contacts
- Cables: Rubber with spec-accurate coloring

### 9.2 Audio Design
**Current**: No audio feedback
**Enhancement**: Full audio environment

**Audio Events**:
- Cable click/insert (satisfying snap)
- POST beep (varies by motherboard)
- Fan ramp (proportional to thermal load)
- Drive seek (clicking for HDDs, silence for SSDs)
- Alarm tones for alerts (different for each severity)
- Ambient datacenter hum (white noise, low frequency)

### 9.3 Accessibility
**New Features**: Inclusive design for all players

**Accessibility Options**:
- Screen reader support for terminal output
- Colorblind-friendly cable colors (patterns + colors)
- Subtitles for all voice-overs
- Simplified controls mode (fewer hotkeys)
- High contrast mode (for low vision)

## 📋 Phase 10: Quality of Life Improvements (PRIORITY 1)

### 10.1 Save System Enhancements
**Current**: Basic localStorage persistence
**Issues**: No versioning, no rollback

**New Features**:
- Multiple save slots
- Quick save/load hotkeys
- Auto-save after major actions
- Load from milestones (completed tutorials)
- Cloud backup (optional)
- Replays/ghost mode (show previous successful builds)

### 10.2 Controls & Hotkeys
**Current**: Basic 'T' for terminal
**Enhancement**: Professional hotkey system

```typescript
const HOTKEYS = {
  terminal: 'T',
  cycleRacks: 'R',
  cycleHardware: 'Tab',
  focusSearch: '/',
  quickSave: 'Ctrl+S',
  quickLoad: 'Ctrl+L',
  chaosMode: 'Ctrl+Shift+C',  // Easter egg for power users
};
```

**UI Overlay**: Show available hotkeys in context

### 10.3 Performance Optimization

**Current Bottlenecks**:
- All nodes in one scene (performance degradation at scale)
- Cable geometry not instanced
- No LOD (Level of Detail) system

**Optimizations**:
- Octree spatial partitioning for collision detection
- Instanced rendering for identical hardware
- Cable LOD: Full geometry → Low-poly → Line → Off
- Rack occlusion culling (don't render hidden racks)
- Deferred loading for off-site infrastructure

### 10.4 Modding Support
**New Feature**: Plugin architecture for community

**Modding API**:
```typescript
interface Mod {
  name: string;
  version: string;
  hooks: {
    onHardwarePlaced?: (node: InfraNode) => void;
    onCommand?: (command: string) => boolean; // return true to intercept
    onTick?: (state: InfraState) => InfraState;  // transform state
  };
  assets: {
    hardware?: HardwareCatalogSpec[];
    tutorials?: Tutorial[];
  };
}
```

**Mod Examples**:
- Custom hardware (AWS/Azure-like shapes)
- Historical scenarios (ARPANET simulation)
- Sci-fi themed (control panels, animations)
- Educational curricula (school assignments)

## 🎯 Immediate Implementation Priorities

### Week 1: Cable Realism (HIGH IMPACT, MEDIUM EFFORT)
- [ ] Create CableSystem component with dual-layer rendering
- [ ] Add data flow animation for active connections
- [ ] Implement cable type validation (prevent power→network)
- [ ] Add cable insertion/removal animations

### Week 2: Mounting Physics (HIGH IMPACT, HIGH EFFORT)
- [ ] Physics-based insertion (slide, align, seat)
- [ ] Port-level interactions (click specific ports)
- [ ] Rack mount quality scoring
- [ ] Add mounting audio and visual feedback

### Week 3: Learning System (HIGH IMPACT, MEDIUM EFFORT)
- [ ] Create tutorial engine framework
- [ ] Design first tutorial: "Your First Rack"
- [ ] Implement achievement tracking
- [ ] Add in-context hints system

### Week 4: Terminal Realism (HIGH IMPACT, HIGH EFFORT)
- [ ] Physical terminal locations (deploy on server)
- [ ] Console server simulation (serial OOB)
- [ ] BIOS/POST simulation
- [ ] SSH connection visualization

### Week 5: Polish & UX (GOOD WILL, LOW EFFORT)
- [ ] Performance optimization (instancing, LOD)
- [ ] Save system improvements
- [ ] Hotkey system expansion
- [ ] First audio pass (basic cable/POST sounds)

## 🏁 Long-term Vision (6-12 Months)

### Ultimate Goal
Become the canonical educational tool for data center operations, used by:
- Universities (IT/CS programs)
- Corporate training (onboarding Jr. admins)
- Certification prep (CompTIA Server+, Network+)
- Hobbyists (homelab community)
- Military/enterprise (SCIF operations training)

### Success Metrics
- 90% player completes first tutorial
- 50% reach "3 servers with network" milestone
- Average session length > 2 hours
- Community mods > 100
- Educational institution partnerships > 10

## 📝 Implementation Notes

### File Structure Recommendations
```
/src/
├── components/
│   ├── world/
│   │   ├── CableSystem.tsx        # NEW: Dual-layer cables
│   │   ├── MountingPhysics.tsx    # NEW: Physics engine
│   │   ├── AudioManager.tsx       # NEW: Sound system
│   │   └── TutorialEngine.tsx     # NEW: Learning system
│   └── ui/
│       ├── MetricsDashboard.tsx   # NEW: Advanced monitoring
│       └── AchievementToast.tsx   # NEW: Achievement system
├── physics/
│   ├── cablePhysics.ts            # NEW: Cable validation
│   ├── mounting.ts                # NEW: Mounting simulation
│   └── audio.ts                   # NEW: Audio event system
├── store/
│   ├── achievements.ts              # NEW: Progress tracking
│   └── tutorials.ts                 # NEW: Tutorial state
└── utils/
    └── metrics.ts                 # NEW: Analytics
```

### Technical Debt to Address
1. **useInfraStore.ts** (1815 lines)
   - Split into domain stores: `nodesStore`, `terminalStore`, `economyStore`
   - Extract terminal command logic to separate file
   - Create selectors to prevent re-renders

2. **Scene.tsx** (large component)
   - Break into: `Rack.tsx`, `Hardware.tsx`, `Cable.tsx`
   - Add React.memo where appropriate
   - Use Suspense for async asset loading

3. **Test Coverage**
   - Current: Basic unit tests
   - Needed: Integration tests for workflow completion
   - Add visual regression tests for 3D scene

### Asset Pipeline
**3D Models Needed**:
- [ ] Server models (generic, detailed)
- [ ] Switch models (front/side views)
- [ ] Cable models (coiled, straight, bundles)
- [ ] Rack accessories (PDUs, cable arms)

**Audio Files Needed**:
- [ ] POST beep sequences (AMI, Phoenix patterns)
- [ ] Cable clicks (RJ45, power connector, fiber)
- [ ] Fan ramps (idle → high load → thermal throttle)
- [ ] Alert tones (info, warning, critical)
- [ ] Ambient datacenter loop (distant hum)

## 🎮 Gameplay Balance Considerations

### Difficulty Curve
- **Hours 0-2**: Tutorial guidance, impossible to fail
- **Hours 2-5**: Sandbox with hints, gentle penalties
- **Hours 5-10**: Realistic costs/constraints, moderate difficulty
- **Hours 10+**: Chaos engineering, competitive challenges

### Failure Modes
Make failure educational, not punitive:
- Wrong cable type: Visual feedback, minor delay
- Overloaded rack: Alerts with clear remediation
- Temperature issues: Gradual degradation, not instant death
- Budget overrun: Pause expensive operations, offer loans

### Mastery Rewards
- **Speed runs**: Deploy infrastructure faster than targets
- **Efficiency**: Minimize power/cost for required capacity
- **Resilience**: Pass chaos experiments without downtime
- **Innovation**: Find creative solutions (under-budget, unique topology)

---

## Conclusion

This roadmap transforms Infra-Tycoon from a functional infrastructure builder into the definitive educational data center simulator. The prioritized phases ensure critical realism features (cables, mounting) are delivered early, while building toward a comprehensive learning platform.

The vision of "learning from zero" is maintained by:
1. **Physical Realism**: All operations mirror real-world procedures
2. **Progressive Complexity**: Well-designed tutorial system
3. **Comprehensive Scope**: From rack mounting to global infrastructure
4. **Educational Focus**: Every failure is a learning opportunity

**Next Steps**: Begin with Week 1 priorities - implement the CableSystem component to immediately enhance visual realism and gameplay satisfaction.

---