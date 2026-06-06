const fs = require('fs');

let c = fs.readFileSync('src/components/ui/GlobalNetwork.tsx', 'utf8');

if (!c.includes("import { Modal, Tabs } from './system'")) {
  c = c.replace(/import \{ useShallow \} from 'zustand\/react\/shallow'/, `import { useShallow } from 'zustand/react/shallow'\nimport { Modal, Tabs } from './system'`);
}

c = c.replace(/return \(\s*<div className=.fixed inset-0[^>]*>[\s\S]*?<div className=.absolute inset-0[^>]*><\/div>/, `return (
    <Modal
      isOpen={isNetworkManagerOpen}
      onClose={() => setNetworkManagerOpen(false)}
      title="SDDC Orchestrator"
      icon={<span className="text-xl font-bold">G</span>}
      width="full"
      zIndex="z-[110]"
    >
      <div className="flex flex-col h-[85vh]">`);

c = c.replace(/<div className=\"flex justify-between items-start mb-8 relative z-10\">[\s\S]*?<\/div>\s*<\/div>\s*<div className=\"flex gap-2 bg-slate-950\/60/, `<div className=\"flex gap-2 bg-slate-950/60`);

c = c.replace(/<div className=\"flex gap-2 bg-slate-950\/60 p-1\.5 rounded-2xl border border-white\/5 w-fit relative z-10 backdrop-blur-xl\">\s*\{\[\s*\{ id: 'topology', label: 'Topology', icon: '.*?' \},\s*\{ id: 'patching', label: 'Patch Panel', icon: '.*?' \},\s*\{ id: 'services', label: 'Orchestration', icon: '.*?' \},\s*\{ id: 'sdn', label: 'SDN Engineering', icon: '.*?' \},\s*\]\.map\(tab => \(\s*<button[\s\S]*?<\/button>\s*\)\)\}\s*<\/div>/, `<Tabs 
          tabs={[
            { id: 'topology', label: 'Topology' },
            { id: 'patching', label: 'Patch Panel' },
            { id: 'services', label: 'Orchestration' },
            { id: 'sdn', label: 'SDN Engineering' },
          ]}
          activeTab={activeTab}
          onChange={(id) => { setActiveTab(id as 'topology' | 'patching' | 'services' | 'sdn'); setConfiguringService(null); }}
        />`);

c = c.replace(/<\/div>\s*<\/div>\s*\)\s*\}/, `      </div>
    </Modal>
  )
}`);

fs.writeFileSync('src/components/ui/GlobalNetwork.tsx', c);
console.log('Done');
