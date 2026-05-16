import { useState, useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { Blueprint } from '../../store/infraTypes'

export function BlueprintManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { blueprints, saveSiteAsBlueprint, applyBlueprint, exportToTerraform, runComplianceCheck, setPreviewBlueprint } = useInfraStore()
  const [blueprintName, setBlueprintName] = useState('')
  const [pendingDeployId, setPendingDeployId] = useState<string | null>(null)

  const compliance = useMemo(() => {
    return runComplianceCheck()
  }, [runComplianceCheck])

  if (!isOpen && !pendingDeployId) return null

  const handleSave = () => {
    if (!blueprintName) return
    saveSiteAsBlueprint(blueprintName)
    setBlueprintName('')
  }

  const handleDownloadJSON = (blueprint: Blueprint) => {
    const data = JSON.stringify(blueprint, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${blueprint.name}_blueprint.json`
    a.click()
  }

  const handleExportTerraform = (blueprint: Blueprint) => {
    const hcl = exportToTerraform()
    const blob = new Blob([hcl], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${blueprint.name}.tf`
    a.click()
  }

  // Right-side confirmation panel
  if (pendingDeployId) {
    const bp = blueprints.find(b => b.id === pendingDeployId)
    return (
      <div className="fixed top-24 right-6 z-[110] w-80 bg-[#0a1128]/95 border border-blue-500/50 rounded-xl shadow-2xl p-6 backdrop-blur-md animate-in slide-in-from-right duration-300">
         <div className="mb-4">
           <h3 className="text-lg font-black text-white flex items-center gap-2">
             <span>🚀</span> DEPLOY PREVIEW
           </h3>
           <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Reviewing: {bp?.name}</p>
         </div>
         
         <div className="bg-slate-900/50 rounded border border-slate-700/50 p-3 mb-6">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              This will <span className="text-red-400 font-bold uppercase underline">replace</span> current infrastructure with the selected blueprint template. 
            </p>
         </div>

         <div className="space-y-3">
           <button 
             onClick={() => { applyBlueprint(pendingDeployId); setPendingDeployId(null); onClose() }}
             className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02]"
           >
             CONFIRM DEPLOYMENT
           </button>
           <button 
             onClick={() => { setPendingDeployId(null); setPreviewBlueprint(null) }}
             className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase tracking-widest border border-slate-700 transition-all"
           >
             CANCEL
           </button>
         </div>
         
         <div className="mt-8 border-t border-slate-800 pt-4">
           <p className="text-[9px] text-slate-500 italic text-center">
             Inspect the 3D space to see the hologram layout of the blueprint before finalizing.
           </p>
         </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0a1128] border border-slate-700/50 rounded-xl w-full max-w-2xl flex flex-col max-h-[80vh] shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/40 rounded-t-xl">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>📐</span> INFRASTRUCTURE BLUEPRINTS
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">IaC Templates & Automated Compliance</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Create New Blueprint */}
          <div className="bg-slate-900/60 p-5 rounded-lg border border-slate-700/30">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Capture Site State</h3>
            <div className="flex gap-3">
              <input 
                type="text"
                placeholder="Blueprint Name (e.g., Standard-K8s-Cluster)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={blueprintName}
                onChange={e => setBlueprintName(e.target.value)}
              />
              <button 
                onClick={handleSave}
                disabled={!blueprintName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
              >
                SAVE AS BLUEPRINT
              </button>
            </div>
          </div>

          {/* Compliance Check (Current Site) */}
          <div className="bg-slate-900/60 p-5 rounded-lg border border-slate-700/30">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
              Current Site Compliance Check
              <span className={`px-2 py-0.5 rounded text-[9px] ${compliance.filter(c => c.type === 'error').length > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                {compliance.length === 0 ? 'PASSED' : `${compliance.length} ISSUES`}
              </span>
            </h3>
            
            {compliance.length > 0 ? (
              <div className="space-y-2">
                {compliance.map((c, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded text-[11px] ${c.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                    <span className="mt-0.5">{c.type === 'error' ? '🚫' : '⚠️'}</span>
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No architectural violations detected in current site.</p>
            )}
          </div>

          {/* List Blueprints */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved Blueprints</h3>
            {blueprints.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-8">No blueprints found. Save a site to get started.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {blueprints.map(bp => (
                  <div key={bp.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition-colors group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">{bp.name}</h4>
                        <p className="text-[10px] text-slate-500">{bp.nodes.length} Nodes • {bp.connections.length} Connections • {new Date(bp.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDownloadJSON(bp)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 uppercase tracking-tighter"
                          title="Download JSON"
                        >
                          JSON
                        </button>
                        <button 
                          onClick={() => handleExportTerraform(bp)}
                          className="p-1.5 bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-500/40 rounded text-[10px] font-bold text-indigo-300 uppercase tracking-tighter"
                          title="Export to Terraform"
                        >
                          HCL
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 border-t border-slate-800 pt-3">
                      <button 
                        onMouseEnter={() => setPreviewBlueprint(bp.id)}
                        onMouseLeave={() => { if (!pendingDeployId) setPreviewBlueprint(null) }}
                        onClick={() => { setPendingDeployId(bp.id); setPreviewBlueprint(bp.id) }}
                        className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/40 rounded text-[11px] font-black transition-all uppercase tracking-widest"
                      >
                        🚀 Deploy Blueprint
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border-t border-slate-700/50 rounded-b-xl flex justify-between items-center">
           <p className="text-[10px] text-slate-500 italic">Caution: Deploying a blueprint will overwrite current site infrastructure.</p>
           <button 
            onClick={onClose}
            className="px-6 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm font-bold transition-colors"
           >
            CLOSE
           </button>
        </div>
      </div>
    </div>
  )
}

