import { useState } from 'react'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import { X, Search, Book, Cpu, Network, Shield, Terminal as TerminalIcon, Activity, Copy, Check } from 'lucide-react'

export function OperatorHandbook({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('bootstrap')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sections = [
    { id: 'bootstrap', title: 'Bootstrap Protocol', icon: Cpu },
    { id: 'networking', title: 'Logical Networking', icon: Network },
    { id: 'services', title: 'Service Orchestration', icon: Shield },
    { id: 'terminal', title: 'Terminal Mastery', icon: TerminalIcon },
    { id: 'health', title: 'Operational Health', icon: Activity },
    { id: 'hardware', title: 'Hardware Catalog', icon: Book },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'bootstrap':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">The Cold Start Sequence</h2>
              <p className="text-slate-400 font-medium">Follow this verified workflow to provision new infrastructure assets from unboxed to fully operational.</p>
            </header>
            
            <div className="grid gap-6">
              {[
                { step: 1, title: 'Physical Placement', desc: 'Use the Procurement Menu (P) to select hardware. Racks must be placed first, then nodes can be snapped into U-slots.', cmd: null },
                { step: 2, title: 'Power-On sequence', desc: 'Establish an OOB Serial link via the Global Terminal or Node Inspector. Execute the boot command to initialize POST.', cmd: 'poweron' },
                { step: 3, title: 'Hostname Identity', desc: 'Assign a unique FQDN. This registration is required before the network stack can be plumbed.', cmd: 'hostname node-01' },
                { step: 4, title: 'IP Provisioning', desc: 'Assign a static management IP or wait for DHCP orchestration. Use the setup command for manual addressing.', cmd: 'ip setup 10.0.0.10 10.0.0.1 1.1.1.1' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-teal-500/30 transition-all group">
                  <div className="flex items-start gap-5">
                    <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-black text-sm shrink-0">
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-black uppercase tracking-widest text-xs mb-2">{item.title}</h4>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4">{item.desc}</p>
                      {item.cmd && (
                        <div className="bg-slate-950 rounded-xl p-3 border border-white/5 flex items-center justify-between group/cmd">
                          <code className="text-teal-400 font-mono text-xs">{item.cmd}</code>
                          <button 
                            onClick={() => copyToClipboard(item.cmd!, `boot-${i}`)}
                            className="p-2 hover:bg-white/5 rounded-lg transition-all"
                          >
                            {copiedId === `boot-${i}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-500" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'networking':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Fabric Orchestration</h2>
              <p className="text-slate-400 font-medium">The SDDC utilizes a flat L2 logical plane. Physical patching determines the data flow paths.</p>
            </header>

            <div className="bg-slate-900/50 border border-teal-500/20 rounded-[2.5rem] p-8">
              <h4 className="text-teal-400 font-black uppercase tracking-widest text-[10px] mb-6">Patch Panel Workflow</h4>
              <ol className="space-y-6">
                <li className="flex gap-4">
                  <span className="text-slate-600 font-mono">01.</span>
                  <p className="text-sm text-slate-300">Open <strong className="text-white">Global Network</strong> (🌐) and select the <strong className="text-white">Patch Panel</strong> tab.</p>
                </li>
                <li className="flex gap-4">
                  <span className="text-slate-600 font-mono">02.</span>
                  <p className="text-sm text-slate-300">Select a <strong className="text-white">Source Port</strong> (e.g., Compute Eth1) and a <strong className="text-white">Destination Port</strong> (e.g., Spine Switch Gi1/0/1).</p>
                </li>
                <li className="flex gap-4">
                  <span className="text-slate-600 font-mono">03.</span>
                  <p className="text-sm text-slate-300">Click <strong className="text-white text-teal-400">Initialize Logical Patch</strong> to anchor the connection in the state machine.</p>
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-900/30 border border-white/5 p-6 rounded-2xl">
                <h5 className="text-white font-black uppercase text-[10px] mb-3 tracking-widest">Topology Visualization</h5>
                <p className="text-xs text-slate-500 leading-relaxed">Nodes glow <span className="text-green-500">GREEN</span> when logically patched and powered. <span className="text-red-500">RED</span> lines indicate blocked paths due to compliance violations or power loss.</p>
              </div>
              <div className="bg-slate-900/30 border border-white/5 p-6 rounded-2xl">
                <h5 className="text-white font-black uppercase text-[10px] mb-3 tracking-widest">OOB Management</h5>
                <p className="text-xs text-slate-500 leading-relaxed">Management traffic is routed via the Serial Console. Ensure nodes are 'Racked' to enable the OOB bus.</p>
              </div>
            </div>
          </div>
        )
      case 'services':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Service Deployment</h2>
              <p className="text-slate-400 font-medium">Verify system integrity by deploying core infrastructure protocols.</p>
            </header>

            <div className="space-y-4">
              {['DHCP', 'DNS', 'NTP'].map(svc => (
                <div key={svc} className="bg-slate-950/50 border border-white/10 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-2xl border border-white/5">
                        {svc === 'DHCP' ? '⚡' : svc === 'DNS' ? '🗺️' : '⏱️'}
                      </div>
                      <h4 className="text-xl font-black text-white tracking-tighter">{svc} Orchestrator</h4>
                    </div>
                    <div className="px-4 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">Verified v1.6</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Terminal sequence</p>
                      <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] space-y-2 border border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-teal-400">apt install {svc === 'DHCP' ? 'isc-dhcp-server' : svc.toLowerCase()}</span>
                          <button onClick={() => copyToClipboard(`apt install ${svc === 'DHCP' ? 'isc-dhcp-server' : svc.toLowerCase()}`, `svc-ins-${svc}`)} className="text-slate-600 hover:text-white transition-all">
                             {copiedId === `svc-ins-${svc}` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-teal-400">systemctl start {svc.toLowerCase()}</span>
                          <button onClick={() => copyToClipboard(`systemctl start ${svc.toLowerCase()}`, `svc-str-${svc}`)} className="text-slate-600 hover:text-white transition-all">
                             {copiedId === `svc-str-${svc}` ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verification criteria</p>
                       <ul className="space-y-2">
                         {[
                           'Node must be in RUNNING state',
                           'Management IP assigned (10.0.0.x)',
                           'Logical patch to Site Core established',
                           'Service process active in store state'
                         ].map((l, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                             <div className="w-1 h-1 bg-teal-500 rounded-full" />
                             {l}
                           </li>
                         ))}
                       </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'terminal':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Terminal Kernel v1.6</h2>
              <p className="text-slate-400 font-medium">Advanced CLI mastery for the enterprise management plane.</p>
            </header>

            <div className="grid grid-cols-2 gap-8">
               <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem]">
                  <h4 className="text-white font-black uppercase text-xs tracking-widest mb-6">Automation & Scripting</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Command redirection</p>
                      <code className="block bg-slate-950 p-3 rounded-xl border border-white/5 text-teal-400 text-xs">echo "poweron" {'>'} boot.sh</code>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Script execution</p>
                      <code className="block bg-slate-950 p-3 rounded-xl border border-white/5 text-teal-400 text-xs">sh boot.sh</code>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Piping (Grep/Tail)</p>
                      <code className="block bg-slate-950 p-3 rounded-xl border border-white/5 text-teal-400 text-xs">cat /var/log/syslog | grep "ERR"</code>
                    </div>
                  </div>
               </div>
               <div className="bg-slate-950/50 border border-teal-500/20 p-8 rounded-[2.5rem]">
                  <h4 className="text-white font-black uppercase text-xs tracking-widest mb-6">Custom Environment</h4>
                  <div className="space-y-4">
                     <p className="text-xs text-slate-400 leading-relaxed font-bold">The kernel supports persistent aliases and environment variables defined per-site.</p>
                     <div className="bg-slate-900 rounded-2xl p-5 border border-white/5 space-y-3 font-mono text-[11px]">
                        <div><span className="text-pink-400">alias</span> ll='ls -la'</div>
                        <div><span className="text-pink-400">export</span> DOMAIN=infra.local</div>
                        <div><span className="text-slate-500"># Verify with:</span></div>
                        <div className="text-teal-400">echo $DOMAIN</div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )
      case 'health':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Operational Health</h2>
              <p className="text-slate-400 font-medium">Pre-flight checklist for enterprise readiness.</p>
            </header>

            <div className="grid grid-cols-1 gap-4">
              {[
                { title: 'Connectivity Probe', task: 'Execute ping [target-ip] from a compute node to verify L3 routing.', status: 'nominal' },
                { title: 'Service Discovery', task: 'Check Global Network Dashboard for "GREEN" service status indicators.', status: 'nominal' },
                { title: 'Thermal Equilibrium', task: 'Verify rack temperature is within safe limits (18°C - 27°C).', status: 'critical' },
                { title: 'State Persistence', task: 'Refresh browser to confirm LocalStorage rehydration of site blueprints.', status: 'nominal' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-900/50 border border-white/5 p-6 rounded-2xl">
                  <div className="flex gap-4 items-center">
                    <div className="w-2 h-10 rounded-full bg-teal-500/40" />
                    <div>
                      <h4 className="text-white font-black uppercase text-xs tracking-widest">{item.title}</h4>
                      <p className="text-slate-500 text-xs font-medium mt-1">{item.task}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${item.status === 'nominal' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'hardware':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Hardware Registry</h2>
              <p className="text-slate-400 font-medium">Specifications for all current-gen SDDC assets.</p>
            </header>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(HARDWARE_CATALOG).map(([key, spec]) => (
                <div key={key} className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex flex-col gap-4 group hover:border-teal-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-black uppercase text-xs tracking-tight">{spec.name}</h4>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">{spec.type}</p>
                    </div>
                    <div className="text-[10px] font-mono text-teal-400 font-black">{spec.uHeight}U</div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 italic">{spec.useCase}</p>
                  <div className="flex gap-4 mt-auto border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Power</span>
                      <span className="text-[10px] text-slate-300 font-black">{spec.wattage}W</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Storage</span>
                      <span className="text-[10px] text-slate-300 font-black">{spec.storageTB}TB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-12 animate-in fade-in zoom-in duration-300">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl" onClick={onClose} />
      
      <div className="relative w-full max-w-7xl h-[85vh] bg-[#020617] border border-white/10 rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-24 border-b border-white/10 flex items-center justify-between px-12 bg-slate-900/20">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-2xl">
              <Book size={24} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-tighter">Operator's Handbook <span className="text-teal-400">v1.6</span></h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Authorized Personnel Only // Classified</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="relative group">
               <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
               <input 
                 type="text" 
                 placeholder="SEARCH KERNEL DOCS..." 
                 className="bg-slate-950 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-teal-500/50 w-64 transition-all"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
             </div>
             <button 
               onClick={onClose}
               className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/5 transition-all flex items-center justify-center"
             >
               <X size={20} />
             </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-80 border-r border-white/5 bg-slate-950/50 p-8 flex flex-col gap-2">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-4">Knowledge Base</p>
            {sections.map(section => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full px-6 py-4 rounded-2xl flex items-center gap-4 transition-all group ${activeSection === section.id ? 'bg-teal-500 text-slate-950 shadow-[0_10px_30px_rgba(45,212,191,0.2)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon size={18} strokeWidth={activeSection === section.id ? 3 : 2} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${activeSection === section.id ? '' : 'group-hover:translate-x-1'} transition-transform`}>{section.title}</span>
                </button>
              )
            })}
            
            <div className="mt-auto p-6 bg-slate-900/40 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                 <span className="text-[9px] font-black text-teal-500 uppercase tracking-widest">Logic Sync: Active</span>
              </div>
              <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase opacity-60">All manual instructions are verified against the v1.6 management plane state machine.</p>
            </div>
          </aside>

          {/* Viewer */}
          <main className="flex-1 p-16 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.03),transparent)]">
            <div className="max-w-4xl">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
