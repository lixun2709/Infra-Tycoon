import { Grid } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'

export function EnvironmentRenderer() {
  const { totalRoomBTU } = useInfraStore()
  const isHot = totalRoomBTU > 50000

  return (
    <>
      <color attach="background" args={isHot ? ['#3a1a1a'] : ['#cfe2f3']} />
      <ambientLight intensity={0.8} color={isHot ? '#ff8c00' : '#ffffff'} />
      <directionalLight position={[10, 10, 5]} intensity={1} color={isHot ? '#ffb347' : '#ffffff'} />

      <Grid
        args={[30, 30]}
        cellSize={1}
        cellThickness={1}
        cellColor="#ffffff"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#ffffff"
        fadeDistance={25}
        fadeStrength={1.5}
      />
    </>
  )
}
