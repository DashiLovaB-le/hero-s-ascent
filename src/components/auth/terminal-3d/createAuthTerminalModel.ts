/**
 * Procedural Auth Terminal — rebuilt in code from a single reference image
 * (public/auth-terminal-ref.png), following the img2threejs hard-surface pattern:
 * primitives + materials + named pivots/sockets + idle tick.
 *
 * Faithful to: thick weathered metal bezel, clipped corners feel, recessed glass
 * face with circuit glow, amber LED accents, rivets, right-side status lamp.
 */
import * as THREE from "three";

export type AuthTerminalOptions = {
  /** World width of the outer bezel (default ~1.15). */
  scale?: number;
};

const METAL = 0x1a1a1c;
const METAL_EDGE = 0x2c2c30;
const AMBER = 0xfc6e20;
const AMBER_DIM = 0x8a3a12;
const GLASS = 0x0c0c0e;
const LED_GREEN = 0x3dff7a;

function metalMat(color = METAL, roughness = 0.55, metalness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function emissiveAmber(intensity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color: AMBER,
    emissive: AMBER,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.2,
  });
}

function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: GLASS,
    roughness: 0.35,
    metalness: 0.1,
    transmission: 0.12,
    thickness: 0.4,
    transparent: true,
    opacity: 0.92,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
}

function circuitPlane(): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#080809";
  ctx.fillRect(0, 0, 512, 768);
  ctx.strokeStyle = "rgba(252, 110, 32, 0.35)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 28; i++) {
    const y = 40 + i * 26;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(120 + (i % 5) * 40, y);
    ctx.lineTo(140 + (i % 5) * 40, y + 12);
    ctx.lineTo(480, y + 12);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = 60 + i * 36;
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.lineTo(x, 720);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(252, 110, 32, 0.55)";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(40 + (i * 97) % 440, 50 + (i * 53) % 680, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(AMBER),
    emissiveIntensity: 0.35,
    roughness: 0.8,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.32), mat);
  mesh.name = "circuit-face";
  return mesh;
}

function makeRivet(mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.02, 10), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

/**
 * Factory: returns a THREE.Group ready for R3F / drei Html form socket.
 */
export function createAuthTerminalModel(options: AuthTerminalOptions = {}): THREE.Group {
  const scale = options.scale ?? 1;
  const root = new THREE.Group();
  root.name = "auth-terminal";

  const nodes: Record<string, THREE.Object3D> = {};
  const sockets: Record<string, THREE.Object3D> = {};

  const bezelMat = metalMat(METAL, 0.48, 0.9);
  const rimMat = metalMat(METAL_EDGE, 0.4, 0.95);
  const amberSoft = emissiveAmber(0.45);
  const ledMat = new THREE.MeshStandardMaterial({
    color: LED_GREEN,
    emissive: LED_GREEN,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  // Outer bezel (slightly thicker frame)
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.58, 0.14), bezelMat);
  bezel.name = "bezel";
  bezel.castShadow = true;
  bezel.receiveShadow = true;
  root.add(bezel);
  nodes.bezel = bezel;

  // Inner recess lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.42, 0.04), rimMat);
  lip.position.z = 0.06;
  lip.name = "inner-lip";
  root.add(lip);
  nodes.lip = lip;

  // Amber edge glow strip (between frame and glass)
  const glowStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 1.4, 0.008),
    amberSoft,
  );
  glowStrip.position.z = 0.075;
  glowStrip.name = "amber-strip";
  root.add(glowStrip);

  // Circuit under glass
  const circuit = circuitPlane();
  circuit.position.z = 0.078;
  root.add(circuit);
  nodes.circuit = circuit;

  // Glass panel
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.36, 0.03), glassMat());
  glass.position.z = 0.095;
  glass.name = "glass";
  root.add(glass);
  nodes.glass = glass;

  // Corner rivets
  const rivetMat = metalMat(0x3a3a3e, 0.3, 1);
  const rivetPositions: [number, number, number][] = [
    [-0.48, 0.68, 0.08],
    [0.48, 0.68, 0.08],
    [-0.48, -0.68, 0.08],
    [0.48, -0.68, 0.08],
  ];
  const rivets = new THREE.Group();
  rivets.name = "rivets";
  for (const p of rivetPositions) {
    const r = makeRivet(rivetMat);
    r.position.set(...p);
    rivets.add(r);
  }
  root.add(rivets);
  nodes.rivets = rivets;

  // Right-side status LED + ribbing
  const status = new THREE.Group();
  status.name = "status-rail";
  status.position.set(0.56, 0.35, 0.05);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), ledMat);
  led.name = "status-led";
  status.add(led);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.03), rimMat);
    rib.position.set(0, -0.12 - i * 0.09, 0);
    status.add(rib);
  }
  root.add(status);
  nodes.status = status;

  // Soft point light from amber UI
  const uiLight = new THREE.PointLight(AMBER, 0.55, 2.2, 2);
  uiLight.position.set(0, 0.1, 0.45);
  root.add(uiLight);
  nodes.uiLight = uiLight;

  // Form socket — Html overlay attaches here (front of glass)
  const formSocket = new THREE.Object3D();
  formSocket.name = "form-socket";
  formSocket.position.set(0, 0.02, 0.12);
  root.add(formSocket);
  sockets.form = formSocket;

  // Subtle idle pulse via userData.tick
  let t = 0;
  root.userData.tick = (dt: number) => {
    t += dt;
    ledMat.emissiveIntensity = 1.1 + Math.sin(t * 3.2) * 0.35;
    amberSoft.emissiveIntensity = 0.35 + Math.sin(t * 1.6) * 0.08;
    uiLight.intensity = 0.45 + Math.sin(t * 1.6) * 0.1;
  };

  root.userData.sculptRuntime = {
    nodes,
    sockets,
    materials: { bezel: bezelMat, amber: amberSoft },
    palette: { METAL, AMBER, LED_GREEN },
  };

  root.scale.setScalar(scale);
  return root;
}

/** Dispose geometries/materials on unmount. */
export function disposeAuthTerminalModel(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        const std = m as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.emissiveMap?.dispose();
        m.dispose();
      }
    }
  });
}
