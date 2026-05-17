export interface ThemeSpec {
  id: string
  name: string
  label: string
  primary: string      // Main UI color
  primaryGlow: string  // UI active glow
  accent: string       // Highlight elements
  accentGlow: string   // Accent glow
  bgDark: string       // Panel background
  bgDeep: string       // Window background
  surface: string      // Card transparency
  border: string       // Neutral borders
  borderActive: string // Primary border

  // Alert Severity Colors (Enterprise operational readability)
  alerts: {
    info: string
    warning: string
    critical: string
  }

  // 3D Rendering Tokens (Shared directly with shaders and R3F materials)
  render: {
    cableNetwork: string
    cablePower: string
    cableFC: string
    cableSAS: string
    rackBound: string
    rackBoundHover: string
    rackBoundSelected: string
    rackStatusNominal: string
    rackStatusOverload: string
  }
}

export type ThemeKey = 'cyberpunk' | 'solar' | 'matrix'

export const THEMES: Record<ThemeKey, ThemeSpec> = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'cyberpunk',
    label: 'Midnight NOC (Teal/Orange)',
    primary: '#06b6d4',             // Muted Observability Cyan
    primaryGlow: 'rgba(6, 182, 212, 0.25)',
    accent: '#3b82f6',              // Observability Blue
    accentGlow: 'rgba(59, 130, 246, 0.25)',
    bgDark: '#080d1a',              // Graphite Dark Panel
    bgDeep: '#02040a',              // Solid Charcoal Background
    surface: 'rgba(8, 13, 26, 0.85)',
    border: 'rgba(255, 255, 255, 0.05)',
    borderActive: 'rgba(6, 182, 212, 0.4)',
    alerts: {
      info: '#0284c7',
      warning: '#ea580c',
      critical: '#ef4444'
    },
    render: {
      cableNetwork: '#06b6d4',      // Muted Cyan
      cablePower: '#eab308',        // Matte Yellow
      cableFC: '#ef4444',           // Amber Red
      cableSAS: '#a855f7',          // Dark Purple
      rackBound: '#1b233a',         // Muted Graphite bounds
      rackBoundHover: '#06b6d4',
      rackBoundSelected: '#22d3ee',
      rackStatusNominal: '#10b981',
      rackStatusOverload: '#ef4444'
    }
  },
  solar: {
    id: 'solar',
    name: 'solar',
    label: 'Solar Grid (Amber/Blue)',
    primary: '#d97706',             // Matte amber
    primaryGlow: 'rgba(217, 119, 6, 0.2)',
    accent: '#2563eb',              // Dark blue accent
    accentGlow: 'rgba(37, 99, 235, 0.2)',
    bgDark: '#110e08',              // Dark warm graphite
    bgDeep: '#040301',
    surface: 'rgba(17, 14, 8, 0.85)',
    border: 'rgba(217, 119, 6, 0.1)',
    borderActive: 'rgba(217, 119, 6, 0.4)',
    alerts: {
      info: '#2563eb',
      warning: '#d97706',
      critical: '#b91c1c'
    },
    render: {
      cableNetwork: '#3b82f6',
      cablePower: '#d97706',
      cableFC: '#ea580c',
      cableSAS: '#d946ef',
      rackBound: '#1e1a12',
      rackBoundHover: '#d97706',
      rackBoundSelected: '#f59e0b',
      rackStatusNominal: '#059669',
      rackStatusOverload: '#b91c1c'
    }
  },
  matrix: {
    id: 'matrix',
    name: 'matrix',
    label: 'Toxic Matrix (Green/Magenta)',
    primary: '#10b981',             // Forest emerald
    primaryGlow: 'rgba(16, 185, 129, 0.25)',
    accent: '#06b6d4',              // Observability Cyan
    accentGlow: 'rgba(6, 182, 212, 0.25)',
    bgDark: '#040a06',              // Tactical Deep Charcoal
    bgDeep: '#010302',
    surface: 'rgba(4, 10, 6, 0.85)',
    border: 'rgba(16, 185, 129, 0.08)',
    borderActive: 'rgba(16, 185, 129, 0.4)',
    alerts: {
      info: '#0d9488',
      warning: '#d946ef',
      critical: '#ef4444'
    },
    render: {
      cableNetwork: '#10b981',
      cablePower: '#06b6d4',
      cableFC: '#f43f5e',
      cableSAS: '#8b5cf6',
      rackBound: '#101c14',
      rackBoundHover: '#10b981',
      rackBoundSelected: '#34d399',
      rackStatusNominal: '#10b981',
      rackStatusOverload: '#f43f5e'
    }
  }
}
