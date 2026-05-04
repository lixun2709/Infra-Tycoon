import React from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Inspector() {
  const { nodes, connections, selectedNodeId, patchingActive, activePatchSource, handlePortClick, updateNode, removeNode, removeConnection, pushAlert, sites, alerts, installService, toggleService } = useInfraStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const [activeTab, setActiveTab] = React.useState<'details' | 'alerts' | 'performance' | 'services'>('details')

  const [showDecommissionConfirm, setShowDecommissionConfirm] = React.useState(false)

  if (!selectedNode) return null

  const nodeSite = sites.find(s => s.id === selectedNode.siteId)

  const handleDecommissionClick = () => {
    if (selectedNode.type === 'rack') {
      const children = nodes.filter(n => n.parentRackId === selectedNode.id)
      if (children.length > 0) {
        pushAlert('warning', `Cannot decommission ${selectedNode.name}: Rack is not empty. Please remove all mounted hardware first.`)
        return
      }
    } else {
      const hasConnections = connections.some(c => c.startNodeId === selectedNode.id || c.endNodeId === selectedNode.id)
      if (hasConnections) {
        pushAlert('warning', `Cannot decommission ${selectedNode.name}: Device has active network connections. Please unplug all cables first.`)
        return
      }
    }

    setShowDecommissionConfirm(true)
  }

  const confirmDecommission = () => {
    removeNode(selectedNode.id)
    setShowDecommissionConfirm(false)
  }

  return (
    <>
    <div className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 bg-[#060b18]/95 text-white p-6 shadow-2xl backdrop-blur-md border-l border-slate-800 overflow-y-auto z-40">
      <input 
        type="text" 
        value={selectedNode.name} 
        onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
        className="block w-full text-xl font-bold mb-1 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-teal-500 focus:outline-none transition-colors pb-1"
      />
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2 items-center">
          <p className="text-teal-400 text-xs">ID: {selectedNode.id.slice(0, 8)}</p>
          {nodeSite && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${nodeSite.id === 'site-1' ? 'border-blue-500/50 text-blue-300 bg-blue-900/30' : 'border-purple-500/50 text-purple-300 bg-purple-900/30'}`}>
              📍 {nodeSite.name}
            </span>
          )}
        </div>
        {selectedNode.type === 'rack' && selectedNode.status === 'power_overload' && (
          <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]">Power Overload</span>
        )}
      </div>

      <div className="flex border-b border-slate-700/50 mb-4">
        <button 
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeTab === 'details' ? 'text-white border-b-2 border-teal-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab('performance')}
          className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeTab === 'performance' ? 'text-white border-b-2 border-purple-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Performance
        </button>
        <button 
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeTab === 'services' ? 'text-white border-b-2 border-emerald-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Services
        </button>
        <button 
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeTab === 'alerts' ? 'text-white border-b-2 border-red-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Alerts
        </button>
      </div>

      {activeTab === 'details' ? (
        <>
      <div className="space-y-4 mb-6 bg-slate-800/50 p-4 rounded-lg">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest">Specifications</p>
          <div className="flex justify-between mt-1">
            <span className="text-sm">U-Height</span>
            <span className="text-sm font-mono">{selectedNode.uHeight}U</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Power Draw</span>
            {selectedNode.type === 'rack' ? (
              <span className={`text-sm font-mono ${selectedNode.status === 'power_overload' ? 'text-red-400 font-bold' : 'text-teal-400'}`}>
                {(selectedNode.currentPowerKW ?? 0).toFixed(1)} / {(selectedNode.maxPowerKW ?? 5.0).toFixed(1)} kW
              </span>
            ) : (
              <span className="text-sm font-mono text-orange-400">{selectedNode.wattage}W</span>
            )}
          </div>

          {selectedNode.totalStorageTB != null && selectedNode.totalStorageTB > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Storage Utilization</span>
                <span className="font-mono text-teal-400">
                  {selectedNode.usedStorageTB} / {selectedNode.totalStorageTB} TB
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-teal-500 h-full transition-all duration-500" 
                  style={{ width: `${(selectedNode.usedStorageTB! / selectedNode.totalStorageTB!) * 100}%` }} 
                />
              </div>
              
              {(selectedNode.type === 'storage' || selectedNode.type === 'backup') && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Immutable Snapshots</span>
                  <button 
                    onClick={() => updateNode(selectedNode.id, { isImmutable: !selectedNode.isImmutable })}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${selectedNode.isImmutable ? 'bg-teal-500' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${selectedNode.isImmutable ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(selectedNode.type === 'storage' || selectedNode.type === 'compute' || selectedNode.type === 'backup') && (
        <div className="space-y-4 mb-6 bg-yellow-950/20 p-4 rounded-lg border border-yellow-900/30">
          <div>
            <p className="text-yellow-400 text-[10px] uppercase tracking-widest mb-2 font-black">⚖️ Sovereignty & Compliance</p>
            <label className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Data Category</label>
            <select 
              value={selectedNode.dataCategory || 'Internal'} 
              onChange={(e) => updateNode(selectedNode.id, { dataCategory: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500"
            >
              <option value="Public">Public (Unrestricted)</option>
              <option value="Internal">Internal (Strict Replication)</option>
              <option value="PII">PII (Geographic Lockdown)</option>
            </select>
            <p className="text-[9px] text-slate-500 mt-2 leading-tight">
              {selectedNode.dataCategory === 'PII' ? '⚠️ PII data is geographically locked and cannot be replicated outside its primary region.' : 'Compliance rules will be enforced on all replication links.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 mb-6 bg-slate-800/50 p-4 rounded-lg">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Enterprise Asset Intelligence</p>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Hardware Power</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${selectedNode.isPoweredOn ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
                <span className={`text-[10px] font-black uppercase tracking-tighter ${selectedNode.isPoweredOn ? 'text-green-500' : 'text-slate-600'}`}>
                  {selectedNode.isPoweredOn ? 'Live' : 'Off'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-slate-600 block mb-1 font-black uppercase tracking-widest ml-1">System Identity</label>
              <div className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[11px] font-black text-white tracking-tight flex items-center gap-2">
                <span className="opacity-30">#</span>
                {selectedNode.hostname || 'UNSET_IDENTITY'}
              </div>
            </div>

            <div>
              <label className="text-[9px] text-slate-600 block mb-1 font-black uppercase tracking-widest ml-1">Logical IP Stack</label>
              <div className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-[11px] font-mono font-black shadow-[inset_0_0_15px_rgba(0,0,0,0.3)] flex justify-between items-center ${selectedNode.managementIP ? 'border-teal-500/30 text-teal-400' : 'border-red-500/30 text-red-500 animate-pulse'}`}>
                <span>{selectedNode.managementIP || 'IP_PENDING'}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase ${
                  selectedNode.provisioningState === 'bootstrapped' ? 'bg-teal-500/10 text-teal-500' :
                  selectedNode.provisioningState === 'patched' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  {selectedNode.provisioningState}
                </span>
              </div>
              {!selectedNode.managementIP && (
                <p className="text-[8px] text-red-500/60 font-bold uppercase mt-1.5 ml-1 animate-pulse">⚠️ Run 'bootstrap' protocol via terminal</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-600 block mb-1 font-black uppercase tracking-widest ml-1">MAC Address</label>
                <div className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[9px] font-mono text-slate-400 uppercase">
                  {selectedNode.macAddress || 'PENDING'}
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-600 block mb-1 font-black uppercase tracking-widest ml-1">Asset Tag</label>
                <input 
                  type="text" 
                  value={selectedNode.assetTag || ''} 
                  onChange={(e) => updateNode(selectedNode.id, { assetTag: e.target.value })}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[9px] text-white focus:outline-none focus:border-teal-500 font-bold"
                  placeholder="TAG-000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-600 block mb-1 font-black uppercase tracking-widest ml-1">Hardware Serial</label>
                <input 
                  type="text" 
                  value={selectedNode.serialNumber || ''} 
                  onChange={(e) => updateNode(selectedNode.id, { serialNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[9px] text-white focus:outline-none focus:border-teal-500 font-bold"
                  placeholder="SN-XXXXXXXX"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] text-slate-600 block mb-2 font-black uppercase tracking-widest ml-1">Deployment Lifecycle</label>
                <div className="flex gap-1 mt-1">
                  {['unboxed', 'racked', 'patched', 'bootstrapped'].map((s, idx) => {
                    const states = ['unboxed', 'racked', 'patched', 'bootstrapped']
                    const currentIdx = states.indexOf(selectedNode.provisioningState)
                    const isDone = idx <= currentIdx
                    return (
                      <div key={s} className="flex-1 flex flex-col gap-1">
                        <div className={`h-1 rounded-full transition-all ${isDone ? 'bg-teal-500' : 'bg-slate-800'}`} />
                      </div>
                    )
                  })}
                </div>
                <p className="text-[8px] text-slate-500 font-black uppercase mt-1.5 text-center tracking-tighter">{selectedNode.provisioningState}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Rear Connectivity</p>
        <div className="grid grid-cols-1 gap-3">
          {selectedNode.ports.map((port) => {
            const isConnecting = activePatchSource?.portId === port.id
            const conn = connections.find(c => c.startPortId === port.id || c.endPortId === port.id)
            
            return (
              <div key={port.id} className={`flex flex-col gap-1 border p-3 rounded-md transition-all ${isConnecting ? 'bg-teal-500/20 border-teal-500' : 'bg-slate-800/80 border-slate-700'}`}>
                <button
                  onClick={() => handlePortClick(selectedNode.id, port.id)}
                  className="flex items-center justify-between w-full text-xs"
                >
                  <div className="flex flex-col items-start">
                    <span className={`font-bold ${isConnecting ? 'text-teal-400 animate-pulse' : 'text-white'}`}>{port.label}</span>
                    <span className="opacity-50 text-[10px] uppercase">{port.type}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${conn ? 'bg-green-500' : isConnecting ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`} />
                </button>
                
                {conn && (
                  <div className="mt-2 pt-2 border-t border-slate-700/80 text-[10px] flex justify-between items-center text-slate-300">
                    <div className="flex gap-2">
                      <span>BW: <span className="text-teal-300 font-mono">{conn.bandwidthGbps} Gbps</span></span>
                      <span>Lat: <span className={`font-mono ${conn.latencyMs > 10 ? 'text-amber-400' : 'text-green-400'}`}>{conn.latencyMs} ms</span></span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeConnection(conn.id) }}
                      className="text-red-400 hover:text-red-200 bg-red-900/30 hover:bg-red-900/50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      Unplug
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-slate-800 pt-6">
        <button 
          onClick={handleDecommissionClick}
          className="w-full py-2 bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 border border-red-800/50 rounded transition-colors text-sm font-semibold"
        >
          Decommission Device
        </button>
      </div>

      {patchingActive && (
        <div className="mt-6 p-4 bg-teal-900/40 border border-teal-500 rounded-lg">
          <p className="text-xs text-teal-200">
            <strong>Patching Active:</strong> Select target port to complete the link.
          </p>
        </div>
      )}
      </>
      ) : activeTab === 'alerts' ? (
        <div className="space-y-3">
          {(() => {
            const nodeAlerts = alerts.filter(a => a.nodeId === selectedNode.id)
            if (nodeAlerts.length === 0) {
              return <p className="text-xs text-slate-500 italic text-center py-4">No alerts for this hardware.</p>
            }
            return nodeAlerts.map(alert => (
              <div key={alert.id} className={`flex gap-3 items-start p-3 bg-slate-800/50 rounded-lg border ${alert.severity === 'critical' ? 'border-red-900/50' : 'border-slate-700'} ${alert.isAcknowledged ? 'opacity-60' : ''}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse shadow-red-500/50' : alert.severity === 'warning' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-blue-400 shadow-blue-400/50'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${alert.severity === 'critical' ? 'text-red-200' : alert.severity === 'warning' ? 'text-amber-200' : 'text-slate-300'}`}>
                    {alert.message}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-2 flex justify-between">
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {alert.isAcknowledged && <span className="text-teal-500 font-bold uppercase">Acknowledged</span>}
                  </p>
                </div>
              </div>
            ))
          })()}
        </div>
      ) : activeTab === 'performance' ? (
        <div className="space-y-4">
          {(() => {
            const activeConns = connections.filter(c => c.startNodeId === selectedNode.id || c.endNodeId === selectedNode.id)
            if (activeConns.length === 0) {
              return <p className="text-xs text-slate-500 italic text-center py-4">No active connections to monitor.</p>
            }
            return activeConns.map(conn => {
              const utilPercent = Math.min(100, (conn.throughputGbps / conn.bandwidthGbps) * 100)
              const remoteId = conn.startNodeId === selectedNode.id ? conn.endNodeId : conn.startNodeId
              const remoteNode = nodes.find(n => n.id === remoteId)
              const isWan = remoteNode?.siteId !== selectedNode.siteId
              return (
                <div key={conn.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-300 font-semibold truncate">{remoteNode?.name || 'Unknown Node'}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isWan ? 'bg-purple-900/40 text-purple-400 border border-purple-500/30' : 'bg-slate-700 text-slate-300'}`}>
                      {isWan ? 'WAN' : 'LAN'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-400">Throughput</span>
                    <span className="font-mono text-teal-400">{conn.throughputGbps.toFixed(1)} / {conn.bandwidthGbps} Gbps</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-sm h-2 overflow-hidden mb-3">
                    <div 
                      className={`h-full transition-all duration-300 ease-in-out ${utilPercent > 80 ? 'bg-red-500' : utilPercent > 50 ? 'bg-amber-400' : 'bg-teal-500'}`} 
                      style={{ width: `${utilPercent}%` }} 
                    />
                  </div>

                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Latency</span>
                    <span className={`font-mono ${conn.latencyMs > 20 ? 'text-amber-400' : 'text-green-400'}`}>{conn.latencyMs} ms</span>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      ) : activeTab === 'services' ? (
        <div className="space-y-6">
          {/* Service Installation */}
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Deploy New Service</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'web', icon: '🌐', label: 'Web' },
                { type: 'storage', icon: '🗄️', label: 'Storage' },
                { type: 'backup', icon: '🛡️', label: 'Backup' }
              ].map(s => (
                <button
                  key={s.type}
                  onClick={() => installService(selectedNode.id, s.type as any)}
                  className="flex flex-col items-center gap-2 p-3 bg-slate-900/50 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition-all group"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">{s.icon}</span>
                  <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-emerald-400">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Installed Services List */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Installed Applications</p>
            {!selectedNode.services?.length ? (
              <div className="text-center py-8 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-600 font-bold uppercase italic">No software deployed</p>
              </div>
            ) : (
              selectedNode.services.map(service => (
                <div key={service.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${service.status === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                    <div>
                      <div className="text-xs font-black text-slate-200 uppercase tracking-tight">{service.type}</div>
                      <div className="text-[9px] text-slate-500 font-mono">PORT: {service.port}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleService(selectedNode.id, service.id, service.status === 'running' ? 'stopped' : 'running')}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                        service.status === 'running' 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                      }`}
                    >
                      {service.status === 'running' ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>

    {showDecommissionConfirm && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4">
        <div className="bg-[#0a1536] border border-red-500/50 p-6 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.2)] max-w-sm w-full">
          <h3 className="text-xl font-bold text-red-500 flex items-center gap-3 mb-3">
            <span className="text-2xl">⚠️</span> Destructive Action
          </h3>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            Are you absolutely sure you want to permanently decommission <strong className="text-white">{selectedNode.name}</strong>? This action will completely erase its configuration and cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button 
              onClick={() => setShowDecommissionConfirm(false)}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded transition-colors border border-slate-600"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDecommission}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] transition-all"
            >
              Confirm Decommission
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}