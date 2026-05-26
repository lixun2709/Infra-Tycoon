import { System } from '../System'
import type { SecurityComponent, PowerComponent, ConnectionComponent } from '../types'

/**
 * SecuritySystem
 * Handles deterministic ransomware states and lateral network propagation.
 */
export class SecuritySystem extends System {
  private propagationTimer = 0
  private propagationInterval = 2.0 // Check for lateral propagation every 2 seconds

  public update(dt: number): void {
    this.propagationTimer += dt
    const world = this.world
    const securityMap = world.getComponentMap<SecurityComponent>('security')
    const powerMap = world.getComponentMap<PowerComponent>('power')
    const connectionMap = world.getComponentMap<ConnectionComponent>('connection')

    // 1. Process local infection progression per node
    securityMap.forEach((security, id) => {
      const power = powerMap.get(id)
      
      // If node is off, malware pauses
      if (!power || !power.isPowered || power.systemState !== 'running') {
        return
      }

      if (security.infectionState === 'exposed') {
        // Deterministically transition exposed -> infected quickly
        security.infectionProgress += dt * 0.5 // 2 seconds to infect
        if (security.infectionProgress >= 1.0) {
          security.infectionState = 'infected'
          security.infectionProgress = 0
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Node compromised! Entering infected state.`,
            severity: 'critical'
          })
        }
      } else if (security.infectionState === 'infected') {
        // Delay before encryption begins
        security.infectionProgress += dt * 0.1 // 10 seconds of silent spreading
        if (security.infectionProgress >= 1.0) {
          security.infectionState = 'encrypting'
          security.infectionProgress = 0
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Ransomware active! Encryption in progress.`,
            severity: 'critical'
          })
        }
      } else if (security.infectionState === 'encrypting') {
        // Encryption based on encryption rate
        security.infectionProgress += dt * security.encryptionRate
        if (security.infectionProgress >= 1.0) {
          security.infectionState = 'locked'
          security.infectionProgress = 1.0
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: System Locked! Ransom demanded.`,
            severity: 'critical'
          })
          
          // Trigger ransomware incident event
          this.world.eventBus.publish('incident:ransomware_locked', {
            nodeId: id
          })
        }
      }
    })

    // 2. Process lateral propagation over the network
    if (this.propagationTimer >= this.propagationInterval) {
      this.propagationTimer = 0
      this.processLateralSpread(securityMap, powerMap, connectionMap)
    }
  }

  private processLateralSpread(
    securityMap: Map<string, SecurityComponent>,
    powerMap: Map<string, PowerComponent>,
    connectionMap: Map<string, ConnectionComponent>
  ) {
    const newlyExposed: string[] = []
    const time = Date.now()

    // Deterministic random pseudo-generator (0 to 1) based on time and a string
    const pseudoRandom = (seedStr: string, t: number) => {
      let hash = 0
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i)
        hash |= 0
      }
      const val = Math.sin(hash * 12.9898 + t * 78.233) * 43758.5453
      return val - Math.floor(val)
    }

    // Build adjacency logic
    // Nodes that are infected or encrypting can spread malware
    const activeThreats: string[] = []
    securityMap.forEach((sec, id) => {
      if ((sec.infectionState === 'infected' || sec.infectionState === 'encrypting') && !sec.isIsolated) {
        const p = powerMap.get(id)
        if (p && p.isPowered && p.systemState === 'running') {
          activeThreats.push(id)
        }
      }
    })

    if (activeThreats.length === 0) return

    // Iterate connections to spread malware
    connectionMap.forEach((conn, connId) => {
      if (conn.status === 'blocked' || conn.isBlackholed) return

      const u = conn.startNodeId
      const v = conn.endNodeId

      // Check if U infects V
      if (activeThreats.includes(u)) {
        const secV = securityMap.get(v)
        const pV = powerMap.get(v)
        if (secV && secV.infectionState === 'clean' && !secV.isIsolated && !secV.isImmutable && pV && pV.isPowered) {
          // Spread chance 15% per evaluation interval
          if (pseudoRandom(connId, time) < 0.15) {
            newlyExposed.push(v)
          }
        }
      }

      // Check if V infects U
      if (activeThreats.includes(v)) {
        const secU = securityMap.get(u)
        const pU = powerMap.get(u)
        if (secU && secU.infectionState === 'clean' && !secU.isIsolated && !secU.isImmutable && pU && pU.isPowered) {
          if (pseudoRandom(connId + "_rev", time) < 0.15) {
            newlyExposed.push(u)
          }
        }
      }
    })

    // Apply new exposures
    newlyExposed.forEach(id => {
      const sec = securityMap.get(id)
      if (sec && sec.infectionState === 'clean') {
        sec.infectionState = 'exposed'
        sec.infectionProgress = 0
      }
    })
  }
}
