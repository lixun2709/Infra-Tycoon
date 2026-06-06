 
import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { HARDWARE_CATALOG, type HardwareCatalogKey } from '../../physics/hardwareLibrary'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'
import { audioManager } from '../../utils/AudioManager'

export interface ProgressionSlice {
  companyLevel: number
  experience: number
  xpToNextLevel: number
  
  gainXp: (amount: number, reason: string) => void
  checkLevelUp: () => void
  isHardwareUnlocked: (key: HardwareCatalogKey) => boolean
  isContractUnlocked: (blueprintId: string) => boolean
}

export const createProgressionSlice: StateCreator<InfraState, [], [], ProgressionSlice> = (set, get) => ({
  companyLevel: 1,
  experience: 0,
  xpToNextLevel: 1000,
  
  gainXp: (amount: number, reason: string) => {
    const { experience, pushAlert, checkLevelUp } = get()
    
    // Slight jitter to prevent exact numbers looking robotic
    const actualAmount = Math.floor(amount * (0.95 + Math.random() * 0.1))
    
    set({ experience: experience + actualAmount })
    
    // We do not push an alert for every single XP gain to avoid spam, unless it's a major milestone
    if (actualAmount >= 500) {
      pushAlert('info', `EXP GAINED: +${actualAmount} XP (${reason})`)
    }
    
    checkLevelUp()
  },
  
  checkLevelUp: () => {
    const { experience, companyLevel, xpToNextLevel, pushAlert } = get()
    
    if (experience >= xpToNextLevel) {
      const nextLevel = companyLevel + 1
      // Adjusted pacing curve: slower mid game but faster early game to hook the player
      const baseRequirement = 1000
      const newXpRequirement = Math.floor(baseRequirement * Math.pow(1.65, nextLevel - 1))
      
      set({ 
        companyLevel: nextLevel,
        experience: experience - xpToNextLevel,
        xpToNextLevel: newXpRequirement
      })
      
      // Fire event for UI overlay to catch
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('enterprise-level-up', { detail: { level: nextLevel } })
        window.dispatchEvent(event)
      }
      
      pushAlert('info', `[MILESTONE REACHED] Enterprise operations scaled to Tier ${nextLevel}! New strategic contracts and advanced hardware are now available for deployment.`, 'HQ-SYS')
      audioManager.playEffect('success') // Placeholder sound
      
      // Recursively check if they gained so much XP they leveled up twice
      get().checkLevelUp()
    }
  },
  
  isHardwareUnlocked: (key: HardwareCatalogKey) => {
    const { companyLevel } = get()
    const item = HARDWARE_CATALOG[key] as import('../../physics/hardwareLibrary').HardwareCatalogSpec | undefined
    return !item?.minLevel || companyLevel >= item.minLevel
  },
  
  isContractUnlocked: (blueprintId: string) => {
    const { companyLevel } = get()
    const item = CONTRACT_CATALOG[blueprintId] as import('../../physics/contractLibrary').ContractBlueprint | undefined
    return !item?.minLevel || companyLevel >= item.minLevel
  }
})

