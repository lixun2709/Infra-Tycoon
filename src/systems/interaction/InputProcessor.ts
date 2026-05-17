import { useInfraStore } from '../../store/useInfraStore'
import type { InteractionMode } from '../../store/slices/interactionSlice'
import type { HardwareCatalogKey } from '../../physics/hardwareLibrary'

export type InteractionIntent =
  | { type: 'SELECT_NODE'; payload: { nodeId: string; nodeType: 'RACK' | 'NODE' | 'FLOOR' } }
  | { type: 'DESELECT_NODE' }
  | { type: 'CHANGE_MODE'; payload: { mode: InteractionMode } }
  | { type: 'PLACE_HARDWARE'; payload: { key: string; rackId: string } }
  | { type: 'DRAG_START'; payload: { position: { x: number; y: number; z: number } } }
  | { type: 'DRAG_END' }

export class InputProcessor {
  private static instance: InputProcessor | null = null
  private intentQueue: InteractionIntent[] = []
  private isProcessing = false

  private constructor() {}

  public static getInstance(): InputProcessor {
    if (!InputProcessor.instance) {
      InputProcessor.instance = new InputProcessor()
    }
    return InputProcessor.instance
  }

  /**
   * Enqueue a raw interaction intent for rate-limited, buffered, or multiplayer execution.
   */
  public enqueueIntent(intent: InteractionIntent): void {
    this.intentQueue.push(intent)
    this.processQueue()
  }

  /**
   * Clears the current intent queue buffer.
   */
  public clearQueue(): void {
    this.intentQueue = []
  }

  /**
   * Returns current pending queue length for diagnostics.
   */
  public getQueueLength(): number {
    return this.intentQueue.length
  }

  /**
   * Processes the intent queue FIFO style, preventing event contention.
   */
  private processQueue(): void {
    if (this.isProcessing || this.intentQueue.length === 0) return

    this.isProcessing = true
    const nextIntent = this.intentQueue.shift()

    if (nextIntent) {
      this.executeIntent(nextIntent)
    }

    this.isProcessing = false
    if (this.intentQueue.length > 0) {
      this.processQueue()
    }
  }

  /**
   * Maps intent to store actions and triggers diagnostic interaction logs.
   */
  private executeIntent(intent: InteractionIntent): void {
    const store = useInfraStore.getState()

    switch (intent.type) {
      case 'SELECT_NODE': {
        const { nodeId, nodeType } = intent.payload
        store.logInteractionEvent(`[SELECT_NODE] Selected ${nodeType} id: ${nodeId}`)
        
        if (nodeType === 'RACK') {
          store.setSelectedNode(nodeId)
          store.setInteractionMode('SELECTING')
        } else if (nodeType === 'NODE') {
          store.setSelectedNode(nodeId)
          store.setInteractionMode('SELECTING')
        }
        break
      }

      case 'DESELECT_NODE':
        store.logInteractionEvent(`[DESELECT_NODE] Cleared selections`)
        store.setSelectedNode(null)
        store.setInteractionMode('IDLE')
        break

      case 'CHANGE_MODE':
        store.logInteractionEvent(`[CHANGE_MODE] Switched interaction mode to: ${intent.payload.mode}`)
        store.setInteractionMode(intent.payload.mode)
        break

      case 'PLACE_HARDWARE': {
        const { key, rackId } = intent.payload
        store.logInteractionEvent(`[PLACE_HARDWARE] Placing item ${key} on rack ${rackId}`)
        
        const success = store.placeCatalogHardware(key as HardwareCatalogKey, rackId)
        if (success) {
          store.logInteractionEvent(`[PLACE_HARDWARE] Placement success for ${key}`)
        } else {
          store.logInteractionEvent(`[PLACE_HARDWARE] Placement failed for ${key}`)
        }
        break
      }

      case 'DRAG_START':
        store.logInteractionEvent(`[DRAG_START] Dragging started from point`)
        break

      case 'DRAG_END':
        store.logInteractionEvent(`[DRAG_END] Dragging ended`)
        break

      default:
        break
    }
  }
}
