import { System } from '../System'
import type { KubernetesNodeComponent, PodComponent, PowerComponent, TransformComponent } from '../types'

export class KubernetesSystem extends System {

  update(_deltaTime: number) {
    const k8sNodes = this.world.getComponentMap<KubernetesNodeComponent>('kubernetes')
    if (!k8sNodes) return

    const powerComponents = this.world.getComponentMap<PowerComponent>('power')
    const transformComponents = this.world.getComponentMap<TransformComponent>('transform')
    const pods = this.world.getComponentMap<PodComponent>('pod')

    const clusters = new Map<string, { masters: string[], workers: string[] }>()
    const offlineNodes = new Set<string>()

    for (const [entityId, node] of k8sNodes.entries()) {
      const power = powerComponents?.get(entityId)
      const transform = transformComponents?.get(entityId)
      
      const isPowered = power ? power.isPowered : false
      const isBlackholed = transform ? transform.isBlackholed : false

      const isHealthy = isPowered && !isBlackholed

      if (isHealthy) {
        node.kubeletStatus = 'running'
        if (!clusters.has(node.clusterId)) {
          clusters.set(node.clusterId, { masters: [], workers: [] })
        }
        if (node.role === 'master') {
          clusters.get(node.clusterId)!.masters.push(entityId)
        } else {
          clusters.get(node.clusterId)!.workers.push(entityId)
        }
      } else {
        node.kubeletStatus = 'offline'
        offlineNodes.add(entityId)
      }
    }

    // Determine cluster quorums before processing pods
    const clusterQuorums = new Map<string, boolean>()
    for (const [clusterId, cluster] of clusters.entries()) {
       let totalMasters = 0
       for (const masterId of cluster.masters) {
          const masterNode = k8sNodes.get(masterId)
          if (masterNode && masterNode.totalMasters) {
             totalMasters = Math.max(totalMasters, masterNode.totalMasters)
          }
       }
       if (totalMasters === 0) totalMasters = cluster.masters.length || 1
       const quorum = Math.floor(totalMasters / 2) + 1
       clusterQuorums.set(clusterId, cluster.masters.length >= quorum)
    }

    if (pods) {
      for (const [podId, pod] of pods.entries()) {
        const hasQuorum = clusterQuorums.get(pod.clusterId) ?? false

        // Pod Level OOMKilled simulation (Jitter)
        if (pod.status === 'running' && pod.memoryLimit) {
           // Simulate fluctuating memory usage (+0% to +50% of request)
           const currentMemoryUsage = pod.memoryReq * (1.0 + Math.random() * 0.5)
           if (currentMemoryUsage > pod.memoryLimit) {
              pod.status = 'oomkilled'
              pod.evictionTimer = 0
              pod.restartCount = (pod.restartCount || 0) + 1
              this.world.eventBus.publish('system:alert', {
                 entityId: podId,
                 message: `Pod ${podId.slice(0, 8)} OOMKilled: Usage ${currentMemoryUsage.toFixed(1)}MB exceeded limit ${pod.memoryLimit}MB`,
                 severity: 'warning'
              })
           }
        } else if (pod.status === 'oomkilled' || pod.status === 'crashloop') {
           if (pod.evictionTimer !== undefined) {
              pod.evictionTimer += _deltaTime
              // Exponential backoff or simple backoff before restart (e.g., 30s)
              if (pod.evictionTimer >= 30) {
                 pod.status = 'pending'
                 pod.evictionTimer = 0
              }
           } else {
              pod.evictionTimer = 0
           }
        }

        if (offlineNodes.has(pod.nodeId)) {
           // If we don't have quorum, the API server is read-only, so the node controller cannot evict pods.
           if (!hasQuorum) continue;

           if (pod.status !== 'crashloop' && pod.status !== 'terminating' && pod.status !== 'oomkilled') {
             pod.status = 'crashloop'
             pod.evictionTimer = 0
             pod.restartCount = (pod.restartCount || 0) + 1
           }
           if (pod.evictionTimer !== undefined) {
             pod.evictionTimer += _deltaTime
             // Evict after pod-eviction-timeout (e.g. 300 seconds)
             if (pod.evictionTimer >= 300) {
             // Pod Disruption Budget (PDB) / Minimum Replicas constraint
             // Prevent eviction if doing so would drop the running count below 2 for a highly available service
             let activeReplicas = 0
             for (const p of pods.values()) {
               if (p.serviceName === pod.serviceName && p.status === 'running') {
                 activeReplicas++
               }
             }

             if (activeReplicas > 1) {
               pod.nodeId = ''
               pod.status = 'pending'
               pod.evictionTimer = 0
             } else {
               // Eviction blocked by PDB, keep the timer maxed so it evicts as soon as another replica is ready
               pod.evictionTimer = 300 
             }
             }
           } else {
             pod.evictionTimer = 0
           }
        } else if (pod.status === 'pending' && pod.nodeId !== '' && hasQuorum) {
           pod.status = 'running'
           pod.evictionTimer = 0
        }
      }

      for (const [clusterId, cluster] of clusters.entries()) {
         const hasQuorum = clusterQuorums.get(clusterId) ?? false
         if (!hasQuorum) continue // etcd Quorum Loss: Control Plane Read-Only 

         const unscheduledPods = []
         for (const [podId, pod] of pods.entries()) {
           if (pod.clusterId === clusterId && pod.status === 'pending') {
             unscheduledPods.push(podId)
           }
         }

         if (unscheduledPods.length > 0 && cluster.workers.length > 0) {
            // Sort workers deterministically by entityId to prevent sync issues
            const sortedWorkers = [...cluster.workers].sort((a, b) => a.localeCompare(b))
            
            // Calculate available resources for all workers in this cluster
            const workerResources = new Map<string, { cpuAvailable: number, memAvailable: number, podCount: number }>()
            for (const workerId of sortedWorkers) {
               const node = k8sNodes.get(workerId)!
               let usedCpu = 0
               let usedMem = 0
               let podCount = 0
               
               for (const p of pods.values()) {
                 if (p.nodeId === workerId && (p.status === 'running' || p.status === 'crashloop' || p.status === 'terminating')) {
                   usedCpu += p.cpuReq
                   usedMem += p.memoryReq
                   podCount++
                 }
               }
               
               workerResources.set(workerId, {
                 cpuAvailable: node.cpuCapacity - usedCpu,
                 memAvailable: node.memoryCapacity - usedMem,
                 podCount
               })
            }

            // OOM Enforcement: Find workers with negative memory and OOMKill the newest/a running pod
            workerResources.forEach((res, workerId) => {
              if (res.memAvailable < 0) {
                 // Find a pod on this node to kill
                 for (const [podId, p] of pods.entries()) {
                   if (p.nodeId === workerId && p.status === 'running') {
                     p.status = 'oomkilled'
                     p.evictionTimer = 0
                     p.restartCount = (p.restartCount || 0) + 1
                     res.memAvailable += p.memoryReq
                     res.cpuAvailable += p.cpuReq
                     res.podCount--
                     this.world.eventBus.publish('system:alert', {
                        entityId: workerId,
                        message: `OOMKilled: Pod ${podId.slice(0, 8)} terminated due to memory exhaustion.`,
                        severity: 'warning'
                     })
                     if (res.memAvailable >= 0) break // Stop killing if we have freed enough
                   }
                 }
              }
            })

            let workerIdx = 0
            for (const podId of unscheduledPods) {
              const pod = pods.get(podId)!
              
              let placed = false
              // Try to find a worker that can accommodate this pod (round-robin)
              for (let i = 0; i < sortedWorkers.length; i++) {
                 const workerId = sortedWorkers[(workerIdx + i) % sortedWorkers.length]!
                 const workerNode = k8sNodes.get(workerId)!
                 const res = workerResources.get(workerId)!
                 
                 if (res.podCount < workerNode.maxPods && 
                     res.cpuAvailable >= pod.cpuReq && 
                     res.memAvailable >= pod.memoryReq) {
                     
                     // Anti-affinity check: Try to avoid nodes that already have this service
                     // Zone-Awareness: Check if another replica is already running in the same physical siteId!
                     let hasSameServiceInSite = false
                     const targetSiteId = transformComponents?.get(workerId)?.siteId || ''

                     for (const p of pods.values()) {
                       if (p.serviceName === pod.serviceName && p.status === 'running') {
                         if (p.nodeId === workerId) {
                           hasSameServiceInSite = true
                           break
                         } else if (targetSiteId) {
                           const otherSiteId = transformComponents?.get(p.nodeId)?.siteId
                           if (otherSiteId === targetSiteId) {
                             hasSameServiceInSite = true
                             break
                           }
                         }
                       }
                     }
                     
                     // If there's another worker available, we skip this one for anti-affinity
                     // But if we've checked all workers and haven't placed it, we will relax anti-affinity.
                     // For deterministic simplicity, we'll just score it and pick the best, or skip if i < sortedWorkers.length - 1
                     if (hasSameServiceInSite && i < sortedWorkers.length - 1) {
                        continue // Skip this node to prefer spread
                     }
                     
                     // Place pod
                     pod.nodeId = workerId
                     pod.status = 'running'
                     
                     // Update available resources to account for this placement
                     res.podCount++
                     res.cpuAvailable -= pod.cpuReq
                     res.memAvailable -= pod.memoryReq
                     
                     placed = true
                     workerIdx = (workerIdx + i + 1) % sortedWorkers.length
                     break
                 }
              }
              
              if (!placed) {
                 pod.status = 'pending' 
              }
            }
         }
      }
    }
  }
}
