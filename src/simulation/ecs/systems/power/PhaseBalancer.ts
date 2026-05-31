import type { PowerComponent, TransformComponent } from '../../types'

export class PhaseBalancer {
  /**
   * Aggregates child device loads into 3-phase PDU loads on the parent rack.
   */
  public static calculateRackPhases(
    rackPower: PowerComponent,
    children: string[] | undefined,
    powerMap: Map<string, PowerComponent>,
    transformMap: Map<string, TransformComponent>
  ) {
    if (!rackPower.isPowered) {
      rackPower.load = 0
      rackPower.apparentPowerVA = 0
      rackPower.phaseLoadsWatts = [0, 0, 0]
      rackPower.phaseLoadsVA = [0, 0, 0]
      return
    }

    let pWatts0 = 0, pWatts1 = 0, pWatts2 = 0
    let pVA0 = 0, pVA1 = 0, pVA2 = 0

    if (children) {
      for (let i = 0; i < children.length; i++) {
        const id = children[i]
        if (!id) continue
        const transform = transformMap.get(id)!
        if (transform.type === 'cooling') continue

        const childPower = powerMap.get(id)
        if (childPower && childPower.isPowered) {
          const serverPhase = childPower.phase ?? 'A'
          const cWattage = Number.isFinite(childPower.wattage) && !Number.isNaN(childPower.wattage) ? childPower.wattage : 0
          const cVA = (childPower.apparentPowerVA !== undefined && Number.isFinite(childPower.apparentPowerVA) && !Number.isNaN(childPower.apparentPowerVA)) ? childPower.apparentPowerVA : cWattage
          
          if (childPower.dualPSU) {
             // A dual PSU splits load perfectly across two phases (A and B, or B and C) to minimize imbalance.
             // But wait, the standard usually says split 50/50.
             // If phase is 'A', split A and B. If 'B', split B and C. If 'C', split C and A.
             const halfWatts = cWattage / 2
             const halfVA = cVA / 2
             if (serverPhase === 'A') {
               pWatts0 += halfWatts; pVA0 += halfVA; pWatts1 += halfWatts; pVA1 += halfVA
             } else if (serverPhase === 'B') {
               pWatts1 += halfWatts; pVA1 += halfVA; pWatts2 += halfWatts; pVA2 += halfVA
             } else {
               pWatts2 += halfWatts; pVA2 += halfVA; pWatts0 += halfWatts; pVA0 += halfVA
             }
          } else {
             if (serverPhase === 'A') {
               pWatts0 += cWattage; pVA0 += cVA
             } else if (serverPhase === 'B') {
               pWatts1 += cWattage; pVA1 += cVA
             } else {
               pWatts2 += cWattage; pVA2 += cVA
             }
          }
        }
      }
    }

    let totalWatts = pWatts0 + pWatts1 + pWatts2
    let totalVA = pVA0 + pVA1 + pVA2

    totalWatts = Math.max(0, Math.min(150000, totalWatts))
    totalVA = Math.max(0, Math.min(150000, totalVA))

    if (!Number.isFinite(pWatts0) || Number.isNaN(pWatts0)) pWatts0 = 0
    if (!Number.isFinite(pWatts1) || Number.isNaN(pWatts1)) pWatts1 = 0
    if (!Number.isFinite(pWatts2) || Number.isNaN(pWatts2)) pWatts2 = 0
    if (!Number.isFinite(pVA0) || Number.isNaN(pVA0)) pVA0 = 0
    if (!Number.isFinite(pVA1) || Number.isNaN(pVA1)) pVA1 = 0
    if (!Number.isFinite(pVA2) || Number.isNaN(pVA2)) pVA2 = 0

    rackPower.phaseLoadsWatts = [pWatts0, pWatts1, pWatts2]
    rackPower.phaseLoadsVA = [pVA0, pVA1, pVA2]

    rackPower.wattage = totalWatts
    rackPower.apparentPowerVA = totalVA
    rackPower.load = totalWatts / 1000.0
  }
}
