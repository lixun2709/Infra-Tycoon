import { useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Inspector() {
  const nodes = useInfraStore((s) => s.nodes)
  const selectedNodeId = useInfraStore((s) => s.selectedNodeId)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  if (!selectedNode) {
    return null
  }

  return (
    <aside className="pointer-events-auto fixed right-0 top-0 z-10 flex h-full w-80 flex-col border-l border-[#48afbb]/35 bg-[#070f52] p-5 text-white shadow-[-4px_0_24px_rgba(7,15,82,0.35)]">
      <div className="border-b border-white/10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
          Inspector
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#fcfdfd]">
          Selected Node
        </h2>
      </div>

      <div className="mt-4 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2 rounded-md border border-white/10 bg-[#0d1854] p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[#a8bfd0]">Name</span>
            <span className="font-semibold text-right">{selectedNode.name}</span>
          </div>
          <div>
            <span className="text-[#a8bfd0]">Type</span>
            <span className="font-semibold text-right">{selectedNode.type}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#a8bfd0]">Power Usage</span>
            <span className="font-semibold text-right">{selectedNode.wattage} W</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Ports
          </p>
          {selectedNode.ports.length === 0 ? (
            <p className="text-sm text-[#a8bfd0]">No ports defined.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {selectedNode.ports.map((port) => (
                <li
                  key={port.id}
                  className="rounded-md border border-white/10 bg-[#0d1854] px-3 py-2"
                >
                  {`Port ${port.label} (${port.type}): ${
                    port.connectedTo == null ? 'Disconnected' : `Connected to ${port.connectedTo}`
                  }`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}

