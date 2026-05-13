import { useEffect } from 'react'
import { useInfraStore } from '../store/useInfraStore'

export function useHotkeys() {
  const { 
    terminalStates, 
    currentSiteId, 
    addTerminalSession, 
    closeTerminalSession,
    nodes,
    selectedNodeId,
    setSelectedNode,
    setIsTerminalOpen,
    isTerminalOpen
  } = useInfraStore()
  
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

        case 'r':
          // Cycle Racks
          const racks = nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId)
          if (racks.length > 0) {
            const currentIndex = racks.findIndex(r => r.id === selectedNodeId)
            const nextIndex = (currentIndex + 1) % racks.length
            setSelectedNode(racks[nextIndex].id)
          }
          break

        case 'tab':
          // Cycle Hardware in selected rack
          if (selectedNodeId) {
            const selectedNode = nodes.find(n => n.id === selectedNodeId)
            if (selectedNode?.type === 'rack') {
              const children = nodes.filter(n => n.parentRackId === selectedNodeId)
              if (children.length > 0) {
                // Select first child
                setSelectedNode(children[0].id)
              }
            } else if (selectedNode?.parentRackId) {
              const siblings = nodes.filter(n => n.parentRackId === selectedNode.parentRackId)
              const currentIndex = siblings.findIndex(s => s.id === selectedNodeId)
              const nextIndex = (currentIndex + 1) % siblings.length
              setSelectedNode(siblings[nextIndex].id)
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
  }, [terminalStates, currentSiteId, nodes, selectedNodeId])
}
