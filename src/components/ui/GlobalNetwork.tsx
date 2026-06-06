import { useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import type { ServiceType } from '../../store/infraTypes'
import { TECHNICAL_MANUALS } from '../../physics/Manuals'

export function GlobalNetwork() {
  const { 
    isNetworkManagerOpen, 
    setNetworkManagerOpen, 
    connections, 
    sites,
    currentSiteId,
    patchConnection,
    removeConnection,
    getServiceStatus,
    updateConnectionConfig
  } = useInfraStore(useShallow(state => ({
    isNetworkManagerOpen: state.isNetworkManagerOpen, 
    setNetworkManagerOpen: state.setNetworkManagerOpen, 
    connections: state.connections, 
    sites: state.sites,
    currentSiteId: state.currentSiteId,
    patchConnection: state.patchConnection,
    removeConnection: state.removeConnection,
    getServiceStatus: state.getServiceStatus,
    updateConnectionConfig: state.updateConnectionConfig
  })))

  const nodes = useInfraStore.getState().nodes
  
  const [activeTab, setActiveTab] = useState<'topology' | 'patching' | 'services' | 'sdn'>('topology')
  const [serviceSubTab, setServiceSubTab] = useState<'overview' | 'DHCP' | 'DNS' | 'NTP'>('overview')
  const [selectedRackIds, setSelectedRackIds] = useState<Set<string>>(new Set())
  const [flippedServices, setFlippedServices] = useState<Set<ServiceType>>(new Set())
  const [configuringService, setConfiguringService] = useState<ServiceType | null>(null)
  
  const [srcRackId, setSrcRackId] = useState('')
  const [srcNodeId, setSrcNodeId] = useState('')
  const [srcPortId, setSrcPortId] = useState('')
  
  const [dstRackId, setDstRackId] = useState('')
  const [dstNodeId, setDstNodeId] = useState('')
  const [dstPortId, setDstPortId] = useState('')

  const [tick, setTick] = useState(0)

  const { dnsRecords, addDnsRecord, removeDnsRecord, autoPatchRack } = useInfraStore(useShallow(state => ({
    dnsRecords: state.dnsRecords, 
    addDnsRecord: state.addDnsRecord, 
    removeDnsRecord: state.removeDnsRecord, 
    autoPatchRack: state.autoPatchRack
  })))

  useEffect(() => {
    if (!isNetworkManagerOpen) return undefined
    const interval = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(interval)
  }, [isNetworkManagerOpen])

  if (!isNetworkManagerOpen) return null

  const toggleRackSelection = (id: string) => {
    const next = new Set(selectedRackIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedRackIds(next)
  }

  const toggleFlip = (type: ServiceType) => {
    const next = new Set(flippedServices)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setFlippedServices(next)
  }

  const handlePatch = () => {
    if (srcNodeId && srcPortId && dstNodeId && dstPortId) {
      patchConnection(srcNodeId, srcPortId, dstNodeId, dstPortId)
      setSrcPortId('')
      setDstPortId('')
      setActiveTab('topology')
    }
  }

  const renderTopology = () => {
    const siteRacks = nodes.filter((n: any) => n.siteId === currentSiteId && n.type === 'rack')
    
    // Filter connections based on selected racks
    const filteredConnections = connections.filter((conn: any) => {
      if (selectedRackIds.size === 0) return false // v1.6: Only show selected
      const sNode = nodes.find((n: any) => n.id === conn.startNodeId)
      const eNode = nodes.find((n: any) => n.id === conn.endNodeId)
      return (sNode?.parentRackId && selectedRackIds.has(sNode.parentRackId)) || 
             (eNode?.parentRackId && selectedRackIds.has(eNode.parentRackId))
    })

    return (
      <div className="flex-1 overflow-hidden flex gap-6">
        {/* Multi-Select Sidebar */}
        <div className="w-80 bg-slate-900/50 rounded-3xl border border-white/5 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-white/5 bg-slate-800/30">
              <div className="flex justify-between items-center mb-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Enterprise Context</label>
                 <button 
                   onClick={() => setSelectedRackIds(new Set())}
                   className="text-[9px] font-bold text-teal-400 hover:text-teal-300"
                 >
                   Reset Filter
                 </button>
              </div>
              <div className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-[10px] text-teal-400 font-black uppercase tracking-widest flex items-center gap-3">
                <span className="text-sm">🛰️</span>
                {sites.find((s: any) => s.id === currentSiteId)?.name}
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar scrollbar-hide">
              {siteRacks.map((rack: any) => (
                <div key={rack.id} className="space-y-1">
                  <div className={`flex items-center gap-2 p-2 rounded-lg transition-all ${selectedRackIds.has(rack.id) ? 'bg-teal-500/10 border border-teal-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedRackIds.has(rack.id)}
                      onChange={() => toggleRackSelection(rack.id)}
                      className="w-3 h-3 rounded border-white/10 bg-slate-950 text-teal-500 focus:ring-0 cursor-pointer"
                    />
                    <button 
                      onClick={() => toggleRackSelection(rack.id)}
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{rack.name}</span>
                      </div>
                      <span className="text-[8px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded-md">
                        {nodes.filter((n: any) => n.parentRackId === rack.id).length} U
                      </span>
                    </button>
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Live Status & Bandwidth */}
        <div className="flex-1 bg-slate-900/50 rounded-3xl border border-white/5 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-white/5 bg-slate-800/30 flex justify-between items-center">
              <div>
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Logical Traffic Fabric</h3>
                <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Showing {filteredConnections.length} active flows in selected racks</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Established</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Transferring</span>
                </div>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar scrollbar-hide">
              {selectedRackIds.size === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                  <div className="text-4xl mb-4">📐</div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">No Racks Selected</h4>
                  <p className="text-xs text-slate-400 max-w-xs">Select one or more racks from the sidebar to visualize their internal and external logical connections.</p>
                </div>
              ) : filteredConnections.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                  <div className="text-4xl mb-4">🔌</div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">No Logical Connections</h4>
                  <p className="text-xs text-slate-400 max-w-xs">Selected racks are physically present but not logically patched to the network fabric.</p>
                </div>
              ) : (
                filteredConnections.map((conn: any) => {
                  const sNode = nodes.find((n: any) => n.id === conn.startNodeId)
                  const eNode = nodes.find((n: any) => n.id === conn.endNodeId)
                  const sPort = sNode?.ports.find((p: any) => p.id === conn.startPortId)
                  const ePort = eNode?.ports.find((p: any) => p.id === conn.endPortId)
                  
                  // Determine Protocol Label
                  let protocol = 'TCP/IP'
                  if (sNode?.services?.some((s: any) => s.type === 'storage') || eNode?.services?.some((s: any) => s.type === 'storage')) protocol = 'ISCSI'
                  if (sNode?.services?.some((s: any) => s.type === 'DHCP') || eNode?.services?.some((s: any) => s.type === 'DHCP')) protocol = 'DHCP/UDP'
                  if (sNode?.services?.some((s: any) => s.type === 'DNS') || eNode?.services?.some((s: any) => s.type === 'DNS')) protocol = 'DNS/53'

                  return (
                    <div key={conn.id} className="bg-slate-950 p-5 rounded-2xl border border-white/5 flex items-center gap-6 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/0 via-teal-500/[0.02] to-teal-500/0 group-hover:via-teal-500/[0.05] transition-all" />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-200 uppercase">{sNode?.hostname || sNode?.name}</span>
                          <span className="text-[8px] bg-slate-900 text-teal-500/60 px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">{sNode?.managementIP || 'BOOTING'}</span>
                        </div>
                        <div className="text-teal-400 font-mono text-[9px]">{sPort?.label} <span className="text-slate-600 ml-2">MAC: {sNode?.macAddress || 'PENDING'}</span></div>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1 min-w-[180px]">
                         <div className="px-3 py-0.5 bg-slate-900 border border-white/10 rounded-full text-[8px] font-black text-teal-500 uppercase tracking-widest mb-1 shadow-[0_0_15px_rgba(45,212,191,0.1)]">{protocol}</div>
                         <div className="flex gap-1.5 mb-1">
                            {[1,2,3,4,5,6,7,8].map(i => (
                              <div key={i} className={`w-1 h-1 rounded-full bg-teal-500/40 animate-pulse`} style={{ animationDelay: `${i*100}ms` }} />
                            ))}
                         </div>
                         <div className="text-[8px] font-black text-slate-700 uppercase tracking-widest flex gap-3">
                           <span>{conn.bandwidthGbps} Gbps</span>
                           <span>{conn.latencyMs.toFixed(2)} ms</span>
                         </div>
                      </div>

                      <div className="flex-1 text-right">
                        <div className="flex items-center gap-2 mb-1 justify-end">
                          <span className="text-[8px] bg-slate-900 text-teal-500/60 px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">{eNode?.managementIP || 'BOOTING'}</span>
                          <span className="text-[10px] font-black text-slate-200 uppercase">{eNode?.hostname || eNode?.name}</span>
                        </div>
                        <div className="text-teal-400 font-mono text-[9px]"><span className="text-slate-600 mr-2">MAC: {eNode?.macAddress || 'PENDING'}</span> {ePort?.label}</div>
                      </div>
                      
                      <button 
                        onClick={() => removeConnection(conn.id)}
                        className="ml-2 p-2 rounded-lg hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
           </div>
        </div>
      </div>
    )
  }

  const renderPatching = () => {
    const racks = nodes.filter((n: any) => n.siteId === currentSiteId && n.type === 'rack')
    const srcNodes = nodes.filter((n: any) => n.parentRackId === srcRackId)
    const dstNodes = nodes.filter((n: any) => n.parentRackId === dstRackId)
    
    const srcNode = nodes.find((n: any) => n.id === srcNodeId)
    const srcPorts = srcNode?.ports.filter((p: any) => !connections.some((c: any) => (c.startNodeId === srcNodeId && c.startPortId === p.id) || (c.endNodeId === srcNodeId && c.endPortId === p.id))) || []
    
    const srcPort = srcPorts.find((p: any) => p.id === srcPortId)
    
    const dstNode = nodes.find((n: any) => n.id === dstNodeId)
    const dstPorts = dstNode?.ports.filter((p: any) => {
       const isUnused = !connections.some((c: any) => (c.startNodeId === dstNodeId && c.startPortId === p.id) || (c.endNodeId === dstNodeId && c.endPortId === p.id))
       if (!srcPort) return isUnused
       return isUnused && p.type === srcPort.type
    }) || []

    return (
      <div className="flex-1 flex flex-col items-center justify-start py-4 gap-6 max-w-6xl mx-auto w-full relative overflow-y-auto custom-scrollbar scrollbar-hide">
         <div className="flex justify-between items-center w-full relative z-10 px-6">
            <div>
              <p className="text-teal-500 text-[10px] font-black uppercase tracking-[0.4em]">Enterprise Patch Panel</p>
              <h3 className="text-white text-lg font-black uppercase mt-1">Cross-Connect Provisioning</h3>
            </div>
            <div className="flex gap-3">
               <button 
                 disabled={!srcRackId}
                 onClick={() => autoPatchRack(srcRackId)}
                 className="px-5 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 text-[9px] font-black uppercase tracking-widest rounded-xl border border-teal-500/30 transition-all disabled:opacity-20"
               >
                 ⚡ Rack Auto-Patch
               </button>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-8 w-full relative z-10 px-6">
            {/* SOURCE INTERFACE */}
            <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
               <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-teal-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-xs shadow-[0_0_15px_rgba(45,212,191,0.3)]">A</div>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Logical Source</h4>
                    <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Origin Interface</p>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Asset Rack</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold focus:border-teal-500 transition-all outline-none appearance-none cursor-pointer"
                       value={srcRackId}
                       onChange={(e) => { setSrcRackId(e.target.value); setSrcNodeId(''); setSrcPortId(''); }}
                     >
                       <option value="">Select Rack</option>
                       {racks.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                     </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Hardware Node</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold focus:border-teal-500 transition-all outline-none disabled:opacity-20 appearance-none cursor-pointer"
                       value={srcNodeId}
                       disabled={!srcRackId}
                       onChange={(e) => { setSrcNodeId(e.target.value); setSrcPortId(''); }}
                     >
                       <option value="">Select Node</option>
                       {srcNodes.map((n: any) => <option key={n.id} value={n.id}>{n.hostname || n.name} ({n.type})</option>)}
                     </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-1">Physical Port</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-white font-bold focus:border-teal-500 transition-all outline-none disabled:opacity-20 appearance-none cursor-pointer"
                       value={srcPortId}
                       disabled={!srcNodeId}
                       onChange={(e) => setSrcPortId(e.target.value)}
                     >
                       <option value="">Select Port</option>
                       {srcPorts.map((p: any) => <option key={p.id} value={p.id}>{p.label} ({p.type})</option>)}
                     </select>
                  </div>
               </div>
            </div>

            {/* DESTINATION INTERFACE */}
            <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
               <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-slate-800 text-teal-400 rounded-xl flex items-center justify-center font-black text-xs border border-teal-500/20">B</div>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Logical Destination</h4>
                    <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Target Interface</p>
                  </div>
               </div>
               
               <div className="space-y-5">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Asset Rack</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] text-white font-bold focus:border-teal-500 transition-all outline-none appearance-none cursor-pointer"
                       value={dstRackId}
                       onChange={(e) => { setDstRackId(e.target.value); setDstNodeId(''); setDstPortId(''); }}
                     >
                       <option value="">Select Rack</option>
                       {racks.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Hardware Node</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] text-white font-bold focus:border-teal-500 transition-all outline-none disabled:opacity-20 appearance-none cursor-pointer"
                       value={dstNodeId}
                       disabled={!dstRackId}
                       onChange={(e) => { setDstNodeId(e.target.value); setDstPortId(''); }}
                     >
                       <option value="">Select Node</option>
                       {dstNodes.map((n: any) => <option key={n.id} value={n.id}>{n.hostname || n.name} ({n.type})</option>)}
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Physical Port</label>
                     <select 
                       className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] text-white font-bold focus:border-teal-500 transition-all outline-none disabled:opacity-20 appearance-none cursor-pointer"
                       value={dstPortId}
                       disabled={!dstNodeId}
                       onChange={(e) => setDstPortId(e.target.value)}
                     >
                       <option value="">Select Port</option>
                       {dstPorts.map((p: any) => <option key={p.id} value={p.id}>{p.label} ({p.type})</option>)}
                     </select>
                  </div>
               </div>
            </div>
         </div>

         <div className="w-full max-w-md px-6 relative z-10">
            <button 
              onClick={handlePatch}
              disabled={!srcPortId || !dstPortId || (srcNodeId === dstNodeId && srcPortId === dstPortId)}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-2xl transition-all shadow-[0_20px_50px_rgba(45,212,191,0.2)] hover:shadow-[0_20px_50px_rgba(45,212,191,0.4)] uppercase tracking-[0.2em] text-[10px]"
            >
              Initialize Logical Patch
            </button>
            <p className="text-center text-[9px] text-slate-600 font-bold uppercase mt-4 tracking-tighter">Warning: Established connections will disrupt active protocol flows if modified.</p>
         </div>
      </div>
    )
  }

  const renderServices = () => {
    const services: ServiceType[] = ['DHCP', 'DNS', 'NTP']
    
    if (configuringService) {
       return renderConfigPanel(configuringService)
    }

    return (
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Service Sidebar */}
        <div className="w-64 bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-4 flex flex-col gap-2">
           <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 px-4">Service Control Plane</p>
           {[
             { id: 'overview', label: 'Dashboard Hub', icon: '📊' },
             { id: 'DHCP', label: 'DHCP Pool', icon: '⚡' },
             { id: 'DNS', label: 'Domain Zones', icon: '🗺️' },
             { id: 'NTP', label: 'Time Sync', icon: '⏱️' },
           ].map(st => (
             <button
               key={st.id}
               onClick={() => setServiceSubTab(st.id as 'overview' | 'DHCP' | 'DNS' | 'NTP')}
               className={`w-full px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 transition-all ${serviceSubTab === st.id ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'}`}
             >
               <span className="text-lg">{st.icon}</span>
               {st.label}
             </button>
           ))}

           <div className="mt-auto p-5 bg-slate-900/50 rounded-3xl border border-white/5">
              <p className="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-1">Global Health</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                 <span className="text-[10px] font-bold text-slate-400">99.99% Uptime</span>
              </div>
           </div>
        </div>

        {/* Service Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar scrollbar-hide pr-4">
           {serviceSubTab === 'overview' ? (
              <div className="grid grid-cols-2 gap-6 p-2">
                 {services.map(type => {
                   const status = getServiceStatus(type)
                   const hostingNodes = nodes.filter((n: any) => n.services.some((s: any) => s.type === type && s.status === 'running'))
                   const isFlipped = flippedServices.has(type)
                   
                   return (
                     <div key={type} className="group h-[480px] [perspective:1500px]">
                        <div className={`relative h-full w-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                           
                           {/* FRONT SIDE */}
                           <div className="absolute inset-0 [backface-visibility:hidden] bg-slate-900/40 p-6 rounded-[3rem] border border-white/5 flex flex-col gap-6 overflow-hidden backdrop-blur-md">
                              <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 transition-all ${status === 'green' ? 'bg-green-500' : 'bg-red-500'}`} />
                              
                              <div className="flex justify-between items-start relative z-10">
                                 <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 text-2xl shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                    {type === 'DHCP' ? '⚡' : type === 'DNS' ? '🗺️' : '⏱️'}
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${status === 'green' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                                    {status === 'green' ? 'Active' : 'Offline'}
                                 </div>
                              </div>

                              <div className="relative z-10">
                                 <h4 className="text-xl font-black text-white uppercase tracking-tighter">{type} Orchestration</h4>
                                 <p className="text-slate-500 text-[10px] mt-2 leading-relaxed font-bold uppercase tracking-tight opacity-70">
                                   Cluster-wide {type.toLowerCase()} management and state synchronization.
                                 </p>
                              </div>

                              <div className="mt-auto space-y-3 relative z-10">
                                 <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 pb-2">Primary Controllers</div>
                                 {hostingNodes.length > 0 ? (
                                   <div className="space-y-2">
                                     {hostingNodes.slice(0, 3).map((n: any) => (
                                       <div key={n.id} className="flex items-center justify-between text-[10px] font-bold text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                          <span>{n.hostname || n.name}</span>
                                          <span className="text-teal-400 font-mono text-[9px]">{n.managementIP}</span>
                                       </div>
                                     ))}
                                     {hostingNodes.length > 3 && <div className="text-[9px] text-center text-slate-600 font-black uppercase">+ {hostingNodes.length - 3} more instances</div>}
                                   </div>
                                 ) : (
                                   <div className="text-[9px] italic text-slate-700 py-3 bg-slate-950/30 rounded-2xl border border-dashed border-white/5 text-center uppercase font-black">Zero instances deployed</div>
                                 )}
                              </div>

                              <div className="flex gap-2 relative z-10">
                                <button 
                                  onClick={() => toggleFlip(type)}
                                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                                >
                                  Docs
                                </button>
                                {status === 'green' && (
                                  <button 
                                    onClick={() => setConfiguringService(type)}
                                    className="px-5 py-3.5 bg-teal-500 text-slate-950 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all shadow-[0_5px_20px_rgba(45,212,191,0.2)]"
                                  >
                                    Config
                                  </button>
                                )}
                              </div>
                           </div>

                           {/* BACK SIDE (Integrated Manual) */}
                           <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-slate-950 p-6 rounded-[3rem] border border-teal-500/40 flex flex-col gap-4 shadow-2xl">
                              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                 <div>
                                    <h4 className="text-[10px] font-black text-teal-400 uppercase tracking-widest">{type} Protocol Manual</h4>
                                    <p className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter mt-1">Bootstrapping Sequence</p>
                                 </div>
                                 <button onClick={() => toggleFlip(type)} className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 hover:text-white transition-all text-xs">✕</button>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto text-[9px] font-mono text-slate-400 leading-relaxed space-y-4 custom-scrollbar scrollbar-hide pr-1">
                                 {(TECHNICAL_MANUALS[type.toLowerCase()] || []).map((line, i) => (
                                    <div key={i} className="whitespace-pre-wrap border-l border-teal-500/20 pl-3 py-0.5">
                                       {line.replace(/\[\[GREEN\]\]/g, '✅ ').replace(/\[\[YELLOW\]\]/g, '⌨️ ').replace(/\[\[BLUE\]\]/g, 'ℹ️ ').replace(/\[\[RESET\]\]/g, '')}
                                    </div>
                                 ))}
                              </div>

                              <button 
                                onClick={() => toggleFlip(type)}
                                className="w-full py-3 bg-teal-500/5 text-teal-400 text-[9px] font-black uppercase tracking-widest rounded-xl border border-teal-500/20 hover:bg-teal-500/10 transition-all"
                              >
                                Exit Documentation
                              </button>
                           </div>
                        </div>
                     </div>
                   )
                 })}
              </div>
           ) : (
              <div className="p-6 bg-slate-900/40 rounded-[3rem] border border-white/5 h-full flex flex-col gap-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-xl font-black text-white uppercase tracking-tight">{serviceSubTab} Configuration</h3>
                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Runtime Management & Node Affinity</p>
                    </div>
                    <div className="px-4 py-2 bg-teal-500/10 text-teal-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-teal-500/20">
                       ACTIVE STATUS: NOMINAL
                    </div>
                 </div>

                 {/* Configuration Interface would go here, currently using the standard panel */}
                 <div className="flex-1 bg-slate-950/50 rounded-[2rem] border border-white/5 p-8 overflow-y-auto custom-scrollbar">
                    {getServiceStatus(serviceSubTab as ServiceType) === 'green' ? (
                       renderConfigPanel(serviceSubTab as ServiceType)
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-center gap-6">
                          <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-dashed border-slate-700 flex items-center justify-center text-4xl grayscale opacity-50">
                             {serviceSubTab === 'DHCP' ? '⚡' : serviceSubTab === 'DNS' ? '🗺️' : '⏱️'}
                          </div>
                          <div>
                             <h4 className="text-lg font-black text-slate-500 uppercase">Service Not Deployed</h4>
                             <p className="text-xs text-slate-600 font-bold max-w-xs mx-auto mt-2 uppercase tracking-tight">Deploy this service to a compute node via the hardware inspector to unlock configuration.</p>
                          </div>
                          <button 
                            onClick={() => setServiceSubTab('overview')}
                            className="px-8 py-3 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all"
                          >
                            Return to Dashboard
                          </button>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </div>
      </div>
    )
  }

  const renderConfigPanel = (type: ServiceType) => {
    // Pure jitter generation for NTP
    const ntpJitter = Math.sin(tick) * 0.05

    return (
      <div className="flex-1 bg-slate-900/50 rounded-[3rem] border border-teal-500/20 flex flex-col overflow-hidden">
         <div className="p-8 border-b border-white/5 bg-slate-800/20 flex justify-between items-center">
            <div className="flex items-center gap-6">
               <button onClick={() => setConfiguringService(null)} className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-500 hover:text-white border border-white/5 transition-all shadow-xl">←</button>
               <div>
                 <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">{type} Runtime Configuration</h3>
                 <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">Enterprise Service Orchestrator</p>
               </div>
            </div>
            <div className="flex gap-3">
               <span className="px-3 py-1.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase border border-green-500/20 rounded-xl">Status: Stable</span>
            </div>
         </div>

         <div className="flex-1 overflow-hidden flex gap-8 p-8">
            {type === 'DNS' && (
              <>
              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar scrollbar-hide pr-2">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Active Forward Lookup Zone</h4>
                 <div className="grid grid-cols-2 gap-4">
                    {dnsRecords.map((record: any) => (
                      <div key={record.id} className="bg-slate-950/60 p-5 rounded-3xl border border-white/5 flex justify-between items-center hover:border-teal-500/20 transition-all group">
                         <div>
                            <div className="text-[12px] font-black text-white tracking-tight">{record.hostname}</div>
                            <div className="text-[10px] text-teal-500/60 font-mono mt-1">{record.ip}</div>
                         </div>
                         <button 
                           onClick={() => removeDnsRecord(record.id)}
                           className="w-8 h-8 rounded-xl bg-red-500/5 text-red-500/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                         >✕</button>
                      </div>
                    ))}
                    {dnsRecords.length === 0 && <p className="col-span-2 text-[10px] italic text-slate-700 py-12 text-center bg-slate-950/20 rounded-[2rem] border border-dashed border-white/5">No records found in authoritative zone.</p>}
                 </div>
              </div>
              <div className="w-96 bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-8 space-y-6 backdrop-blur-sm">
                 <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-2">Record Injection</h4>
                 <div className="space-y-5">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">FQDN Hostname</label>
                       <input id="dns-host" type="text" placeholder="api.infra.local" className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] text-white outline-none focus:border-teal-500 transition-all font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Target IPV4</label>
                       <input id="dns-ip" type="text" placeholder="10.0.0.50" className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-3.5 text-[11px] text-white outline-none focus:border-teal-500 transition-all font-bold" />
                    </div>
                    <button 
                      onClick={() => {
                        const host = (document.getElementById('dns-host') as HTMLInputElement).value
                        const ip = (document.getElementById('dns-ip') as HTMLInputElement).value
                        if (host && ip) {
                          addDnsRecord({ hostname: host, ip, type: 'A' })
                          ;(document.getElementById('dns-host') as HTMLInputElement).value = ''
                          ;(document.getElementById('dns-ip') as HTMLInputElement).value = ''
                        }
                      }}
                      className="w-full py-4 bg-teal-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-[0_10px_30px_rgba(45,212,191,0.2)]"
                    >
                      Provision Record
                    </button>
                 </div>
              </div>
              </>
            )}

            {type === 'DHCP' && (
              <div className="flex-1 space-y-6">
                 <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global IP Lease Table</h4>
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Subnet: 10.0.0.0/24</span>
                 </div>
                 <div className="grid grid-cols-3 gap-5 overflow-y-auto custom-scrollbar scrollbar-hide max-h-[500px] pr-2">
                    {nodes.filter((n: any) => n.managementIP && n.siteId === currentSiteId).map((n: any) => (
                      <div key={n.id} className="bg-slate-950/60 p-5 rounded-3xl border border-white/5 flex flex-col gap-3">
                         <div className="flex justify-between items-start">
                            <div className="text-[11px] font-black text-white truncate max-w-[120px]">{n.hostname || n.name}</div>
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                         </div>
                         <div className="text-teal-400 font-mono text-[12px] font-black">{n.managementIP}</div>
                         <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">MAC: {n.macAddress || 'STATIC'}</div>
                      </div>
                    ))}
                    {nodes.filter((n: any) => n.managementIP && n.siteId === currentSiteId).length === 0 && (
                      <div className="col-span-3 py-20 text-center opacity-20">
                         <div className="text-4xl mb-4">🛰️</div>
                         <p className="text-xs font-black uppercase tracking-widest">No Active Leases Detected</p>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {type === 'NTP' && (
              <div className="flex-1 space-y-6">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Time-Sync Distribution Status</h4>
                 <div className="grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar scrollbar-hide max-h-[500px] pr-2">
                    {nodes.filter((n: any) => n.siteId === currentSiteId && n.type !== 'rack').map((n: any) => (
                      <div key={n.id} className="bg-slate-950/60 p-5 rounded-3xl border border-white/5 flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                            <div>
                               <div className="text-[11px] font-black text-white uppercase">{n.hostname || n.name}</div>
                               <div className="text-[8px] text-slate-600 font-bold uppercase mt-0.5">Stratum 2 Target</div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className="text-[11px] font-mono text-teal-400 font-black">+{Math.abs(ntpJitter).toFixed(4)}ms</div>
                            <div className="text-[8px] text-slate-700 font-bold uppercase tracking-tighter">Jitter: 0.001ms</div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
         </div>
      </div>
    )
  }

  const renderSdn = () => {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar scrollbar-hide max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
           <div>
             <h3 className="text-xl font-black text-white uppercase tracking-tight">SDN Traffic Engineering</h3>
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">BGP Routing & QoS Policies</p>
           </div>
        </div>
        
        {connections.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
             <div className="text-4xl mb-4">🌐</div>
             <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">No Active Links</h4>
           </div>
        ) : (
          connections.map((conn: any) => {
            const sNode = nodes.find((n: any) => n.id === conn.startNodeId)
            const eNode = nodes.find((n: any) => n.id === conn.endNodeId)
            const sPort = sNode?.ports.find((p: any) => p.id === conn.startPortId)
            const ePort = eNode?.ports.find((p: any) => p.id === conn.endPortId)

            return (
              <div key={conn.id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-xl flex items-center gap-8 group hover:border-teal-500/20 transition-all">
                 <div className="flex-1">
                    <div className="text-[10px] font-black text-slate-200 uppercase">{sNode?.hostname || sNode?.name}</div>
                    <div className="text-teal-400 font-mono text-[9px]">{sPort?.label || conn.startPortId}</div>
                 </div>
                 
                 <div className="flex-[2] flex flex-col gap-3 px-8 border-x border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Routing Cost (Weight)</label>
                      <span className={`text-[10px] font-bold ${conn.routingWeight && conn.routingWeight > 100 ? 'text-amber-500' : 'text-teal-400'}`}>{conn.routingWeight ?? 100}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="200" 
                      value={conn.routingWeight ?? 100}
                      onChange={(e) => updateConnectionConfig(conn.id, { routingWeight: parseInt(e.target.value) })}
                      className="w-full accent-teal-500"
                    />
                    <div className="flex justify-between text-[7px] font-black text-slate-600 uppercase tracking-widest">
                       <span>Priority Route (1)</span>
                       <span>Avoid Route (200)</span>
                    </div>
                 </div>
                 
                 <div className="flex-1 text-right">
                    <div className="text-[10px] font-black text-slate-200 uppercase">{eNode?.hostname || eNode?.name}</div>
                    <div className="text-teal-400 font-mono text-[9px]">{ePort?.label || conn.endPortId}</div>
                 </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/95 backdrop-blur-3xl p-6" onClick={() => setNetworkManagerOpen(false)}>
      <div className="bg-[#0f172a] border border-teal-500/30 p-6 rounded-[3rem] shadow-[0_0_200px_rgba(0,0,0,0.9)] max-w-[1500px] w-full flex flex-col gap-4 h-[94vh] animate-in zoom-in-95 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />

        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-teal-500 text-slate-950 rounded-[1.5rem] shadow-[0_0_40px_rgba(45,212,191,0.3)] flex items-center justify-center text-3xl font-black">
              <span className="animate-pulse">G</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-[-0.05em] uppercase leading-none">SDDC <span className="text-teal-400">Orchestrator</span></h2>
              <div className="flex items-center gap-3 mt-2">
                 <span className="text-teal-400 font-mono text-[10px] font-black tracking-widest uppercase bg-teal-500/5 px-2 py-0.5 rounded-md border border-teal-500/20">SDDC v2.0</span>
                 <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                 <span className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">Enterprise LAN Orchestration</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setNetworkManagerOpen(false)}
            className="w-12 h-12 rounded-2xl bg-slate-800/40 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-500/20 transition-all border border-white/5 group"
          >
            <span className="group-hover:rotate-90 transition-transform duration-300">✕</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5 w-fit relative z-10 backdrop-blur-xl">
          {[
            { id: 'topology', label: 'Topology', icon: '📐' },
            { id: 'patching', label: 'Patch Panel', icon: '🔌' },
            { id: 'services', label: 'Orchestration', icon: '⚡' },
            { id: 'sdn', label: 'SDN Engineering', icon: '🌐' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as 'topology' | 'patching' | 'services' | 'sdn'); setConfiguringService(null); }}
              className={`px-6 py-2.5 rounded-xl text-[9px] font-black transition-all flex items-center gap-2 uppercase tracking-[0.1em] ${activeTab === tab.id ? 'bg-teal-500 text-slate-950 shadow-[0_10px_30px_rgba(45,212,191,0.2)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative z-10 mt-2">
           {activeTab === 'topology' && renderTopology()}
           {activeTab === 'patching' && renderPatching()}
           {activeTab === 'services' && renderServices()}
           {activeTab === 'sdn' && renderSdn()}
        </div>
      </div>
    </div>
  )
}
