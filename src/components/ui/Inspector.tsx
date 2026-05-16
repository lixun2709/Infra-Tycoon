import React from 'react'
import { useInfraStore, type DataCategory } from '../../store/useInfraStore'
import { ConfirmDialog } from './ConfirmDialog'
import { Card } from './base/Card'
import { Button } from './base/Button'
import { Badge } from './base/Badge'

export function Inspector() {
  const { nodes, connections, selectedNodeId, activePatchSource, handlePortClick, updateNode, removeNode, removeConnection, pushAlert, sites, alerts, installService, toggleService } = useInfraStore()
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
      <div className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 glass-dark border-l border-white/10 flex flex-col z-40">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 bg-white/5">
          <input
            type="text"
            value={selectedNode.name}
            onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
            className="block w-full text-xl font-black bg-transparent border-b border-transparent focus:border-teal-500/50 focus:outline-none transition-colors pb-1 uppercase tracking-tighter"
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex gap-2 items-center">
              <span className="text-[10px] font-mono text-slate-500">ID: {selectedNode.id.slice(0, 8)}</span>
              {nodeSite && (
                <Badge variant="ghost" className="bg-slate-800/50 text-slate-400">
                  📍 {nodeSite.name}
                </Badge>
              )}
            </div>
            {selectedNode.type === 'rack' && selectedNode.status === 'power_overload' && (
              <Badge variant="error" glow className="animate-pulse">OVERLOAD</Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-2 bg-black/20">
          {(['details', 'performance', 'services', 'alerts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[9px] uppercase tracking-[0.2em] font-black transition-all border-b-2 ${
                activeTab === tab 
                  ? 'text-teal-400 border-teal-500 bg-teal-500/5' 
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {activeTab === 'details' && (
            <>
              <Card title="Specifications" className="bg-transparent" glass={false}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Form Factor</span>
                    <Badge variant="ghost">{selectedNode.uHeight}U</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Power Profile</span>
                    <span className={`text-[10px] font-mono ${selectedNode.status === 'power_overload' ? 'text-rose-400' : 'text-teal-400'}`}>
                      {selectedNode.type === 'rack' 
                        ? `${(selectedNode.currentPowerKW ?? 0).toFixed(1)} / ${(selectedNode.maxPowerKW ?? 5).toFixed(1)} kW`
                        : `${selectedNode.wattage}W`
                      }
                    </span>
                  </div>
                </div>

                {selectedNode.totalStorageTB != null && selectedNode.totalStorageTB > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-wider">
                      <span className="text-slate-500">Storage Utilization</span>
                      <span className="text-teal-400 font-mono">
                        {selectedNode.usedStorageTB} / {selectedNode.totalStorageTB} TB
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-teal-500 h-full transition-all duration-500 shadow-[0_0_8px_var(--primary)]"
                        style={{ width: `${(selectedNode.usedStorageTB! / selectedNode.totalStorageTB!) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Governance" subtitle="Data Sovereignty Controls">
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-1 uppercase font-black tracking-widest">Data Category</label>
                    <select
                      value={selectedNode.dataCategory || 'Internal'}
                      onChange={(e) => updateNode(selectedNode.id, { dataCategory: e.target.value as DataCategory })}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-teal-500/50 uppercase font-black"
                    >
                      <option value="Public">Public (Unrestricted)</option>
                      <option value="Internal">Internal (Sensitive)</option>
                      <option value="PII">PII (Highly Sensitive)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Immutable Storage</span>
                    <input 
                      type="checkbox"
                      checked={selectedNode.isImmutable}
                      onChange={(e) => updateNode(selectedNode.id, { isImmutable: e.target.checked })}
                      className="w-4 h-4 accent-teal-500"
                    />
                  </div>
                </div>
              </Card>

              <Card title="Rear Connectivity" className="bg-transparent" glass={false}>
                <div className="grid grid-cols-1 gap-2">
                  {selectedNode.ports.map((port) => {
                    const isConnecting = activePatchSource?.portId === port.id
                    const conn = connections.find(c => (c.startNodeId === selectedNode.id && c.startPortId === port.id) || (c.endNodeId === selectedNode.id && c.endPortId === port.id))
                    
                    return (
                      <div key={port.id} className={`p-3 rounded-xl border transition-all ${isConnecting ? 'bg-teal-500/10 border-teal-500' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${conn ? 'bg-teal-500 shadow-[0_0_8px_var(--primary)]' : 'bg-slate-700'}`} />
                            <span className="text-[10px] font-black uppercase text-white">{port.label}</span>
                          </div>
                          <Badge variant="ghost">{port.type}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant={isConnecting ? 'primary' : 'ghost'} 
                            className="flex-1 py-1 h-7 text-[9px]"
                            onClick={() => handlePortClick(selectedNode.id, port.id)}
                          >
                            {isConnecting ? 'PATCHING...' : conn ? 'CONNECTED' : 'PATCH'}
                          </Button>
                          {conn && (
                            <Button 
                              variant="danger" 
                              className="px-2 py-1 h-7 text-[9px]"
                              onClick={() => removeConnection(conn.id)}
                            >
                              UNPLUG
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <div className="pt-4">
                <Button variant="danger" className="w-full justify-center text-[10px] font-black tracking-widest" onClick={handleDecommissionClick}>
                  DECOMMISSION ASSET
                </Button>
              </div>
            </>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              {connections.filter(c => c.startNodeId === selectedNode.id || c.endNodeId === selectedNode.id).map(conn => {
                const util = Math.min(100, (conn.throughputGbps / conn.bandwidthGbps) * 100)
                return (
                  <Card key={conn.id} title={`LINK: ${conn.id.slice(0, 8)}`} subtitle={`LATENCY: ${conn.latencyMs}ms`}>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-500 uppercase font-black">Utilization</span>
                        <span className="text-teal-400">{util.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${util > 80 ? 'bg-rose-500' : 'bg-teal-500'}`}
                          style={{ width: `${util}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-4">
              <Card title="Deploy Application">
                <div className="grid grid-cols-3 gap-2">
                  {(['web', 'storage', 'backup'] as const).map(type => (
                    <Button 
                      key={type} 
                      variant="ghost" 
                      className="flex-col h-auto py-3 text-[8px] uppercase font-black"
                      onClick={() => installService(selectedNode.id, type)}
                    >
                      <span className="text-xl mb-1">{type === 'web' ? '🌐' : type === 'storage' ? '🗄️' : '🛡️'}</span>
                      {type}
                    </Button>
                  ))}
                </div>
              </Card>

              <div className="space-y-2">
                {selectedNode.services.map(service => (
                  <Card key={service.id} className="bg-transparent" glass={false}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${service.status === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_var(--primary)]' : 'bg-slate-700'}`} />
                        <div>
                          <p className="text-[10px] font-black uppercase text-white">{service.type}</p>
                          <p className="text-[8px] font-mono text-slate-500">PORT {service.port}</p>
                        </div>
                      </div>
                      <Button 
                        variant={service.status === 'running' ? 'danger' : 'primary'} 
                        className="px-3 py-1 h-7 text-[8px]"
                        onClick={() => toggleService(selectedNode.id, service.id, service.status === 'running' ? 'stopped' : 'running')}
                      >
                        {service.status === 'running' ? 'STOP' : 'START'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.filter(a => a.nodeId === selectedNode.id).map(alert => (
                <Card key={alert.id} className={`${alert.severity === 'critical' ? 'border-rose-500/20' : ''}`} glass={true}>
                  <div className="flex gap-3">
                    <div className={`w-1 h-1 rounded-full mt-1.5 ${alert.severity === 'critical' ? 'bg-rose-500 animate-pulse' : 'bg-sky-500'}`} />
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-300 leading-relaxed font-medium">{alert.message}</p>
                      <p className="text-[8px] text-slate-500 mt-2 font-mono uppercase">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog 
        isOpen={showDecommissionConfirm}
        title="Confirm Decommission"
        message={`Are you sure you want to decommission ${selectedNode.name}? This action is permanent and will remove all associated data and connections.`}
        confirmText="DECOMMISSION"
        type="danger"
        onConfirm={confirmDecommission}
        onCancel={() => setShowDecommissionConfirm(false)}
      />
    </>
  )
}