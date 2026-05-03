import React, { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function NetworkManager() {
  const { 
    isNetworkManagerOpen, 
    setNetworkManagerOpen, 
    nodes, 
    connections, 
    addReplicationLink, 
    removeConnection,
    sites,
    currentSiteId
  } = useInfraStore()
  
  const [activeTab, setActiveTab] = useState<'global' | 'local'>('global')
  const [sourceId, setSourceId] = useState<string>('')
  const [sourcePortId, setSourcePortId] = useState<string>('')
  const [targetId, setTargetId] = useState<string>('')
  const [targetPortId, setTargetPortId] = useState<string>('')

  // Reset ports when node selection changes
  React.useEffect(() => { setSourcePortId('') }, [sourceId])
  React.useEffect(() => { setTargetPortId('') }, [targetId])

  if (!isNetworkManagerOpen) return null

  const primarySiteId = sites[0]?.id
  const drSiteId = sites[1]?.id

  const primaryNodes = nodes.filter(n => n.siteId === primarySiteId && (n.type === 'storage' || n.type === 'backup' || n.type === 'compute'))
  const drNodes = nodes.filter(n => n.siteId === drSiteId && (n.type === 'storage' || n.type === 'backup' || n.type === 'compute'))
  
  // Local DC nodes
  const localNodes = nodes.filter(n => n.siteId === currentSiteId && n.type !== 'rack' && n.type !== 'cooling')

  const sourceNode = nodes.find(n => n.id === sourceId)
  const targetNode = nodes.find(n => n.id === targetId)

  const usedPorts = new Set(connections.map(c => c.startPortId).concat(connections.map(c => c.endPortId)))
  const availableSourcePorts = sourceNode?.ports.filter(p => !usedPorts.has(p.id)) || []
  const availableTargetPorts = targetNode?.ports.filter(p => !usedPorts.has(p.id)) || []

  const handleCreateLink = () => {
    if (sourceId && sourcePortId && targetId && targetPortId) {
      addReplicationLink(sourceId, sourcePortId, targetId, targetPortId)
      setSourceId('')
      setSourcePortId('')
      setTargetId('')
      setTargetPortId('')
    }
  }

  // Filter connections based on tab
  const filteredLinks = activeTab === 'global' 
    ? connections.filter(conn => {
        const s = nodes.find(n => n.id === conn.startNodeId)
        const e = nodes.find(n => n.id === conn.endNodeId)
        return s?.siteId !== e?.siteId
      })
    : connections.filter(conn => {
        const s = nodes.find(n => n.id === conn.startNodeId)
        const e = nodes.find(n => n.id === conn.endNodeId)
        return s?.siteId === currentSiteId && e?.siteId === currentSiteId
      })

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/90 backdrop-blur-xl p-6" onClick={() => setNetworkManagerOpen(false)}>
      <div className="bg-[#0f172a] border border-teal-500/30 p-8 rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] max-w-6xl w-full flex flex-col gap-6 max-h-[85vh] animate-in zoom-in-95 duration-300 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Glossy Background Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-purple-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-[100px]" />

        <div className="flex justify-between items-start relative z-10">
          <div>
            <h2 className="text-3xl font-black text-white flex items-center gap-3">
              <span className="p-2 bg-teal-500/20 rounded-xl border border-teal-500/30 text-teal-400">🌐</span> 
              Connectivity Matrix
            </h2>
            <p className="text-slate-400 mt-2 font-medium">Enterprise Port-to-Port Patching & Site Replication</p>
          </div>
          <button 
            onClick={() => setNetworkManagerOpen(false)}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 transition-all border border-white/5"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/5 w-fit relative z-10">
          <button 
            onClick={() => setActiveTab('global')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-teal-500 text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.4)]' : 'text-slate-400 hover:text-white'}`}
          >
            Global Replication
          </button>
          <button 
            onClick={() => setActiveTab('local')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'local' ? 'bg-teal-500 text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.4)]' : 'text-slate-400 hover:text-white'}`}
          >
            Local DC Patching
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8 relative z-10 flex-1 overflow-hidden">
          {/* Patching Controls */}
          <div className="col-span-5 bg-slate-900/50 p-6 rounded-3xl border border-white/5 flex flex-col gap-6">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Patch New Connection
            </h3>
            
            <div className="space-y-6">
              {/* Source Section */}
              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Source Node & Port</label>
                <div className="grid grid-cols-2 gap-3">
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                  >
                    <option value="">Select Hardware</option>
                    {(activeTab === 'global' ? primaryNodes : localNodes).map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    value={sourcePortId}
                    onChange={(e) => setSourcePortId(e.target.value)}
                    disabled={!sourceId}
                  >
                    <option value="">Select Port</option>
                    {availableSourcePorts.map(p => (
                      <option key={p.id} value={p.id}>{p.label} ({p.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center -my-3 opacity-20">
                <div className="h-8 w-px bg-gradient-to-b from-teal-500 to-transparent" />
              </div>

              {/* Destination Section */}
              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Destination Node & Port</label>
                <div className="grid grid-cols-2 gap-3">
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">Select Hardware</option>
                    {(activeTab === 'global' ? drNodes : localNodes).filter(n => n.id !== sourceId).map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    value={targetPortId}
                    onChange={(e) => setTargetPortId(e.target.value)}
                    disabled={!targetId}
                  >
                    <option value="">Select Port</option>
                    {availableTargetPorts.map(p => (
                      <option key={p.id} value={p.id}>{p.label} ({p.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCreateLink}
                disabled={!sourceId || !sourcePortId || !targetId || !targetPortId}
                className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-2xl transition-all shadow-[0_20px_50px_rgba(45,212,191,0.2)] hover:shadow-[0_20px_50px_rgba(45,212,191,0.4)] disabled:shadow-none mt-4 text-xs uppercase tracking-[0.2em]"
              >
                Establish Patch Link
              </button>
            </div>
          </div>

          {/* Connection Table */}
          <div className="col-span-7 bg-slate-900/50 rounded-3xl border border-white/5 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-slate-800/30 flex justify-between items-center">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                {activeTab === 'global' ? 'Active WAN Replications' : 'Datacenter Patch Panel'}
              </h3>
              <span className="px-3 py-1 bg-teal-500/10 text-teal-400 text-[10px] font-bold rounded-full border border-teal-500/20">
                {filteredLinks.length} Active Links
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
              {filteredLinks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                  <div className="text-4xl opacity-20">📡</div>
                  <p className="text-xs italic font-medium">No active {activeTab} links established.</p>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {filteredLinks.map(conn => {
                    const sNode = nodes.find(n => n.id === conn.startNodeId)
                    const eNode = nodes.find(n => n.id === conn.endNodeId)
                    const sPort = sNode?.ports.find(p => p.id === conn.startPortId)
                    const ePort = eNode?.ports.find(p => p.id === conn.endPortId)
                    const isHealthy = sNode?.healthStatus !== 'critical' && eNode?.healthStatus !== 'critical'
                    
                    return (
                      <div key={conn.id} className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 hover:border-teal-500/30 transition-all group">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              {activeTab === 'global' ? 'WAN Link' : 'Local Patch'}
                            </span>
                          </div>
                          <button 
                            onClick={() => removeConnection(conn.id)}
                            className="text-[9px] font-black text-red-500/70 hover:text-red-400 uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                          >
                            Unpatch
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="text-white font-bold text-sm truncate">{sNode?.name}</div>
                            <div className="text-teal-400 font-mono text-[10px] mt-1">{sPort?.label}</div>
                          </div>
                          <div className="text-slate-700 flex flex-col items-center gap-1">
                            <div className="text-[10px] font-black">↔</div>
                            <div className="text-[8px] opacity-40 uppercase font-black">100G</div>
                          </div>
                          <div className="flex-1 text-right">
                            <div className="text-white font-bold text-sm truncate">{eNode?.name}</div>
                            <div className="text-teal-400 font-mono text-[10px] mt-1">{ePort?.label}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
