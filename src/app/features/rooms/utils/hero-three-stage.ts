import type { DayPeriod } from '../models/hero-scene.model';

export interface HeroThreeStage {
  setScene(period: DayPeriod, sceneIndex: number): void;
  setLiveEnergy(liveCount: number): void;
  setPointer(nx: number, ny: number): void;
  triggerPulse(strength?: number): void;
  setVisible(visible: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

interface PeriodPalette {
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly particles: number;
}

interface ScenePreset {
  readonly cameraZ: number;
  readonly cameraY: number;
  readonly ringTiltX: number;
  readonly ringTiltY: number;
  readonly waveSpeed: number;
}

const PALETTES: Readonly<Record<DayPeriod, PeriodPalette>> = {
  morning: {
    primary: 0xf59e0b,
    secondary: 0x2dd4bf,
    accent: 0xfef08a,
    particles: 0xfef3c7,
  },
  afternoon: {
    primary: 0x38bdf8,
    secondary: 0x2dd4bf,
    accent: 0xe0f2fe,
    particles: 0xbae6fd,
  },
  evening: {
    primary: 0xf97316,
    secondary: 0xf472b6,
    accent: 0xfed7aa,
    particles: 0xfde68a,
  },
  night: {
    primary: 0x818cf8,
    secondary: 0x38bdf8,
    accent: 0xc4b5fd,
    particles: 0xe0e7ff,
  },
};

const SCENE_PRESETS: readonly [ScenePreset, ...ScenePreset[]] = [
  { cameraZ: 7.2, cameraY: 0.0, ringTiltX: Math.PI / 3, ringTiltY: 0.3, waveSpeed: 1.0 },
  { cameraZ: 6.7, cameraY: 0.45, ringTiltX: Math.PI / 4.5, ringTiltY: -0.45, waveSpeed: 1.25 },
  { cameraZ: 7.5, cameraY: -0.35, ringTiltX: Math.PI / 2.4, ringTiltY: 0.65, waveSpeed: 0.9 },
  { cameraZ: 6.9, cameraY: 0.25, ringTiltX: -Math.PI / 3.2, ringTiltY: 0.25, waveSpeed: 1.35 },
  { cameraZ: 7.3, cameraY: -0.2, ringTiltX: Math.PI / 5, ringTiltY: -0.7, waveSpeed: 1.1 },
  { cameraZ: 6.8, cameraY: 0.55, ringTiltX: -Math.PI / 2.6, ringTiltY: 0.5, waveSpeed: 1.2 },
];

export async function mountHeroThreeStage(
  canvas: HTMLCanvasElement,
  initialPeriod: DayPeriod,
  initialIndex: number,
  reducedMotion: boolean,
): Promise<HeroThreeStage | null> {
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) {
    return null;
  }

  let THREE: typeof import('three');
  try {
    THREE = await import('three');
  } catch {
    return null;
  }

  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const preset = SCENE_PRESETS[initialIndex % SCENE_PRESETS.length] ?? SCENE_PRESETS[0];
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, preset.cameraY, preset.cameraZ);

  // Offset sculpture right so left-aligned hero copy remains unobstructed.
  const cluster = new THREE.Group();
  cluster.position.set(1.9, 0.12, 0);
  scene.add(cluster);

  const palette = PALETTES[initialPeriod];

  // 1. Vertex-displaced acoustic wireframe outer shell
  const outerGeo = new THREE.IcosahedronGeometry(1.48, 2);
  const outerPosAttr = outerGeo.getAttribute('position');
  const baseOuterPositions =
    outerPosAttr instanceof THREE.BufferAttribute && outerPosAttr.array instanceof Float32Array
      ? new Float32Array(outerPosAttr.array)
      : new Float32Array();
  const outerMat = new THREE.MeshBasicMaterial({
    color: palette.primary,
    wireframe: true,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  cluster.add(outerMesh);

  // 2. Luminous inner geometric core
  const coreGeo = new THREE.IcosahedronGeometry(0.76, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: palette.secondary,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  cluster.add(coreMesh);

  // 3. Dual orbital rings
  const ringGeo = new THREE.TorusGeometry(2.12, 0.016, 12, 84);
  const ringMatA = new THREE.MeshBasicMaterial({
    color: palette.accent,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringA = new THREE.Mesh(ringGeo, ringMatA);
  ringA.rotation.set(preset.ringTiltX, preset.ringTiltY, 0);
  cluster.add(ringA);

  const ringMatB = new THREE.MeshBasicMaterial({
    color: palette.secondary,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringB = new THREE.Mesh(ringGeo, ringMatB);
  ringB.scale.setScalar(1.22);
  ringB.rotation.set(-preset.ringTiltX * 0.75, -preset.ringTiltY, 0.4);
  cluster.add(ringB);

  // 4. Radial 3D voice-equalizer bars (single InstancedMesh draw call)
  const barCount = 28;
  const barGeo = new THREE.BoxGeometry(0.055, 0.32, 0.055);
  const barMat = new THREE.MeshBasicMaterial({
    color: palette.accent,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const barsMesh = new THREE.InstancedMesh(barGeo, barMat, barCount);
  const eqRingGroup = new THREE.Group();
  eqRingGroup.rotation.set(Math.PI / 2.6, 0.15, 0);
  eqRingGroup.add(barsMesh);
  cluster.add(eqRingGroup);

  const dummy = new THREE.Object3D();
  const eqRadius = 1.82;

  // 5. Ambient floating acoustic particles
  const particleCount = 130;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const theta = (i / particleCount) * Math.PI * 2;
    const radius = 2.1 + (i % 9) * 0.42;
    positions[i * 3] = Math.cos(theta * 3) * radius - 0.5;
    positions[i * 3 + 1] = Math.sin(theta * 2) * (radius * 0.42);
    positions[i * 3 + 2] = Math.sin(theta * 5) * 1.5 - 0.4;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: palette.particles,
    size: 0.055,
    transparent: true,
    opacity: 0.74,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  let disposed = false;
  let visible = true;
  let rafId = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let currentPointerX = 0;
  let currentPointerY = 0;
  let sceneTwist = initialIndex * 0.55;
  let pulseBoost = 0;
  let liveEnergy = 0.25;
  let targetCameraZ = preset.cameraZ;
  let targetCameraY = preset.cameraY;
  let targetRingTiltX = preset.ringTiltX;
  let targetRingTiltY = preset.ringTiltY;
  let waveSpeed = preset.waveSpeed;

  const targetPrimary = new THREE.Color(palette.primary);
  const targetSecondary = new THREE.Color(palette.secondary);
  const targetAccent = new THREE.Color(palette.accent);
  const targetParticles = new THREE.Color(palette.particles);

  const startTime = performance.now();

  const updateEqualizerBars = (elapsed: number, energy: number): void => {
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const wave =
        Math.sin(elapsed * 2.8 * waveSpeed + i * 0.65) * 0.5 +
        Math.cos(elapsed * 1.9 - i * 0.4) * 0.5;
      const scaleY = 0.45 + Math.max(0, wave) * (0.95 + energy * 0.9 + pulseBoost * 1.1);
      dummy.position.set(Math.cos(angle) * eqRadius, 0, Math.sin(angle) * eqRadius);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      barsMesh.setMatrixAt(i, dummy.matrix);
    }
    barsMesh.instanceMatrix.needsUpdate = true;
  };

  const updateAcousticShell = (elapsed: number, energy: number): void => {
    if (
      !(outerPosAttr instanceof THREE.BufferAttribute) ||
      !(outerPosAttr.array instanceof Float32Array) ||
      baseOuterPositions.length === 0
    ) {
      return;
    }
    const arr = outerPosAttr.array;
    const amp = 0.045 + energy * 0.035 + pulseBoost * 0.08;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = baseOuterPositions[i] ?? 0;
      const by = baseOuterPositions[i + 1] ?? 0;
      const bz = baseOuterPositions[i + 2] ?? 0;
      const ripple = Math.sin(bx * 2.4 + elapsed * 1.8 * waveSpeed) * Math.cos(by * 2.2 - elapsed);
      const factor = 1 + ripple * amp;
      arr[i] = bx * factor;
      arr[i + 1] = by * factor;
      arr[i + 2] = bz * factor;
    }
    outerPosAttr.needsUpdate = true;
  };

  const renderFrame = (now: number): void => {
    const elapsed = (now - startTime) * 0.001;

    currentPointerX += (targetPointerX - currentPointerX) * 0.065;
    currentPointerY += (targetPointerY - currentPointerY) * 0.065;
    pulseBoost *= 0.92;

    camera.position.z += (targetCameraZ - camera.position.z) * 0.06;
    camera.position.y += (targetCameraY + currentPointerY * 0.25 - camera.position.y) * 0.06;
    camera.lookAt(cluster.position.x * 0.28, 0, 0);

    outerMat.color.lerp(targetPrimary, 0.08);
    coreMat.color.lerp(targetSecondary, 0.08);
    ringMatA.color.lerp(targetAccent, 0.08);
    ringMatB.color.lerp(targetSecondary, 0.08);
    barMat.color.lerp(targetAccent, 0.08);
    particleMat.color.lerp(targetParticles, 0.08);

    const breathe = 1 + Math.sin(elapsed * 1.4) * 0.04 + pulseBoost * 0.12;
    cluster.scale.setScalar(breathe);

    updateAcousticShell(elapsed, liveEnergy);
    updateEqualizerBars(elapsed, liveEnergy);

    outerMesh.rotation.y = elapsed * 0.18 + sceneTwist + currentPointerX * 0.55;
    outerMesh.rotation.x = elapsed * 0.11 + currentPointerY * 0.4;

    coreMesh.rotation.y = -elapsed * 0.34 - currentPointerX * 0.38;
    coreMesh.rotation.z = elapsed * 0.18 + currentPointerY * 0.28;

    ringA.rotation.x += (targetRingTiltX + currentPointerY * 0.22 - ringA.rotation.x) * 0.06;
    ringA.rotation.y += (targetRingTiltY + currentPointerX * 0.28 - ringA.rotation.y) * 0.06;
    ringA.rotation.z = elapsed * 0.22 + sceneTwist;

    ringB.rotation.z = -elapsed * 0.16 - sceneTwist * 0.5;
    eqRingGroup.rotation.y = elapsed * 0.14 + currentPointerX * 0.25;

    particles.rotation.y = elapsed * 0.055 + currentPointerX * 0.18;
    particles.rotation.x = currentPointerY * 0.12;

    renderer.render(scene, camera);
  };

  const loop = (now: number): void => {
    if (disposed || !visible) {
      rafId = 0;
      return;
    }
    renderFrame(now);
    rafId = window.requestAnimationFrame(loop);
  };

  const startLoop = (): void => {
    if (disposed || !visible) return;
    if (reducedMotion) {
      renderFrame(performance.now());
      return;
    }
    if (!rafId) {
      rafId = window.requestAnimationFrame(loop);
    }
  };

  startLoop();

  return {
    setScene: (period: DayPeriod, sceneIndex: number) => {
      const next = PALETTES[period];
      const nextPreset = SCENE_PRESETS[sceneIndex % SCENE_PRESETS.length] ?? SCENE_PRESETS[0];
      targetPrimary.setHex(next.primary);
      targetSecondary.setHex(next.secondary);
      targetAccent.setHex(next.accent);
      targetParticles.setHex(next.particles);
      targetCameraZ = nextPreset.cameraZ;
      targetCameraY = nextPreset.cameraY;
      targetRingTiltX = nextPreset.ringTiltX;
      targetRingTiltY = nextPreset.ringTiltY;
      waveSpeed = nextPreset.waveSpeed;
      sceneTwist = sceneIndex * 0.65;
      pulseBoost = 1;
      if (reducedMotion && !disposed) {
        outerMat.color.copy(targetPrimary);
        coreMat.color.copy(targetSecondary);
        ringMatA.color.copy(targetAccent);
        ringMatB.color.copy(targetSecondary);
        barMat.color.copy(targetAccent);
        particleMat.color.copy(targetParticles);
        renderFrame(performance.now());
      }
    },
    setLiveEnergy: (liveCount: number) => {
      liveEnergy = liveCount <= 0 ? 0.15 : Math.min(1, 0.35 + liveCount * 0.12);
    },
    setPointer: (nx: number, ny: number) => {
      targetPointerX = nx;
      targetPointerY = ny;
    },
    triggerPulse: (strength = 0.85) => {
      pulseBoost = Math.max(pulseBoost, strength);
    },
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      if (visible) {
        startLoop();
      } else if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    resize: (nextWidth: number, nextHeight: number) => {
      if (disposed || nextWidth <= 0 || nextHeight <= 0) return;
      camera.aspect = nextWidth / nextHeight;
      cluster.position.x = nextWidth < 560 ? 1.15 : 1.9;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(nextWidth, nextHeight, false);
      if (reducedMotion) renderFrame(performance.now());
    },
    dispose: () => {
      disposed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      outerGeo.dispose();
      outerMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMatA.dispose();
      ringMatB.dispose();
      barGeo.dispose();
      barMat.dispose();
      barsMesh.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    },
  };
}
