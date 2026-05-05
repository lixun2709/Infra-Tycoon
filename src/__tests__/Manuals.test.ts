import { describe, it, expect } from 'vitest'
import { TECHNICAL_MANUALS } from '../physics/Manuals'

describe('v1.3 Terminal Kernel - Manuals & Documentation', () => {
  it('should have complete and valid man pages for core storage commands', () => {
    const storageManual = TECHNICAL_MANUALS['cluster']
    expect(storageManual).toBeDefined()
    expect(storageManual.length).toBeGreaterThan(0)
    
    const fullText = storageManual.join(' ')
    expect(fullText).toContain('ONTAP')
    expect(fullText).toContain('health')
  })

  it('should document new v1.3 split-pane shortcuts', () => {
    const termManual = TECHNICAL_MANUALS['terminal']
    const fullText = termManual.join(' ')
    
    expect(fullText).toContain('Ctrl+Shift+V')
    expect(fullText).toContain('Ctrl+Shift+H')
    expect(fullText).toContain('ENTERPRISE EDITION')
  })
})
