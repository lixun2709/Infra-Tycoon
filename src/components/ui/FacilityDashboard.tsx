/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useGameplayStore } from '../../store/useGameplayStore'
import { 
  Wind, 
  ThermometerSun, 
  ThermometerSnowflake, 
  AlertTriangle, 
  Server,
  LayoutGrid,
  ShieldCheck,
  TrendingDown
} from 'lucide-react'
import { Card, Badge, Button, Tabs, type TabItem } from './system'
import { ThermalSystem } from '../../simulation/ecs/systems/ThermalSystem'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'

export function FacilityTab() {
  const { 
    nodes, 
    currentSiteId,
    upgradeRackContainment,
    balance
  } = useInfraStore()

  const [activeTab, setActiveTab] = useState<'overview' | 'zones'>('overview')

  const racks = useMemo(() => nodes.filter((n: any) => n.type === 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])
  const coolingUnits = useMemo(() => nodes.filter((n: any) => n.type === 'cooling' && n.siteId === currentSiteId), [nodes, currentSiteId])

  const stats = useMemo(() => {
    let totalITHeatBTU = 0
    let totalCoolingCapacityBTU = 0

    // Approximate metrics based on hardware catalog specs
    nodes.filter((n: any) => n.siteId === currentSiteId).forEach((n: any) => {
      if (n.type === 'compute' || n.type === 'storage' || n.type === 'load_balancer') {
        const pwr = HARDWARE_CATALOG[n.catalogKey as keyof typeof HARDWARE_CATALOG]?.wattage || 0
        // Approx 3.412 BTU per watt. If efficiency is e.g. 0.8, then 20% is lost as heat, plus IT heat.
        totalITHeatBTU += pwr * 3.412
      } else if (n.type === 'cooling') {
        totalCoolingCapacityBTU += Math.abs(n.btuOutput || 0)
      }
    })

    const ambientTemp = ThermalSystem.siteAmbientTemps.get(currentSiteId || 'default-site') || ThermalSystem.BASE_AMBIENT_TEMP

    return {
      racksCount: racks.length,
      coolingUnitsCount: coolingUnits.length,
      totalITHeatBTU: Math.round(totalITHeatBTU),
      totalCoolingCapacityBTU: Math.round(totalCoolingCapacityBTU),
      ambientTemp
    }
  }, [nodes, racks, coolingUnits, currentSiteId])

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Facility Status', icon: <Wind size={16} /> },
    { id: 'zones', label: 'Thermal Zones', icon: <LayoutGrid size={16} /> }
  ]

  const getTemperatureColor = (temp: number) => {
    if (temp >= 50) return 'text-red-500'
    if (temp >= 35) return 'text-orange-400'
    if (temp <= 22) return 'text-blue-400'
    return 'text-emerald-400'
  }

  const getContainmentBadge = (containment?: string) => {
    if (containment === 'cold_aisle') return <Badge variant="info">Cold Aisle</Badge>
    if (containment === 'hot_aisle') return <Badge variant="warning">Hot Aisle</Badge>
    return <Badge variant="ghost">No Containment</Badge>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4">
        <Tabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onChange={(id) => setActiveTab(id as typeof activeTab)} 
        />
      </div>

      <div className="p-6 h-[600px] overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col items-center justify-center">
                <ThermometerSun className={`mb-2 ${getTemperatureColor(stats.ambientTemp)}`} size={24} />
                <div className="text-sm text-slate-400">Ambient Temp</div>
                <div className={`text-2xl font-bold ${getTemperatureColor(stats.ambientTemp)}`}>
                  {stats.ambientTemp.toFixed(1)}°C
                </div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col items-center justify-center">
                <ThermometerSnowflake className="text-sky-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Cooling Capacity</div>
                <div className="text-xl font-bold text-sky-400">{stats.totalCoolingCapacityBTU.toLocaleString()} BTU</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col items-center justify-center">
                <AlertTriangle className="text-orange-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">IT Heat Load</div>
                <div className="text-xl font-bold text-orange-400">{stats.totalITHeatBTU.toLocaleString()} BTU</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-800 flex flex-col items-center justify-center">
                <ShieldCheck className="text-emerald-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">N+1 Redundancy</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {stats.totalCoolingCapacityBTU > stats.totalITHeatBTU * 1.2 ? 'Active' : 'Critical'}
                </div>
              </Card>
            </div>

            <Card className="p-6 border-slate-800 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white mb-4">CRAC Subsystem Telemetry</h3>
              <p className="text-slate-300 text-sm mb-4">
                The facility cooling system automatically regulates the CRAC (Computer Room Air Conditioning) units. Utilizing Lead-Lag algorithms, redundant units are put into standby mode to conserve power when the IT Heat Load permits.
              </p>
              
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400 mb-1">Active Cooling Units</div>
                  <div className="text-xl font-mono text-sky-400">{stats.coolingUnitsCount}</div>
                </div>
                <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400 mb-1">Cooling Margin</div>
                  <div className="text-xl font-mono text-white">
                    {stats.totalCoolingCapacityBTU - stats.totalITHeatBTU > 0 ? '+' : ''}{(stats.totalCoolingCapacityBTU - stats.totalITHeatBTU).toLocaleString()} BTU
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Rack Microclimates</h3>
                <p className="text-sm text-slate-400">Deploy structural containment to trap chilled air and reduce thermodynamic recirculation.</p>
              </div>
              <div className="text-sm text-slate-500">Capital Balance: <span className="text-emerald-400 font-mono">${balance.toLocaleString()}</span></div>
            </div>

            <div className="grid gap-3">
              {racks.map((rack: any) => {
                const isColdAisle = rack.containmentType === 'cold_aisle'
                const isHotAisle = rack.containmentType === 'hot_aisle'

                return (
                  <Card key={rack.id} className="p-4 border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Server className="text-slate-400" size={24} />
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {rack.name}
                          {getContainmentBadge(rack.containmentType)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {rack.catalogKey} | ID: {rack.id.substring(0,8)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex gap-2">
                        {!isColdAisle && (
                          <Button 
                            variant="ghost"
                            onClick={() => upgradeRackContainment(rack.id, 'cold_aisle')}
                            disabled={balance < 5000}
                            className="border-sky-500/30 hover:bg-sky-500/10 text-sky-400"
                            icon={<TrendingDown size={14} />}
                          >
                            Cold Aisle ($5k)
                          </Button>
                        )}
                        {!isHotAisle && (
                          <Button 
                            variant="ghost"
                            onClick={() => upgradeRackContainment(rack.id, 'hot_aisle')}
                            disabled={balance < 8000}
                            className="border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                            icon={<TrendingDown size={14} />}
                          >
                            Hot Aisle ($8k)
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
              
              {racks.length === 0 && (
                <div className="text-center p-8 text-slate-500">
                  No racks found in the current site. Deploy some racks first.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

