import React, { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { Tenant } from '../../store/useInfraStore'

export function TenantManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tenants, nodes, addTenant, removeTenant, assignNodeToTenant, updateNodeQoS } = useInfraStore()
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantColor, setNewTenantColor] = useState('#3b82f6')
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreateTenant = () => {
    if (!newTenantName) return
    const tenant: Tenant = {
      id: crypto.randomUUID(),
      name: newTenantName,
      color: newTenantColor,
      budget: 5000, // Default budget
    }
    addTenant(tenant)
    setNewTenantName('')
  }

  const selectedTenantNodes = nodes.filter(n => n.tenantId === selectedTenantId)
  const unassignedNodes = nodes.filter(n => !n.tenantId && n.type !== 'rack' && n.type !== 'cooling')

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#0a1128] border border-slate-700/50 rounded-2xl w-full max-w-6xl flex h-[85vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {/* Left Sidebar: Tenant List */}
        <div className="w-72 border-r border-slate-700/50 flex flex-col bg-slate-900/40">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-sm font-black text-white tracking-widest flex items-center gap-2">
              <span>👥</span> TENANTS
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tenants.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTenantId(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${selectedTenantId === t.id ? 'bg-slate-800 border-slate-500 shadow-lg' : 'bg-slate-900/40 border-transparent hover:border-slate-700'}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-xs font-bold text-white">{t.name}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Budget: ${t.budget}/mo</p>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-700/50 bg-slate-950/30">
            <p className="text-[9px] font-bold text-slate-500 uppercase mb-3">Create New Client</p>
            <input 
              type="text"
              placeholder="Tenant Name"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white mb-2"
              value={newTenantName}
              onChange={e => setNewTenantName(e.target.value)}
            />
            <div className="flex gap-2">
              <input 
                type="color"
                className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                value={newTenantColor}
                onChange={e => setNewTenantColor(e.target.value)}
              />
              <button 
                onClick={handleCreateTenant}
                disabled={!newTenantName}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[10px] font-black text-white rounded uppercase tracking-widest"
              >
                Add Tenant
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Tenant Details & Node Assignment */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/20">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {selectedTenantId ? `Managing ${tenants.find(t => t.id === selectedTenantId)?.name}` : 'Select a tenant to manage isolation'}
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {selectedTenantId ? (
              <>
                {/* Assigned Nodes */}
                <div className="flex-1 p-6 overflow-y-auto border-r border-slate-700/30">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Assigned Infrastructure</h4>
                  <div className="space-y-2">
                    {selectedTenantNodes.map(n => (
                      <div key={n.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg flex justify-between items-center group">
                        <div>
                          <p className="text-xs font-bold text-white">{n.name}</p>
                          <p className="text-[9px] text-slate-500">{n.assetTag} • {n.type.toUpperCase()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <label className="flex items-center gap-1.5 cursor-pointer">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">QoS</span>
                              <input 
                                type="checkbox"
                                checked={n.qosEnabled}
                                onChange={(e) => updateNodeQoS(n.id, e.target.checked)}
                                className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-0"
                              />
                           </label>
                           <button 
                            onClick={() => assignNodeToTenant(n.id, null)}
                            className="text-[9px] text-red-500 hover:text-red-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                           >UNASSIGN</button>
                        </div>
                      </div>
                    ))}
                    {selectedTenantNodes.length === 0 && (
                      <p className="text-sm text-slate-600 text-center py-8 italic">No nodes assigned to this tenant.</p>
                    )}
                  </div>
                </div>

                {/* Available Nodes */}
                <div className="w-80 p-6 bg-slate-950/20 overflow-y-auto">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest text-center">Unassigned Pool</h4>
                  <div className="space-y-2">
                    {unassignedNodes.map(n => (
                      <button 
                        key={n.id}
                        onClick={() => assignNodeToTenant(n.id, selectedTenantId)}
                        className="w-full bg-slate-900/40 border border-slate-800 p-2 rounded text-left hover:border-blue-500/50 hover:bg-blue-900/10 transition-all"
                      >
                        <p className="text-[11px] font-bold text-slate-300">{n.name}</p>
                        <p className="text-[9px] text-slate-600 uppercase">{n.type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                 <span className="text-4xl mb-4">🏗️</span>
                 <p className="text-sm text-slate-400 max-w-xs">Create and select a tenant to carve up your physical infrastructure into logical partitions.</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-700/50 bg-slate-950/50 flex justify-between items-center">
             <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                   <span className="text-[9px] text-slate-500 font-bold uppercase">Logical Isolation</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                   <span className="text-[9px] text-slate-500 font-bold uppercase">QoS Guaranteed</span>
                </div>
             </div>
             <button onClick={onClose} className="px-6 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded uppercase tracking-widest transition-colors">Close Manager</button>
          </div>
        </div>
      </div>
    </div>
  )
}
