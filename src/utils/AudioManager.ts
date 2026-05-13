import * as THREE from 'three'

class AudioManager {
  private listener: THREE.AudioListener | null = null
  private sounds: Map<string, THREE.Audio | THREE.PositionalAudio> = new Map()
  private ambientHum: THREE.Audio | null = null
  private isMuted: boolean = false

  init(camera: THREE.Camera) {
    if (this.listener) return
    this.listener = new THREE.AudioListener()
    camera.add(this.listener)
    
    // Ensure context resumes on first interaction if blocked by browser
    if (this.listener.context.state === 'suspended') {
      const resume = () => {
        this.listener?.context.resume()
        window.removeEventListener('click', resume)
      }
      window.addEventListener('click', resume)
    }
    
    this.startAmbient()
  }

  private startAmbient() {
    if (!this.listener) return
    const audio = new THREE.Audio(this.listener)
    
    // Using an oscillator for high-tech industrial hum instead of an external file
    const ctx = audio.context
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(50, ctx.currentTime) // Low hum
    
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(200, ctx.currentTime)
    
    gain.gain.setValueAtTime(0.02, ctx.currentTime) // Very quiet
    
    oscillator.connect(filter)
    filter.connect(gain)
    audio.setNodeSource(gain)
    
    oscillator.start()
    this.ambientHum = audio
  }

  playEffect(type: 'click' | 'alert' | 'error' | 'success') {
    if (!this.listener || this.isMuted) return

    const audio = new THREE.Audio(this.listener)
    const ctx = audio.context
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    switch (type) {
      case 'click':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(800, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
        break
      case 'alert':
        osc.type = 'square'
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        break
      case 'error':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        break
      case 'success':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2) // G5
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        break
    }

    osc.connect(gain)
    audio.setNodeSource(gain)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  }

  toggleMute() {
    this.isMuted = !this.isMuted
    if (this.listener) {
      this.listener.setMasterVolume(this.isMuted ? 0 : 1)
    }
    return this.isMuted
  }
}

export const audioManager = new AudioManager()
