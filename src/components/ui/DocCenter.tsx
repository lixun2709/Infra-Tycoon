import React, { useState, useMemo, useRef } from 'react'
import { parseMarkdownToAST } from '../../utils/docsParser'
import type { DocSection, ASTNode } from '../../utils/docsParser'
import userGuideRaw from '../../../USER_GUIDE.md?raw'
import { 
  X, Search, Book, Cpu, Network, Shield, Terminal as TerminalIcon, 
  Activity, Copy, Check, ChevronRight, AlertTriangle, Info, HardDrive, 
  Thermometer, Zap, HelpCircle, ArrowUpRight, Maximize2 
} from 'lucide-react'

export interface DocCenterProps {
  onClose: () => void
}

export function DocCenter({ onClose }: DocCenterProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('architecture-overview')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const paragraphRefs = useRef<{ [key: string]: HTMLParagraphElement | null }>({})
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Parse raw USER_GUIDE.md AST
  const parsedSections = useMemo(() => {
    return parseMarkdownToAST(userGuideRaw)
  }, [])

  // Dynamic Sidebar Categories Mapping
  const categories = useMemo(() => {
    return [
      {
        id: 'architecture-overview',
        title: 'Architecture Overview',
        icon: Cpu,
        sections: ['1-system-architecture--platform-overview', '11-architecture-design-decoupled-ecs--simulation-worker', '12-deterministic-execution--thread-synchronization']
      },
      {
        id: 'getting-started',
        title: 'Getting Started',
        icon: ArrowUpRight,
        sections: ['5-asset-lifecycle--provisioning-workflows', '51-provisioning-lifecycle-stages']
      },
      {
        id: 'rack-systems',
        title: 'Rack Systems',
        icon: Maximize2,
        sections: ['2-asset--hardware-procurement-catalog']
      },
      {
        id: 'thermal-systems',
        title: 'Thermal Systems',
        icon: Thermometer,
        sections: ['31-thermodynamic--cooling-systems']
      },
      {
        id: 'electrical-systems',
        title: 'Electrical Systems',
        icon: Zap,
        sections: ['32-electrical--power-systems']
      },
      {
        id: 'networking-systems',
        title: 'Networking Systems',
        icon: Network,
        sections: ['33-networking--fabric-systems']
      },
      {
        id: 'storage-systems',
        title: 'Storage Systems',
        icon: HardDrive,
        sections: ['34-storage--raid-systems']
      },
      {
        id: 'alerts-monitoring',
        title: 'Alerts & Monitoring',
        icon: AlertTriangle,
        sections: ['13-telemetry-tracing-and-alerting-infrastructure']
      },
      {
        id: 'controls-interaction',
        title: 'Controls & Interaction',
        icon: TerminalIcon,
        sections: ['4-uiux-interface--interactive-noc-overlays', '6-interactive-cli-terminal-kernel']
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: Activity,
        sections: ['7-operational-troubleshooting-protocols']
      },
      {
        id: 'operational-workflows',
        title: 'Operational Workflows',
        icon: Shield,
        sections: ['52-technician-ticket-rma-queue', '53-maintenance-mode--traffic-drainage']
      },
      {
        id: 'datacenter-concepts',
        title: 'Datacenter Concepts',
        icon: HelpCircle,
        sections: [] // Placeholder for conceptual aggregation
      },
      {
        id: 'glossary',
        title: 'Glossary',
        icon: Book,
        sections: [] // Aggregates acronym definitions
      }
    ]
  }, [])

  // Find active content node structure
  const activeContent = useMemo(() => {
    const matchedCategory = categories.find(c => c.id === activeTab)
    if (!matchedCategory) return []

    // Special category logic
    if (activeTab === 'glossary') {
      return getGlossaryAST()
    }
    if (activeTab === 'datacenter-concepts') {
      return getDatacenterConceptsAST()
    }

    const outputNodes: ASTNode[] = []
    
    // Find matching sections in parsed markdown
    const targetIds = matchedCategory.sections
    
    const searchSection = (secs: DocSection[]) => {
      for (const sec of secs) {
        if (targetIds.includes(sec.id)) {
          // Push header node
          outputNodes.push({ type: 'heading', level: sec.level, content: sec.title })
          outputNodes.push(...sec.nodes)
        }
        if (sec.subsections.length > 0) {
          searchSection(sec.subsections)
        }
      }
    }
    
    searchSection(parsedSections)
    return outputNodes
  }, [activeTab, parsedSections, categories])

  // Subheadings list for the right-hand TOC
  const tocItems = useMemo(() => {
    return activeContent
      .filter(n => n.type === 'heading' && n.level && n.level <= 3)
      .map(n => ({
        title: n.content,
        id: n.content.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      }))
  }, [activeContent])

  // Full-Text Search Engine
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return []
    const results: { categoryId: string; heading: string; excerpt: string; targetId: string }[] = []
    const query = searchQuery.toLowerCase()

    // Scan all categories and sections
    for (const cat of categories) {
      if (cat.id === 'glossary' || cat.id === 'datacenter-concepts') continue
      
      const targetIds = cat.sections
      const scanSection = (secs: DocSection[]) => {
        for (const sec of secs) {
          if (targetIds.includes(sec.id)) {
            // Scan content nodes
            for (let i = 0; i < sec.nodes.length; i++) {
              const node = sec.nodes[i]
              if (!node) continue
              if (node.content && node.content.toLowerCase().includes(query)) {
                // Generate excerpt
                const idx = node.content.toLowerCase().indexOf(query)
                const start = Math.max(0, idx - 40)
                const end = Math.min(node.content.length, idx + query.length + 50)
                const excerpt = `...${node.content.slice(start, end)}...`
                
                results.push({
                  categoryId: cat.id,
                  heading: sec.title,
                  excerpt,
                  targetId: node.content.slice(0, 30).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
                })
                break; // Limit 1 match per section for display density
              }
            }
          }
          if (sec.subsections.length > 0) {
            scanSection(sec.subsections)
          }
        }
      }
      scanSection(parsedSections)
    }
    return results.slice(0, 8) // Limit to top 8 matches
  }, [searchQuery, categories, parsedSections])

  // Handle Search Result Click
  const handleSearchResultClick = (result: { categoryId: string; targetId: string }) => {
    setActiveTab(result.categoryId)
    setSearchQuery('')
    setHighlightedNodeId(result.targetId)

    // Delay scroll to allow component to render
    setTimeout(() => {
      const el = paragraphRefs.current[result.targetId]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Trigger subtle pulse highlight
        setTimeout(() => setHighlightedNodeId(null), 3000)
      }
    }, 150)
  }

  // Smooth scroll to subheading
  const handleTocClick = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
      {/* Dynamic Glassmorphic Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl transition-all" 
        onClick={onClose} 
      />
      
      {/* Cisco/VMware Styled enterprise Frame */}
      <div className="relative w-full max-w-7xl h-[88vh] bg-[#020617] border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Top Management Navigation Bar */}
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 lg:px-12 bg-slate-900/10">
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-2xl">
              <Book size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-black text-white uppercase tracking-tighter flex items-center gap-2">
                Operational Knowledgebase <span className="text-xs text-teal-400 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full">v2.2</span>
              </h1>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.25em] mt-0.5">Infra-Tycoon Operations & Thermodynamic Twin Console</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Global Index Searching */}
             <div className="relative">
               <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search platform docs..." 
                 className="bg-slate-950/80 border border-white/10 rounded-xl py-2 pl-10 pr-6 text-[9px] font-black uppercase tracking-widest text-white outline-none focus:border-teal-500/50 w-48 lg:w-64 transition-all"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
               
               {/* Search Suggestions Dropdown */}
               {searchResults.length > 0 && (
                 <div className="absolute right-0 top-12 z-50 w-80 bg-slate-950/95 border border-white/10 rounded-2xl p-4 shadow-3xl flex flex-col gap-2 backdrop-blur-2xl">
                   <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider mb-1">Index Matches</p>
                   {searchResults.map((res, i) => (
                     <button
                       key={i}
                       onClick={() => handleSearchResultClick(res)}
                       className="p-3 text-left bg-white/5 hover:bg-teal-500/10 rounded-xl border border-white/5 hover:border-teal-500/20 transition-all group flex flex-col gap-1"
                     >
                       <span className="text-[9px] font-black text-teal-400 group-hover:underline uppercase">{res.heading}</span>
                       <span className="text-[10px] text-slate-400 leading-normal font-medium block truncate">{res.excerpt}</span>
                     </button>
                   ))}
                 </div>
               )}
             </div>
             
             {/* Close Overlay */}
             <button 
               onClick={onClose}
               className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/5 transition-all flex items-center justify-center"
             >
               <X size={18} />
             </button>
          </div>
        </div>

        {/* Main Content Layout Grid */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left-hand Nested Sidebar */}
          <aside className="w-64 lg:w-72 border-r border-white/5 bg-slate-950/30 p-6 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar shrink-0">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-3">System Catalogs</p>
            {categories.map(c => {
              const Icon = c.icon
              const isActive = activeTab === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveTab(c.id)}
                  className={`w-full px-4 py-3 rounded-xl flex items-center justify-between transition-all group ${isActive ? 'bg-teal-500 text-slate-950 shadow-[0_8px_20px_rgba(45,212,191,0.15)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[9px] font-extrabold uppercase tracking-widest">{c.title}</span>
                  </div>
                  <ChevronRight size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-0.5' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              )
            })}
            
            {/* Live Wear Verification Indicator */}
            <div className="mt-auto p-4 bg-slate-900/20 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                 <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest">Observability: Synced</span>
              </div>
              <p className="text-[8px] text-slate-500 font-bold leading-normal uppercase opacity-70">
                Concepts parsed from authoritative source file, synced with grid telemetry.
              </p>
            </div>
          </aside>

          {/* Center Markdown Viewer panel */}
          <main 
            ref={scrollContainerRef}
            className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.02),transparent)]"
          >
            <div className="max-w-3xl space-y-6">
              {/* Render parsed contents */}
              {activeContent.map((node, index) => {
                const nodeKey = node.content.slice(0, 30).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
                const isHighlighted = highlightedNodeId === nodeKey

                if (node.type === 'heading') {
                  const headingId = node.content.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
                  if (node.level === 1) {
                    return (
                      <h2 key={index} id={headingId} className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tighter border-b border-white/10 pb-4 mt-2">
                        {node.content}
                      </h2>
                    )
                  }
                  if (node.level === 2) {
                    return (
                      <h3 key={index} id={headingId} className="text-xl lg:text-2xl font-black text-teal-400 uppercase tracking-tight pt-6">
                        {node.content}
                      </h3>
                    )
                  }
                  return (
                    <h4 key={index} id={headingId} className="text-sm lg:text-base font-extrabold text-white uppercase tracking-wide pt-4 flex items-center gap-2">
                      <ChevronRight size={14} className="text-teal-400" /> {node.content}
                    </h4>
                  )
                }

                if (node.type === 'paragraph') {
                  return (
                    <p 
                      key={index}
                      ref={el => { paragraphRefs.current[nodeKey] = el }}
                      className={`text-[11px] lg:text-[12px] text-slate-400 leading-relaxed transition-all duration-500 rounded-lg p-1.5 ${isHighlighted ? 'bg-teal-500/20 text-white font-bold px-3 shadow-md' : ''}`}
                    >
                      {formatParagraphText(node.content)}
                    </p>
                  )
                }

                if (node.type === 'list') {
                  return (
                    <ul key={index} className="space-y-2.5 pl-4">
                      {node.items?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-[11px] lg:text-[12px] text-slate-400 font-medium">
                          {item.checked !== undefined ? (
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${item.checked ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'border-white/20 bg-slate-900'}`}>
                              {item.checked && <Check size={10} strokeWidth={3} />}
                            </div>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500/40 shrink-0 mt-2" />
                          )}
                          <span className="leading-relaxed">{formatParagraphText(item.text)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                }

                if (node.type === 'code') {
                  const codeId = `code-block-${index}`
                  return (
                    <div key={index} className="bg-slate-950 border border-white/5 rounded-2xl p-4 font-mono text-[10px] lg:text-[11px] space-y-2 relative group overflow-hidden shadow-2xl">
                      <div className="flex justify-between items-center text-slate-500 uppercase font-black text-[8px] tracking-widest border-b border-white/5 pb-2 mb-2">
                        <span>{node.codeLang || 'Terminal Shell'}</span>
                        <button 
                          onClick={() => copyToClipboard(node.content, codeId)}
                          className="hover:text-white transition-colors"
                        >
                          {copiedId === codeId ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="text-teal-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                        {node.content}
                      </pre>
                    </div>
                  )
                }

                if (node.type === 'table') {
                  return (
                    <div key={index} className="border border-white/10 rounded-2xl overflow-hidden shadow-xl my-4 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-900/80 border-b border-white/10 text-[9px] font-black text-white uppercase tracking-wider">
                            {node.headers?.map((h, i) => (
                              <th key={i} className="p-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[10px] lg:text-[11px] text-slate-300 font-bold bg-slate-950/20">
                          {node.rows?.map((row, idx) => (
                            <tr key={idx} className="hover:bg-teal-500/5 hover:text-white transition-colors">
                              {row.map((cell, i) => (
                                <td key={i} className="p-4 align-top leading-relaxed">{formatParagraphText(cell)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                if (node.type === 'formula') {
                  return (
                    <div key={index} className="my-6 p-5 bg-teal-500/5 border border-teal-500/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg">
                      <span className="text-[8px] text-teal-400 font-black uppercase tracking-wider">Physics Formulation</span>
                      <div className="font-serif italic text-white text-xs lg:text-sm text-center p-2 leading-relaxed tracking-wider select-all">
                        {node.content}
                      </div>
                    </div>
                  )
                }

                if (node.type === 'alert') {
                  const getAlertStyles = (type: ASTNode['alertType']) => {
                    switch (type) {
                      case 'warning':
                      case 'caution':
                        return { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', icon: AlertTriangle, title: 'Operational Warning' }
                      case 'important':
                        return { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', icon: AlertTriangle, title: 'Important' }
                      case 'incident':
                        return { bg: 'bg-indigo-500/5', border: 'border-indigo-500/25', text: 'text-indigo-400', icon: Info, title: 'Incident Symptoms' }
                      case 'cause':
                        return { bg: 'bg-purple-500/5', border: 'border-purple-500/25', text: 'text-purple-400', icon: Info, title: 'Root Cause Diagnostics' }
                      case 'resolution':
                        return { bg: 'bg-emerald-500/5', border: 'border-emerald-500/25', text: 'text-emerald-400', icon: Check, title: 'Resolution Procedure' }
                      default:
                        return { bg: 'bg-sky-500/5', border: 'border-sky-500/20', text: 'text-sky-400', icon: Info, title: 'Note' }
                    }
                  }
                  
                  const style = getAlertStyles(node.alertType)
                  const Icon = style.icon
                  return (
                    <div key={index} className={`my-4 p-5 rounded-2xl border ${style.bg} ${style.border} flex gap-4 shadow-md`}>
                      <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${style.text}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <h5 className={`text-[9px] font-black uppercase tracking-wider mb-1 ${style.text}`}>{style.title}</h5>
                        <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed font-medium">
                          {formatParagraphText(node.content)}
                        </p>
                      </div>
                    </div>
                  )
                }

                return null
              })}

              {/* Embed Interactive Playgrounds under specific pages */}
              {activeTab === 'electrical-systems' && <ThreePhaseInteractiveWidget />}
              {activeTab === 'storage-systems' && <RaidReliabilityWidget />}
              {activeTab === 'thermal-systems' && <ThermodynamicInteractiveWidget />}
            </div>
          </main>

          {/* Right-hand "On This Page" Table of Contents Panel */}
          {tocItems.length > 0 && (
            <aside className="w-56 border-l border-white/5 bg-slate-950/20 p-6 hidden xl:flex flex-col gap-3 shrink-0 overflow-y-auto custom-scrollbar">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">On This Page</p>
              <div className="flex flex-col gap-2">
                {tocItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleTocClick(item.id)}
                    className="text-left text-[9px] font-extrabold text-slate-400 hover:text-white uppercase tracking-wide hover:translate-x-0.5 transition-all truncate"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------
// INLINE TEXT FORMATTING HELPER (bold, inline-code)
// ------------------------------------------------------------------------
function formatParagraphText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\$\$.*?\$\$|\$.*?\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-extrabold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-white/5 border border-white/10 font-mono text-[10px] px-1.5 py-0.5 rounded text-teal-400 leading-none inline-block">
          {part.slice(1, -1)}
        </code>
      )
    }
    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      const math = part.startsWith('$$') ? part.slice(2, -2) : part.slice(1, -1)
      return (
        <span key={i} className="font-serif italic text-teal-300 font-bold px-1 select-all tracking-wide">
          {math}
        </span>
      )
    }
    return part
  })
}

// ------------------------------------------------------------------------
// SPECIAL AGGREGATE AST GENERATOR: GLOSSARY
// ------------------------------------------------------------------------
function getGlossaryAST(): ASTNode[] {
  return [
    { type: 'heading', level: 1, content: 'Platform Glossary' },
    { type: 'paragraph', content: 'Centralized reference mapping key acronyms, technologies, and terms used in real-time datacenter operations.' },
    {
      type: 'table',
      content: '',
      headers: ['Acronym / Term', 'Definition', 'Application context'],
      rows: [
        ['ECS', 'Entity-Component-System design separating game state logical operations from rendering threads.', 'Authoritative background Web Worker synchronizing Transferable ArrayBuffers to keep main thread stable above 60 FPS.'],
        ['CRAC', 'Computer Room Air Conditioning generating massive BTU cooling loads.', 'Maintains facility room ambient temp target scales. Degrades when room ambient >40°C.'],
        ['PDU', 'Power Distribution Unit mounted inside server racks.', 'Routes Apparent Power (VA) across Phase A, B, and C lines based on slotIndex.'],
        ['WAF', 'Write Amplification Factor penalty multiplier.', 'Scales physical flash wear based on RAID parities under dynamic application IOPS.'],
        ['OOB Serial', 'Out-Of-Band remote serial console management.', 'Allows operators to run poweron/hostname commands on unbooted slotted assets.'],
        ['SLA', 'Service Level Agreement metrics.', 'Compliance uptime tracker. Contract payouts drop if nodes enter error/infected states.'],
        ['RMA Dispatch', 'Return Merchandise Authorization engineering dispatch.', ' Technician dispatches ($1,500) that progress to repair worn drives, clean infections, and restore health to 100%.'],
        ['SAN Controller', 'Storage Area Network aggregation controller.', 'Slices high-density block spaces, caching RAID calculations and mapping LUNs cabled from SAS Shelves.']
      ]
    }
  ]
}

// ------------------------------------------------------------------------
// SPECIAL AGGREGATE AST GENERATOR: CONCEPT BASICS
// ------------------------------------------------------------------------
function getDatacenterConceptsAST(): ASTNode[] {
  return [
    { type: 'heading', level: 1, content: 'Datacenter Infrastructure Concepts' },
    { type: 'paragraph', content: 'An overview of the physical laws, mathematics, and infrastructure policies simulated inside the digital twin.' },
    { type: 'heading', level: 2, content: '1. Apparent Power vs Real Power' },
    { type: 'paragraph', content: 'Traditional server power supplies exhibit AC-to-DC conversion inefficiencies and reactances. Apparent Power (VA) represents the actual electrical demand drawn from the rack PDU, computed as:' },
    { type: 'formula', content: '\\text{Apparent Power (VA)} = \\frac{\\text{AC Power Draw}}{\\text{Power Factor}}' },
    { type: 'paragraph', content: 'Power factor scales dynamically between **0.85** (idle compute state) and **0.99** (saturated workloads). Apparent Power determines the current balancing across three phases. Overloading any single phase trips the breaker.' },
    { type: 'heading', level: 2, content: '2. RAID Fault-Tolerance Mechanics' },
    { type: 'paragraph', content: 'Redundant Array of Independent Disks (RAID) parities trade capacity for safety. Each parity method exhibits a strict mathematical threshold for drive wear failures:' },
    {
      type: 'table',
      content: '',
      headers: ['RAID Configuration', 'Fault Tolerance Limit', 'WAF Penalty', 'IOPS Scaling Rule'],
      rows: [
        ['JBOD / RAID0', '0 Drives failed (First failure fails array)', '1.0 WAF', 'Linear sum of cabled shelf IOPS.'],
        ['RAID1 / RAID10', '1 Drive failed (Degrades performance by 50%)', '2.0 WAF', 'Double aggregate performance bounds.'],
        ['RAID5', '1 Drive failed (Degrades performance by 50%)', '4.0 WAF', 'Distributed single parity overhead.'],
        ['RAID6', '2 Drives failed (Degrades performance to 75% then 40%)', '6.0 WAF', 'Distributed double parity block layers.']
      ]
    },
    { type: 'heading', level: 2, content: '3. Aisle Thermal Convection & Bypass Leaks' },
    { type: 'paragraph', content: 'Racks exhaust massive heat that recirculates into server intakes if airflow is uncontained. Installing Cold or Hot Aisle Containment blocks air recirculation. Additionally, open empty slots without blanking panels cause bypass air leaks, calculated as:' },
    { type: 'formula', content: '\\text{Bypass Airflow Factor} = \\max(0.1, 1.0 - 0.05 \\times \\text{emptySlotsWithoutPanels})' },
    { type: 'paragraph', content: 'Each unpanelled empty slot reduces cooling efficiency by 5%, causing heat to build up inside the local micro-climate.' }
  ]
}

// ------------------------------------------------------------------------
// INTERACTIVE PLAYGROUND WIDGET: 3-PHASE LOAD BALANCER
// ------------------------------------------------------------------------
function ThreePhaseInteractiveWidget() {
  const [phaseALoad, setPhaseALoad] = useState(600)
  const [phaseBLoad, setPhaseBLoad] = useState(800)
  const [phaseCLoad, setPhaseCLoad] = useState(700)
  const [pduLimit, setPduLimit] = useState(5000) // 5 kW limit

  const totalLoad = phaseALoad + phaseBLoad + phaseCLoad
  const nominalPhaseLimit = pduLimit / 3
  const safetyPhaseLimit = nominalPhaseLimit * 1.15

  const aOver = phaseALoad > safetyPhaseLimit
  const bOver = phaseBLoad > safetyPhaseLimit
  const cOver = phaseCLoad > safetyPhaseLimit
  const totalOver = totalLoad > pduLimit
  const isTripped = aOver || bOver || cOver || totalOver

  const maxPhaseLoad = Math.max(phaseALoad, phaseBLoad, phaseCLoad)
  const minPhaseLoad = Math.min(phaseALoad, phaseBLoad, phaseCLoad)
  const imbalancePercent = maxPhaseLoad > 0 ? ((maxPhaseLoad - minPhaseLoad) / maxPhaseLoad) * 100 : 0

  return (
    <div className="my-8 p-6 bg-slate-900/60 border border-white/10 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="text-teal-400" size={20} />
        <div>
          <h4 className="text-xs font-black uppercase text-white tracking-widest">Interactive Playground: 3-Phase Phase Balancer</h4>
          <p className="text-[9px] text-slate-500 font-bold uppercase">Plug in active slot draws to simulate PDU breaker limits</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Phase A Load</span>
              <span className="text-white">{phaseALoad} W</span>
            </div>
            <input 
              type="range" min="0" max="2500" step="50" value={phaseALoad}
              onChange={(e) => setPhaseALoad(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Phase B Load</span>
              <span className="text-white">{phaseBLoad} W</span>
            </div>
            <input 
              type="range" min="0" max="2500" step="50" value={phaseBLoad}
              onChange={(e) => setPhaseBLoad(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Phase C Load</span>
              <span className="text-white">{phaseCLoad} W</span>
            </div>
            <input 
              type="range" min="0" max="2500" step="50" value={phaseCLoad}
              onChange={(e) => setPhaseCLoad(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>PDU Breaker Cap</span>
              <span className="text-white">{(pduLimit/1000).toFixed(1)} kW</span>
            </div>
            <select
              value={pduLimit}
              onChange={(e) => setPduLimit(Number(e.target.value))}
              className="w-full bg-slate-950 text-white font-bold text-[10px] uppercase py-2 px-3 rounded-xl border border-white/10 outline-none"
            >
              <option value="5000">Standard PDU (5.0 kW)</option>
              <option value="8000">Mid-Range PDU (8.0 kW)</option>
              <option value="15000">High-Density PDU (15.0 kW)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Total Demand</span>
              <span className={`text-[11px] font-black ${totalOver ? 'text-red-500' : 'text-teal-400'}`}>
                {(totalLoad / 1000).toFixed(3)} kW / {(pduLimit/1000).toFixed(1)} kW
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Phase Limit (+15%)</span>
              <span className="text-[10px] font-black text-slate-300">{(safetyPhaseLimit/1000).toFixed(3)} kW</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Phase Imbalance</span>
              <span className={`text-[10px] font-black ${imbalancePercent > 30 ? 'text-amber-400' : 'text-slate-300'}`}>
                {imbalancePercent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={`p-4 rounded-xl mt-4 border flex items-center gap-3 text-left ${isTripped ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            <span className="text-xl">{isTripped ? '⚠️' : '🛡️'}</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider">Breaker Status</p>
              <p className="text-[10px] leading-tight font-medium mt-0.5">
                {isTripped 
                  ? 'TRIP IN 10s: One or more phases exceed Apparent safety limits!' 
                  : 'OPERATIONAL: Current distribution is within nominal safety bounds.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------
// INTERACTIVE PLAYGROUND WIDGET: RAID RELIABILITY
// ------------------------------------------------------------------------
function RaidReliabilityWidget() {
  const [raidLevel, setRaidLevel] = useState<'raid0'|'raid1'|'raid5'|'raid6'|'raid10'>('raid5')
  const [diskTier, setDiskTier] = useState<'nvme'|'ssd'|'hdd'>('ssd')
  const [diskCount, setDiskCount] = useState(6)
  const [diskCap, setDiskCap] = useState(10) // 10 TB disks

  const rawCap = diskCount * diskCap
  let usableCap = rawCap
  let faultTolerance = 0
  let waf = 1.0

  if (raidLevel === 'raid1' || raidLevel === 'raid10') {
    usableCap = rawCap / 2
    faultTolerance = 1
    waf = 2.0
  } else if (raidLevel === 'raid5') {
    usableCap = (diskCount - 1) * diskCap
    faultTolerance = 1
    waf = 4.0
  } else if (raidLevel === 'raid6') {
    usableCap = (diskCount - 2) * diskCap
    faultTolerance = 2
    waf = 6.0
  } else if (raidLevel === 'raid0') {
    usableCap = rawCap
    faultTolerance = 0
    waf = 1.0
  }

  // Multipliers
  const tierSpeed = diskTier === 'nvme' ? 3.0 : diskTier === 'ssd' ? 1.5 : 0.5
  const raidPenalty = raidLevel === 'raid6' ? 0.5 : raidLevel === 'raid5' ? 0.7 : 1.0
  
  // Rebuild hours estimation (concept-scaling)
  const baseRebuildHours = 24.0
  const rebuildHours = baseRebuildHours / (tierSpeed * raidPenalty)

  return (
    <div className="my-8 p-6 bg-slate-900/60 border border-white/10 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center gap-3">
        <HardDrive className="text-teal-400" size={20} />
        <div>
          <h4 className="text-xs font-black uppercase text-white tracking-widest">Interactive Playground: RAID Reliability Calculator</h4>
          <p className="text-[9px] text-slate-500 font-bold uppercase">Configure parities and tiers to analyze storage array metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-black uppercase">RAID Parity Configuration</span>
            <select
              value={raidLevel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRaidLevel(e.target.value as 'raid0'|'raid1'|'raid5'|'raid6'|'raid10')}
              className="w-full bg-slate-950 text-white font-bold text-[10px] uppercase py-2 px-3 rounded-xl border border-white/10 outline-none"
            >
              <option value="raid0">RAID0 / JBOD (Zero Parity)</option>
              <option value="raid1">RAID1 (Mirroring)</option>
              <option value="raid5">RAID5 (Single Distributed Parity)</option>
              <option value="raid6">RAID6 (Double Distributed Parity)</option>
              <option value="raid10">RAID10 (Striped Mirrors)</option>
            </select>
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-black uppercase">Disk Media Tier</span>
            <select
              value={diskTier}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDiskTier(e.target.value as 'nvme'|'ssd'|'hdd')}
              className="w-full bg-slate-950 text-white font-bold text-[10px] uppercase py-2 px-3 rounded-xl border border-white/10 outline-none"
            >
              <option value="nvme">NVMe PCIe Flash (3.0x Rebuild)</option>
              <option value="ssd">SATA SSD Storage (1.5x Rebuild)</option>
              <option value="hdd">Mechanical SAS HDD (0.5x Rebuild)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-black uppercase">Drive Capacity (TB)</span>
            <select
              value={diskCap}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDiskCap(Number(e.target.value))}
              className="w-full bg-slate-950 text-white font-bold text-[10px] uppercase py-2 px-3 rounded-xl border border-white/10 outline-none"
            >
              <option value="4">4 TB Drives</option>
              <option value="10">10 TB Drives</option>
              <option value="20">20 TB Drives</option>
              <option value="50">50 TB Drives</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Drive Count</span>
              <span className="text-white">{diskCount} Drives</span>
            </div>
            <input 
              type="range" min="3" max="24" step="1" value={diskCount}
              onChange={(e) => setDiskCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
        </div>

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Apparent Usable Space</span>
              <span className="text-[11px] font-black text-teal-400">{usableCap} TB / {rawCap} TB</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Parity Overhead</span>
              <span className="text-[10px] font-black text-slate-400">{(rawCap - usableCap)} TB ({(100 - (usableCap / rawCap) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Fault Tolerance</span>
              <span className="text-[10px] font-black text-emerald-400">{faultTolerance} Failed Drives Allowed</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Parity WAF Multiplier</span>
              <span className="text-[10px] font-black text-amber-400">{waf.toFixed(1)}x Wear Rate</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Estimated Rebuild Time</span>
              <span className="text-[10px] font-black text-white">{rebuildHours.toFixed(1)} Hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------
// INTERACTIVE PLAYGROUND WIDGET: THERMODYNAMIC CONVECTION FLOW
// ------------------------------------------------------------------------
function ThermodynamicInteractiveWidget() {
  const [ambientTemp, setAmbientTemp] = useState(25) // °C
  const [emptySlots, setEmptySlots] = useState(4)
  const [containment, setContainment] = useState<'none'|'cold'|'hot'>('none')

  // Recirculation fractions
  const recircFraction = containment === 'none' ? 0.5 : containment === 'cold' ? 0.05 : 0.15
  
  // Bypass airflow factor
  const bypassAirflow = Math.max(0.1, 1.0 - 0.05 * emptySlots)
  
  // Localized Rack Intake Temperature target math
  // (Scaled for playground visualization)
  const serverHeatLoad = 12 // kW model load
  const rackIntakeTemp = ambientTemp + (serverHeatLoad * recircFraction) / bypassAirflow
  const coolingEfficiency = bypassAirflow * 100

  // Safeguards limits
  const isThrottled = rackIntakeTemp > 70
  const isShutdown = rackIntakeTemp > 80

  return (
    <div className="my-8 p-6 bg-slate-900/60 border border-white/10 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center gap-3">
        <Thermometer className="text-teal-400" size={20} />
        <div>
          <h4 className="text-xs font-black uppercase text-white tracking-widest">Interactive Playground: Thermodynamic Flow Simulator</h4>
          <p className="text-[9px] text-slate-500 font-bold uppercase">Toggle panel leaks and containment to estimate chassis air intake temps</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[9px] text-slate-400 font-black uppercase">Aisle Containment Type</span>
            <select
              value={containment}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setContainment(e.target.value as 'none'|'cold'|'hot')}
              className="w-full bg-slate-950 text-white font-bold text-[10px] uppercase py-2 px-3 rounded-xl border border-white/10 outline-none"
            >
              <option value="none">Open Air (50% Recirculation)</option>
              <option value="cold">Cold Aisle Containment (5% Recirculation)</option>
              <option value="hot">Hot Aisle Containment (15% Recirculation)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Empty Slots (No Blanking Panels)</span>
              <span className="text-white">{emptySlots} Slots</span>
            </div>
            <input 
              type="range" min="0" max="12" step="1" value={emptySlots}
              onChange={(e) => setEmptySlots(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase">
              <span>Site Ambient Temperature</span>
              <span className="text-white">{ambientTemp} °C</span>
            </div>
            <input 
              type="range" min="15" max="55" step="1" value={ambientTemp}
              onChange={(e) => setAmbientTemp(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
        </div>

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Recirculation Fraction</span>
              <span className="text-[10px] font-black text-slate-300">{(recircFraction * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Bypass Airflow leaks</span>
              <span className="text-[10px] font-black text-slate-400">{((1 - bypassAirflow) * 100).toFixed(0)}% Leaked Air</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Rack Cooling Efficiency</span>
              <span className="text-[10px] font-black text-teal-400">{coolingEfficiency.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-slate-500 font-black uppercase">Intake Micro-Climate Temp</span>
              <span className={`text-[12px] font-black ${isShutdown ? 'text-red-500 animate-pulse' : isThrottled ? 'text-amber-400' : 'text-emerald-400'}`}>
                {rackIntakeTemp.toFixed(1)} °C
              </span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 text-left ${isShutdown ? 'bg-red-500/10 border-red-500/30 text-red-400' : isThrottled ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
            <span className="text-xl">{isShutdown || isThrottled ? '⚠️' : '🛡️'}</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider">Silicon Thermal Status</p>
              <p className="text-[10px] leading-tight font-medium mt-0.5">
                {isShutdown 
                  ? 'CRITICAL SHUTDOWN: Intake temperature exceeds 80°C threshold limit!' 
                  : isThrottled 
                    ? 'THROTTLED: Temperature >70°C, server CPU performance halved!' 
                    : 'NOMINAL: Airflow and temperature operate within safe structural bounds.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
