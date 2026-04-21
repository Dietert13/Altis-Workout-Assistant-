import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

const PARTICLE_COUNT = 12000;
const CLUSTER_COUNT = 4;

const DeepField = ({ phase, status }: { phase: string | null, status: string }) => {
  const meshRef = useRef<THREE.Points>(null);
  const starCount = 20000;
  
  const stars = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 2] = -50 - Math.random() * 150;
    }
    return pos;
  }, []);

  const twinkles = useMemo(() => new Float32Array(starCount).map(() => Math.random()), []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z -= 0.0001;
      meshRef.current.rotation.y -= 0.00005;
      
      const time = state.clock.getElapsedTime();
      const opacityAttr = meshRef.current.geometry.attributes.opacity;
      for (let i = 0; i < starCount; i++) {
        const twinkle = Math.sin(time * 2 + twinkles[i] * 10) * 0.5 + 0.5;
        (opacityAttr.array as Float32Array)[i] = 0.05 + twinkle * 0.15;
      }
      opacityAttr.needsUpdate = true;
    }
  });

  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  return (
    <group>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starCount}
            array={stars}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            count={starCount}
            array={new Float32Array(starCount).fill(0.1)}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.4} 
          map={starTexture}
          color="#ffffff" 
          transparent 
          sizeAttenuation={true} 
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};

const CosmicAtmosphere = ({ isHIIT, isMetronomeEnabled, metronomeBeat, explosionTrigger, phase, phaseColor, timeLeft = 0 }: { isHIIT: boolean, isMetronomeEnabled: boolean, metronomeBeat: number, explosionTrigger: number, phase: string | null, phaseColor: THREE.Color, timeLeft?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport, camera } = useThree();
  const pulseTime = useRef(0);
  const clusterCount = CLUSTER_COUNT;
  const clusterRadius = 10;
  
  // Reset on phase change
  React.useEffect(() => {
    pulseTime.current = 0;
  }, [phase]);

  React.useEffect(() => {
    if (explosionTrigger > 0) {
      pulseTime.current = 1.0;
    }
  }, [explosionTrigger]);

  const colors = useMemo(() => {
    const palette = [
      '#3D5AFE', // Cosmic indigo
      '#00E5FF', // Electric cyan
      '#00BFA5', // Borealis teal
      '#0047AB', // Cobalt blue
      '#7FFFD4', // Aquamarine
      '#00E676', // Formula green
      '#FF8C00', // Stellar ember
      '#967BB6', // Nebula lavender
      '#F0F8FF', // Star-point blue
      '#121212', // Void charcoal
      '#000000', // Absolute void
    ];
    return Array.from({ length: clusterCount }, () => new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
  }, [clusterCount]);

  const clusters = useRef(Array.from({ length: clusterCount }, (_, i) => ({
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 80, 
      (Math.random() - 0.5) * 60, 
      -30 - Math.random() * 70
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 1.5, 
      (Math.random() - 0.5) * 1.5, 
      (Math.random() - 0.5) * 0.6
    ),
    orbitRadius: 15 + Math.random() * 35,
    orbitSpeed: 0.02 + Math.random() * 0.05,
    orbitOffset: Math.random() * Math.PI * 2,
    swirlRotation: new THREE.Euler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    ),
    swirlSpeed: (Math.random() - 0.5) * 0.4
  })));

  const atmParticleCount = 16000;
  const particles = useRef(Array.from({ length: atmParticleCount }, (_, i) => {
    const radius = Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const offset = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
    return {
      clusterIndex: i % clusterCount,
      offset,
      originalOffset: offset.clone(),
      scale: (Math.random() * 0.05 + 0.02) * 1.5,
      rotationSpeed: (Math.random() - 0.5) * 0.8, // Slightly faster particle swirl
      axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
    };
  }));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    pulseTime.current = Math.max(0, pulseTime.current - delta * 2.0); 
    // Smoother cubic easing for the pulse
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const pulseFactor = 1.0 + easeOutCubic(pulseTime.current) * 0.5; 

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    clusters.current.forEach((c, i) => {
      // Orbital motion around center (0,0)
      // Clockwise means angle decreases over time
      const angle = c.orbitOffset - (time * c.orbitSpeed);
      c.position.x = Math.cos(angle) * c.orbitRadius;
      c.position.y = Math.sin(angle) * c.orbitRadius;
      c.position.z += c.velocity.z * delta;
      
      // Bouncing logic for Z only
      if (c.position.z > -10 || c.position.z < -100) {
        c.velocity.z *= -1;
      }
    });

    particles.current.forEach((p, i) => {
      const cluster = clusters.current[p.clusterIndex];
      
      // Particle swirl + Cluster swirl + organic jitter
      const jitter = Math.sin(time * 2 + i) * 0.05;
      const rotatedOffset = p.originalOffset.clone()
        .multiplyScalar(1 + jitter)
        .applyAxisAngle(p.axis, time * p.rotationSpeed)
        .applyEuler(new THREE.Euler(
          cluster.swirlRotation.x + time * cluster.swirlSpeed,
          cluster.swirlRotation.y + time * cluster.swirlSpeed * 0.5,
          cluster.swirlRotation.z + time * cluster.swirlSpeed * 0.2
        ));
      
      const depthFactor = THREE.MathUtils.mapLinear(cluster.position.z, -100, -10, 0.1, 1.0);
      if (isHIIT) {
        tempColor.copy(phaseColor).multiplyScalar(depthFactor);
      } else {
        tempColor.copy(colors[p.clusterIndex]).multiplyScalar(depthFactor);
      }
      
      dummy.position.copy(cluster.position).addScaledVector(rotatedOffset, pulseFactor);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, tempColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, atmParticleCount]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
};

const OrbitingStars = ({ bpm, phaseColor, isMetronomeEnabled, metronomeBeat, explosionTrigger, metronomeStartTime }: { bpm: number, phaseColor: THREE.Color, isMetronomeEnabled: boolean, metronomeBeat: number, explosionTrigger: number, metronomeStartTime: number | null }) => {
  const star1Ref = useRef<THREE.Mesh>(null);
  const star2Ref = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const explosionPulseTime = useRef(0);

  React.useEffect(() => {
    if (explosionTrigger > 0) {
      explosionPulseTime.current = 1.0;
    }
  }, [explosionTrigger]);

  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.65, 'rgba(255, 255, 255, 1)');   // Solid core
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');  // Defined edge
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');      // Subtle glow
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  const coronaTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state, delta) => {
    explosionPulseTime.current = Math.max(0, explosionPulseTime.current - delta * 1.5);
    
    const effectiveBpm = isMetronomeEnabled ? bpm : 60;
    const omega = (Math.PI * effectiveBpm) / 60;
    
    // Smooth angle derived from clock or metronome start
    let currentAngle;
    if (isMetronomeEnabled && metronomeStartTime !== null) {
      const elapsed = (performance.now() - metronomeStartTime) / 1000;
      currentAngle = elapsed * omega;
    } else {
      currentAngle = state.clock.getElapsedTime() * omega;
    }
    
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    const pulseStrength = easeOutQuint(explosionPulseTime.current);
    
    // Lock to eclipse (X=0) when pulse is high
    const targetEclipseAngle = Math.round(currentAngle / Math.PI) * Math.PI;
    const dispAngle = THREE.MathUtils.lerp(currentAngle, targetEclipseAngle, pulseStrength);

    const radius = 6;
    // During supernova, they pull inward completely to merge into a single star
    const currentRadius = radius * (1 - pulseStrength);

    // Eclipse effect for metronome
    const eclipseGlow = Math.pow(Math.abs(Math.cos(currentAngle)), 20) * 0.4;
    
    // Supernova scale
    const supernovaFactor = pulseStrength * 0.5; 
    const baseScale = 1.0 + eclipseGlow + supernovaFactor;

    const tilt = 0.2; 
    const blipIntensity = Math.pow(Math.abs(Math.cos(currentAngle)), 40);
    const blippedColor = phaseColor.clone().lerp(new THREE.Color('#000000'), blipIntensity * 0.6);

    if (star1Ref.current) {
      const x = Math.sin(dispAngle) * currentRadius;
      const z = Math.cos(dispAngle) * currentRadius;
      const y = Math.sin(dispAngle) * currentRadius * tilt;
      star1Ref.current.position.set(x, y, z);
      star1Ref.current.scale.setScalar(baseScale);
      (star1Ref.current.material as THREE.MeshBasicMaterial).color.copy(blippedColor);
    }
    if (star2Ref.current) {
      const x = Math.sin(dispAngle + Math.PI) * currentRadius;
      const z = Math.cos(dispAngle + Math.PI) * currentRadius;
      const y = Math.sin(dispAngle + Math.PI) * currentRadius * tilt;
      star2Ref.current.position.set(x, y, z);
      star2Ref.current.scale.setScalar(baseScale);
      (star2Ref.current.material as THREE.MeshBasicMaterial).color.copy(blippedColor);
    }
    
    if (coronaRef.current) {
      const coronaIntensity = Math.pow(Math.abs(Math.cos(currentAngle)), 80);
      coronaRef.current.scale.setScalar(baseScale * (1 + coronaIntensity * 1.2));
      (coronaRef.current.material as THREE.MeshBasicMaterial).opacity = coronaIntensity * 0.4;
    }
  });

  return (
    <group>
      <mesh ref={star1Ref}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial map={starTexture} color={phaseColor} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={star2Ref}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial map={starTexture} color={phaseColor} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={coronaRef}>
        <planeGeometry args={[5.5, 5.5]} />
        <meshBasicMaterial map={coronaTexture} color={phaseColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const CosmicFlow = ({ phase, isPaused, timeLeft = 0, explosionTrigger = 0, customColor, isDroning = false, bloomIntensity = 1.0, metronomeBeat = 0, status = 'active', isHIIT = false, isMetronomeEnabled = false, bpm = 60, metronomeStartTime = null }: { phase: string | null, isPaused: boolean, timeLeft?: number, explosionTrigger?: number, customColor?: string, isDroning?: boolean, bloomIntensity?: number, metronomeBeat?: number, status?: string, isHIIT?: boolean, isMetronomeEnabled?: boolean, bpm?: number, metronomeStartTime?: number | null }) => {
  const phaseColor = useMemo(() => {
    const color = new THREE.Color();
    if (customColor) color.set(customColor);
    else if (phase === 'Warmup') color.set('#FFFF00'); // Yellow
    else if (phase === 'Hard') color.set('#00FF00'); // Green
    else if (phase === 'Easy') color.set('#FF0000'); // Red
    else if (phase === 'Cooldown') color.set('#0000FF'); // Blue
    else if (phase === 'Set_Active' || phase === 'Superset_Active') color.set('#00E5FF'); // Electric cyan
    else if (phase?.includes('Rest')) color.set('#FF0000'); // Red for any rest period in Sets/Supersets
    else color.set('#ffffff');
    return color;
  }, [phase, customColor]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 25], fov: 60 }} gl={{ alpha: true }}>
        <DeepField phase={phase} status={status} />
        <CosmicAtmosphere isHIIT={isHIIT} isMetronomeEnabled={isMetronomeEnabled} metronomeBeat={metronomeBeat} explosionTrigger={explosionTrigger} phase={phase} phaseColor={phaseColor} timeLeft={timeLeft} />
        {isHIIT && (
          <OrbitingStars bpm={bpm} phaseColor={phaseColor} isMetronomeEnabled={isMetronomeEnabled} metronomeBeat={metronomeBeat} explosionTrigger={explosionTrigger} metronomeStartTime={metronomeStartTime} />
        )}
        <EffectComposer multisampling={4}>
          <Bloom 
            luminanceThreshold={0.2} 
            luminanceSmoothing={0.9} 
            intensity={1.8 * bloomIntensity} 
            radius={0.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
