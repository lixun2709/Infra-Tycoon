import { System } from '../System'
import type { LoadBalancerComponent, PowerComponent, ApplicationComponent, EdgeCacheComponent, ConnectionComponent } from '../types'

/**
 * LoadBalancerSystem
 * ECS implementation for Hardware Load Balancers and Edge Cache appliances.
 * Distributes simulated traffic and tracks cache efficiency.
 */
export class LoadBalancerSystem extends System {
  public update(dt: number) {
    const lbMap = this.world.getComponentMap<LoadBalancerComponent>('loadBalancer')
    const edgeMap = this.world.getComponentMap<EdgeCacheComponent>('edgeCache')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const appMap = this.world.getComponentMap<ApplicationComponent>('application')
    const connMap = this.world.getComponentMap<ConnectionComponent>('connection')

    // 1. Process Load Balancers
    const lbEntities = this.world.getEntitiesWith(['loadBalancer', 'power'])
    lbEntities.forEach(lbId => {
      const lb = lbMap.get(lbId)!
      const power = powerMap.get(lbId)!

      if (!power.isPowered || power.breakerTripped || power.systemState !== 'running') {
        lb.activeConnections = 0
        lb.totalThroughputGbps = 0
        return
      }

      // Re-map target group connections via the application map
      let totalThroughput = 0
      let activeConnections = 0

      // Find applications assigned to this Load Balancer
      const apps = this.world.getEntitiesWith(['application']).map(appId => appMap.get(appId)!).filter(a => a.loadBalancerId === lbId)
      
      apps.forEach(app => {
        // Find connections pointing to the app's target group nodes
        const targetNodes = app.targetGroupIds || []
        
        // Count backend traffic throughput across all backend targets
        if (connMap) {
          connMap.forEach(conn => {
            if (targetNodes.includes(conn.endNodeId) || targetNodes.includes(conn.startNodeId)) {
              totalThroughput += (conn.throughputGbps ?? 0)
              activeConnections += Math.floor((conn.throughputGbps ?? 0) * 1500) // Rough approximation
            }
          })
        }
      })

      // The LB itself processes the sum of all its backend target traffic
      lb.totalThroughputGbps = totalThroughput
      lb.activeConnections = activeConnections
    })

    // 2. Process Edge Cache Appliances
    const edgeEntities = this.world.getEntitiesWith(['edgeCache', 'power'])
    edgeEntities.forEach(edgeId => {
      const edge = edgeMap.get(edgeId)!
      const power = powerMap.get(edgeId)!

      if (!power.isPowered || power.breakerTripped || power.systemState !== 'running') {
        edge.cacheHitRatio = 0
        edge.bandwidthSavedGbps = 0
        edge.totalRequests = 0
        return
      }

      // Simulate CDN cache efficiency (Static values scaled by dt)
      // High traffic sites gain more cache efficiency over time
      edge.totalRequests += Math.floor(dt * 1000)
      
      // Dynamic cache hit ratio simulation (oscillates around 85-95%)
      const targetRatio = 0.85 + (Math.random() * 0.1)
      edge.cacheHitRatio = edge.cacheHitRatio * 0.9 + targetRatio * 0.1

      // Approximate saved bandwidth
      edge.bandwidthSavedGbps = (edge.totalRequests / 1000) * 0.05 * edge.cacheHitRatio
    })
  }
}
