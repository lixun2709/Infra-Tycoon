const fs = require('fs');

function replaceFile(file, regex, replace) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(regex, replace);
  fs.writeFileSync(file, c);
}

replaceFile('src/components/ui/FacilityDashboard.tsx', /Modal,\s*/g, '');
replaceFile('src/components/ui/FleetDashboard.tsx', /Modal,\s*/g, '');
replaceFile('src/components/ui/ServiceDeskDashboard.tsx', /Modal,\s*/g, '');
replaceFile('src/components/ui/TopNav.tsx', /Brain,\s*/g, '');
replaceFile('src/components/world/MountedUnit.tsx', /selectedNodeId,\s*/g, '');
replaceFile('src/components/world/Rack.tsx', /ReactNode,\s*/g, '');
replaceFile('src/components/world/Scene.tsx', /MountedUnit,\s*/g, '');

let term = fs.readFileSync('src/components/ui/Terminal.tsx', 'utf8');
term = term.replace(/const matches = get\(\)\.nodes\.filter\(n =>/g, 'const matches = get().nodes.filter((n: any) =>');
fs.writeFileSync('src/components/ui/Terminal.tsx', term);

let cable = fs.readFileSync('src/components/world/CableSystem.tsx', 'utf8');
if (!cable.includes('import type { ThemeKey }')) {
  cable = "import type { ThemeKey } from '../../store/themeTypes'\n" + cable;
}
fs.writeFileSync('src/components/world/CableSystem.tsx', cable);

let rack = fs.readFileSync('src/components/world/Rack.tsx', 'utf8');
if (!rack.includes('import type { ThemeKey }')) {
  rack = "import type { ThemeKey } from '../../store/themeTypes'\n" + rack;
}
fs.writeFileSync('src/components/world/Rack.tsx', rack);

let infraTypes = fs.readFileSync('src/store/infraStoreTypes.ts', 'utf8');
infraTypes = infraTypes.replace(/\bAISlice\s*&\s*/g, '');
fs.writeFileSync('src/store/infraStoreTypes.ts', infraTypes);
