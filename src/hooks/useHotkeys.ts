/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react'
import { useInfraStore } from '../store/useInfraStore'
import { useTerminalStore } from '../store/useTerminalStore'

export function useHotkeys() {
  const { 
    terminalStates, 
    currentSiteId, 
    addTerminalSession, 
    nodes,
    selectedNodeId,
    setSelectedNode
  } = useInfraStore()
  
  const isTerminalOpen = useTerminalStore(s => s.isTerminalOpen)
  const setIsTerminalOpen = useTerminalStore(s => s.setIsTerminalOpen)
  
  const siteTerminal = terminalStates[currentSiteId]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur()
        }
        return
      }

      const isCtrl = e.ctrlKey || e.metaKey

      switch (e.key.toLowerCase()) {
        case 't':
          // Toggle Terminal
          setIsTerminalOpen(!isTerminalOpen)
          if (siteTerminal?.sessions.length === 0) {
            addTerminalSession('Main Console')
          }
          break

        case 'r': {
          // Cycle Racks
          const racks = nodes.filter((n: any) => n.type === 'rack' && n.siteId === currentSiteId)
          if (racks.length > 0) {
            const currentIndex = racks.findIndex((r: any) => r.id === selectedNodeId)
            const nextIndex = (currentIndex + 1) % racks.length
            const nextRack = racks[nextIndex]
            if (nextRack) {
              setSelectedNode(nextRack.id)
            }
          }
          break
        }

        case 'tab':
          // Cycle Hardware in selected rack
          if (selectedNodeId) {
            const selectedNode = nodes.find((n: any) => n.id === selectedNodeId)
            if (selectedNode?.type === 'rack') {
              const children = nodes.filter((n: any) => n.parentRackId === selectedNodeId)
              if (children.length > 0) {
                // Select first child
                const firstChild = children[0]
                if (firstChild) {
                  setSelectedNode(firstChild.id)
                }
              }
            } else if (selectedNode?.parentRackId) {
              const siblings = nodes.filter((n: any) => n.parentRackId === selectedNode.parentRackId)
              const currentIndex = siblings.findIndex((s: any) => s.id === selectedNodeId)
              const nextIndex = (currentIndex + 1) % siblings.length
              const sibling = siblings[nextIndex]
              if (sibling) {
                setSelectedNode(sibling.id)
              }
            }
          }
          e.preventDefault()
          break

        case '/':
          // Focus search / command
          // This would require a ref to the terminal input
          break

        case 's':
          if (isCtrl) {
            e.preventDefault()
            useInfraStore.setState({ isSaveManagerOpen: true })
          }
          break

        case 'escape':
          setSelectedNode(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [terminalStates, currentSiteId, nodes, selectedNodeId, addTerminalSession, isTerminalOpen, setIsTerminalOpen, setSelectedNode, siteTerminal?.sessions.length])
}

