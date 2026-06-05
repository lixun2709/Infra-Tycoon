import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  Headset, 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  FastForward,
  ShieldAlert
} from 'lucide-react'
import { Modal, Card, Badge, Button, Tabs, type TabItem } from './base'
import type { TechnicianTicket } from '../../store/infraTypes'

interface ServiceDeskDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function ServiceDeskDashboard({ isOpen, onClose }: ServiceDeskDashboardProps) {
  const { 
    technicianTickets,
    expediteTicket,
    resolveTicket
  } = useInfraStore()

  const [activeTab, setActiveTab] = useState<'queue' | 'metrics'>('queue')

  const tabs: TabItem[] = [
    { id: 'queue', label: 'Active Tickets', icon: <Wrench size={16} /> },
    { id: 'metrics', label: 'SLA Analytics', icon: <Clock size={16} /> }
  ]

  const activeCount = technicianTickets.filter(t => t.status !== 'completed').length
  const completedCount = technicianTickets.filter(t => t.status === 'completed').length
  const p1Count = technicianTickets.filter(t => t.severity === 'P1' && t.status !== 'completed').length

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'P1': return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'P2': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
      case 'P3': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'P4': return 'text-sky-400 bg-sky-400/10 border-sky-400/20'
      default: return 'text-slate-400'
    }
  }

  const getSlaStatus = (ticket: TechnicianTicket) => {
    if (ticket.status === 'completed') return 'Healthy'
    if (ticket.elapsedSeconds >= ticket.slaTargetSeconds) return 'Breached'
    if (ticket.elapsedSeconds >= ticket.slaTargetSeconds * 0.75) return 'Approaching Breach'
    return 'Healthy'
  }

  const getSlaColor = (status: string) => {
    switch(status) {
      case 'Breached': return 'text-red-400'
      case 'Approaching Breach': return 'text-orange-400'
      default: return 'text-emerald-400'
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ITSM Service Desk" 
      icon={<Headset size={24} className="text-teal-400" />}
      width="xl"
      zIndex="z-[150]"
      headerExtra={
        <div className="flex gap-2 ml-4">
          <Badge variant={p1Count > 0 ? 'error' : 'success'}>
            {p1Count > 0 ? `${p1Count} CRITICAL P1` : 'ALL CLEAR'}
          </Badge>
        </div>
      }
    >
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onChange={(id) => setActiveTab(id as any)} 
      />

      <div className="p-6 h-[600px] overflow-y-auto">
        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <AlertTriangle className="text-orange-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Open Tickets</div>
                <div className="text-2xl font-bold text-white">{activeCount}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <CheckCircle className="text-emerald-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">Resolved Today</div>
                <div className="text-2xl font-bold text-white">{completedCount}</div>
              </Card>
              <Card className="p-4 bg-slate-900 border-slate-700 flex flex-col items-center justify-center">
                <ShieldAlert className="text-red-400 mb-2" size={24} />
                <div className="text-sm text-slate-400">P1 Incident Queue</div>
                <div className="text-2xl font-bold text-red-400">{p1Count}</div>
              </Card>
            </div>

            {/* Kanban List */}
            <div className="space-y-3">
              {technicianTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Headset size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No active service requests.</p>
                </div>
              ) : (
                technicianTickets.map(ticket => {
                  const slaStatus = getSlaStatus(ticket)
                  const slaColor = getSlaColor(slaStatus)
                  return (
                    <Card key={ticket.id} className="p-4 bg-slate-900/80 border-slate-800 flex items-center justify-between">
                      <div className="flex flex-col gap-2 w-1/3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-black rounded border ${getSeverityColor(ticket.severity)}`}>
                            {ticket.severity}
                          </span>
                          <span className="text-sm font-bold text-white">{ticket.id}</span>
                        </div>
                        <div className="text-xs text-slate-400">Node: {ticket.nodeName}</div>
                        <div className="text-xs text-slate-500 capitalize">Issue: {ticket.type} Failure</div>
                      </div>

                      <div className="w-1/3 px-4 flex flex-col items-center">
                        <div className="w-full bg-slate-950 rounded-full h-2 mb-2 border border-slate-800">
                          <div 
                            className="bg-teal-500 h-2 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (ticket.elapsedSeconds / ticket.totalSeconds) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex justify-between w-full">
                          <span>{ticket.status.toUpperCase()}</span>
                          <span className={slaColor}>SLA: {ticket.elapsedSeconds}s / {ticket.slaTargetSeconds}s</span>
                        </div>
                        {(ticket.breachFinesAccumulated || 0) > 0 && (
                          <div className="text-[10px] text-red-400 font-bold mt-1">
                            FINE: -${ticket.breachFinesAccumulated?.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="w-1/3 flex justify-end items-center gap-2">
                        {ticket.status !== 'completed' ? (
                          <Button 
                            variant="primary" 
                            onClick={() => expediteTicket(ticket.id)}
                            icon={<FastForward size={14} />}
                            className="text-[10px] py-1 px-2"
                            title="Pay $2,000 to halve remaining dispatch time"
                          >
                            Expedite ($2k)
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            onClick={() => resolveTicket(ticket.id)}
                            icon={<CheckCircle size={14} className="text-emerald-400" />}
                            className="text-[10px] py-1 px-2 text-emerald-400"
                          >
                            Close Ticket
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <Card className="p-6 border-slate-800 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white mb-4">SLA Compliance & MTTR</h3>
              <p className="text-slate-300 text-sm mb-6">
                Mean Time To Resolution (MTTR) tracks how quickly your Smart Hands teams repair critical infrastructure. Breaching SLAs on P1 and P2 tickets will result in severe Reputation damage with Enterprise clients.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-emerald-400" />
                    <div>
                      <div className="text-sm font-bold text-white">Global MTTR</div>
                      <div className="text-xs text-slate-500">Average resolution time</div>
                    </div>
                  </div>
                  <div className="text-xl font-mono text-emerald-400">
                    {technicianTickets.length > 0 
                      ? `${Math.floor(technicianTickets.reduce((acc, t) => acc + t.elapsedSeconds, 0) / technicianTickets.length)}s`
                      : '0s'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center gap-3">
                    <DollarSign size={20} className="text-sky-400" />
                    <div>
                      <div className="text-sm font-bold text-white">Expedite Spend</div>
                      <div className="text-xs text-slate-500">Total fees paid for priority routing</div>
                    </div>
                  </div>
                  <div className="text-xl font-mono text-sky-400">
                    ${technicianTickets.reduce((acc, t) => acc + (t.priorityFee || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Modal>
  )
}
