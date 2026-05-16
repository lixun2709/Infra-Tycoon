import type { Site, HardwarePort } from './infraTypes'
import type { HardwareCatalogKey } from '../physics/hardwareLibrary'
import { HARDWARE_CATALOG } from '../physics/hardwareLibrary'

export const INITIAL_SITES: Site[] = [
  { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } },
  { id: 'site-2', name: 'DR-Site', isDisaster: false, region: 'US-East', energySource: 'Grid', geoCoords: { lat: 40.71, lng: -74.00 } }
]

export const INITIAL_TERMINAL_STATE = {
  'site-1': { 
    sessions: [{ 
      id: 's1-1', 
      title: 'Primary Bastion', 
      panes: [{ id: 'p1-1', logs: ['Enterprise Console v2.0 Ready.'], history: [], cwd: '/', context: { mode: 'global' as const, targetId: null } }],
      activePaneId: 'p1-1',
      layout: 'single' as const
    }],
    activeSessionId: 's1-1',
    layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
    aliases: { 'll': 'ls -la', 'netstat': 'show ip int brief' },
    envVars: { 'DOMAIN': 'infra.local', 'USER': 'admin' },
    storedFiles: { '/etc/motd': 'Welcome to Global Infrastructure Management v2.0\nSecurity Authorized Personnel Only.' }
  }
}

export function createPortsForCatalog(nodeId: string, key: HardwareCatalogKey): HardwarePort[] {
  const { portLayout } = HARDWARE_CATALOG[key]
  return portLayout.flatMap((segment) =>
    Array.from({ length: segment.count }, (_, idx) => ({
      id: `${nodeId}-${segment.type}-${idx + 1}`,
      type: segment.type,
      label: `${segment.labelPrefix}${idx + 1}`,
      connectedTo: null,
      status: 'down' as const,
      ip: undefined,
      mask: undefined
    }))
  )
}

export function calculateGeoLatency(siteA: Site, siteB: Site): number {
  if (siteA.id === siteB.id) return 1 // Intra-site latency
  
  const dLat = Math.abs(siteA.geoCoords.lat - siteB.geoCoords.lat)
  const dLng = Math.abs(siteA.geoCoords.lng - siteB.geoCoords.lng)
  const distance = Math.sqrt(dLat * dLat + dLng * dLng)
  
  return Math.round(distance * 5) + 20 
}
