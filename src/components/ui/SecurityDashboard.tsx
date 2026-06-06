/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  WifiOff, 
  TerminalSquare, 
  AlertTriangle, 
  Fingerprint,
  Server,
  Layers,
  Search,
  Radar,
  RadioTower,
  Cpu,
  Globe
} from 'lucide-react'
import { Modal, Card, Badge, Button, Tabs, type TabItem } from './system'

interface SecurityDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function SecurityDashboard({ isOpen, onClose }: SecurityDashboardProps) {
  const { 
    nodes, 
    isolateNode, 
    toggleMicrosegmentation, 
    formatNode, 
    triggerRansomwareSimulation 
  } = useInfraStore()

  const [activeTab, setActiveTab] = useState<'overview' | 'intel' | 'nodes'>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter for servers and storage
  const securityNodes = useMemo(() => {
    return nodes.filter((n: any) => n.type === 'compute' || n.type === 'storage')
  }, [nodes])

  const stats = useMemo(() => {
    let clean = 0, exposed = 0, infected = 0, encrypting = 0, locked = 0
    let isolatedCount = 0
    let microsegCount = 0
    
    securityNodes.forEach((n: any) => {
      const state = n.infectionState || 'clean'
      if (state === 'clean') clean++
      else if (state === 'exposed') exposed++
      else if (state === 'infected') infected++
      else if (state === 'encrypting') encrypting++
      else if (state === 'locked') locked++

      if (n.isIsolated) isolatedCount++
      if (n.microsegmentationEnabled) microsegCount++
    })
    return { clean, exposed, infected, encrypting, locked, isolatedCount, microsegCount, total: securityNodes.length }
  }, [securityNodes])

  const tabs: TabItem[] = [
    { id: 'overview', label: 'THREAT LANDSCAPE', icon: <Radar size={14} /> },
    { id: 'intel', label: 'GLOBAL OSINT', icon: <Globe size={14} /> },
    { id: 'nodes', label: 'ASSET MITIGATION', icon: <Server size={14} /> }
  ]

  const filteredNodes = securityNodes.filter((n: any) => 
    n.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.catalogKey?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'clean': return 'border-emerald-500/30 bg-emerald-950/10'
      case 'exposed': return 'border-yellow-500/50 bg-yellow-950/20'
      case 'infected': return 'border-orange-500/50 bg-orange-950/20'
      case 'encrypting': return 'border-rose-500/50 bg-rose-950/30'
      case 'locked': return 'border-red-500/50 bg-red-950/30'
      default: return 'border-slate-700/50 bg-slate-900/50'
    }
  }

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'clean': return <ShieldCheck className="w-5 h-5 text-emerald-400" />
      case 'exposed': return <ShieldAlert className="w-5 h-5 text-yellow-400" />
      case 'infected': return <AlertTriangle className="w-5 h-5 text-orange-400" />
      case 'encrypting': return <Lock className="w-5 h-5 text-rose-400 animate-pulse" />
      case 'locked': return <Lock className="w-5 h-5 text-red-500" />
      default: return <Shield className="w-5 h-5 text-slate-400" />
    }
  }

  const getDotColor = (state: string) => {
    switch (state) {
      case 'clean': return 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]'
      case 'exposed': return 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.5)]'
      case 'infected': return 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)] animate-pulse'
      case 'encrypting': return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,1)] animate-ping'
      case 'locked': return 'bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.8)]'
      default: return 'bg-slate-600'
    }
  }

  const handleGlobalLockdown = () => {
    securityNodes.forEach((n: any) => {
      const state = n.infectionState || 'clean'
      if ((state === 'infected' || state === 'encrypting' || state === 'exposed') && !n.isIsolated) {
        isolateNode(n.id)
      }
    })
  }

  const handleGlobalMicroseg = () => {
    securityNodes.forEach((n: any) => {
      if (!n.microsegmentationEnabled) {
        toggleMicrosegmentation(n.id, true)
      }
    })
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SECURITY OPERATIONS CENTER"
      icon={<Fingerprint size={20} className="text-cyan-400" />}
      width="xl"
      zIndex="z-[150]"
      headerExtra={
        <div className="flex items-center gap-6 ml-4">
           <div className="flex flex-col items-end mr-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">DEFCON Level</span>
              <span className={`text-xs font-black tracking-widest ${stats.infected + stats.encrypting + stats.locked > 0 ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : stats.exposed > 0 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]'}`}>
                {stats.infected + stats.encrypting + stats.locked > 0 ? 'CRITICAL (1)' : stats.exposed > 0 ? 'ELEVATED (3)' : 'NOMINAL (5)'}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700/50"></div>
            <Button 
              variant="danger" 
              onClick={triggerRansomwareSimulation}
              icon={<RadioTower size={14} />}
              className="h-8 text-[10px] uppercase font-black tracking-widest hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              Trigger Simulation
            </Button>
        </div>
      }
    >
      <div className="flex flex-col h-[80vh]">
        <Tabs 
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          variant="underline"
          className="bg-black/40 border-b border-white/5"
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-b from-transparent to-slate-950/50">
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Top Overview Cards */}
              <div className="grid grid-cols-5 gap-3">
                <Card className="p-4 flex flex-col items-center justify-center text-center border-emerald-500/20 bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                  <ShieldCheck className="text-emerald-400 mb-2 opacity-80" size={24} />
                  <span className="text-[9px] text-emerald-500/80 font-black uppercase tracking-[0.2em] mb-1">Clean</span>
                  <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{stats.clean}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center border-yellow-500/20 bg-yellow-950/10 hover:bg-yellow-950/20 transition-colors">
                  <ShieldAlert className="text-yellow-400 mb-2 opacity-80" size={24} />
                  <span className="text-[9px] text-yellow-500/80 font-black uppercase tracking-[0.2em] mb-1">Exposed</span>
                  <span className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">{stats.exposed}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center border-orange-500/30 bg-orange-950/20 hover:bg-orange-950/30 transition-colors">
                  <AlertTriangle className="text-orange-400 mb-2 opacity-80" size={24} />
                  <span className="text-[9px] text-orange-500/80 font-black uppercase tracking-[0.2em] mb-1">Infected</span>
                  <span className="text-3xl font-black text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]">{stats.infected}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center border-rose-500/40 bg-rose-950/30 hover:bg-rose-950/40 transition-colors">
                  <Lock className="text-rose-400 mb-2 opacity-80 animate-pulse" size={24} />
                  <span className="text-[9px] text-rose-500/80 font-black uppercase tracking-[0.2em] mb-1">Encrypting</span>
                  <span className="text-3xl font-black text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]">{stats.encrypting}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center border-red-500/50 bg-red-950/30 hover:bg-red-950/40 transition-colors">
                  <Lock className="text-red-500 mb-2 opacity-80" size={24} />
                  <span className="text-[9px] text-red-500/80 font-black uppercase tracking-[0.2em] mb-1">Locked</span>
                  <span className="text-3xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">{stats.locked}</span>
                </Card>
              </div>

              {/* Threat Matrix Visualizer */}
              <Card className="p-6 border-slate-700/50 bg-[#0a0f18] relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.8)] opacity-50 animate-[scan_3s_ease-in-out_infinite]"></div>

                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <Radar className="w-4 h-4 text-cyan-400 animate-spin-slow" /> Datacenter Threat Matrix
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span><span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Clean</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.5)]"></span><span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Threat</span></div>
                  </div>
                </div>

                <div className="relative z-10 flex flex-wrap gap-1.5 content-start min-h-[120px]">
                  {securityNodes.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-slate-600 font-mono uppercase tracking-widest">No assets online</span>
                    </div>
                  ) : (
                    securityNodes.map((n: any) => (
                      <div 
                        key={n.id} 
                        className={`w-2.5 h-2.5 rounded-sm transition-all duration-300 ${getDotColor(n.infectionState || 'clean')} ${n.isIsolated ? 'opacity-20' : 'opacity-100'} ${n.microsegmentationEnabled ? 'border border-blue-400/50' : ''}`}
                        title={`${n.name} - ${n.infectionState || 'clean'}${n.isIsolated ? ' (Isolated)' : ''}${n.microsegmentationEnabled ? ' (Microseg)' : ''}`}
                      ></div>
                    ))
                  )}
                </div>
              </Card>

              {/* Zero Trust & Global Mitigations */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-5 border-blue-500/20 bg-blue-950/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <Layers size={14} /> Zero-Trust Microsegmentation
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Restricts lateral worm propagation</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-white">{stats.microsegCount}</span>
                      <span className="text-xs text-slate-500 font-bold ml-1">/ {stats.total}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000"
                      style={{ width: `${stats.total > 0 ? (stats.microsegCount / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <Button 
                    variant="primary" 
                    className="w-full h-8 text-[10px] tracking-widest font-black uppercase bg-blue-600 hover:bg-blue-500"
                    onClick={handleGlobalMicroseg}
                    icon={<ShieldCheck size={14} />}
                  >
                    Deploy Global Microseg
                  </Button>
                </Card>

                <Card className="p-5 border-indigo-500/20 bg-indigo-950/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <WifiOff size={14} /> Network Quarantine
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Physically severed connections</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">{stats.isolatedCount}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
                      style={{ width: `${stats.total > 0 ? (stats.isolatedCount / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-full h-8 text-[10px] tracking-widest font-black uppercase border-indigo-500 text-indigo-400 hover:bg-indigo-950/50"
                    onClick={handleGlobalLockdown}
                    disabled={stats.exposed === 0 && stats.infected === 0 && stats.encrypting === 0}
                    icon={<WifiOff size={14} />}
                  >
                    Lockdown Active Threats
                  </Button>
                </Card>
              </div>

            </div>
          )}

          {activeTab === 'intel' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="col-span-2 p-5 border-slate-700/50 bg-[#0a0f18]">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Globe size={14} className="text-cyan-400" /> Active Threat Intelligence (OSINT)
                  </h3>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center gap-4 bg-slate-900 p-3 rounded border border-slate-800">
                      <Badge variant="error" className="animate-pulse">CRITICAL</Badge>
                      <span className="text-red-400 font-bold">CVE-2026-9921</span>
                      <span className="text-slate-400">Zero-day RCE in ESXi v8.x</span>
                      <span className="text-slate-600 ml-auto">2m ago</span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900 p-3 rounded border border-slate-800">
                      <Badge variant="warning">HIGH</Badge>
                      <span className="text-yellow-400 font-bold">APT-44</span>
                      <span className="text-slate-400">Targeting North American Datacenters</span>
                      <span className="text-slate-600 ml-auto">14m ago</span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900 p-3 rounded border border-slate-800">
                      <Badge variant="info">INFO</Badge>
                      <span className="text-cyan-400 font-bold">Botnet Activity</span>
                      <span className="text-slate-400">DDoS precursor traffic detected at Edge</span>
                      <span className="text-slate-600 ml-auto">1h ago</span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900 p-3 rounded border border-slate-800">
                      <Badge variant="warning">HIGH</Badge>
                      <span className="text-yellow-400 font-bold">CVE-2026-8102</span>
                      <span className="text-slate-400">Palo Alto VPN bypass</span>
                      <span className="text-slate-600 ml-auto">3h ago</span>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 border-slate-700/50 bg-[#0a0f18]">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                    <ShieldAlert size={14} className="text-rose-400" /> IPS/IDS Logs
                  </h3>
                  <div className="space-y-2 font-mono text-[10px] text-slate-500">
                    <div className="flex justify-between"><span className="text-red-400">DROP</span><span>TCP 445 (SMB)</span></div>
                    <div className="flex justify-between"><span className="text-emerald-400">ALLOW</span><span>TCP 443 (HTTPS)</span></div>
                    <div className="flex justify-between"><span className="text-red-400">DROP</span><span>UDP 53 (DNS Amp)</span></div>
                    <div className="flex justify-between"><span className="text-red-400">DROP</span><span>TCP 22 (SSH Brute)</span></div>
                    <div className="flex justify-between"><span className="text-emerald-400">ALLOW</span><span>TCP 80 (HTTP)</span></div>
                    <div className="flex justify-between"><span className="text-emerald-400">ALLOW</span><span>TCP 443 (HTTPS)</span></div>
                    <div className="flex justify-between"><span className="text-red-400">DROP</span><span>ICMP (Ping Flood)</span></div>
                    <div className="flex justify-between"><span className="text-red-400">DROP</span><span>TCP 3389 (RDP)</span></div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="space-y-4">
              
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search assets by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
                  />
                </div>
              </div>

              {filteredNodes.length === 0 ? (
                 <div className="flex items-center justify-center h-48 bg-white/5 rounded-xl border border-white/5 border-dashed">
                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">No matching assets found</span>
                 </div>
              ) : (
                <div className="grid gap-2">
                  {filteredNodes.map((node: any) => {
                    const state = node.infectionState || 'clean'
                    const isCritical = state === 'infected' || state === 'encrypting' || state === 'locked'
                    
                    return (
                      <Card key={node.id} className={`p-3 flex items-center justify-between transition-colors ${getStatusColor(state)} hover:brightness-110`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center shadow-inner border border-white/5 relative overflow-hidden">
                            <div className={`absolute inset-0 opacity-20 ${state === 'clean' ? 'bg-emerald-500' : state === 'exposed' ? 'bg-yellow-500' : state === 'locked' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                            {getStatusIcon(state)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-white text-sm tracking-wide">{node.name || node.catalogKey || node.id.slice(0, 8)}</span>
                              <Badge variant="ghost" className="text-[9px] py-0 border-slate-700 bg-slate-800/50"><Cpu size={10} className="inline mr-1" />{node.type}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={isCritical ? 'error' : state === 'exposed' ? 'warning' : 'success'} className="text-[9px] py-0 px-1.5 font-black tracking-widest">
                                {state.toUpperCase()}
                              </Badge>
                              {node.isIsolated && <Badge variant="info" className="text-[9px] py-0 px-1.5 font-black tracking-widest bg-indigo-500/20 text-indigo-300 border-indigo-500/30">ISOLATED</Badge>}
                              {node.microsegmentationEnabled && <Badge variant="success" className="text-[9px] py-0 px-1.5 font-black tracking-widest bg-blue-500/20 text-blue-300 border-blue-500/30">MICROSEG</Badge>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant={node.microsegmentationEnabled ? 'primary' : 'ghost'} onClick={() => toggleMicrosegmentation(node.id, !node.microsegmentationEnabled)} icon={<ShieldCheck size={14} />} className={`h-8 text-[10px] font-black tracking-widest ${node.microsegmentationEnabled ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 hover:bg-blue-600/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border-slate-700'}`}>
                            MICROSEG
                          </Button>

                          <Button variant="ghost" onClick={() => isolateNode(node.id)} disabled={node.isIsolated} icon={<WifiOff size={14} />} className={`h-8 text-[10px] font-black tracking-widest ${node.isIsolated ? 'opacity-40 cursor-not-allowed bg-indigo-950 text-indigo-500 border-indigo-900' : 'hover:bg-indigo-500/20 hover:text-indigo-400 border-slate-700 text-slate-300 hover:border-indigo-500/50'}`}>
                            {node.isIsolated ? 'ISOLATED' : 'ISOLATE'}
                          </Button>

                          {isCritical && (
                            <Button variant="ghost" onClick={() => formatNode(node.id)} icon={<TerminalSquare size={14} />} className="h-8 text-[10px] font-black tracking-widest ml-2 border-red-500/50">
                              FORMAT DRIVE
                            </Button>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </Modal>
  )
}

