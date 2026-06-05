import { useState, useEffect } from 'react'

export function useAnimatedNumber(value: number, duration: number = 500) {
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    let startTime: number | null = null
    const startValue = displayValue

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      
      // Easing function (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      
      setDisplayValue(startValue + (value - startValue) * easeProgress)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    if (value !== startValue) {
      requestAnimationFrame(animate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return displayValue
}
