import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  createAuthTerminalModel,
  disposeAuthTerminalModel,
} from "@/components/auth/terminal-3d/createAuthTerminalModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthTerminalMode = "signin" | "signup";

export type AuthTerminal3DProps = {
  locked: boolean;
  exiting: boolean;
  onExitComplete?: () => void;
  onSignIn: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignUp: (e: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
};

/**
 * Terminal 3D procedural (estilo img2threejs) + formulário HTML interativo por cima.
 * No sucesso (`exiting`), anima a saída e chama onExitComplete.
 */
export function AuthTerminal3D(props: AuthTerminal3DProps) {
  const [mode, setMode] = useState<AuthTerminalMode>("signin");
  const [webglOk, setWebglOk] = useState(true);
  const mountRef = useRef<HTMLDivElement>(null);
  const exitingRef = useRef(props.exiting);
  const onExitCompleteRef = useRef(props.onExitComplete);
  const exitDone = useRef(false);

  exitingRef.current = props.exiting;
  onExitCompleteRef.current = props.onExitComplete;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (props.exiting && (!webglOk || reduced)) {
      const id = window.setTimeout(() => {
        if (!exitDone.current) {
          exitDone.current = true;
          onExitCompleteRef.current?.();
        }
      }, 220);
      return () => window.clearTimeout(id);
    }
  }, [props.exiting, webglOk, reduced]);

  useEffect(() => {
    if (reduced) {
      setWebglOk(false);
      return;
    }

    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglOk(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 0.05, 2.55);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const key = new THREE.DirectionalLight(0xfff2e0, 0.9);
    key.position.set(2.5, 3, 4);
    const fill = new THREE.DirectionalLight(0x6a8cff, 0.3);
    fill.position.set(-2, -1, 2);
    const accent = new THREE.PointLight(0xfc6e20, 0.35, 6);
    accent.position.set(0, 0.2, 1.2);
    scene.add(ambient, key, fill, accent);

    const root = new THREE.Group();
    const model = createAuthTerminalModel({ scale: 1.05 });
    root.add(model);
    scene.add(root);

    const pointer = { x: 0, y: 0 };
    function onMove(e: PointerEvent) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onMove);

    let exitT = 0;
    let frame = 0;
    let last = performance.now();
    let alive = true;

    function resize() {
      if (!mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    function animate(now: number) {
      if (!alive) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const tick = model.userData.tick as ((d: number) => void) | undefined;
      tick?.(dt);

      if (exitingRef.current) {
        exitT = Math.min(1, exitT + dt * 1.35);
        const ease = exitT * exitT * (3 - 2 * exitT);
        root.position.z = -0.2 - ease * 2.4;
        root.rotation.x = ease * 0.35;
        root.scale.setScalar(1 - ease * 0.35);
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat && "opacity" in mat) {
              mat.transparent = true;
              (mat as THREE.Material & { opacity: number }).opacity = 1 - ease;
            }
          }
        });
        if (exitT >= 1 && !exitDone.current) {
          exitDone.current = true;
          onExitCompleteRef.current?.();
        }
      } else {
        const targetY = pointer.x * 0.12;
        const targetX = -pointer.y * 0.08;
        root.rotation.y += (targetY - root.rotation.y) * Math.min(1, dt * 4);
        root.rotation.x += (targetX - root.rotation.x) * Math.min(1, dt * 4);
      }

      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(animate);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      disposeAuthTerminalModel(model);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reduced]);

  if (!webglOk || reduced) {
    return (
      <div
        className={`w-full max-w-sm transition-all duration-500 ${
          props.exiting ? "scale-90 opacity-0" : "opacity-100"
        }`}
      >
        <div className="rounded-lg border border-[#FC6E20]/40 bg-card/90 p-5 shadow-elevated backdrop-blur-sm">
          <AuthTerminalForm
            mode={mode}
            setMode={setMode}
            locked={props.locked || props.exiting}
            onSignIn={props.onSignIn}
            onSignUp={props.onSignUp}
            onGoogle={props.onGoogle}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-terminal-stage relative h-[min(640px,78dvh)] w-full max-w-lg">
      <div ref={mountRef} className="absolute inset-0" aria-hidden />
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-8 transition-opacity duration-500 ${
          props.exiting ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          className={`pointer-events-auto w-full max-w-[260px] ${
            props.exiting ? "pointer-events-none" : ""
          }`}
        >
          <AuthTerminalForm
            mode={mode}
            setMode={setMode}
            locked={props.locked || props.exiting}
            onSignIn={props.onSignIn}
            onSignUp={props.onSignUp}
            onGoogle={props.onGoogle}
          />
        </div>
      </div>
    </div>
  );
}

function AuthTerminalForm({
  mode,
  setMode,
  locked,
  onSignIn,
  onSignUp,
  onGoogle,
}: {
  mode: AuthTerminalMode;
  setMode: (m: AuthTerminalMode) => void;
  locked: boolean;
  onSignIn: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignUp: (e: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
}) {
  return (
    <div className="auth-terminal-form font-sans text-[13px] text-[#FFE7D0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={locked}
          onClick={() => setMode("signin")}
          className={`rounded-sm border px-2 py-1.5 text-center text-[11px] uppercase tracking-wider transition ${
            mode === "signin"
              ? "border-[#FC6E20] bg-[#FC6E20]/15 text-[#FC6E20] shadow-[0_0_12px_rgba(252,110,32,0.45)]"
              : "border-white/15 bg-black/55 text-white/50 hover:border-white/30"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => setMode("signup")}
          className={`rounded-sm border px-2 py-1.5 text-center text-[11px] uppercase tracking-wider transition ${
            mode === "signup"
              ? "border-[#FC6E20] bg-[#FC6E20]/15 text-[#FC6E20] shadow-[0_0_12px_rgba(252,110,32,0.45)]"
              : "border-white/15 bg-black/55 text-white/50 hover:border-white/30"
          }`}
        >
          Criar conta
        </button>
      </div>

      {mode === "signin" ? (
        <form onSubmit={onSignIn} className="space-y-2.5">
          <Field label="E-mail" id="email-in">
            <Input
              id="email-in"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={locked}
              className="h-9 rounded-full border-[#FC6E20]/50 bg-black/70 text-sm text-[#FFE7D0] shadow-[inset_0_0_12px_rgba(252,110,32,0.12)] focus-visible:ring-[#FC6E20]"
            />
          </Field>
          <Field label="Senha" id="pass-in">
            <Input
              id="pass-in"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={locked}
              className="h-9 rounded-full border-[#FC6E20]/50 bg-black/70 text-sm text-[#FFE7D0] shadow-[inset_0_0_12px_rgba(252,110,32,0.12)] focus-visible:ring-[#FC6E20]"
            />
          </Field>
          <Button
            type="submit"
            disabled={locked}
            className="mt-1 h-10 w-full rounded-full bg-gradient-to-b from-[#ff8a3d] to-[#FC6E20] text-sm font-semibold text-white shadow-[0_0_18px_rgba(252,110,32,0.55)] hover:brightness-110"
          >
            Entrar
          </Button>
        </form>
      ) : (
        <form onSubmit={onSignUp} className="space-y-2.5">
          <Field label="Nome do herói" id="nome">
            <Input
              id="nome"
              name="nome"
              required
              autoComplete="name"
              disabled={locked}
              className="h-9 rounded-full border-[#FC6E20]/50 bg-black/70 text-sm text-[#FFE7D0] focus-visible:ring-[#FC6E20]"
            />
          </Field>
          <Field label="E-mail" id="email-up">
            <Input
              id="email-up"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={locked}
              className="h-9 rounded-full border-[#FC6E20]/50 bg-black/70 text-sm text-[#FFE7D0] focus-visible:ring-[#FC6E20]"
            />
          </Field>
          <Field label="Senha" id="pass-up">
            <Input
              id="pass-up"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              disabled={locked}
              className="h-9 rounded-full border-[#FC6E20]/50 bg-black/70 text-sm text-[#FFE7D0] focus-visible:ring-[#FC6E20]"
            />
          </Field>
          <Button
            type="submit"
            disabled={locked}
            className="mt-1 h-10 w-full rounded-full bg-gradient-to-b from-[#ff8a3d] to-[#FC6E20] text-sm font-semibold text-white shadow-[0_0_18px_rgba(252,110,32,0.55)] hover:brightness-110"
          >
            Aceitar o chamado
          </Button>
        </form>
      )}

      <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
        <div className="h-px flex-1 bg-[#FC6E20]/35" />
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#FC6E20]/80" />
          ou
          <span className="inline-block size-1.5 rounded-full bg-[#FC6E20]/80" />
        </span>
        <div className="h-px flex-1 bg-[#FC6E20]/35" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={onGoogle}
        className="h-9 w-full rounded-md border-[#FC6E20]/70 bg-black/55 text-[12px] text-[#FC6E20] hover:bg-[#FC6E20]/10 hover:text-[#FC6E20]"
      >
        Continuar com Google
      </Button>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] text-[#FC6E20]">
        {label}
      </Label>
      {children}
    </div>
  );
}
