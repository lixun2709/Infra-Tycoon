/**
 * Simulated operations clock formatter.
 * Converts simulation cycles/ticks to a gorgeous tycoon game clock format.
 * Each cycle represents 1 minute of operational simulation time.
 */
export function formatSimulatedClock(cycle: number, format: '12h' | '24h'): string {
  const totalMinutes = cycle * 1
  const day = Math.floor(totalMinutes / (24 * 60)) + 1
  const hour = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minute = totalMinutes % 60
  
  const pad = (n: number) => n.toString().padStart(2, '0')
  
  if (format === '24h') {
    return `Day ${day} • ${pad(hour)}:${pad(minute)}`
  } else {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `Day ${day} • ${pad(displayHour)}:${pad(minute)} ${ampm}`
  }
}
