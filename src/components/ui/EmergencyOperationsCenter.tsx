import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { ShieldAlert, FileText, PlayCircle, Settings } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { motion } from 'framer-motion'

export const EmergencyOperationsCenter = () => {
  const { 
    isEocOpen, 
    toggleEoc, 
    incidents, 
    postMortems,
    sites,
    triggerSiteFailover,
    triggerPowerFailureDrill,
    triggerHVACFailureDrill
  } = useInfraStore(useShallow(state => ({
    isEocOpen: state.isEocOpen,
    toggleEoc: state.toggleEoc,
    incidents: state.incidents,
    postMortems: state.postMortems,
    sites: state.sites,
    triggerSiteFailover: state.triggerSiteFailover,
    triggerPowerFailureDrill: state.triggerPowerFailureDrill,
    triggerHVACFailureDrill: state.triggerHVACFailureDrill
  })))

  const [activeTab, setActiveTab] = useState<'incidents' | 'postmortems' | 'drills'>('incidents')

  if (!isEocOpen) return null

  const activeIncidents = incidents.filter(i => !i.isResolved)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl h-[85vh] bg-slate-900/90 border border-slate-700 shadow-2xl flex flex-col rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-rose-500 w-6 h-6" />
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase">Emergency Operations Center</h2>
              <p className="text-xs text-slate-400 font-mono">GLOBAL THREAT & INCIDENT RESPONSE</p>
            </div>
          </div>
          <button 
            onClick={toggleEoc}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 bg-slate-900/50 px-6">
          <button 
            onClick={() => setActiveTab('incidents')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'incidents' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Active Incidents ({activeIncidents.length})
          </button>
          <button 
            onClick={() => setActiveTab('postmortems')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'postmortems' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Post-Mortems
          </button>
          <button 
            onClick={() => setActiveTab('drills')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'drills' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Drill Operations
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 font-mono custom-scrollbar">
          {activeTab === 'incidents' && (
            <div className="space-y-4">
              {activeIncidents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="uppercase tracking-widest text-sm">No Active Incidents. All Systems Nominal.</p>
                </div>
              ) : (
                activeIncidents.map(incident => {
                  const rto = incident.rtoTargetSeconds || 120
                  const remaining = Math.max(0, rto - incident.elapsedSeconds)
                  const site = sites.find(s => s.id === incident.siteId)
                  
                  return (
                    <div key={incident.id} className="bg-slate-800/40 border border-rose-500/30 rounded-lg p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-rose-400 font-bold uppercase tracking-widest text-xs mb-1">
                            {incident.severity} SEVERITY
                          </div>
                          <h3 className="text-lg font-black text-white uppercase">{incident.type.replace('_', ' ')}</h3>
                          <p className="text-slate-400 text-sm mt-1">Location: {site?.name || incident.siteId}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">RTO Timer</div>
                          <div className="text-2xl font-black text-rose-500 font-mono">
                            {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                      
                      {incident.type === 'drill' && (
                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => {
                              const targetSite = sites.find(s => s.id !== incident.siteId)
                              if (targetSite) triggerSiteFailover(incident.siteId, targetSite.id)
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
                          >
                            <Settings size={14} /> Execute Site Failover
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'postmortems' && (
            <div className="space-y-4">
              {postMortems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="uppercase tracking-widest text-sm">No Post-Mortems Filed.</p>
                </div>
              ) : (
                [...postMortems].reverse().map(pm => (
                  <div key={pm.id} className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-indigo-400 font-bold uppercase tracking-widest text-sm">
                        INCIDENT #{pm.incidentNumber.toString().padStart(4, '0')}
                      </div>
                      <div className="text-slate-500 text-xs">{new Date(pm.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <span className="text-xs text-slate-500 uppercase">Impact</span>
                        <p className="text-sm text-slate-300 mt-1">{pm.impact}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase">Root Cause Analysis</span>
                        <p className="text-sm text-white mt-1">{pm.rca}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase">Mitigation</span>
                        <p className="text-sm text-emerald-400 mt-1">{pm.mitigation}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'drills' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-5">
                <h3 className="text-lg font-black text-amber-500 uppercase mb-2">Power Failure Drill</h3>
                <p className="text-sm text-slate-400 mb-6">Sever utility power to a site to test UPS and Generator failover mechanics. Requires high resilience.</p>
                <button
                  onClick={() => triggerPowerFailureDrill('site-1')}
                  className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/50 py-3 rounded font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <PlayCircle size={16} /> Initiate Power Drill
                </button>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-5">
                <h3 className="text-lg font-black text-cyan-500 uppercase mb-2">HVAC Failure Drill</h3>
                <p className="text-sm text-slate-400 mb-6">Disable cooling units to test thermal runaway response and auto-throttling limits.</p>
                <button
                  onClick={() => triggerHVACFailureDrill('site-1')}
                  className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 py-3 rounded font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <PlayCircle size={16} /> Initiate HVAC Drill
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
