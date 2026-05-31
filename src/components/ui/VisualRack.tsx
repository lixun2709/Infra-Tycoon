import React from 'react'
import type { InfraNode } from '../../store/infraTypes'
import { Server, Database, Network } from 'lucide-react'

interface VisualRackProps {
  rack: InfraNode
  hardware: InfraNode[]
}

export const VisualRack: React.FC<VisualRackProps> = ({ rack, hardware }) => {
  // Typical rack is 42U. We render top (42) to bottom (1).
  const totalU = rack.uHeight || 42
  
  // Create an array of slot numbers from top to bottom
  const slots = Array.from({ length: totalU }).map((_, i) => totalU - i)

  // Map slots to hardware
  const slotMap = new Map<number, InfraNode>()
  hardware.forEach(node => {
    if (node.slotIndex !== undefined) {
      for (let i = 0; i < (node.uHeight || 1); i++) {
        slotMap.set(node.slotIndex + i, node)
      }
    }
  })

  // To avoid rendering the same hardware multiple times, we'll track which ones we've rendered.
  const renderedNodes = new Set<string>()

  return (
    <div className="bg-[#0b1120] border-2 border-[#1a2333] rounded-sm p-2 shadow-2xl flex max-h-[400px]">
      {/* Left side: U-numbers */}
      <div className="flex flex-col border-r border-[#1a2333] pr-2 mr-2 w-8 shrink-0 overflow-y-auto custom-scrollbar">
        {slots.map(u => (
          <div key={u} className="h-6 flex items-center justify-center text-[8px] font-mono text-slate-600 border-b border-transparent">
            {u}U
          </div>
        ))}
      </div>

      {/* Right side: Rack content */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
        {slots.map(u => {
          const node = slotMap.get(u)
          
          if (!node) {
            // Empty slot
            return (
              <div key={u} className="h-6 border-b border-[#1a2333]/50 flex items-center px-4 bg-[#0a0f1c]/50">
                <span className="text-[8px] text-slate-800 font-mono">EMPTY</span>
              </div>
            )
          }

          if (renderedNodes.has(node.id)) {
            // This slot is occupied by a node we already rendered (it spans multiple U)
            return null
          }

          renderedNodes.add(node.id)
          const height = (node.uHeight || 1) * 24 // 24px per U

          let Icon = Server
          if (node.type === 'storage') Icon = Database
          if (node.type === 'network') Icon = Network

          const isOverloaded = node.status === 'power_overload'
          const isOff = node.systemState === 'off'

          return (
            <div 
              key={u} 
              className={`border border-[#1a2333] flex items-center px-3 relative overflow-hidden group transition-colors cursor-pointer ${
                isOverloaded ? 'bg-red-950/40 border-red-900/50' :
                isOff ? 'bg-slate-900/40' : 'bg-[#0f172a] hover:bg-[#1e293b]'
              }`}
              style={{ height: `${height}px` }}
            >
              {/* LED Lights */}
              <div className="absolute left-2 flex flex-col gap-1">
                <div className={`w-1 h-1 rounded-full ${isOff ? 'bg-slate-700' : isOverloaded ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
                <div className={`w-1 h-1 rounded-full ${isOff ? 'bg-slate-700' : 'bg-blue-500 animate-pulse'}`} />
              </div>

              {/* Node Details */}
              <div className="ml-4 flex-1 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon size={12} className={isOff ? 'text-slate-600' : 'text-slate-400'} />
                  <div>
                    <div className="text-[10px] font-black uppercase text-white tracking-wider">{node.name}</div>
                    <div className="text-[7px] font-mono text-slate-500 uppercase tracking-widest">{node.catalogKey}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[8px] font-mono text-slate-500">{node.currentPowerKW?.toFixed(1)}kW</div>
                  <div className="text-[8px] font-mono text-slate-500">{node.temperature?.toFixed(0)}°C</div>
                </div>
              </div>

              {/* Chassis Details */}
              <div className="absolute right-0 top-0 bottom-0 w-8 border-l border-[#1a2333] flex flex-col justify-evenly items-center bg-[#0a0f1c]/30">
                 <div className="w-4 h-[2px] bg-[#1a2333]" />
                 <div className="w-4 h-[2px] bg-[#1a2333]" />
                 <div className="w-4 h-[2px] bg-[#1a2333]" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
