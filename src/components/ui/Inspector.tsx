import React from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { DataCategory } from '../../store/infraTypes'
import { ConfirmDialog } from './ConfirmDialog'
import { Card, Button, Badge, Tabs } from './base'

export function Inspector() {
  const { 
    nodes, 
    connections, 
    selectedNodeId, 
    activePatchSource, 
    handlePortClick, 
    updateNode, 
    removeNode, 
    removeConnection, 
    pushAlert, 
    sites, 
    alerts, 
    installService, 
    toggleService, 
    advanceProvisioningState, 
    powerOnNode,
    repairHardware,
    toggleMaintenanceMode,
    technicianTickets,
    timeFormat
  } = useInfraStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const [activeTab, setActiveTab] = React.useState<'details' | 'alerts' | 'thermal' | 'services' | 'lifecycle'>('details')
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
        <Tabs
          tabs={[
            { id: 'details', label: 'details' },
            { id: 'thermal', label: 'thermal' },
            { id: 'services', label: 'services' },
            { id: 'lifecycle', label: 'lifecycle' },
            { id: 'alerts', label: 'alerts' }
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          variant="underline"
          className="bg-black/20 px-2"
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {activeTab === 'details' && (
            <>
              {selectedNode.type === 'rack' && (
                <Card title="Aisle Containment Strategy" className="bg-transparent" glass={false}>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1.5 uppercase font-black tracking-widest">Configuration</label>
                      <select
                        value={selectedNode.containmentType || 'none'}
                        onChange={(e) => updateNode(selectedNode.id, { containmentType: e.target.value as 'none' | 'cold_aisle' | 'hot_aisle' })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-teal-500/50 uppercase font-black"
                      >
                        <option value="none">No Containment (Open Air)</option>
                        <option value="cold_aisle">Cold Aisle Containment (20% Convection)</option>
                        <option value="hot_aisle">Hot Aisle Containment (1.5x Cooling Return)</option>
                      </select>
                    </div>
                  </div>
                </Card>
              )}

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
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    {/* Capacity Section */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Storage Capacity</span>
                        <span className="text-teal-400 font-mono">
                          {(selectedNode.usedStorageTB ?? 0).toFixed(1)} / {selectedNode.totalStorageTB} TB
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full transition-all duration-500 shadow-[0_0_8px_var(--primary)]"
                          style={{ width: `${Math.min(100, ((selectedNode.usedStorageTB ?? 0) / selectedNode.totalStorageTB!) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* RAID & Array Health Section */}
                    {selectedNode.raidLevel && (
                      <div className="bg-slate-950/40 border border-white/5 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 uppercase font-black">RAID Array</span>
                          <Badge variant="ghost" className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-[8px] font-black font-mono">
                            {selectedNode.raidLevel}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 uppercase font-black">Array Status</span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              selectedNode.storageStatus === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                              selectedNode.storageStatus === 'degraded' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse' :
                              selectedNode.storageStatus === 'rebuilding' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] animate-pulse' :
                              'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-ping'
                            }`} />
                            <span className={`font-mono text-[9px] font-black uppercase ${
                              selectedNode.storageStatus === 'healthy' ? 'text-emerald-400' :
                              selectedNode.storageStatus === 'degraded' ? 'text-amber-400' :
                              selectedNode.storageStatus === 'rebuilding' ? 'text-yellow-400' :
                              'text-rose-400'
                            }`}>
                              {selectedNode.storageStatus}
                            </span>
                          </span>
                        </div>

                        {selectedNode.storageStatus === 'rebuilding' && selectedNode.rebuildProgress !== undefined && (
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[8px] font-mono text-yellow-400">
                              <span>ARRAY SYNCING...</span>
                              <span>{Math.round(selectedNode.rebuildProgress)}%</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                              <div 
                                className="bg-yellow-400 h-full transition-all duration-300" 
                                style={{ width: `${selectedNode.rebuildProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* IOPS Performance section */}
                    {selectedNode.ioPSLimit && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-slate-500">I/O Performance</span>
                          <span className={`font-mono font-black text-[9px] ${
                            (selectedNode.ioPSUsed ?? 0) > selectedNode.ioPSLimit ? 'text-rose-400 animate-pulse' : 'text-teal-400'
                          }`}>
                            {(selectedNode.ioPSUsed ?? 0).toLocaleString()} / {selectedNode.ioPSLimit.toLocaleString()} IOPS
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden relative">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              (selectedNode.ioPSUsed ?? 0) > selectedNode.ioPSLimit ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-teal-500'
                            }`}
                            style={{ width: `${Math.min(100, ((selectedNode.ioPSUsed ?? 0) / selectedNode.ioPSLimit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Wear & Degradation status */}
                    {selectedNode.driveDegradation !== undefined && (
                      <div className="flex justify-between items-center text-[10px] pt-1">
                        <span className="text-slate-500 uppercase font-black">Drive Wear</span>
                        <span className={`font-mono text-[9px] font-black ${
                          selectedNode.driveDegradation > 80 ? 'text-rose-400 font-bold' :
                          selectedNode.driveDegradation > 50 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {selectedNode.driveDegradation.toFixed(1)}% WEAR
                        </span>
                      </div>
                    )}
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

          {activeTab === 'thermal' && (
            <div className="space-y-4">
              <style>{`
                @keyframes custom-fan-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>

              <Card title="Thermodynamics" subtitle="Real-time Thermal Telemetry">
                <div className="space-y-4">
                  {/* CPU Temp */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">CPU Temperature</span>
                    <span className={`text-xl font-black ${selectedNode.temperature && selectedNode.temperature > 70 ? 'text-rose-400 animate-pulse' : 'text-teal-400'}`}>
                      {selectedNode.temperature?.toFixed(1) || '22.0'}°C
                    </span>
                  </div>

                  {/* Site Ambient Temp */}
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Site Ambient</span>
                    <span className={`text-sm font-mono font-bold ${
                      (nodeSite?.ambientTemp ?? 22) > 40 ? 'text-rose-400 animate-pulse' :
                      (nodeSite?.ambientTemp ?? 22) > 30 ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {(nodeSite?.ambientTemp ?? 22.0).toFixed(1)}°C
                    </span>
                  </div>

                  {/* Throttle Status */}
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Throttle Status</span>
                    <Badge variant={selectedNode.isThrottled ? 'warning' : 'ghost'} glow={selectedNode.isThrottled}>
                      {selectedNode.isThrottled ? 'THROTTLED' : 'NOMINAL'}
                    </Badge>
                  </div>
                </div>
              </Card>

              {selectedNode.type !== 'rack' && selectedNode.type !== 'cooling' && (
                <>
                  {/* Dynamic Cooling Fan Widget */}
                  <Card title="Active Ventilation" subtitle="Dynamic Fan Velocity">
                    <div className="flex items-center gap-4 p-2 bg-slate-950/40 border border-white/5 rounded-xl">
                      <div className="relative w-12 h-12 flex items-center justify-center bg-slate-900 border border-white/10 rounded-full overflow-hidden">
                        <svg 
                          className={`w-8 h-8 ${selectedNode.systemState === 'off' ? 'text-slate-600' : 'text-teal-400'}`} 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          style={{
                            animation: selectedNode.systemState !== 'off' && selectedNode.fanSpeedPercent && selectedNode.fanSpeedPercent > 0 
                              ? 'custom-fan-spin infinite linear' 
                              : 'none',
                            animationDuration: selectedNode.fanSpeedPercent 
                              ? `${Math.max(0.1, 2.0 - (selectedNode.fanSpeedPercent / 100) * 1.95)}s` 
                              : '0s',
                            transformOrigin: 'center'
                          }}
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v7M12 15v7M2 12h7M15 12h7M5.6 5.6l4.9 4.9M13.5 13.5l4.9 4.9M18.4 5.6l-4.9 4.9M10.5 13.5l-4.9 4.9" />
                        </svg>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-slate-500">Fan Speed</span>
                          <span className="text-teal-400 font-mono">
                            {selectedNode.systemState === 'off' ? '0.0' : (selectedNode.fanSpeedPercent ?? 20.0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-teal-500 h-full transition-all duration-300"
                            style={{ width: `${selectedNode.systemState === 'off' ? 0 : (selectedNode.fanSpeedPercent ?? 20.0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Silicon Health">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] uppercase font-black text-slate-500">
                        <span>Operating Window</span>
                        <span>20°C - 80°C</span>
                      </div>
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500 via-yellow-500 to-rose-500 opacity-20" />
                        <div 
                          className="h-full bg-teal-500 transition-all duration-1000"
                          style={{ width: `${Math.min(100, ((selectedNode.temperature || 20) / 80) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === 'lifecycle' && (
            <div className="space-y-4">
              <Card title="Provisioning State" subtitle="Enterprise Lifecycle Engine">
                <div className="space-y-6">
                  <div className="flex flex-col gap-4">
                    {(['unboxed', 'racked', 'patched', 'bootstrapped', 'provisioned'] as const).map((state, i) => {
                      const states = ['unboxed', 'racked', 'patched', 'bootstrapped', 'provisioned']
                      const isPast = states.indexOf(selectedNode.provisioningState) >= i
                      const isCurrent = selectedNode.provisioningState === state
                      return (
                        <div key={state} className="flex items-center gap-4">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${isPast ? 'bg-teal-500 text-[#020617]' : 'bg-slate-800 text-slate-500'}`}>
                            {isPast ? '✓' : i + 1}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-white' : isPast ? 'text-teal-400/60' : 'text-slate-600'}`}>
                            {state}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  
                  <Button 
                    variant="primary" 
                    className="w-full justify-center h-10 text-[10px] font-black tracking-widest"
                    onClick={() => advanceProvisioningState(selectedNode.id)}
                    disabled={selectedNode.provisioningState === 'provisioned'}
                  >
                    ADVANCE LIFECYCLE
                  </Button>
                </div>
              </Card>

              <Card title="Remote Management" subtitle="IPMI / OOB Interface">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Power State</span>
                       <Badge variant={selectedNode.systemState === 'running' ? 'success' : selectedNode.systemState === 'off' ? 'ghost' : 'warning'}>
                          {selectedNode.systemState.toUpperCase()}
                       </Badge>
                    </div>
                    <div className="flex gap-2">
                       <Button 
                         variant="ghost" 
                         className="flex-1 py-1 h-8 text-[9px]"
                         onClick={() => powerOnNode(selectedNode.id)}
                         disabled={selectedNode.systemState !== 'off'}
                       >
                         POWER ON
                       </Button>
                       <Button 
                         variant="danger" 
                         className="flex-1 py-1 h-8 text-[9px]"
                         onClick={() => updateNode(selectedNode.id, { systemState: 'off', bootProgress: 0 })}
                         disabled={selectedNode.systemState === 'off'}
                       >
                         FORCE OFF
                       </Button>
                    </div>
                 </div>
              </Card>

              {selectedNode.type !== 'rack' && (
                <Card title="Asset Maintenance" subtitle="Technician RMA & Diagnostics">
                  <div className="space-y-4">
                    {/* Maintenance Mode Toggle */}
                    <div className="flex justify-between items-center bg-slate-950/40 border border-white/5 rounded-xl p-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white font-black uppercase tracking-wider">Maintenance Mode</span>
                        <span className="text-[8px] text-slate-500 font-medium font-sans">Pause apps & drain traffic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedNode.maintenanceMode && (
                          <Badge variant="warning" className="text-[8px] px-2 py-0.5 font-black font-mono tracking-widest animate-pulse" glow>DRAINING</Badge>
                        )}
                        <input 
                          type="checkbox"
                          checked={!!selectedNode.maintenanceMode}
                          onChange={() => toggleMaintenanceMode(selectedNode.id)}
                          className="w-4 h-4 accent-teal-500 cursor-pointer rounded bg-slate-900 border-white/10"
                        />
                      </div>
                    </div>

                    {/* RMA Status / Dispatch Button */}
                    <div className="pt-2 border-t border-white/5 space-y-3">
                      {(() => {
                        const ticket = technicianTickets.find(t => t.nodeId === selectedNode.id)
                        if (!ticket) {
                          return (
                            <Button 
                              variant={selectedNode.healthStatus !== 'healthy' ? 'primary' : 'ghost'}
                              className="w-full justify-center text-[10px] font-black tracking-widest py-2 h-9"
                              onClick={() => repairHardware(selectedNode.id)}
                            >
                              🛠️ REQUEST TECHNICIAN RMA ($1,500)
                            </Button>
                          )
                        }

                        let statusText = 'Technician Dispatched'
                        let statusIcon = '🚀'
                        if (ticket.status === 'arrived') {
                          statusText = 'Unboxing Tools & Grounding'
                          statusIcon = '📦'
                        } else if (ticket.status === 'diagnosing') {
                          statusText = 'Running Silicon Diagnostics'
                          statusIcon = '🔍'
                        } else if (ticket.status === 'repairing') {
                          statusText = 'Hot-Swapping Hardware'
                          statusIcon = '🔧'
                        }

                        const pct = Math.round((ticket.elapsedSeconds / ticket.totalSeconds) * 100)

                        return (
                          <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 space-y-3 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <span className="text-[9px] uppercase font-black text-amber-400 font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                                  <span>{statusIcon}</span>
                                  <span>ACTIVE SERVICE TICKET</span>
                                </span>
                                <p className="text-[10px] font-bold text-white uppercase">{statusText}</p>
                              </div>
                              <Badge variant="warning" className="text-[8px] font-black uppercase font-mono px-2 py-0.5 rounded border border-amber-500/20">
                                {pct}%
                              </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-amber-400 h-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-[8px] font-mono text-slate-500 text-right uppercase">
                                T-MINUS {ticket.totalSeconds - ticket.elapsedSeconds} SECONDS
                              </p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </Card>
              )}
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
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h' })}
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
