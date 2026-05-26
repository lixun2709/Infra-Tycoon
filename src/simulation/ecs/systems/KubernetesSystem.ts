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

    if (pods) {
      for (const [, pod] of pods.entries()) {
        if (offlineNodes.has(pod.nodeId)) {
           if (pod.status !== 'crashloop' && pod.status !== 'terminating') {
             pod.status = 'crashloop'
             pod.evictionTimer = 0
             pod.restartCount = (pod.restartCount || 0) + 1
           }
           if (pod.evictionTimer !== undefined) {
             pod.evictionTimer += _deltaTime
             // Evict after pod-eviction-timeout (e.g. 300 seconds)
             if (pod.evictionTimer >= 300) {
               pod.nodeId = ''
               pod.status = 'pending'
               pod.evictionTimer = 0
             }
           } else {
             pod.evictionTimer = 0
           }
        } else if (pod.status === 'crashloop' && pod.nodeId !== '') {
           pod.status = 'running'
           pod.evictionTimer = 0
        }
      }

      for (const [clusterId, cluster] of clusters.entries()) {
         if (cluster.masters.length === 0) continue 

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
