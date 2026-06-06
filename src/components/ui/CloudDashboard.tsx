/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  Cloud, 
  CloudLightning, 
  Server, 
  Activity, 
  DollarSign, 
  Shield, 
  Zap,
  TrendingUp
} from 'lucide-react'
import { Modal, Card, Badge, Button, Tabs, type TabItem } from './system'

interface CloudDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function CloudDashboard({ isOpen, onClose }: CloudDashboardProps) {
  const { 
    cloudProviders, 
    activeCloudProviderId, 
    setCloudProvider, 
    cloudBurstingActive, 
    setCloudBursting,
    purchaseReservedInstance,
    updateSpotInstances // Note: usually driven by ECS, but we expose a slider for demo/manual testing
  } = useInfraStore()

  const [activeTab, setActiveTab] = useState<'marketplace' | 'analytics'>('marketplace')

  const totalSpot = cloudProviders.reduce((sum: any, p: any) => sum + p.activeSpotInstances, 0)
  const totalReserved = cloudProviders.reduce((sum: any, p: any) => sum + p.reservedInstances, 0)
  
  const totalOpex = cloudProviders.reduce((sum: any, p: any) => 
    sum + (p.activeSpotInstances * p.spotPricePerNode) + (p.reservedInstances * p.reservedPricePerNode)
  , 0)

  const tabs: TabItem[] = [
    { id: 'marketplace', label: 'Cloud Marketplace', icon: <Cloud size={16} /> },
    { id: 'analytics', label: 'FinOps Analytics', icon: <TrendingUp size={16} /> }
  ]

  const handleProviderSelect = (providerId: string) => {
    if (activeCloudProviderId === providerId) {
      setCloudProvider(null)
    } else {
      setCloudProvider(providerId)
    }
  }

  const handleDemoSpotChange = (providerId: string, val: number) => {
    updateSpotInstances(providerId, val)
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Hybrid Cloud & FinOps Console" 
      icon={<CloudLightning size={24} className="text-sky-400" />}
      width="xl"
      zIndex="z-[150]"
      headerExtra={
        <div className="flex items-center gap-4 ml-4">
          <Badge variant={cloudBurstingActive ? 'success' : 'warning'}>
            Bursting: {cloudBurstingActive ? 'ACTIVE' : 'DISABLED'}
          </Badge>
          <Button 
            variant={cloudBurstingActive ? 'danger' : 'primary'}
            onClick={() => setCloudBursting(!cloudBurstingActive)}
          >
            {cloudBurstingActive ? 'Disable Auto-Burst' : 'Enable Auto-Burst'}
          </Button>
        </div>
      }
    >
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onChange={(id) => setActiveTab(id as typeof activeTab)} 
      />

      <div className="p-6 h-[600px] overflow-y-auto">
        {activeTab === 'marketplace' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <Server className="text-sky-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Total Cloud Nodes</div>
                <div className="text-2xl font-bold">{totalSpot + totalReserved}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <Activity className="text-purple-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Reserved Instances</div>
                <div className="text-2xl font-bold">{totalReserved}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <DollarSign className="text-red-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Monthly Burn Rate</div>
                <div className="text-2xl font-bold text-red-400">${totalOpex.toLocaleString()}</div>
              </Card>
            </div>

            <div className="grid gap-4">
              {cloudProviders.map((provider: any) => {
                const isActive = activeCloudProviderId === provider.id
                return (
                  <Card 
                    key={provider.id} 
                    className={`p-5 transition-colors ${isActive ? 'bg-sky-900/20 border-sky-500/50' : 'bg-slate-900/50 border-slate-800'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <Cloud className={isActive ? 'text-sky-400' : 'text-slate-500'} size={28} />
                        <div>
                          <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                          <div className="text-xs text-slate-400 font-mono">
                            SLA: {(provider.reliability * 100).toFixed(2)}% | Base Latency: {provider.baseLatencyMs}ms
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant={isActive ? 'ghost' : 'primary'}
                        onClick={() => handleProviderSelect(provider.id)}
                      >
                        {isActive ? 'Disconnect Gateway' : 'Establish Gateway'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Spot Pricing */}
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-slate-300">On-Demand (Spot)</span>
                          <span className="text-sm text-sky-400 font-mono">${provider.spotPricePerNode}/mo</span>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs text-slate-500">Active Spot Nodes: {provider.activeSpotInstances}</span>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleDemoSpotChange(provider.id, Math.max(0, provider.activeSpotInstances - 10))}
                            >
                              -10
                            </Button>
                            <Button 
                              variant="ghost" 
                              onClick={() => handleDemoSpotChange(provider.id, provider.activeSpotInstances + 10)}
                            >
                              +10
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Reserved Pricing */}
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-slate-300">Reserved Instance</span>
                          <span className="text-sm text-emerald-400 font-mono">${provider.reservedPricePerNode}/mo</span>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs text-slate-500">Active RIs: {provider.reservedInstances}</span>
                          <Button 
                            variant="primary" 
                            onClick={() => purchaseReservedInstance(provider.id, 10)}
                            icon={<Zap size={14} />}
                          >
                            Reserve 10
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <Card className="p-6 border-slate-800 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white mb-4">FinOps Optimization</h3>
              <p className="text-slate-300 text-sm mb-4">
                Analyze your cloud spend. Spot instances handle elastic bursts but incur higher monthly OPEX. Purchasing Reserved Instances (RIs) locks in a lower rate for baseload traffic but requires a long-term OPEX commitment.
              </p>
              
              <div className="space-y-3">
                {cloudProviders.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-950 p-3 rounded border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-slate-500" />
                      <span className="text-sm text-slate-300">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-mono">
                      <span className="text-sky-400">Spot OPEX: ${(p.activeSpotInstances * p.spotPricePerNode).toLocaleString()}</span>
                      <span className="text-emerald-400">RI OPEX: ${(p.reservedInstances * p.reservedPricePerNode).toLocaleString()}</span>
                      <span className="text-white font-bold text-base">Total: ${(p.activeSpotInstances * p.spotPricePerNode + p.reservedInstances * p.reservedPricePerNode).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Modal>
  )
}

