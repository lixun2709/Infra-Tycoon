/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InfraState } from '../store/infraStoreTypes'

export type ObjectiveBlueprint = {
  id: string
  label: string
  description: string
  evaluate: (state: InfraState) => boolean
}

export type MissionBlueprint = {
  id: string
  title: string
  description: string
  objectives: ObjectiveBlueprint[]
  rewardText?: string
  rewardCash?: number
  rewardXp?: number
}

export const MISSION_CATALOG: Record<string, MissionBlueprint> = {
  m1: {
    id: 'm1',
    title: 'Foundations of Infrastructure',
    description: 'Establish the core physical layer of your data center.',
    rewardText: 'Unlocked Storage Tier 1',
    rewardCash: 5000,
    rewardXp: 500,
    objectives: [
      {
        id: 'm1_obj1',
        label: 'Rack Installation',
        description: 'Deploy your first 42U Server Rack.',
        evaluate: (state) => state.nodes.some((n: any) => n.type === 'rack')
      },
      {
        id: 'm1_obj2',
        label: 'Network Backbone',
        description: 'Install a 1U Leaf Switch in the rack.',
        evaluate: (state) => state.nodes.some((n: any) => n.catalogKey === 'LEAF_SWITCH_1U' && n.parentRackId)
      },
      {
        id: 'm1_obj3',
        label: 'Compute Power',
        description: 'Add a 1U Compute Node to the rack.',
        evaluate: (state) => state.nodes.some((n: any) => n.type === 'compute' && n.parentRackId)
      }
    ]
  },
  m2: {
    id: 'm2',
    title: 'The Nervous System',
    description: 'Establish connectivity between your compute and network layers.',
    rewardText: 'Unlocked Performance Metrics',
    rewardCash: 10000,
    rewardXp: 1000,
    objectives: [
      {
        id: 'm2_obj1',
        label: 'Patching Protocol',
        description: 'Connect the Compute Node to the Leaf Switch.',
        evaluate: (state) => state.connections.some((conn: any) => {
          const startNode = state.nodes.find((n: any) => n.id === conn.startNodeId)
          const endNode = state.nodes.find((n: any) => n.id === conn.endNodeId)
          if (!startNode || !endNode) return false
          return (startNode.type === 'compute' && endNode.type === 'network') ||
                 (startNode.type === 'network' && endNode.type === 'compute')
        })
      },
      {
        id: 'm2_obj2',
        label: 'Power Integrity',
        description: 'Ensure the rack has a PDU installed.',
        evaluate: (state) => state.nodes.some((n: any) => n.catalogKey === 'HIGH_DENSITY_PDU_1U' && n.parentRackId)
      }
    ]
  },
  m3: {
    id: 'm3',
    title: 'High Availability',
    description: 'Build a resilient stack capable of handling failures.',
    rewardText: 'DCIM Certified Operator',
    rewardCash: 25000,
    rewardXp: 2000,
    objectives: [
      {
        id: 'm3_obj1',
        label: 'Storage Foundation',
        description: 'Deploy a SAN Controller and a Disk Shelf.',
        evaluate: (state) => {
          const hasSan = state.nodes.some((n: any) => n.catalogKey === 'SAN_CONTROLLER_2U')
          const hasShelf = state.nodes.some((n: any) => n.catalogKey === 'DISK_SHELF_2U')
          return hasSan && hasShelf
        }
      },
      {
        id: 'm3_obj2',
        label: 'Compute Cluster',
        description: 'Deploy at least 3 Compute Nodes in a single rack.',
        evaluate: (state) => {
          const racks = state.nodes.filter((n: any) => n.type === 'rack')
          return racks.some((rack: any) => {
            const computeInRack = state.nodes.filter((n: any) => n.parentRackId === rack.id && n.type === 'compute')
            return computeInRack.length >= 3
          })
        }
      },
      {
        id: 'm3_obj3',
        label: 'Secure Perimeter',
        description: 'Install a Next-Gen Firewall (Security Appliance).',
        evaluate: (state) => state.nodes.some((n: any) => n.type === 'security')
      }
    ]
  },
  m4: {
    id: 'm4',
    title: 'Thermal Management',
    description: 'Manage heat output with advanced cooling infrastructure.',
    rewardText: 'Thermal Operations Certification',
    rewardCash: 50000,
    rewardXp: 3000,
    objectives: [
      {
        id: 'm4_obj1',
        label: 'HVAC Deployment',
        description: 'Install an In-Row CRAC unit in your server hall.',
        evaluate: (state) => state.nodes.some((n: any) => n.catalogKey === 'IN_ROW_CRAC_4U')
      },
      {
        id: 'm4_obj2',
        label: 'Liquid Loop (Optional)',
        description: 'Prepare for high density by deploying a CDU (if unlocked).',
        evaluate: (state) => state.nodes.some((n: any) => n.catalogKey === 'LIQUID_CDU')
      }
    ]
  },
  m5: {
    id: 'm5',
    title: 'Infrastructure Operations OS',
    description: 'Use the new enterprise Terminal shell to bootstrap bare-metal nodes.',
    rewardText: 'Infrastructure Operations Console Mastery',
    rewardCash: 15000,
    rewardXp: 1500,
    objectives: [
      {
        id: 'm5_obj1',
        label: 'BMC Initialization',
        description: 'Open the console and run `poweron` to initialize a node.',
        evaluate: (state) => state.nodes.some((n: any) => n.type === 'compute' && n.systemState === 'running')
      },
      {
        id: 'm5_obj2',
        label: 'Node Identity',
        description: 'Set a hostname using the `hostname` command in the shell.',
        evaluate: (state) => state.nodes.some((n: any) => !!n.hostname)
      },
      {
        id: 'm5_obj3',
        label: 'Network Bootstrap',
        description: 'Configure a management interface using `ip setup`.',
        evaluate: (state) => state.nodes.some((n: any) => !!n.managementIP)
      }
    ]
  }
}

export const MISSION_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5']


