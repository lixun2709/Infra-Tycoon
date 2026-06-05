import React, { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { Play, Square, Plus, Trash2, Terminal, List, Code, Archive } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AutomationConditionType, AutomationActionType } from '../../store/infraTypes'

import { Modal, Card, Button, Tabs, type TabItem } from './base'

interface AutomationDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export const AutomationDashboard: React.FC<AutomationDashboardProps> = ({ isOpen, onClose }) => {
  const policies = useInfraStore(state => state.automationPolicies) || []
  const addPolicy = useInfraStore(state => state.addAutomationPolicy)
  const removePolicy = useInfraStore(state => state.removeAutomationPolicy)
  const updatePolicy = useInfraStore(state => state.updateAutomationPolicy)

  const [activeTab, setActiveTab] = useState<'policies' | 'pipeline'>('policies')
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



  const tabs: TabItem[] = [
    { id: 'policies', label: 'Rule Engine', icon: <Code className="w-4 h-4" /> },
    { id: 'pipeline', label: 'CI/CD Pipeline', icon: <Terminal className="w-4 h-4" /> },
  ]

  const renderPolicies = () => (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
        <div>
          <h3 className="font-bold text-slate-300">Infrastructure as Code (IaC) Rules</h3>
          <p className="text-xs text-slate-500">Define autonomous remediation paths via terraform-style state policies.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreating(!isCreating)} icon={<Plus size={16} />}>
          {isCreating ? 'Cancel' : 'New Policy'}
        </Button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-4 border-cyan-500/30 bg-slate-900/80 mb-4">
              <h3 className="text-cyan-300 font-bold mb-4 uppercase text-xs tracking-wider flex items-center gap-2">
                <Code size={14} /> Define YAML Automation Policy
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Policy Name</label>
                  <input 
                    type="text" 
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs" 
                    placeholder="e.g. Auto-Shutdown on Overheat"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Scope / Target Level</label>
                  <select 
                    value={newPolicy.targetLevel}
                    onChange={(e) => setNewPolicy({...newPolicy, targetLevel: e.target.value as any})}
                    className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs"
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
                      className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs" 
                      placeholder={`Enter ${newPolicy.targetLevel} ID`}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Condition Type</label>
                  <select 
                    value={newPolicy.conditionType}
                    onChange={(e) => setNewPolicy({...newPolicy, conditionType: e.target.value as any})}
                    className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs"
                  >
                    <option value="temp_above">Temperature Above (°C)</option>
                    <option value="health_degraded">Health Degraded</option>
                    <option value="hardware_failure">Hardware Failure</option>
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
                      className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs" 
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 text-xs mb-1 uppercase tracking-wider">Action Type</label>
                  <select 
                    value={newPolicy.actionType}
                    onChange={(e) => setNewPolicy({...newPolicy, actionType: e.target.value as any})}
                    className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 outline-none focus:border-cyan-500 font-mono text-xs"
                  >
                    <option value="notify_only">Send Notification Only</option>
                    <option value="shutdown_node">Graceful Shutdown</option>
                    <option value="reboot_node">Hard Reboot Node</option>
                    <option value="auto_dispatch_smart_hands">Auto-Dispatch Smart Hands ($1,500)</option>
                  </select>
                </div>
              </div>

              <Button 
                variant="primary" 
                onClick={handleCreate}
                disabled={!newPolicy.name}
                className="w-full mt-2"
              >
                COMMIT & PUSH CONFIG
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
        {policies.map(policy => (
          <Card key={policy.id} className="p-3 bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                {policy.enabled ? <Play className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-slate-500" />}
                <div>
                  <h3 className="font-bold text-slate-200 font-mono text-sm">{policy.name}</h3>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">ID: {policy.id.slice(0, 8)}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant={policy.enabled ? 'ghost' : 'primary'} onClick={() => updatePolicy(policy.id, { enabled: !policy.enabled })}>
                  {policy.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="danger" onClick={() => removePolicy(policy.id)} icon={<Trash2 size={14} />}>
                  Drop
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-950 p-3 rounded font-mono text-xs space-y-2 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-pink-500">scope:</span>
                <span className="text-slate-300">"{policy.targetLevel}{policy.targetId ? `:${policy.targetId.slice(0,8)}` : ''}"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cyan-500">condition:</span>
                <span className="text-cyan-200">
                  "{policy.conditionType}{policy.conditionType === 'temp_above' ? ` > ${policy.conditionValue}C` : ''}"
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">action:</span>
                <span className="text-emerald-200">"{policy.actionType}"</span>
              </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-[10px] text-slate-500 font-mono uppercase">
              <span>Cooldown: {policy.cooldownMs / 1000}s</span>
              <span>Last Fired: {policy.lastFiredAt > 0 ? new Date(policy.lastFiredAt).toLocaleTimeString() : 'Never'}</span>
            </div>
          </Card>
        ))}

        {policies.length === 0 && !isCreating && (
          <div className="py-12 text-center text-slate-500 font-mono text-sm border border-dashed border-slate-700 rounded-lg">
            No active IaC policies. <br/> System is operating in manual mode.
          </div>
        )}
      </div>
    </div>
  )

  const renderPipeline = () => (
    <div className="flex flex-col h-full space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-slate-900/50 border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 flex items-center gap-2"><List size={14} /> Pending Jobs</div>
          <div className="text-3xl font-mono font-bold text-slate-300">0</div>
        </Card>
        <Card className="p-4 bg-emerald-900/10 border-emerald-500/20">
          <div className="text-[10px] text-emerald-500 uppercase tracking-widest font-black mb-2 flex items-center gap-2"><Play size={14} /> Active Runners</div>
          <div className="text-3xl font-mono font-bold text-emerald-400">4</div>
        </Card>
        <Card className="p-4 bg-blue-900/10 border-blue-500/20">
          <div className="text-[10px] text-blue-500 uppercase tracking-widest font-black mb-2 flex items-center gap-2"><Archive size={14} /> Total Deployments</div>
          <div className="text-3xl font-mono font-bold text-blue-400">1,204</div>
        </Card>
      </div>

      <Card className="p-4 flex-1 bg-slate-950 font-mono text-xs overflow-y-auto">
        <div className="text-slate-500 mb-4 uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between">
          <span>Deployment Logs (Tail)</span>
          <span className="text-emerald-500">Live</span>
        </div>
        <div className="space-y-2 opacity-70">
          <div className="text-slate-400">[08:42:01] runner-01: Fetching cluster state... <span className="text-emerald-400">OK</span></div>
          <div className="text-slate-400">[08:42:02] runner-01: Validating policy syntax... <span className="text-emerald-400">OK</span></div>
          <div className="text-slate-400">[08:42:05] runner-02: Executing drift detection... <span className="text-emerald-400">CLEAN</span></div>
          <div className="text-slate-400">[08:45:11] system: Health check ping to primary switch... <span className="text-emerald-400">2ms</span></div>
          <div className="text-slate-400">[08:50:00] runner-03: Performing rolling update on worker nodes... <span className="text-slate-500">SKIPPED (Up to date)</span></div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-cyan-500">
          <span className="animate-pulse">_</span> Waiting for trigger events...
        </div>
      </Card>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CI/CD & Operations Automation"
      icon={<Terminal size={20} className="text-cyan-400" />}
      width="lg"
      zIndex="z-[150]"
    >
      <div className="flex flex-col h-[600px]">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as 'policies' | 'pipeline')} />
        <div className="p-4 flex-1 min-h-0">
          {activeTab === 'policies' ? renderPolicies() : renderPipeline()}
        </div>
      </div>
    </Modal>
  )
}
