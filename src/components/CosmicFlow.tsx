import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

const PARTICLE_COUNT = 25000;
const CLUSTER_COUNT = 8;

const DeepField = ({ phase, status }: { phase: string | null, status: string }) => {
  const meshRef = useRef<THREE.Points>(null);
  const starCount = 10000;
  
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

const CosmicAtmosphere = ({ isHIIT, isMetronomeEnabled, metronomeBeat, explosionTrigger, phase, timeLeft = 0 }: { isHIIT: boolean, isMetronomeEnabled: boolean, metronomeBeat: number, explosionTrigger: number, phase: string | null, timeLeft?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport, camera } = useThree();
  const pulseTime = useRef(0);
  const prevTimeLeft = useRef(timeLeft);
  const clusterCount = 12;
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

  const particles = useRef(Array.from({ length: 18000 }, (_, i) => {
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

    // Trigger pulse on every second of timer
    if (Math.floor(timeLeft) !== Math.floor(prevTimeLeft.current) && timeLeft > 0) {
      prevTimeLeft.current = timeLeft;
      pulseTime.current = 1.0;
    }

    pulseTime.current = Math.max(0, pulseTime.current - delta * 2.5); 
    const pulseFactor = 1.0 + Math.sin(pulseTime.current * Math.PI) * 0.4; 

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
      
      // Particle swirl + Cluster swirl
      const rotatedOffset = p.originalOffset.clone()
        .applyAxisAngle(p.axis, time * p.rotationSpeed)
        .applyEuler(new THREE.Euler(
          cluster.swirlRotation.x + time * cluster.swirlSpeed,
          cluster.swirlRotation.y + time * cluster.swirlSpeed * 0.5,
          cluster.swirlRotation.z + time * cluster.swirlSpeed * 0.2
        ));
      
      const depthFactor = THREE.MathUtils.mapLinear(cluster.position.z, -100, -10, 0.1, 1.0);
      tempColor.copy(colors[p.clusterIndex]).multiplyScalar(depthFactor);
      
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, 18000]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
};

export const BpmEngine = ({ isPaused, metronomeBeat, isMetronomeEnabled, phaseColor, explosionTrigger, phase, timeLeft = 0 }: { isPaused: boolean, metronomeBeat: number, isMetronomeEnabled: boolean, phaseColor: THREE.Color, explosionTrigger: number, phase: string | null, timeLeft?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const prevMetronomeBeat = useRef(-1);
  const prevTimeLeft = useRef(timeLeft);
  const pulseTime = useRef(0);
  const explosionPulseTime = useRef(0);

  // Reset on phase change
  React.useEffect(() => {
    pulseTime.current = 0;
    explosionPulseTime.current = 0;
  }, [phase]);

  React.useEffect(() => {
    if (explosionTrigger > 0) {
      explosionPulseTime.current = 1.0;
    }
  }, [explosionTrigger]);

  const clusters = useRef([
    { position: new THREE.Vector3(0, 0, 0) }
  ]);

  const particles = useRef(Array.from({ length: 2400 }, (_, i) => {
    // Using pow(random, 2.5) to pull density towards the center, making a dense core
    const radius = Math.pow(Math.random(), 2.5) * 6.0; 
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const offset = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
    return {
      clusterIndex: 0,
      offset,
      originalOffset: offset.clone(),
      scale: (Math.random() * 0.04 + 0.02) * 1.5, // Even smaller particles
      rotationSpeed: (Math.random() - 0.5) * 2,
      axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
    };
  }));

  useFrame((state, delta) => {
    if (!meshRef.current || !isMetronomeEnabled) return;

    // Trigger pulse on metronome beat
    if (metronomeBeat !== prevMetronomeBeat.current) {
      prevMetronomeBeat.current = metronomeBeat;
      pulseTime.current = 1.0;
    }

    // Trigger pulse on every second of timer if metronome is not already pulsing
    if (Math.floor(timeLeft) !== Math.floor(prevTimeLeft.current) && timeLeft > 0) {
      prevTimeLeft.current = timeLeft;
      if (pulseTime.current < 0.5) pulseTime.current = 1.0;
    }

    pulseTime.current = Math.max(0, pulseTime.current - delta * 3);
    explosionPulseTime.current = Math.max(0, explosionPulseTime.current - delta * 0.2);
    
    const metronomeFactor = Math.sin(pulseTime.current * Math.PI) * 0.3;
    const explosionFactor = Math.sin(explosionPulseTime.current * Math.PI) * 2.0;
    const pulseFactor = 1.0 + metronomeFactor + explosionFactor;

    const dummy = new THREE.Object3D();
    const time = state.clock.getElapsedTime();

    particles.current.forEach((p, i) => {
      const cluster = clusters.current[p.clusterIndex];
      
      // Swirl effect: rotate offset around its axis
      const rotatedOffset = p.originalOffset.clone().applyAxisAngle(p.axis, time * p.rotationSpeed);
      
      dummy.position.copy(cluster.position).addScaledVector(rotatedOffset, pulseFactor);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, phaseColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 2400]}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshBasicMaterial transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
};

export const CosmicFlow = ({ phase, isPaused, timeLeft = 0, explosionTrigger = 0, customColor, isDroning = false, bloomIntensity = 1.0, metronomeBeat = 0, status = 'active', isHIIT = false, isMetronomeEnabled = false }: { phase: string | null, isPaused: boolean, timeLeft?: number, explosionTrigger?: number, customColor?: string, isDroning?: boolean, bloomIntensity?: number, metronomeBeat?: number, status?: string, isHIIT?: boolean, isMetronomeEnabled?: boolean }) => {
  const phaseColor = useMemo(() => {
    const color = new THREE.Color();
    if (customColor) color.set(customColor);
    else if (phase === 'Warmup') color.set('#7FFFD4'); // Aquamarine
    else if (phase === 'Hard') color.set('#00E5FF'); // Electric cyan
    else if (phase === 'Easy') color.set('#00BFA5'); // Borealis teal
    else if (phase === 'Cooldown') color.set('#0047AB'); // Cobalt blue
    else if (phase === 'Set_RepRest' || phase === 'Set_Rest') color.set('#3D5AFE'); // Cosmic indigo
    else if (phase === 'Superset_ExerciseRest' || phase === 'Superset_RoundRest') color.set('#3D5AFE'); // Cosmic indigo
    else color.set('#ffffff');
    return color;
  }, [phase, customColor]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 25], fov: 60 }} gl={{ alpha: true }}>
        <DeepField phase={phase} status={status} />
        <CosmicAtmosphere isHIIT={isHIIT} isMetronomeEnabled={isMetronomeEnabled} metronomeBeat={metronomeBeat} explosionTrigger={explosionTrigger} phase={phase} timeLeft={timeLeft} />
        {isHIIT && isMetronomeEnabled && (
          <BpmEngine isPaused={isPaused} metronomeBeat={metronomeBeat} isMetronomeEnabled={isMetronomeEnabled} phaseColor={phaseColor} explosionTrigger={explosionTrigger} phase={phase} timeLeft={timeLeft} />
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
