/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react'
import { Card, Button } from './system'
import { Server, ShieldAlert, Cpu, HardDrive, RefreshCw, Zap } from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
export const FleetTab = () => {
  const { nodes, globalTargetFirmware, triggerFirmwareUpgrade } = useInfraStore()

  const [targetVersionInput, setTargetVersionInput] = useState(globalTargetFirmware)

  const hardwareNodes = useMemo(() => nodes.filter((n: any) => n.type === 'compute' || n.type === 'storage' || n.type === 'network' || n.type === 'load_balancer'), [nodes])

  const outdatedNodes = useMemo(() => hardwareNodes.filter((n: any) => n.firmwareVersion !== globalTargetFirmware), [hardwareNodes, globalTargetFirmware])
  
  const compliancePercentage = hardwareNodes.length > 0 
    ? Math.round(((hardwareNodes.length - outdatedNodes.length) / hardwareNodes.length) * 100) 
    : 100

  const handleUpdateGlobalTarget = () => {
    if (targetVersionInput.trim() !== '') {
      useInfraStore.setState({ globalTargetFirmware: targetVersionInput.trim() })
    }
  }

  const handleDeployAll = () => {
    const idsToUpgrade = outdatedNodes.map((n: any) => n.id)
    if (idsToUpgrade.length > 0) {
      triggerFirmwareUpgrade(idsToUpgrade)
    }
  }

  const renderContent = () => (
    <div className="flex flex-col h-full space-y-4">
      {/* Global Setting */}
      <Card className="p-4 border border-blue-500/30 bg-blue-500/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-blue-400">Global Target Firmware</h3>
            <p className="text-sm text-slate-400">Current active blueprint version for hardware validation.</p>
          </div>
          <div className="flex items-center space-x-2">
            <input 
              type="text"
              value={targetVersionInput}
              onChange={(e) => setTargetVersionInput(e.target.value)}
              className="w-32 bg-slate-900 font-mono px-3 py-1.5 rounded border border-slate-700 text-white"
            />
            <Button variant="primary" onClick={handleUpdateGlobalTarget}>Apply</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Server className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <h4 className="text-2xl font-bold font-mono">{hardwareNodes.length}</h4>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Total Fleet Nodes</span>
        </Card>
        <Card className="p-4 text-center">
          <ShieldAlert className={`w-8 h-8 mx-auto mb-2 ${outdatedNodes.length > 0 ? 'text-orange-400' : 'text-green-400'}`} />
          <h4 className="text-2xl font-bold font-mono">{outdatedNodes.length}</h4>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Outdated Nodes</span>
        </Card>
        <Card className="p-4 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-blue-400 mb-2" />
          <h4 className="text-2xl font-bold font-mono">{compliancePercentage}%</h4>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Fleet Compliance</span>
        </Card>
      </div>

      <div className="flex-1 overflow-auto border border-slate-700/50 rounded-lg p-2 bg-slate-900/50">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-bold text-slate-300">Outdated Hardware List</h3>
          <Button 
            variant={outdatedNodes.length > 0 ? 'primary' : 'ghost'} 
            disabled={outdatedNodes.length === 0}
            onClick={handleDeployAll}
            className="flex items-center space-x-2"
          >
            <Zap className="w-4 h-4" />
            <span>Deploy Firmware ({outdatedNodes.length})</span>
          </Button>
        </div>
        
        {outdatedNodes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            All systems are running the target firmware version.
          </div>
        ) : (
          <div className="space-y-2">
            {outdatedNodes.map((node: any) => (
              <div key={node.id} className="flex justify-between items-center p-3 bg-slate-800/50 border border-slate-700 rounded">
                <div className="flex items-center space-x-3">
                  {node.type === 'compute' ? <Cpu className="w-5 h-5 text-indigo-400" /> : <HardDrive className="w-5 h-5 text-blue-400" />}
                  <div>
                    <div className="font-bold font-mono text-sm">{node.name || node.id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-500">{node.type.toUpperCase()} • {node.catalogKey}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-xs text-orange-400 font-mono">Current: {node.firmwareVersion || 'Unknown'}</div>
                    <div className="text-xs text-green-400 font-mono">Target: {globalTargetFirmware}</div>
                  </div>
                  <Button variant="ghost" onClick={() => triggerFirmwareUpgrade([node.id])} disabled={node.isFlashing || node.maintenanceMode}>
                    {node.isFlashing ? 'Flashing...' : 'Update'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 flex-1">
        {renderContent()}
      </div>
    </div>
  )
}

