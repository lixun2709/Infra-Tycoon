import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { HARDWARE_CATALOG, type HardwareCatalogKey } from '../../physics/hardwareLibrary'
import { 
  Server, 
  Database, 
  Network, 
  Shield, 
  Fingerprint, 
  Zap, 
  ShoppingCart, 
  Box, 
  Plus, 
  Minus,
  CheckCircle2,
  Trash2,
  X,
  Info
} from 'lucide-react'

type Category = 'compute' | 'storage' | 'network' | 'security' | 'identity' | 'facility'

interface ProcurementMenuProps {
  onAddRack: () => void
  isOpen: boolean
  onToggle: (open: boolean) => void
}

export function ProcurementMenu({ onAddRack, isOpen, onToggle }: ProcurementMenuProps) {
  const [showQueueList, setShowQueueList] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<any>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const { 
    cashBalance, 
    shoppingCart, 
    addToCart, 
    removeFromCart, 
    clearCart, 
    checkout,
    deploymentQueue,
    setPlacementMode,
    placementMode
  } = useInfraStore()

  const [activeCategory, setActiveCategory] = useState<Category>('compute')

  const categories: { id: Category; label: string; icon: any }[] = [
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

  const cartTotal = shoppingCart.reduce((sum, item) => sum + (HARDWARE_CATALOG[item.key].purchasePrice * item.quantity), 0)
  const cartPower = shoppingCart.reduce((sum, item) => sum + (HARDWARE_CATALOG[item.key].wattage * item.quantity), 0) / 1000

  return (
    <div className="fixed bottom-8 right-8 z-[200]">
      {/* Main Toggle Button */}
      <button 
        onClick={() => onToggle(!isOpen)}
        className={`relative w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all shadow-2xl ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-teal-500 hover:bg-teal-400 animate-pulse'}`}
      >
        {isOpen ? <X size={32} className="text-white" /> : <ShoppingCart size={32} className="text-[#020617]" />}
        {!isOpen && shoppingCart.length > 0 && (
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full border-4 border-[#020617] flex items-center justify-center">
            <span className="text-[10px] font-black text-white">{shoppingCart.length}</span>
          </div>
        )}
      </button>

      {/* Deployment Quick Action (if queue exists) */}
      {deploymentQueue.length > 0 && !isOpen && (
        <div className="absolute bottom-24 right-0 flex flex-col items-end gap-3">
          {showQueueList && (
            <div className="mb-2 w-64 bg-[#0a1536]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Box size={14} className="text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Staging</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {deploymentQueue.map((key, idx) => (
                  <button
                    key={`${key}-${idx}`}
                    onClick={() => {
                      setPlacementMode(true, key)
                      setShowQueueList(false)
                    }}
                    className="w-full group p-3 bg-white/5 hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/30 rounded-2xl transition-all flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <Plus size={14} />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-white uppercase tracking-tight">{HARDWARE_CATALOG[key].name || key}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">{HARDWARE_CATALOG[key].type}</p>
                    </div>
                  </button>
                ))}
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

      {/* Main Dual-Pane Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-12 bg-black/80 backdrop-blur-sm" onClick={() => onToggle(false)}>
          <div 
            className="w-full max-w-5xl h-[80vh] bg-[#020617] border border-slate-800 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Left Pane: Catalog */}
            <div className="w-2/3 flex flex-col border-r border-slate-800">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase">Hardware Procurement</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Tier-IV Datacenter Catalog</p>
                </div>
                <div className="px-6 py-3 bg-slate-950 border border-teal-500/20 rounded-2xl text-right">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Available CapEx</p>
                  <p className="text-xl font-mono font-black text-teal-400">${cashBalance.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex border-b border-slate-800 bg-slate-900/10">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-1 flex flex-col items-center py-5 gap-1 transition-all ${
                      activeCategory === cat.id 
                        ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <cat.icon size={18} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
                  </button>
                ))}
              </div>

              <div 
                className="flex-1 overflow-y-auto p-8 grid grid-cols-2 gap-6 bg-slate-900/5 relative"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                }}
              >
                {items.map(item => (
                  <div 
                    key={item.key} 
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-6 flex flex-col justify-between group hover:border-teal-500/30 transition-all relative h-48"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-3 rounded-full shadow-inner" style={{ backgroundColor: item.color }} />
                        <span className="text-teal-500 font-mono text-xs font-black">${item.purchasePrice.toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-black tracking-tight mb-2 uppercase">{item.name || item.key}</h4>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest opacity-60">
                        {item.uHeight > 0 ? `${item.uHeight}U Chassis` : 'Rack Integration Module'} • {item.wattage}W Load
                      </p>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between">
                      <button 
                        onClick={() => removeFromCart(item.key)}
                        className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-lg font-black font-mono">
                        {shoppingCart.find(i => i.key === item.key)?.quantity || 0}
                      </span>
                      <button 
                        onClick={() => addToCart(item.key)}
                        className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-teal-500/20 hover:text-teal-400 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Special Case: Racks */}
                {activeCategory === 'facility' && (
                  <div 
                    onMouseEnter={() => setHoveredItem({ ...HARDWARE_CATALOG.RACK_42U, name: 'Standard 42U Rack' })}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="bg-teal-500/5 border border-teal-500/20 rounded-3xl p-6 flex flex-col justify-between group relative transition-all hover:border-teal-500/50"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-3 rounded-full bg-slate-600" />
                        <span className="text-teal-400 font-mono text-xs font-black">$200</span>
                      </div>
                      <h4 className="text-sm font-black tracking-tight mb-2 uppercase">Standard 42U Rack</h4>
                      <p className="text-[9px] text-teal-400/50 font-black uppercase tracking-widest">Immediate Grid Placement</p>
                    </div>
                    <button 
                      onClick={() => {
                        onAddRack()
                        onToggle(false)
                      }}
                      className="mt-6 w-full py-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400 text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 hover:text-black transition-all"
                    >
                      Place Immediately
                    </button>
                  </div>
                )}

                {/* Global Flexible Tooltip */}
                {hoveredItem && (
                  <div 
                    className="absolute pointer-events-none z-[300] animate-in fade-in duration-200"
                    style={{ 
                      left: mousePos.x,
                      top: mousePos.y,
                      transform: `translate(${mousePos.x > 300 ? '-105%' : '20px'}, ${mousePos.y > 300 ? '-105%' : '20px'})`
                    }}
                  >
                    <div className="w-72 bg-[#020617]/98 backdrop-blur-xl border border-teal-500/30 rounded-2xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] border-t-teal-500">
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
                        <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-teal-400">
                          <Info size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Architects Notes</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">System Blueprint V1.4</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                        {hoveredItem.useCase}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Project Summary */}
            <div className="w-1/3 flex flex-col bg-[#010413]">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/10">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-500/10 p-2 rounded-lg">
                    <ShoppingCart size={20} className="text-teal-500" />
                  </div>
                  <h3 className="font-black text-sm tracking-[0.2em] uppercase">Project Manifest</h3>
                </div>
                <button onClick={clearCart} className="text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {shoppingCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                    <Box size={64} className="mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">No Items Staged</p>
                  </div>
                ) : (
                  shoppingCart.map(item => (
                    <div key={item.key} className="flex justify-between items-center group animate-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: HARDWARE_CATALOG[item.key].color, backgroundColor: 'currentColor' }} />
                        <span className="text-xs text-slate-300 font-black tracking-tight">{HARDWARE_CATALOG[item.key].name || item.key}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-lg">x{item.quantity}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-slate-900/20 border-t border-slate-800 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Thermal Load</span>
                    <span className="text-sm font-black text-white font-mono">{(cartPower * 3412.14 / 1000).toFixed(1)} <span className="text-[10px] text-slate-500">KBTU</span></span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimated Power Draw</span>
                    <span className="text-sm font-black text-white font-mono">{cartPower.toFixed(2)} <span className="text-[10px] text-slate-500">KW</span></span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em]">Total Investment</span>
                    <span className={`text-2xl font-black font-mono tracking-tighter ${cartTotal > cashBalance ? 'text-red-500' : 'text-white'}`}>
                      ${cartTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  disabled={shoppingCart.length === 0 || cartTotal > cashBalance}
                  onClick={() => {
                    checkout()
                    onToggle(false)
                  }}
                  className="w-full py-5 bg-teal-500 hover:bg-teal-400 disabled:opacity-10 disabled:cursor-not-allowed text-[#020617] font-black uppercase tracking-[0.3em] text-sm rounded-[1.5rem] transition-all shadow-[0_20px_40px_rgba(20,184,166,0.3)] flex items-center justify-center gap-3 active:scale-95"
                >
                  <CheckCircle2 size={20} />
                  Authorize Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
