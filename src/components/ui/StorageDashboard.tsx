import { useState } from 'react'
import { Modal, Tabs, type TabItem, Card, Button, Badge } from './base'
import { 
  Database, 
  HardDrive, 
  Activity, 
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  ShieldCheck,
  Zap
} from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'

interface StorageDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function StorageDashboard({ isOpen, onClose }: StorageDashboardProps) {
  const { nodes, rebuildRaidArray, toggleDataService, setStorageTier } = useInfraStore(useShallow(state => ({
    nodes: state.nodes,
    rebuildRaidArray: state.rebuildRaidArray,
    toggleDataService: state.toggleDataService,
    setStorageTier: state.setStorageTier
  })))

  const [activeTab, setActiveTab] = useState<'overview' | 'clusters' | 'data_services'>('overview')

  const storageNodes = nodes.filter((n: any) => n.type === 'storage')
  const totalCapacity = storageNodes.reduce((acc: any, n: any) => acc + (n.totalStorageTB || 0), 0)
  const totalUsed = storageNodes.reduce((acc: any, n: any) => acc + (n.usedStorageTB || 0), 0)
  const physicalUsed = storageNodes.reduce((acc: any, n: any) => acc + (n.physicalUsedStorageTB || n.usedStorageTB || 0), 0)
  
  const degradedNodes = storageNodes.filter((n: any) => n.storageStatus === 'degraded' || n.storageStatus === 'highly_degraded')
  const rebuildingNodes = storageNodes.filter((n: any) => n.storageStatus === 'rebuilding')
  const failedNodes = storageNodes.filter((n: any) => n.storageStatus === 'failed')

  const tabs: TabItem[] = [
    { id: 'overview', label: 'OVERVIEW', icon: <Activity size={14} /> },
    { id: 'clusters', label: 'SAN CLUSTERS', icon: <Server size={14} /> },
    { id: 'data_services', label: 'DATA SERVICES', icon: <Layers size={14} /> }
  ]

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Storage Operations"
      icon={<Database size={20} />}
      width="xl"
      zIndex="z-[150]"
    >
      <div className="flex flex-col h-[75vh]">
        <Tabs 
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          variant="underline"
          className="bg-black/20"
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col items-center justify-center text-center">
                  <Database className="text-teal-400 mb-2" size={24} />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Capacity</span>
                  <span className="text-2xl font-black text-white">{totalCapacity.toFixed(1)} <span className="text-sm text-slate-400">TB</span></span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center">
                  <HardDrive className="text-emerald-400 mb-2" size={24} />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Logical Used</span>
                  <span className="text-2xl font-black text-white">{totalUsed.toFixed(1)} <span className="text-sm text-slate-400">TB</span></span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center">
                  <Layers className="text-indigo-400 mb-2" size={24} />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Physical Used</span>
                  <span className="text-2xl font-black text-white">{physicalUsed.toFixed(1)} <span className="text-sm text-slate-400">TB</span></span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center border-amber-500/30">
                  <AlertTriangle className="text-amber-400 mb-2" size={24} />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Degraded Arrays</span>
                  <span className="text-2xl font-black text-amber-400">{degradedNodes.length + failedNodes.length}</span>
                </Card>
              </div>

              <div className="mt-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <RefreshCw size={14} /> Active Rebuilds
                </h3>
                {rebuildingNodes.length === 0 ? (
                  <div className="flex items-center justify-center h-24 bg-white/5 rounded-xl border border-white/5 border-dashed">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">No active rebuilds</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rebuildingNodes.map((node: any) => (
                      <Card key={node.id} className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                          <RefreshCw className="text-yellow-400 animate-spin" size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-white">{node.catalogKey || 'Storage Array'}</span>
                            <span className="text-xs font-black text-yellow-400">{Math.floor(node.rebuildProgress || 0)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-400 transition-all duration-1000"
                              style={{ width: `${node.rebuildProgress || 0}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="space-y-4">
              {storageNodes.length === 0 ? (
                <div className="flex items-center justify-center h-48 bg-white/5 rounded-xl border border-white/5 border-dashed">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">No storage nodes deployed</span>
                </div>
              ) : (
                storageNodes.map((node: any) => {
                  const isDegraded = node.storageStatus === 'degraded' || node.storageStatus === 'highly_degraded' || node.storageStatus === 'failed'
                  return (
                    <Card key={node.id} className={`p-5 flex flex-col gap-4 transition-colors ${isDegraded ? 'border-amber-500/50 bg-amber-950/10' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDegraded ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                            {isDegraded ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{node.catalogKey || 'Generic Storage'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="ghost" className="text-[9px] py-0.5">{node.raidLevel || 'RAID5'}</Badge>
                              <Badge variant={node.storageStatus === 'healthy' ? 'success' : 'warning'} className="text-[9px] py-0.5">
                                {node.storageStatus?.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant={isDegraded ? 'primary' : 'ghost'}
                          disabled={!isDegraded || node.storageStatus === 'rebuilding'}
                          onClick={() => rebuildRaidArray(node.id)}
                          icon={<RefreshCw size={14} className={node.storageStatus === 'rebuilding' ? 'animate-spin' : ''} />}
                          className={`text-xs h-8 ${isDegraded && node.storageStatus !== 'rebuilding' ? 'bg-amber-500 hover:bg-amber-600 text-black border-amber-400' : ''}`}
                        >
                          {node.storageStatus === 'rebuilding' ? 'REBUILDING...' : 'REBUILD ARRAY'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Drive Wear (Degradation)</span>
                            <span className="text-[10px] font-black text-white">{Math.floor(node.driveDegradation || 0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${(node.driveDegradation || 0) > 75 ? 'bg-rose-500' : (node.driveDegradation || 0) > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${node.driveDegradation || 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Capacity Used</span>
                            <span className="text-[10px] font-black text-white">{(node.usedStorageTB || 0).toFixed(1)} / {node.totalStorageTB} TB</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-400 transition-all duration-1000"
                              style={{ width: `${Math.min(100, ((node.usedStorageTB || 0) / (node.totalStorageTB || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'data_services' && (
            <div className="space-y-4">
              {storageNodes.length === 0 ? (
                 <div className="flex items-center justify-center h-48 bg-white/5 rounded-xl border border-white/5 border-dashed">
                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">No storage nodes deployed</span>
                 </div>
              ) : (
                storageNodes.map((node: any) => (
                  <Card key={node.id} className="p-5 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{node.catalogKey || 'Storage Array'}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">Manage Deduplication, Compression, and Tiering</p>
                    </div>

                    <div className="flex gap-6">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tier:</span>
                        <select 
                          value={node.tier || 'hdd'}
                          onChange={(e) => setStorageTier(node.id, e.target.value as 'hdd' | 'ssd' | 'nvme')}
                          className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                        >
                          <option value="hdd">HDD (Slow / Cheap)</option>
                          <option value="ssd">SSD (Fast / Balanced)</option>
                          <option value="nvme">NVMe (Ultra / Expensive)</option>
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant={node.deduplicationEnabled ? 'primary' : 'ghost'}
                          onClick={() => toggleDataService(node.id, 'deduplication', !node.deduplicationEnabled)}
                          icon={<Layers size={14} />}
                          className="text-xs h-8"
                        >
                          DEDUP
                        </Button>
                        <Button
                          variant={node.compressionEnabled ? 'primary' : 'ghost'}
                          onClick={() => toggleDataService(node.id, 'compression', !node.compressionEnabled)}
                          icon={<Zap size={14} />}
                          className="text-xs h-8"
                        >
                          COMPRESS
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
