import type { PowerComponent, TransformComponent, ThermalComponent } from '../../types'
import { HARDWARE_CATALOG } from '../../../../physics/hardwareLibrary'

export class DevicePowerCalculator {
  /**
   * Calculates the dynamic wattage, power factor, and apparent power for a compute or networking node.
   */
  public static calculate(
    power: PowerComponent,
    transform: TransformComponent,
    thermal: ThermalComponent | undefined,
    appCount: number,
    throughput: number
  ) {
    if (power.baseWattage === undefined || !Number.isFinite(power.baseWattage) || Number.isNaN(power.baseWattage) || power.baseWattage <= 0) {
      const catalogSpec = transform.catalogKey ? HARDWARE_CATALOG[transform.catalogKey as keyof typeof HARDWARE_CATALOG] : null
      power.baseWattage = catalogSpec ? catalogSpec.wattage : (power.wattage && Number.isFinite(power.wattage) && power.wattage > 0 ? power.wattage : 300)
    }
    power.baseWattage = Math.max(50, Math.min(15000, power.baseWattage))
    power.phase = transform.slotIndex !== undefined ? (['A', 'B', 'C'][transform.slotIndex % 3] as 'A' | 'B' | 'C') : 'A'

    if (!power.isPowered) {
      power.wattage = 0
      power.load = 0
      power.apparentPowerVA = 0
      return
    }

    const networkUtil = Math.min(100.0, throughput * 10.0)
    const utilization = Math.min(100.0, appCount * 30.0 + networkUtil)
    const fanSpeed = thermal?.fanSpeedPercent ?? 0.0

    let baseScale = 1.0
    let util = utilization
    if (power.systemState === 'booting') {
      baseScale = 0.5
      util = 0.0
    }

    const internalDCWattage = power.baseWattage * baseScale * (1.0 + (util / 100.0) * 0.5) + (fanSpeed / 100.0) * 50.0
    const efficiency = power.efficiency && power.efficiency > 0.5 && power.efficiency <= 1.0 ? power.efficiency : 0.85
    let dynamicWattage = internalDCWattage / efficiency

    if (!Number.isFinite(dynamicWattage) || Number.isNaN(dynamicWattage) || dynamicWattage < 0) {
      dynamicWattage = power.baseWattage
    }
    
    dynamicWattage = Math.max(10, Math.min(15000, dynamicWattage))

    // Power factor degradation based on utilization
    const powerFactor = Math.max(0.85, Math.min(0.99, 0.85 + 0.13 * (utilization / 100.0)))
    power.powerFactor = powerFactor

    let apparentPower = dynamicWattage / powerFactor
    if (!Number.isFinite(apparentPower) || Number.isNaN(apparentPower)) apparentPower = dynamicWattage
    power.apparentPowerVA = apparentPower

    power.wattage = dynamicWattage
    power.load = dynamicWattage / 1000.0
  }
}
