import type { DayPeriod } from '../models/hero-scene.model';

export interface HeroThreeStage {
  setScene(period: DayPeriod, sceneIndex: number): void;
  setPointer(nx: number, ny: number): void;
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

const PALETTES: Readonly<Record<DayPeriod, PeriodPalette>> = {
  morning: {
    primary: 0xf59e0b,
    secondary: 0x14b8a6,
    accent: 0xfde68a,
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
    secondary: 0xec4899,
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

export async function mountHeroThreeStage(
  canvas: HTMLCanvasElement,
  initialPeriod: DayPeriod,
  initialIndex: number,
  reducedMotion: boolean,
): Promise<HeroThreeStage | null> {
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
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  // Position sculpture slightly right so the left-aligned hero copy stays unobstructed.
  const cluster = new THREE.Group();
  cluster.position.set(1.85, 0.15, 0);
  scene.add(cluster);

  const palette = PALETTES[initialPeriod];

  const outerGeo = new THREE.IcosahedronGeometry(1.55, 1);
  const outerMat = new THREE.MeshBasicMaterial({
    color: palette.primary,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  cluster.add(outerMesh);

  const coreGeo = new THREE.IcosahedronGeometry(0.88, 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: palette.secondary,
    wireframe: true,
    transparent: true,
    opacity: 0.65,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  cluster.add(coreMesh);

  const ringGeo = new THREE.TorusGeometry(2.15, 0.018, 12, 72);
  const ringMatA = new THREE.MeshBasicMaterial({
    color: palette.accent,
    transparent: true,
    opacity: 0.48,
  });
  const ringA = new THREE.Mesh(ringGeo, ringMatA);
  ringA.rotation.set(Math.PI / 3, 0.3, 0);
  cluster.add(ringA);

  const ringMatB = new THREE.MeshBasicMaterial({
    color: palette.secondary,
    transparent: true,
    opacity: 0.35,
  });
  const ringB = new THREE.Mesh(ringGeo, ringMatB);
  ringB.scale.setScalar(1.18);
  ringB.rotation.set(-Math.PI / 4, -0.5, 0.4);
  cluster.add(ringB);

  const particleCount = 110;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const theta = (i / particleCount) * Math.PI * 2;
    const radius = 2.4 + (i % 7) * 0.48;
    positions[i * 3] = Math.cos(theta * 3) * radius - 0.6;
    positions[i * 3 + 1] = Math.sin(theta * 2) * (radius * 0.45);
    positions[i * 3 + 2] = Math.sin(theta * 5) * 1.4 - 0.5;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: palette.particles,
    size: 0.055,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true,
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

  const targetPrimary = new THREE.Color(palette.primary);
  const targetSecondary = new THREE.Color(palette.secondary);
  const targetAccent = new THREE.Color(palette.accent);
  const targetParticles = new THREE.Color(palette.particles);

  const startTime = performance.now();

  const renderFrame = (now: number): void => {
    const elapsed = (now - startTime) * 0.001;

    currentPointerX += (targetPointerX - currentPointerX) * 0.06;
    currentPointerY += (targetPointerY - currentPointerY) * 0.06;
    pulseBoost *= 0.92;

    outerMat.color.lerp(targetPrimary, 0.08);
    coreMat.color.lerp(targetSecondary, 0.08);
    ringMatA.color.lerp(targetAccent, 0.08);
    ringMatB.color.lerp(targetSecondary, 0.08);
    particleMat.color.lerp(targetParticles, 0.08);

    const breathe = 1 + Math.sin(elapsed * 1.5) * 0.045 + pulseBoost * 0.14;
    cluster.scale.setScalar(breathe);

    outerMesh.rotation.y = elapsed * 0.22 + sceneTwist + currentPointerX * 0.55;
    outerMesh.rotation.x = elapsed * 0.14 + currentPointerY * 0.4;

    coreMesh.rotation.y = -elapsed * 0.34 - currentPointerX * 0.35;
    coreMesh.rotation.z = elapsed * 0.18 + currentPointerY * 0.3;

    ringA.rotation.z = elapsed * 0.25 + sceneTwist;
    ringB.rotation.z = -elapsed * 0.18 - sceneTwist * 0.5;

    particles.rotation.y = elapsed * 0.06 + currentPointerX * 0.18;
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
      targetPrimary.setHex(next.primary);
      targetSecondary.setHex(next.secondary);
      targetAccent.setHex(next.accent);
      targetParticles.setHex(next.particles);
      sceneTwist = sceneIndex * 0.65;
      pulseBoost = 1;
      if (reducedMotion && !disposed) {
        outerMat.color.copy(targetPrimary);
        coreMat.color.copy(targetSecondary);
        ringMatA.color.copy(targetAccent);
        ringMatB.color.copy(targetSecondary);
        particleMat.color.copy(targetParticles);
        renderFrame(performance.now());
      }
    },
    setPointer: (nx: number, ny: number) => {
      targetPointerX = nx;
      targetPointerY = ny;
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
      camera.position.x = nextWidth < 520 ? -0.45 : 0;
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
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    },
  };
}
