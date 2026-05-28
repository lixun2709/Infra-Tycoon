import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { BackupSystem } from '../BackupSystem'
import type { 
  BackupComponent, 
  StorageComponent, 
  SecurityComponent, 
  TransformComponent 
} from '../../types'

describe('BackupSystem', () => {
  it('should fail backup and release throttle if target storage is full', () => {
    const world = new World()
    const system = new BackupSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const backupId = 'node-backup'
    const targetId = 'node-target'
    
    world.registerEntity(backupId)
    world.registerEntity(targetId)

    // The node attempting to backup
    world.addComponent('backup', {
      entityId: backupId,
      backupStatus: 'backing_up',
      lastBackupTime: Date.now(),
      backupTargetId: targetId
    } as BackupComponent)

    world.addComponent('transform', {
      entityId: backupId,
      isThrottled: true // Throttled due to backup storm
    } as TransformComponent)

    // The target storage node
    world.addComponent('storage', {
      entityId: targetId,
      totalStorageTB: 10,
      usedStorageTB: 10 // Full!
    } as StorageComponent)

    // Run system
    system.update(1.0)

    const backup = world.getComponent<BackupComponent>('backup', backupId)!
    const transform = world.getComponent<TransformComponent>('transform', backupId)!

    expect(backup.backupStatus).toBe('unprotected')
    expect(backup.corruptionState).toBe('corrupted')
    expect(transform.isThrottled).toBe(false)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('Target storage full')
    }))
  })

  it('should fail backup if network path is blackholed', () => {
    const world = new World()
    const system = new BackupSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const backupId = 'node-backup-2'
    
    world.registerEntity(backupId)

    world.addComponent('backup', {
      entityId: backupId,
      backupStatus: 'backing_up',
      lastBackupTime: Date.now(),
      backupTargetId: 'some-target'
    } as BackupComponent)

    world.addComponent('transform', {
      entityId: backupId,
      isBlackholed: true // Blackholed!
    } as TransformComponent)

    world.addComponent('storage', {
      entityId: 'some-target',
      totalStorageTB: 10,
      usedStorageTB: 5
    } as StorageComponent)

    system.update(1.0)

    const backup = world.getComponent<BackupComponent>('backup', backupId)!
    expect(backup.backupStatus).toBe('unprotected')
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('Network path blocked')
    }))
  })

  it('should invalidate backups if node is infected with ransomware, unless immutable', () => {
    const world = new World()
    const system = new BackupSystem(world)

    const normalNodeId = 'node-normal'
    const immutableNodeId = 'node-immutable'

    world.registerEntity(normalNodeId)
    world.registerEntity(immutableNodeId)

    world.addComponent('backup', {
      entityId: normalNodeId,
      backupStatus: 'protected',
      lastBackupTime: Date.now(),
      isImmutable: false,
      corruptionState: 'clean'
    } as BackupComponent)

    world.addComponent('security', {
      entityId: normalNodeId,
      infectionState: 'infected'
    } as SecurityComponent)

    world.addComponent('backup', {
      entityId: immutableNodeId,
      backupStatus: 'protected',
      lastBackupTime: Date.now(),
      isImmutable: true,
      corruptionState: 'clean'
    } as BackupComponent)

    world.addComponent('security', {
      entityId: immutableNodeId,
      infectionState: 'infected'
    } as SecurityComponent)

    system.update(1.0)

    const normalBackup = world.getComponent<BackupComponent>('backup', normalNodeId)!
    const immutableBackup = world.getComponent<BackupComponent>('backup', immutableNodeId)!

    expect(normalBackup.corruptionState).toBe('ransomware')
    expect(normalBackup.backupStatus).toBe('unprotected')

    expect(immutableBackup.corruptionState).toBe('clean')
    expect(immutableBackup.backupStatus).toBe('protected') // Survives due to immutability
  })
})
