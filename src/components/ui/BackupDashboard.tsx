import { useMemo, useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  Database, 
  DatabaseBackup, 
  ShieldCheck, 
  AlertTriangle, 
  Server,
  HardDrive,
  RefreshCw,
  Search,
  UploadCloud,
  FileWarning
} from 'lucide-react'
import { Modal, Card, Badge, Button, Tabs, type TabItem } from './base'

interface BackupDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function BackupDashboard({ isOpen, onClose }: BackupDashboardProps) {
  const { 
    nodes, 
    triggerBackup, 
    triggerGlobalBackup, 
    restoreFromBackup 
  } = useInfraStore()

  const [activeTab, setActiveTab] = useState<'overview' | 'nodes'>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter for servers and storage
  const backupNodes = useMemo(() => {
    return nodes.filter((n: any) => n.type === 'compute' || n.type === 'storage' || n.type === 'backup')
  }, [nodes])

  const stats = useMemo(() => {
    let protectedCount = 0, unprotectedCount = 0, backingUpCount = 0, corruptedCount = 0
    
    backupNodes.forEach((n: any) => {
      const state = n.backupStatus || 'unprotected'
      if (state === 'protected') protectedCount++
      else if (state === 'unprotected') unprotectedCount++
      else if (state === 'backing_up') backingUpCount++
      
      if (n.corruptionState && n.corruptionState !== 'clean') {
        corruptedCount++
      }
    })

    return {
      total: backupNodes.length,
      protected: protectedCount,
      unprotected: unprotectedCount,
      backingUp: backingUpCount,
      corrupted: corruptedCount
    }
  }, [backupNodes])

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return backupNodes
    const q = searchQuery.toLowerCase()
    return backupNodes.filter((n: any) => 
      n.name.toLowerCase().includes(q) || 
      n.id.toLowerCase().includes(q)
    )
  }, [backupNodes, searchQuery])

  const tabs: TabItem[] = [
    { id: 'overview', label: 'BaaS Overview', icon: <Database size={16} /> },
    { id: 'nodes', label: 'Backup Targets', icon: <Server size={16} /> }
  ]

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Disaster Recovery & Backup Management" 
      icon={<DatabaseBackup size={24} className="text-blue-400" />}
      width="xl"
      zIndex="z-[150]"
      headerExtra={
        <div className="flex items-center gap-6 ml-4">
          <Button 
            variant="danger" 
            onClick={() => triggerGlobalBackup()}
            icon={<UploadCloud size={16} />}
          >
            Global Snapshot
          </Button>
        </div>
      }
    >
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onChange={(id) => setActiveTab(id as typeof activeTab)} 
      />

      <div className="p-6 h-[600px] overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <Database className="text-slate-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Total Nodes</div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-emerald-900/50 flex flex-col items-center justify-center">
                <ShieldCheck className="text-emerald-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Protected</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.protected}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-orange-900/50 flex flex-col items-center justify-center">
                <AlertTriangle className="text-orange-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Unprotected</div>
                <div className="text-2xl font-bold text-orange-400">{stats.unprotected}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-red-900/50 flex flex-col items-center justify-center">
                <FileWarning className="text-red-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Corrupted</div>
                <div className="text-2xl font-bold text-red-400">{stats.corrupted}</div>
              </Card>
            </div>

            <Card className="p-6 border-slate-800 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white mb-4">DRaaS Status</h3>
              <p className="text-slate-300 text-sm mb-4">
                The enterprise backup system automatically creates snapshots of node states based on the global RPO policy. If a ransomware event or hardware failure occurs, use this dashboard to restore corrupted nodes from immutable storage.
              </p>
              
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400 mb-1">Current Active Backups</div>
                  <div className="text-xl font-mono text-blue-400">{stats.backingUp}</div>
                </div>
                <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-800">
                  <div className="text-sm text-slate-400 mb-1">Global SLA Compliance</div>
                  <div className="text-xl font-mono text-white">
                    {stats.total > 0 ? Math.round((stats.protected / stats.total) * 100) : 100}%
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search target nodes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3">
              {filteredNodes.map((node: any) => (
                <Card key={node.id} className="p-4 border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {node.type === 'storage' ? (
                      <HardDrive className="text-blue-400" size={24} />
                    ) : node.type === 'backup' ? (
                      <DatabaseBackup className="text-purple-400" size={24} />
                    ) : (
                      <Server className="text-slate-400" size={24} />
                    )}
                    
                    <div>
                      <div className="font-bold text-white">{node.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {node.catalogKey} | ID: {node.id.substring(0,8)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1 items-end">
                      {node.backupStatus === 'protected' ? (
                        <Badge variant="success">Protected</Badge>
                      ) : node.backupStatus === 'backing_up' ? (
                        <Badge variant="info" className="animate-pulse">Backing Up...</Badge>
                      ) : (
                        <Badge variant="warning">Unprotected</Badge>
                      )}

                      {node.corruptionState === 'ransomware' && (
                        <Badge variant="error">Ransomware</Badge>
                      )}
                      {node.corruptionState === 'corrupted' && (
                        <Badge variant="error">Corrupted</Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="ghost"
                        onClick={() => triggerBackup(node.id)}
                        disabled={node.backupStatus === 'backing_up'}
                        icon={<UploadCloud size={14} />}
                      >
                        Snapshot
                      </Button>
                      <Button 
                        variant="danger"
                        onClick={() => restoreFromBackup(node.id)}
                        disabled={node.backupStatus !== 'protected'}
                        icon={<RefreshCw size={14} />}
                      >
                        Restore
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              {filteredNodes.length === 0 && (
                <div className="text-center p-8 text-slate-500">
                  No target nodes found matching criteria.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
