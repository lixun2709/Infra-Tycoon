import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { HARDWARE_CATALOG, type HardwareCatalogKey, type HardwareCatalogSpec } from '../../physics/hardwareLibrary'
import type { LucideIcon } from 'lucide-react'
import { 
  Server, 
  Database, 
  Network, 
  Shield, 
  Fingerprint, 
  Zap, 
  Box, 
  Plus, 
  X,
  Layout,
  Lock
} from 'lucide-react'

type Category = 'compute' | 'storage' | 'network' | 'security' | 'identity' | 'facility'

interface ProcurementMenuProps {
  onAddRack: () => void
  isOpen: boolean
  onToggle: (open: boolean) => void
}

export function ProcurementMenu({ onAddRack, isOpen, onToggle }: ProcurementMenuProps) {
  const [showQueueList, setShowQueueList] = useState(false)
  const { 
    deploymentQueue,
    setPlacementMode,
    sites,
    currentSiteId,
    selectedNodeId
  } = useInfraStore(useShallow(state => ({
    deploymentQueue: state.deploymentQueue,
    setPlacementMode: state.setPlacementMode,
    sites: state.sites,
    currentSiteId: state.currentSiteId,
    selectedNodeId: state.selectedNodeId,
    isHardwareUnlocked: state.isHardwareUnlocked
  })))

  const [activeCategory, setActiveCategory] = useState<Category>('compute')

  const categories: { id: Category; label: string; icon: LucideIcon }[] = [
    { id: 'compute', label: 'Compute', icon: Server },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'identity', label: 'Identity', icon: Fingerprint },
    { id: 'facility', label: 'Facility', icon: Zap },
  ]

  const items = Object.entries(HARDWARE_CATALOG)
    .filter(([_, spec]) => spec.type === activeCategory || (activeCategory === 'facility' && spec.type === 'cooling'))
    .map(([key, spec]) => ({ key: key as HardwareCatalogKey, ...spec }))

  const stageAsset = (key: HardwareCatalogKey) => {
    useInfraStore.setState(state => ({
      deploymentQueue: [...state.deploymentQueue, key]
    }))
  }

  const currentSiteName = sites.find(s => s.id === currentSiteId)?.name

  return (
    <div className={`fixed bottom-8 z-[200] transition-all duration-500 ease-out ${selectedNodeId ? 'right-[576px]' : 'right-8'}`}>
      {/* Main Toggle Button */}
      <button 
        onClick={() => onToggle(!isOpen)}
        className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 glass-panel hover:scale-105 active:scale-95 ${isOpen ? 'border-teal-500/50 rotate-90 shadow-[0_0_20px_rgba(45,212,191,0.3)]' : 'border-teal-500/30 hover:border-teal-500/60'}`}
      >
        {isOpen ? <X size={28} className="text-teal-400" /> : <Box size={28} className="text-teal-400" />}
      </button>

      {/* Deployment Quick Action (Inventory Staging) */}
      {deploymentQueue.length > 0 && !isOpen && (
        <div className="absolute bottom-24 right-0 flex flex-col items-end gap-3">
          {showQueueList && (
            <div className="mb-2 w-72 glass-panel rounded-[2rem] p-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 mb-5 px-1">
                <Box size={16} className="text-teal-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Staging</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {deploymentQueue.map((key, idx) => {
                  const spec = HARDWARE_CATALOG[key]
                  return (
                    <button
                      key={`${key}-${idx}`}
                      onClick={() => {
                        setPlacementMode(true, key)
                        setShowQueueList(false)
                      }}
                      className="w-full group p-4 bg-white/5 hover:bg-teal-500/10 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-[#020617] transition-all">
                        <Plus size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{spec.name || key}</p>
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{spec.uHeight}U • {spec.type}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowQueueList(!showQueueList)}
            className={`w-16 h-16 bg-blue-600 rounded-2xl flex flex-col items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${showQueueList ? 'ring-4 ring-blue-400/50' : 'animate-pulse'}`}
          >
            <Box size={24} className="text-white" />
            <span className="text-[10px] font-black mt-1 text-white">{deploymentQueue.length}</span>
          </button>
        </div>
      )}

      {/* Asset Catalog Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-12 bg-black/80 backdrop-blur-sm" onClick={() => onToggle(false)}>
          <div 
            className="w-full max-w-5xl h-[80vh] glass-panel rounded-[3rem] flex overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Rail: Categories */}
            <div className="w-24 bg-slate-900/20 border-r border-slate-800 flex flex-col py-8 gap-4">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`group relative flex flex-col items-center py-4 gap-2 transition-all ${
                    activeCategory === cat.id ? 'text-teal-400' : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <cat.icon size={24} className={activeCategory === cat.id ? 'drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]' : ''} />
                  <span className="text-[7px] font-black uppercase tracking-widest">{cat.label}</span>
                  {activeCategory === cat.id && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-500 rounded-l-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Right Pane: Content */}
            <div className="flex-1 flex flex-col">
              <div className="p-10 border-b border-slate-800 bg-slate-900/10 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase text-white">Asset Catalog</h2>
                  <p className="text-[10px] text-teal-400 font-black uppercase tracking-[0.3em] mt-2">
                    Current Site: {currentSiteName}
                  </p>
                </div>
                <button 
                  onClick={onAddRack}
                  className="px-8 py-4 bg-teal-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(20,184,166,0.3)] flex items-center gap-3"
                >
                  <Layout size={16} />
                  Deploy 42U Rack
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-2 gap-8 bg-slate-900/5 custom-scrollbar">
                {items.map((item: HardwareCatalogSpec & { key: HardwareCatalogKey }) => {
                  const unlocked = isHardwareUnlocked(item.key)
                  return (
                  <button
                    key={item.key}
                    onClick={() => unlocked && stageAsset(item.key)}
                    className={`relative border rounded-[2.5rem] p-8 flex flex-col justify-between group transition-all text-left overflow-hidden h-56 ${
                      unlocked ? 'bg-slate-900/40 border-slate-800/50 hover:border-teal-500/30' : 'bg-slate-900/20 border-red-900/20 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {!unlocked && (
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                        <Lock size={32} className="text-red-500/50 mb-3" />
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                          Unlocks at Level {item.minLevel}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-teal-500 group-hover:scale-110 transition-transform">
                      <Box size={80} />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: item.color }} />
                        <h4 className="text-xl font-black tracking-tight uppercase text-white leading-none">{item.name || item.key}</h4>
                      </div>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-relaxed max-w-[80%]">
                        {item.uHeight}U Standard Chassis • {item.wattage}W Power Load
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Type</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase">{item.type}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Mass</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase">{item.uHeight * 12}kg</span>
                        </div>
                      </div>
                      <div className={`px-6 py-2.5 rounded-xl transition-all border ${
                        unlocked ? 'bg-teal-500/5 group-hover:bg-teal-500 group-hover:text-[#020617] border-teal-500/20' : 'bg-slate-800/50 border-slate-700'
                      }`}>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{unlocked ? 'Stage Asset' : 'Locked'}</span>
                      </div>
                    </div>
                  </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
