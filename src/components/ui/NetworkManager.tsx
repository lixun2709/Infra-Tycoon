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
    sites 
  } = useInfraStore()
  
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

  // Find all active cross-site connections
  const activeWanLinks = connections.filter(conn => {
    const startNode = nodes.find(n => n.id === conn.startNodeId)
    const endNode = nodes.find(n => n.id === conn.endNodeId)
    if (!startNode || !endNode) return false
    return startNode.siteId !== endNode.siteId
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070f52]/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a1536] border border-[#48afbb]/50 p-6 rounded-lg shadow-2xl max-w-4xl w-full flex flex-col gap-6 max-h-[90vh]">
        
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#a855f7]">🌐</span> Global Connectivity Manager
            </h2>
            <p className="text-sm text-slate-400 mt-1">Manage cross-site replication and WAN routing</p>
          </div>
          <button 
            onClick={() => setNetworkManagerOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-sm font-bold text-teal-400 mb-4 uppercase tracking-wider">Create Replication Link</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Source Node (Primary-DC)</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                  >
                    <option value="">-- Select Source Node --</option>
                    {primaryNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name} [{n.id.slice(0,6)}]</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Source Port</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    value={sourcePortId}
                    onChange={(e) => setSourcePortId(e.target.value)}
                    disabled={!sourceId}
                  >
                    <option value="">-- Select Port --</option>
                    {availableSourcePorts.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Node (DR-Site)</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">-- Select Target Node --</option>
                    {drNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name} [{n.id.slice(0,6)}]</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Port</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    value={targetPortId}
                    onChange={(e) => setTargetPortId(e.target.value)}
                    disabled={!targetId}
                  >
                    <option value="">-- Select Port --</option>
                    {availableTargetPorts.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCreateLink}
                disabled={!sourceId || !sourcePortId || !targetId || !targetPortId}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded transition-colors"
              >
                Create Replication Link
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
            <h3 className="text-sm font-bold text-[#a855f7] mb-4 uppercase tracking-wider">Active WAN Links</h3>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {activeWanLinks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                  No active replication links.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWanLinks.map(conn => {
                    const sNode = nodes.find(n => n.id === conn.startNodeId)
                    const eNode = nodes.find(n => n.id === conn.endNodeId)
                    const sPort = sNode?.ports.find(p => p.id === conn.startPortId)
                    const ePort = eNode?.ports.find(p => p.id === conn.endPortId)
                    
                    const isHealthy = sNode?.healthStatus !== 'critical' && eNode?.healthStatus !== 'critical'
                    
                    return (
                      <div key={conn.id} className="bg-slate-900 p-3 rounded border border-slate-700 text-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isHealthy ? 'bg-green-900/50 text-green-400 border border-green-500/50' : 'bg-red-900/50 text-red-400 border border-red-500/50 animate-pulse'}`}>
                            {isHealthy ? 'Syncing / Healthy' : 'Interrupted'}
                          </span>
                          <button 
                            onClick={() => removeConnection(conn.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Sever Link
                          </button>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-0.5">Source</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white truncate text-sm" title={sNode?.name || 'Unknown'}>{sNode?.name || 'Unknown'}</span>
                              <span className="text-teal-400 font-mono text-[10px] shrink-0 border border-teal-500/30 bg-teal-900/20 px-1.5 py-0.5 rounded">[{sPort?.label || '?'}]</span>
                            </div>
                          </div>
                          <div className="text-slate-500 shrink-0 mx-1">➜</div>
                          <div className="flex-1 min-w-0 text-right">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-0.5">Target</span>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-teal-400 font-mono text-[10px] shrink-0 border border-teal-500/30 bg-teal-900/20 px-1.5 py-0.5 rounded">[{ePort?.label || '?'}]</span>
                              <span className="text-white truncate text-sm" title={eNode?.name || 'Unknown'}>{eNode?.name || 'Unknown'}</span>
                            </div>
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
