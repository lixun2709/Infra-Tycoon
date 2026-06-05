import { useMemo, useState } from 'react'
import { Modal, Card, Button, Badge } from './base'
import { Server, Activity, ArrowRightLeft, Globe, Database, Network } from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
import { APPLICATION_CATALOG } from '../../physics/applicationLibrary'

export const LoadBalancerDashboard = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { nodes, applications, configureLoadBalancer } = useInfraStore()
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  
  // Find all available LBs
  const loadBalancers = useMemo(() => nodes.filter(n => n.type === 'load_balancer'), [nodes])
  const edgeNodes = useMemo(() => nodes.filter(n => n.type === 'edge_cache'), [nodes])

  // Get unassigned apps vs assigned
  const unassignedApps = useMemo(() => applications.filter(a => !a.loadBalancerId && a.status === 'running'), [applications])
  
  const handleAssignLB = (appId: string, lbId: string) => {
    // For simplicity, auto-assign the app's current compute node as the first target
    // In a full implementation, you'd select multiple targets.
    const app = applications.find(a => a.id === appId)
    if (app) {
      configureLoadBalancer(app.id, lbId, [app.nodeId])
    }
  }

  const renderContent = () => (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center border-blue-500/20 bg-blue-950/10">
          <ArrowRightLeft className="w-8 h-8 mx-auto text-blue-400 mb-2" />
          <h4 className="text-2xl font-bold font-mono">{loadBalancers.length}</h4>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active LBs</span>
        </Card>
        <Card className="p-4 text-center border-teal-500/20 bg-teal-950/10">
          <Globe className="w-8 h-8 mx-auto text-teal-400 mb-2" />
          <h4 className="text-2xl font-bold font-mono">{edgeNodes.length}</h4>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Edge Caches</span>
        </Card>
        <Card className="p-4 text-center border-indigo-500/20 bg-indigo-950/10">
          <Activity className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
          <h4 className="text-2xl font-bold font-mono">{applications.filter(a => a.loadBalancerId).length}</h4>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Balanced Apps</span>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        
        {/* Left Column: Application Targets */}
        <Card className="p-4 flex flex-col h-full overflow-hidden bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" /> Application Targets
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            {applications.filter(a => a.status === 'running').length === 0 && (
              <div className="text-center text-slate-600 text-xs py-8">No running applications.</div>
            )}
            
            {applications.filter(a => a.status === 'running').map(app => {
              const spec = APPLICATION_CATALOG[app.appId]
              const isBalanced = !!app.loadBalancerId
              return (
                <div 
                  key={app.id} 
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedApp === app.id 
                      ? 'border-blue-500 bg-blue-900/20' 
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedApp(app.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-slate-200">{spec?.name || app.appId}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">Node: {app.nodeId.slice(0,8)}</div>
                    </div>
                    {isBalanced ? (
                      <Badge variant="success" className="text-[9px] py-0.5">BALANCED</Badge>
                    ) : (
                      <Badge variant="warning" className="text-[9px] py-0.5">DIRECT</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Right Column: Routing Rules & Appliances */}
        <Card className="p-4 flex flex-col h-full overflow-hidden bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Network className="w-4 h-4 text-slate-500" /> Route Configuration
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
            {!selectedApp ? (
               <div className="text-center text-slate-600 text-xs py-8">Select an application to configure routing.</div>
            ) : (
              <>
                <div className="text-sm text-slate-300 mb-2">Available Load Balancers:</div>
                {loadBalancers.length === 0 && (
                  <div className="text-xs text-orange-400 border border-orange-500/20 bg-orange-500/10 p-3 rounded">
                    No Load Balancer hardware detected on the network. Procure F5 Hardware first.
                  </div>
                )}
                {loadBalancers.map(lb => {
                  const isActiveForApp = applications.find(a => a.id === selectedApp)?.loadBalancerId === lb.id
                  return (
                    <div key={lb.id} className={`p-3 rounded border ${isActiveForApp ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-blue-400" />
                          <span className="font-bold text-sm">{lb.name || lb.catalogKey}</span>
                        </div>
                        <Badge variant="info" className="text-[9px] py-0">LB</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mb-3">ID: {lb.id.slice(0, 8)}</div>
                      <Button 
                        variant={isActiveForApp ? 'success' : 'primary'}
                        size="sm"
                        className="w-full text-xs font-bold"
                        onClick={() => handleAssignLB(selectedApp, lb.id)}
                        disabled={isActiveForApp}
                      >
                        {isActiveForApp ? 'ACTIVE ROUTE' : 'ASSIGN TO LB'}
                      </Button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ADC & Edge Delivery" icon={<Globe size={20} className="text-teal-400" />} width="lg" zIndex="z-[150]">
      <div className="p-4 h-[600px] flex flex-col">
        {renderContent()}
      </div>
    </Modal>
  )
}
