import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { HARDWARE_CATALOG, type HardwareCatalogKey } from '../../physics/hardwareLibrary'

interface ProcurementMenuProps {
  onAddRack: () => void
  onTryPlace: (key: HardwareCatalogKey) => void
  placementMode: boolean
}

export function ProcurementMenu({ onAddRack, onTryPlace, placementMode }: ProcurementMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const cashBalance = useInfraStore(s => s.cashBalance)

  const items: { key: HardwareCatalogKey; label: string; icon: string; price: number }[] = [
    { key: 'COMPUTE_1U', label: 'Compute (1U)', icon: '🖥️', price: HARDWARE_CATALOG.COMPUTE_1U.purchasePrice },
    { key: 'NETAPP_STORAGE_2U', label: 'NetApp Shelf (2U)', icon: '🗄️', price: HARDWARE_CATALOG.NETAPP_STORAGE_2U.purchasePrice },
    { key: 'RUBRIK_BACKUP_2U', label: 'Rubrik Node (2U)', icon: '🛡️', price: HARDWARE_CATALOG.RUBRIK_BACKUP_2U.purchasePrice },
    { key: 'SWITCH_1U', label: 'Managed Switch (1U)', icon: '🔌', price: HARDWARE_CATALOG.SWITCH_1U.purchasePrice },
    { key: 'CRAC_UNIT_4U', label: 'CRAC Unit (4U)', icon: '❄️', price: HARDWARE_CATALOG.CRAC_UNIT_4U.purchasePrice },
    { key: 'LOAD_BALANCER_1U', label: 'Load Balancer (1U)', icon: '⚖️', price: HARDWARE_CATALOG.LOAD_BALANCER_1U.purchasePrice },
  ]

  const rackPrice = HARDWARE_CATALOG.RACK_42U.purchasePrice

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Menu Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[-1]" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Content */}
      <div className={`absolute bottom-20 right-0 w-72 bg-[#0a1536]/95 border border-[#48afbb]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}`}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-white tracking-widest uppercase">Procurement</h3>
            <span className="text-[10px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full font-bold">CapEx</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Select hardware to deploy</p>
        </div>

        <div className="p-4 flex flex-col gap-2 max-h-[400px] overflow-y-auto">
          {/* Rack Option */}
          <button
            onClick={() => {
              onAddRack()
              setIsOpen(false)
            }}
            disabled={placementMode}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${placementMode ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-teal-500/10 border-teal-500/30 text-white hover:bg-teal-500/20 hover:border-teal-500'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🏗️</span>
              <div className="text-left">
                <p className="text-xs font-bold">42U Server Rack</p>
                <p className="text-[9px] text-teal-400/70 font-bold uppercase tracking-tighter">${rackPrice.toLocaleString()}.00</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-teal-500">ADD</span>
          </button>

          <div className="my-2 border-t border-white/5" />

          {/* Hardware Options */}
          {items.map(item => (
            <button
              key={item.key}
              onClick={() => {
                onTryPlace(item.key)
                setIsOpen(false)
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
                <div className="text-left">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">${item.price.toLocaleString()}.00</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-500 group-hover:text-teal-400 transition-colors">BUY</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-black/40 rounded-b-2xl border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Available Cash</span>
            <span className="text-sm font-black text-emerald-400">${cashBalance?.toLocaleString() ?? '0.00'}</span>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 group ${isOpen ? 'bg-red-500 rotate-45' : 'bg-teal-500 hover:scale-110'}`}
      >
        {isOpen ? (
          <span className="text-2xl text-white">✕</span>
        ) : (
          <div className="relative">
            <span className="text-2xl text-[#020617]">🛒</span>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75" />
          </div>
        )}
      </button>
    </div>
  )
}
