import { Vector3 } from 'three'
import { Scene } from './components/world/Scene'
import { useInfraStore } from './store/useInfraStore'

function App() {
  const addNode = useInfraStore((s) => s.addNode)

  const handleAddRack = () => {
    addNode({
      id: crypto.randomUUID(),
      type: 'rack',
      position: new Vector3(0, 0, 0),
      name: '42U Rack',
    })
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
        <button
          type="button"
          onClick={handleAddRack}
          className="rounded-md border border-[#48afbb]/50 bg-[#199277] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1faa8c] hover:border-[#5ec9b8] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
        >
          Add 42U Rack
        </button>
      </aside>
    </div>
  )
}

export default App
