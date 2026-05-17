import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'

export type InputAction = 
  | 'MOVE_FORWARD'
  | 'MOVE_BACKWARD'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'ACTION_CANCEL'
  | 'ACTION_INTERACT'

export type InteractionIntent = 
  | { type: 'SELECT_NODE'; payload: { nodeId: string } }
  | { type: 'DESELECT_NODE' }
  | { type: 'PLACE_NODE'; payload: { position: { x: number, y: number, z: number } } }

interface InputState {
  isActionActive: (action: InputAction) => boolean
  dispatchIntent: (intent: InteractionIntent) => void
  subscribeToIntent: (callback: (intent: InteractionIntent) => void) => () => void
}

const InputContext = createContext<InputState | null>(null)

// Default keybindings (future configurable)
const KEYBINDINGS: Record<string, InputAction> = {
  'KeyW': 'MOVE_FORWARD',
  'KeyS': 'MOVE_BACKWARD',
  'KeyA': 'MOVE_LEFT',
  'KeyD': 'MOVE_RIGHT',
  'ArrowUp': 'MOVE_FORWARD',
  'ArrowDown': 'MOVE_BACKWARD',
  'ArrowLeft': 'MOVE_LEFT',
  'ArrowRight': 'MOVE_RIGHT',
  'Escape': 'ACTION_CANCEL'
}

export function InputProvider({ children }: { children: React.ReactNode }) {
  const activeActions = useRef<Set<InputAction>>(new Set())
  const intentSubscribers = useRef<Set<(intent: InteractionIntent) => void>>(new Set())

  const isActionActive = useCallback((action: InputAction) => activeActions.current.has(action), [])

  const dispatchIntent = useCallback((intent: InteractionIntent) => {
    intentSubscribers.current.forEach(callback => callback(intent))
  }, [])

  const subscribeToIntent = useCallback((callback: (intent: InteractionIntent) => void) => {
    intentSubscribers.current.add(callback)
    return () => {
      intentSubscribers.current.delete(callback)
    }
  }, [])

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      
      const action = KEYBINDINGS[e.code]
      if (action) {
        activeActions.current.add(action)
        
        // Map Escape directly to a deselect intent for convenience
        if (action === 'ACTION_CANCEL') {
          dispatchIntent({ type: 'DESELECT_NODE' })
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = KEYBINDINGS[e.code]
      if (action) {
        activeActions.current.delete(action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [dispatchIntent])

  return (
    <InputContext.Provider value={{ isActionActive, dispatchIntent, subscribeToIntent }}>
      {children}
    </InputContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInput() {
  const context = useContext(InputContext)
  if (!context) throw new Error('useInput must be used within InputProvider')
  return context
}
