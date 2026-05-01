import React from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Inspector() {
  const { nodes, connections, selectedNodeId, cableMode, connectingPort, handlePortClick, updateNode, removeNode, removeConnection, pushAlert, sites } = useInfraStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const nodeSite = sites.find(s => s.id === selectedNode?.siteId)

  const [showDecommissionConfirm, setShowDecommissionConfirm] = React.useState(false)

  if (!selectedNode) return null

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
    <div className="fixed right-0 top-0 h-full w-80 bg-[#060b18]/95 text-white p-6 shadow-2xl backdrop-blur-md border-l border-slate-800 overflow-y-auto">
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

      <div className="space-y-4 mb-6 bg-slate-800/50 p-4 rounded-lg">
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-2">Asset Details</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Asset Tag</label>
              <input 
                type="text" 
                value={selectedNode.assetTag || ''} 
                onChange={(e) => updateNode(selectedNode.id, { assetTag: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Serial Number</label>
              <input 
                type="text" 
                value={selectedNode.serialNumber || ''} 
                onChange={(e) => updateNode(selectedNode.id, { serialNumber: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500"
                placeholder="Enter S/N..."
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Rear Connectivity</p>
        <div className="grid grid-cols-1 gap-3">
          {selectedNode.ports.map((port) => {
            const isConnecting = connectingPort?.portId === port.id
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

      {cableMode && (
        <div className="mt-6 p-4 bg-teal-900/40 border border-teal-500 rounded-lg">
          <p className="text-xs text-teal-200">
            <strong>Cabling Active:</strong> Select target port to complete the link.
          </p>
        </div>
      )}
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