export class LoadStats {
  serverHeatBTU = 0
  coolingBTU = 0
  reset() {
    this.serverHeatBTU = 0
    this.coolingBTU = 0
  }
}

export class ThermalGlobals {
  public static siteAmbientTemps = new Map<string, number>()
  public static siteAmbientHumidity = new Map<string, number>() // V2 room relative humidity %

  public static CONDUCTION_COEFFICIENT = 0.05 / 9.0
  public static BASE_AMBIENT_TEMP = 22.0
  public static DEFAULT_CRITICAL = 80.0 // Silicon shutdown limit
  public static DEFAULT_THROTTLE = 70.0 // Performance throttling limit
  public static ROOM_TIME_CONSTANT = 1800.0 // 30 minutes room time constant (massive thermal inertia)
  public static RACK_TIME_CONSTANT = 300.0 // 5 minutes rack time constant
  public static ROOM_DISPERSION_COEFF = 6000.0 // BTU/hr per C (calibrated industrial dispersion)
  public static RACK_CONV_COEFF = 300.0 // BTU/hr per C (realistic local hot aisle buildup)
  public static RECIRCULATION_NONE = 0.50
  public static RECIRCULATION_HOT_AISLE = 0.15
  public static RECIRCULATION_COLD_AISLE = 0.05
}
