const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('npx tsc --project tsconfig.app.json --noEmit', { stdio: 'pipe' });
  console.log('Passed');
} catch (e) {
  const output = e.stdout.toString();
  const lines = output.split('\n');
  const changes = {};

  for (const line of lines) {
    const match = line.match(/(src\/.*?\.ts[x]?)\((\d+),(\d+)\): error TS7006: Parameter '(.*?)' implicitly has an 'any' type/);
    if (match) {
      const file = match[1];
      const lineNum = parseInt(match[2]) - 1;
      const paramName = match[4];
      if (!changes[file]) changes[file] = {};
      changes[file][lineNum] = paramName;
    }
  }

  for (const file in changes) {
    const content = fs.readFileSync(file, 'utf8').split('\n');
    for (const lineNum in changes[file]) {
       const p = changes[file][lineNum];
       let l = content[lineNum];
       
       l = l.replace(new RegExp(`\\b${p}\\s*=>`), `(${p}: any) =>`);
       l = l.replace(new RegExp(`\\(\\s*${p}\\s*\\)`), `(${p}: any)`);
       l = l.replace(new RegExp(`set\\(\\s*${p}\\s*=>`), `set((${p}: any) =>`);
       l = l.replace(new RegExp(`\\(\\s*${p}\\s*,`), `(${p}: any,`);
       l = l.replace(new RegExp(`,\\s*${p}\\s*\\)`), `, ${p}: any)`);
       
       content[lineNum] = l;
    }
    fs.writeFileSync(file, content.join('\n'));
    console.log('Fixed', file);
  }
}
