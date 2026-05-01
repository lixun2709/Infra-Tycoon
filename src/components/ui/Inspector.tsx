import React from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Inspector() {
  const { nodes, connections, selectedNodeId, cableMode, connectingPort, handlePortClick, updateNode, removeNode } = useInfraStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  if (!selectedNode) return null

  const handleDecommission = () => {
    if (window.confirm(`Are you sure you want to decommission ${selectedNode.name}?`)) {
      removeNode(selectedNode.id)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#060b18]/95 text-white p-6 shadow-2xl backdrop-blur-md border-l border-slate-800 overflow-y-auto">
      <input 
        type="text" 
        value={selectedNode.name} 
        onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
        className="block w-full text-xl font-bold mb-1 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-teal-500 focus:outline-none transition-colors pb-1"
      />
      <div className="flex justify-between items-start mb-4">
        <p className="text-teal-400 text-xs">ID: {selectedNode.id.slice(0, 8)}</p>
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
                  <div className="mt-2 pt-2 border-t border-slate-700/80 text-[10px] flex justify-between text-slate-300">
                    <span>BW: <span className="text-teal-300 font-mono">{conn.bandwidthGbps} Gbps</span></span>
                    <span>Lat: <span className={`font-mono ${conn.latencyMs > 10 ? 'text-amber-400' : 'text-green-400'}`}>{conn.latencyMs} ms</span></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-slate-800 pt-6">
        <button 
          onClick={handleDecommission}
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
  )
}