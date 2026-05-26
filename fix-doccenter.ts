import fs from 'fs'
const path = 'd:/Infra-Tycoon/src/components/ui/DocCenter.tsx'
let content = fs.readFileSync(path, 'utf8')
content = content.replace(/sections: \['([^']+)'\]/g, (match, p1) => `sections: ['${p1.replace(/--/g, '-')}']`)
content = content.replace(/sections: \['([^']+)', '([^']+)'\]/g, (match, p1, p2) => `sections: ['${p1.replace(/--/g, '-')}', '${p2.replace(/--/g, '-')}']`)
content = content.replace(/sections: \['([^']+)', '([^']+)', '([^']+)'\]/g, (match, p1, p2, p3) => `sections: ['${p1.replace(/--/g, '-')}', '${p2.replace(/--/g, '-')}', '${p3.replace(/--/g, '-')}']`)
fs.writeFileSync(path, content)
