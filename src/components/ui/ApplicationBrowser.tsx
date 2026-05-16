import { motion, AnimatePresence } from 'framer-motion'
import { Layout, Rocket, X, Server, Database, Zap, Cpu } from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
import { APPLICATION_CATALOG } from '../../physics/applicationLibrary'

interface ApplicationBrowserProps {
  isOpen: boolean
  onClose: () => void
}

export function ApplicationBrowser({ isOpen, onClose }: ApplicationBrowserProps) {
  const { applications, deployApplication, removeApplication, selectedNodeId, nodes } = useInfraStore()
  
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const nodeApps = applications.filter(a => a.nodeId === selectedNodeId)

  const handleDeploy = (appId: string) => {
    if (!selectedNodeId) return
    deployApplication(appId, selectedNodeId)
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 400, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 400, opacity: 0 }}
            className="fixed bottom-32 right-8 w-96 max-h-[70vh] z-[100] bg-slate-950/90 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 rounded-lg">
                  <Layout className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tighter">Enterprise Catalog</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Service Layer Management</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Context Header */}
              <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Target Hardware</p>
                {selectedNode ? (
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">{selectedNode.name}</span>
                    <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">{selectedNode.type}</span>
                  </div>
                ) : (
                  <p className="text-xs text-rose-400 font-bold italic">Select a node to deploy applications</p>
                )}
              </div>

              {/* Catalog Sections */}
              <div className="space-y-3">
                <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest px-1">Available Blueprints</h3>
                {Object.values(APPLICATION_CATALOG).map(app => (
                  <div 
                    key={app.id}
                    className="group bg-slate-900/60 border border-slate-800 hover:border-slate-600 rounded-xl p-3 transition-all cursor-default"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{app.icon}</span>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase">{app.name}</h4>
                          <span className="text-[9px] text-slate-500 uppercase">{app.category}</span>
                        </div>
                      </div>
                      <button 
                        disabled={!selectedNode || nodeApps.some(a => a.appId === app.id)}
                        onClick={() => handleDeploy(app.id)}
                        className="p-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500 hover:text-white disabled:opacity-30 disabled:hover:bg-teal-500/10 disabled:hover:text-teal-400 transition-all"
                      >
                        <Rocket className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                      {app.description}
                    </p>
                    
                    {/* Requirements */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50 flex flex-col items-center">
                        <Cpu className="w-3 h-3 text-slate-400 mb-1" />
                        <span className="text-[9px] font-bold text-white">{app.requirements.minCores} vCPU</span>
                      </div>
                      <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50 flex flex-col items-center">
                        <Zap className="w-3 h-3 text-slate-400 mb-1" />
                        <span className="text-[9px] font-bold text-white">{app.requirements.minRAMGB} GB</span>
                      </div>
                      <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50 flex flex-col items-center">
                        <Database className="w-3 h-3 text-slate-400 mb-1" />
                        <span className="text-[9px] font-bold text-white">{app.requirements.minStorageGB} GB</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Deployments on Node */}
              {nodeApps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest px-1">Active on Node</h3>
                  {nodeApps.map(app => {
                    const info = APPLICATION_CATALOG[app.appId]
                    return (
                      <div key={app.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{info?.icon}</span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-tighter">{info?.name}</h4>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${app.status === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 animate-pulse'}`} />
                                <span className="text-[9px] text-slate-500 uppercase">{app.status}</span>
                              </div>
                              {app.status === 'deploying' && (
                                <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${app.progress}%` }}
                                    className="h-full bg-teal-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeApplication(app.id)}
                          className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
