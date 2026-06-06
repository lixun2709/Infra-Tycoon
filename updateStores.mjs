import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const TELEMETRY_FIELDS = [
  'realTimePlayedSeconds', 'networkLoad', 'resilienceIndex', 
  'totalPowerKW', 'totalRoomBTU', 'overloadedRackCount', 
  'networkUptime', 'cloudEgressGB', 'activeCloudInstances'
]

const OBSERVABILITY_FIELDS = [
  'auditLogs', 'postMortems', 'incidents', 'technicianTickets'
]

function processDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath)
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (fullPath.includes('store') || fullPath.includes('updateStores.mjs')) continue
      
      let content = fs.readFileSync(fullPath, 'utf-8')
      let changed = false

      // Basic regexes to replace hooks
      TELEMETRY_FIELDS.forEach(field => {
        // e.g. useInfraStore(s => s.totalPowerKW)
        const regex1 = new RegExp(`useInfraStore\\(([^)]+)\\.${field}\\)`, 'g')
        if (regex1.test(content)) {
          content = content.replace(regex1, `useTelemetryStore($1.${field})`)
          changed = true
        }

        // e.g. totalPowerKW: state.totalPowerKW (inside useShallow)
        const regex2 = new RegExp(`(${field}): state\.${field}`, 'g')
        if (regex2.test(content) && content.includes('useInfraStore(useShallow(state => ({')) {
          // This is harder. For now, let's just flag manual edits needed.
          console.log(`[!] Manual edit needed for useShallow telemetry in: ${file} (field: ${field})`)
        }
      })

      OBSERVABILITY_FIELDS.forEach(field => {
        const regex1 = new RegExp(`useInfraStore\\(([^)]+)\\.${field}(?:\\.\\w+\\(.*?\\))*\\)`, 'g')
        if (regex1.test(content)) {
          // Fallback manual edit flag
          console.log(`[!] Manual edit needed for observability hook in: ${file} (field: ${field})`)
        }

        const regex2 = new RegExp(`(${field}): state\.${field}`, 'g')
        if (regex2.test(content)) {
          console.log(`[!] Manual edit needed for useShallow observability in: ${file} (field: ${field})`)
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
