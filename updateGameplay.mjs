import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const GAMEPLAY_FIELDS = [
  'balance', 'reputation', 'reputationHistory', 'operationalBudget',
  'playerAuthority', 'isAutoPilot', 'isBankrupt', 'consecutiveNegativeMonths',
  'activeContracts', 'loans', 'setPlayerAuthority'
]

function processDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath)
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (fullPath.includes('store') || fullPath.includes('updateGameplay.mjs')) continue
      
      let content = fs.readFileSync(fullPath, 'utf-8')
      let changed = false

      const needsGameplay = GAMEPLAY_FIELDS.some(f => content.includes(f))
      if (!needsGameplay) continue

      if (!content.includes('useGameplayStore')) {
        content = content.replace(
          "import { useInfraStore } from '../../store/useInfraStore'",
          "import { useInfraStore } from '../../store/useInfraStore'\nimport { useGameplayStore } from '../../store/useGameplayStore'"
        )
        content = content.replace(
          "import { useInfraStore } from '../../../store/useInfraStore'",
          "import { useInfraStore } from '../../../store/useInfraStore'\nimport { useGameplayStore } from '../../../store/useGameplayStore'"
        )
        changed = true
      }

      GAMEPLAY_FIELDS.forEach(field => {
        const regex1 = new RegExp(`useInfraStore\\(([^)]+)\\.${field}\\)`, 'g')
        if (regex1.test(content)) {
          content = content.replace(regex1, `useGameplayStore($1.${field})`)
          changed = true
        }
        
        const regex2 = new RegExp(`(${field}): state\.${field}`, 'g')
        if (regex2.test(content)) {
          console.log(`[!] Manual edit needed for useShallow gameplay in: ${file} (field: ${field})`)
        }
      })

      if (changed) {
        fs.writeFileSync(fullPath, content)
        console.log(`Updated hooks in ${file}`)
      }
    }
  }
}

processDir(srcDir)
console.log('Done.')
