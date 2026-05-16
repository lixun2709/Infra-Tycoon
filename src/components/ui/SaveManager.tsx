import { useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { SaveMetadata } from '../../store/infraTypes'
import { Save, FolderOpen, Trash2, X, Clock, Server } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

interface SaveManagerProps {
  onClose: () => void
}

export function SaveManager({ onClose }: SaveManagerProps) {
  const { saveGame, loadGame, getAvailableSaves, pushAlert, sites, updateSite } = useInfraStore()
  const [saves, setSaves] = useState<SaveMetadata[]>([])
  const currentSite = sites.find(s => s.id === useInfraStore.getState().currentSiteId)
  const [siteName, setSiteName] = useState(currentSite?.name || 'New Deployment')
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    type: 'danger' | 'warning'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  })

  useEffect(() => {
    setSaves(getAvailableSaves())
  }, [getAvailableSaves])

  const handleSave = (slotId: string) => {
    const existing = saves.find(s => s.id === slotId)
    const proceed = () => {
      saveGame(slotId)
      setSaves(getAvailableSaves())
      setConfirmState(s => ({ ...s, isOpen: false }))
    }

    if (existing) {
      setConfirmState({
        isOpen: true,
        title: 'Overwrite Save?',
        message: `Are you sure you want to overwrite Slot ${slotId}? All previous infrastructure data in this slot will be lost.`,
        onConfirm: proceed,
        type: 'warning'
      })
    } else {
      proceed()
    }
  }

  const handleLoad = (slotId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Load Environment?',
      message: 'Loading this save will replace your current site layout. Any unsaved progress will be lost.',
      onConfirm: () => {
        loadGame(slotId)
        onClose()
      },
      type: 'warning'
    })
  }

  const handleDelete = (slotId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Save Data?',
      message: `This will permanently erase Slot ${slotId}. This action cannot be undone.`,
      onConfirm: () => {
        localStorage.removeItem(`infra-tycoon-save-${slotId}`)
        const filtered = saves.filter(m => m.id !== slotId)
        localStorage.setItem('infra-tycoon-saves-meta', JSON.stringify(filtered))
        setSaves(filtered)
        pushAlert('info', `Save slot ${slotId} deleted.`)
        setConfirmState(s => ({ ...s, isOpen: false }))
      },
      type: 'danger'
    })
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Save className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">SAVE MANAGER</h2>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Infrastructure Persistence Engine</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <X className="text-slate-400" />
          </button>
        </div>

        {/* Site Naming Area */}
        <div className="px-8 py-6 bg-slate-950/50 border-b border-slate-800 flex items-center gap-6">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">Environment Designation</label>
            <input 
              type="text"
              value={siteName}
              onChange={(e) => {
                setSiteName(e.target.value)
                if (currentSite) updateSite(currentSite.id, { name: e.target.value })
              }}
              className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:border-blue-500 transition-all uppercase tracking-tighter"
              placeholder="ENTER SITE NAME..."
            />
          </div>
          <div className="w-px h-10 bg-white/5" />
          <div className="text-right">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Active Site</p>
             <p className="text-xs font-black text-blue-400">{currentSite?.id.slice(0,8)}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {[1, 2, 3, 4, 5].map((slotId) => {
            const slotStr = slotId.toString()
            const save = saves.find(s => s.id === slotStr)

            return (
              <div 
                key={slotStr}
                className={`group relative p-6 rounded-2xl border transition-all ${
                  save 
                  ? 'bg-slate-800/40 border-slate-700 hover:border-blue-500/50' 
                  : 'bg-slate-900/20 border-dashed border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black border ${
                      save ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-600'
                    }`}>
                      {slotId}
                    </div>
                    
                    {save ? (
                      <div className="space-y-1">
                        <h3 className="text-white font-bold flex items-center gap-2">
                          {save.siteName}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(save.timestamp).toLocaleString()}</span>
                          <span className="flex items-center gap-1.5"><Server size={12} /> {save.nodeCount} Assets</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-slate-500 font-bold italic tracking-wide">Empty Slot</h3>
                        <p className="text-slate-700 text-[10px] uppercase font-black">No Data Found</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {save && (
                      <>
                        <button 
                          onClick={() => handleLoad(slotStr)}
                          className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-black uppercase hover:bg-green-500/20 transition-all flex items-center gap-2"
                        >
                          <FolderOpen size={14} /> Load
                        </button>
                        <button 
                          onClick={() => handleDelete(slotStr)}
                          className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleSave(slotStr)}
                      className="px-4 py-2 rounded-xl bg-blue-500 border border-blue-400 text-white text-xs font-black uppercase hover:bg-blue-400 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Save size={14} /> {save ? 'Overwrite' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer info */}
        <div className="p-6 bg-slate-900 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">
            Manual Persistence Layer v2.0 - Storage Type: LocalStorage
          </p>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(s => ({ ...s, isOpen: false }))}
        type={confirmState.type}
        confirmText={confirmState.type === 'danger' ? 'Delete Permanently' : 'Proceed'}
      />
    </div>
  )
}
