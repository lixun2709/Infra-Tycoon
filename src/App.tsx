import { Vector3 } from 'three'
import { Inspector } from './components/ui/Inspector'
import { Scene } from './components/world/Scene'
import { useInfraStore } from './store/useInfraStore'

function App() {
  const addNode = useInfraStore((s) => s.addNode)
  const placeCatalogHardware = useInfraStore((s) => s.placeCatalogHardware)
  const totalPowerKW = useInfraStore((s) => s.totalPowerKW)
  const totalRoomBTU = useInfraStore((s) => s.totalRoomBTU)
  const overloadedRackCount = useInfraStore((s) => s.overloadedRackCount)
  const selectedNodeId = useInfraStore((s) => s.selectedNodeId)

  const handleAddRack = () => {
    addNode({
      id: crypto.randomUUID(),
      type: 'rack',
      position: new Vector3(0, 0, 0),
      name: '42U Rack',
      uHeight: 42,
      wattage: 0,
      btuOutput: 0,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online',
      ports: [],
    })
  }

  const tryPlace = (key: Parameters<typeof placeCatalogHardware>[0]) => {
    const ok = placeCatalogHardware(key)
    if (!ok) {
      window.alert(
        'No free slot found. Add a 42U rack first, or free space on an existing rack.',
      )
    }
  }

  return (
    <div className="relative h-full w-full">
      <div className="fixed inset-0 z-0">
        <Scene />
      </div>

      <aside className="pointer-events-auto fixed left-0 top-0 z-10 flex h-full w-72 flex-col gap-5 border-r border-[#48afbb]/35 bg-[#070f52] p-5 text-white shadow-[4px_0_24px_rgba(7,15,82,0.35)]">
        <div className="border-b border-white/10 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#48afbb]">
            Data center
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-[#fcfdfd]">
            Infra-Tycoon
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[#a8bfd0]">
            Infrastructure layout and floor planning
          </p>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Rack
          </p>
          <button
            type="button"
            onClick={handleAddRack}
            className="w-full rounded-md border border-[#48afbb]/50 bg-[#199277] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1faa8c] hover:border-[#5ec9b8] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
          >
            Add 42U Rack
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Hardware catalog
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => tryPlace('COMPUTE_1U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add Compute (1U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('NETAPP_STORAGE_2U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add NetApp Shelf (2U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('RUBRIK_BACKUP_2U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add Rubrik Node (2U)
            </button>
          </div>
        </div>
      </aside>

      <Inspector />

      <div
        className={`pointer-events-none fixed top-4 z-20 w-[260px] rounded-lg border border-[#48afbb]/25 bg-white/70 p-4 text-[#070f52] shadow-lg backdrop-blur-sm ${
          selectedNodeId ? 'right-[21.5rem]' : 'right-4'
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0b3a4a]">
          Room statistics
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Total power</span>
            <span className="font-semibold">{totalPowerKW.toFixed(1)} kW</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Total heat</span>
            <span className="font-semibold">
              {totalRoomBTU.toLocaleString()} BTU/hr
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Overloaded racks</span>
            <span
              className={
                overloadedRackCount > 0
                  ? 'font-semibold text-red-700'
                  : 'font-semibold'
              }
            >
              {overloadedRackCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
