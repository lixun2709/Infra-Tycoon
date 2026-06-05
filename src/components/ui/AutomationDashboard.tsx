import React, { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { Activity, Play, Square, Settings, Plus, Trash2, Cpu, Thermometer, ShieldAlert, Zap, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AutomationConditionType, AutomationActionType } from '../../store/infraTypes'

import { Modal } from './base'

interface AutomationDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export const AutomationDashboard: React.FC<AutomationDashboardProps> = ({ isOpen, onClose }) => {
  const policies = useInfraStore(state => state.automationPolicies) || []
  const addPolicy = useInfraStore(state => state.addAutomationPolicy)
  const removePolicy = useInfraStore(state => state.removeAutomationPolicy)
  const updatePolicy = useInfraStore(state => state.updateAutomationPolicy)

  const [isCreating, setIsCreating] = useState(false)
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    targetLevel: 'global' as 'global' | 'site' | 'rack' | 'node' | 'application',
    targetId: '',
    conditionType: 'temp_above' as AutomationConditionType,
    conditionValue: '85',
    actionType: 'notify_only' as AutomationActionType,
    cooldownMs: 60000
  })

  const handleCreate = () => {
    if (!newPolicy.name) return
    addPolicy({
      name: newPolicy.name,
      enabled: true,
      targetLevel: newPolicy.targetLevel,
      targetId: newPolicy.targetId || undefined,
      conditionType: newPolicy.conditionType,
      conditionValue: newPolicy.conditionType.includes('temp') ? Number(newPolicy.conditionValue) : newPolicy.conditionValue,
      actionType: newPolicy.actionType,
      cooldownMs: newPolicy.cooldownMs
    })
    setIsCreating(false)
    setNewPolicy({ ...newPolicy, name: '', targetId: '' })
  }

  const getConditionIcon = (type: string) => {
    if (type.includes('temp')) return <Thermometer className="w-4 h-4 text-orange-400" />
    if (type.includes('health')) return <ShieldAlert className="w-4 h-4 text-red-400" />
    if (type.includes('power')) return <Zap className="w-4 h-4 text-yellow-400" />
    if (type.includes('cpu')) return <Cpu className="w-4 h-4 text-blue-400" />
    return <Activity className="w-4 h-4 text-cyan-400" />
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Infrastructure Automation"
      icon={<Settings size={32} />}
      width="lg"
      zIndex="z-[150]"
      className="max-w-4xl !bg-slate-950 border-slate-800"
    >
      <div className="w-full bg-slate-900/90 text-slate-300 font-mono p-6 overflow-y-auto space-y-6 flex-1 border border-slate-700/50 rounded-lg shadow-2xl backdrop-blur-xl h-[70vh] custom-scrollbar">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
        <div>
          <h2 className="text-xl font-black text-cyan-400 tracking-wider flex items-center gap-2">
            <Activity className="w-5 h-5" /> AUTOMATION POLICIES
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
            Enterprise Rules Engine & Autonomous Operations
          </p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600/40 rounded transition-colors"
        >
          {isCreating ? <Activity className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isCreating ? 'CANCEL' : 'NEW POLICY'}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-800/80 border border-cyan-500/30 rounded-lg p-5 overflow-hidden"
          >
            <h3 className="text-cyan-300 font-bold mb-4 uppercase text-sm tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" /> Define Automation Policy
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Policy Name</label>
                <input 
                  type="text" 
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500" 
                  placeholder="e.g. Auto-Shutdown on Overheat"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Scope / Target Level</label>
                <select 
                  value={newPolicy.targetLevel}
                  onChange={(e) => setNewPolicy({...newPolicy, targetLevel: e.target.value as any})}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="global">Global (All Nodes)</option>
                  <option value="site">Specific Site</option>
                  <option value="rack">Specific Rack</option>
                  <option value="node">Specific Node</option>
                </select>
              </div>

              {newPolicy.targetLevel !== 'global' && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Target ID (Leave empty for all in level)</label>
                  <input 
                    type="text" 
                    value={newPolicy.targetId}
                    onChange={(e) => setNewPolicy({...newPolicy, targetId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500" 
                    placeholder={`Enter ${newPolicy.targetLevel} ID`}
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Condition Type</label>
                <select 
                  value={newPolicy.conditionType}
                  onChange={(e) => setNewPolicy({...newPolicy, conditionType: e.target.value as any})}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="temp_above">Temperature Above (°C)</option>
                  <option value="health_degraded">Health Degraded / Failed</option>
                  <option value="power_loss">Power Loss (UPS mode)</option>
                </select>
              </div>

              {newPolicy.conditionType === 'temp_above' && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Threshold Value</label>
                  <input 
                    type="number" 
                    value={newPolicy.conditionValue}
                    onChange={(e) => setNewPolicy({...newPolicy, conditionValue: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500" 
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Action Type</label>
                <select 
                  value={newPolicy.actionType}
                  onChange={(e) => setNewPolicy({...newPolicy, actionType: e.target.value as any})}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="notify_only">Send Notification Only</option>
                  <option value="shutdown_node">Graceful Shutdown</option>
                  <option value="reboot_node">Hard Reboot Node</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleCreate}
              disabled={!newPolicy.name}
              className="w-full py-2 bg-cyan-600 text-white font-bold tracking-widest uppercase rounded hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Deploy Policy
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map(policy => (
          <div key={policy.id} className="bg-slate-800/60 border border-slate-700 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                  {policy.enabled ? <Play className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                  {policy.name}
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => updatePolicy(policy.id, { enabled: !policy.enabled })} className="text-slate-400 hover:text-cyan-400">
                    {policy.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => removePolicy(policy.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  <span className="uppercase text-slate-500">Scope:</span>
                  <span className="text-slate-300 font-bold">{policy.targetLevel} {policy.targetId ? `(${policy.targetId.slice(0,8)})` : ''}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {getConditionIcon(policy.conditionType)}
                  <span className="uppercase text-slate-500">If:</span>
                  <span className="text-cyan-200 font-bold">
                    {policy.conditionType} {policy.conditionType === 'temp_above' ? `> ${policy.conditionValue}°C` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span className="uppercase text-slate-500">Then:</span>
                  <span className="text-emerald-200 font-bold">{policy.actionType}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500">
              <span>Cooldown: {policy.cooldownMs / 1000}s</span>
              <span>Last Fired: {policy.lastFiredAt > 0 ? new Date(policy.lastFiredAt).toLocaleTimeString() : 'Never'}</span>
            </div>
          </div>
        ))}

        {policies.length === 0 && !isCreating && (
          <div className="col-span-1 md:col-span-2 py-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
            No automation policies defined. <br/> Create one to enable autonomous datacenter operations.
          </div>
        )}
      </div>

      </div>
    </Modal>
  )
}
