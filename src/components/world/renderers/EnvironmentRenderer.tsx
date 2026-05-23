import { Grid } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'

export function EnvironmentRenderer() {
  const { totalRoomBTU } = useInfraStore()
  const isHot = totalRoomBTU > 50000

  return (
    <>
      <color attach="background" args={isHot ? ['#3a1a1a'] : ['#e8edf2']} />
      <ambientLight intensity={0.8} color={isHot ? '#ff8c00' : '#ffffff'} />
      <directionalLight position={[10, 10, 5]} intensity={1} color={isHot ? '#ffb347' : '#ffffff'} />

      {/* Solid Physical Floor Plane (Muted Light Blue) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          color={isHot ? '#4a2525' : '#cbdff2'} 
          roughness={0.3} 
          metalness={0.15} 
        />
      </mesh>

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
