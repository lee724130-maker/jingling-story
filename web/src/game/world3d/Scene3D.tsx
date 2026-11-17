/* 精灵物语 · 第三人称 3D 世界场景（React Three Fiber）
 * 逻辑仍由 GameEngine 驱动（像素坐标），本组件只做渲染；战斗/过场仍走原有 2D overlay。
 * v2：玩家/NPC 改用带骨骼动画的 3D 人物模型，支持点击地面寻路、点击 NPC/野怪/出口交互。 */
import React, { Suspense, useMemo, useRef, useCallback, useEffect, useState, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text, useTexture, useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { GameEngine, WildSpirit } from '../engine';
import { ART, SPIRIT_CELL, MONSTERS, TILE } from '../config';
import { MAPS, type MapId, type NpcDef } from '@shared/maps';
import { pxToWorld, worldToPx, worldSpanX, worldSpanY, PX_W, PX_H } from './coords';
import { useBillboardTexture } from './useBillboardTexture';

const HERO_URL = '/models/characters/hero.glb';
useGLTF.preload(HERO_URL);

/* ==================== 带骨骼动画的 3D 人物 ==================== */
/** 动画名映射：逻辑态 → Soldier 模型剪辑名（首字母大写 Idle/Walk/Run） */
const ANIM_CLIP: Record<string, string> = { Idle: 'Idle', Walking: 'Walk', Running: 'Run' };

/** 克隆材质，保留模型自带纹理质感；可选轻微色调区分角色（与纹理相乘，不覆盖贴图） */
function cloneMaterial(mat: THREE.Material, tint?: string): THREE.Material {
  const m = mat.clone();
  if (tint) {
    const mm = m as THREE.MeshStandardMaterial;
    // color 与 map 相乘：轻微染色既保留纹理明暗，又能区分角色
    if (mm.color) mm.color.set(tint);
  }
  return m;
}

/** 玩家/NPC 通用模型：加载 hero.glb(带纹理 Soldier)，克隆骨骼与材质，按状态播放 Idle/Walk/Run */
function useHeroModel(tint?: string) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(HERO_URL);
  const { actions } = useAnimations(animations, group);
  const model = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        // 深拷贝材质：SkeletonUtils.clone 只克隆骨骼层级，材质仍共享。
        // tint 可选——不传则完全保留原纹理质感（玩家/NPC 用同一套装甲外观）。
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => cloneMaterial(m, tint));
        } else {
          mesh.material = cloneMaterial(mesh.material, tint);
        }
      }
    });
    // 注意：Soldier 网格是绑定空间坐标(Y -22~21)，不能用 Box3.setFromObject 求脚底，
    // 否则会算出错误高度导致浮空。模型加载后本身脚在 y≈0，保持原点即可。
    return c;
  }, [scene, tint]);
  const currentRef = useRef('');
  const setAnim = useCallback((name: 'Idle' | 'Walking' | 'Running') => {
    if (currentRef.current === name) return;
    const prevName = currentRef.current;
    const clip = ANIM_CLIP[name];
    const next = actions[clip];
    if (!next) return;
    if (prevName && actions[ANIM_CLIP[prevName]]) actions[ANIM_CLIP[prevName]]!.fadeOut(0.18);
    next.reset().fadeIn(0.18).play();
    currentRef.current = name;
  }, [actions]);
  useEffect(() => { setAnim('Idle'); }, [setAnim]);
  return { group, model, setAnim };
}

/** 玩家：跟随 engine.state.player，按 walking/running 切动画，朝向严格跟随实际移动方向 */
function PlayerCharacter({ engine }: { engine: GameEngine }) {
  // 保留Soldier模型自带纹理质感，不再强制染纯色
  const { group, model, setAnim } = useHeroModel();
  useFrame(() => {
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x, p.y);
    if (group.current) {
      group.current.position.set(x, 0, z);
      if (p.walking) {
        // 朝向跟随移动方向，做最短角度插值（处理 ±π 环绕），停止时保持最后朝向。
        // +π 修正：Soldier 模型默认面朝 -Z，而 moveAngle 以 +Z(屏幕下)为 0，需翻转半圈才与实际移动方向一致。
        const want = p.moveAngle + Math.PI;
        let diff = want - group.current.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        group.current.rotation.y += diff * 0.25;
      }
    }
    setAnim(p.running ? 'Running' : p.walking ? 'Walking' : 'Idle');
  });
  return (
    <group ref={group} scale={1.2}>
      <primitive object={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** NPC：固定格子位置，始终待机动画，名字标签，点击触发交互 */
function NpcCharacter({ npc, color, onInteract }: { npc: NpcDef; color: string; onInteract: (n: NpcDef) => void }) {
  // 轻微色调与纹理相乘，既区分角色又保留装甲质感
  const { group, model } = useHeroModel(color);
  const [x, z] = pxToWorld(npc.x * TILE + TILE / 2, npc.y * TILE + TILE / 2 - 4);
  const [hover, setHover] = useState(false);
  return (
    <group position={[x, 0, z]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onInteract(npc); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
      <group ref={group} scale={1.15}><primitive object={model} /></group>
      <Billboard position={[0, 2.35, 0]}>
        <Text fontSize={0.26} color={hover ? '#ffe37a' : '#ffffff'} outlineWidth={0.05} outlineColor="#2a3a2a">{npc.name}</Text>
      </Billboard>
      {hover && <Billboard position={[0, 2.7, 0]}><Text fontSize={0.18} color="#7fffd0" outlineWidth={0.03} outlineColor="#1a3a2a">点击互动</Text></Billboard>}
    </group>
  );
}

const NPC_COLORS: Record<string, string> = {
  elder: '#b98bff', shop: '#ff9d5c', sign: '#5fe0a0', questboard: '#ffe06a'
};

/** 全部 NPC（按当前地图） */
function Npcs({ engine, mapId }: { engine: GameEngine; mapId: MapId }) {
  const list = MAPS[mapId].npcs;
  return <>{list.map(n => (
    <ModelBoundary key={n.id} fallback={null}>
      <NpcCharacter npc={n} color={NPC_COLORS[n.role] || '#ffffff'} onInteract={(npc) => engine.onNpcInteract(npc)} />
    </ModelBoundary>
  ))}</>;
}

/* ==================== 跟随伙伴 / 野怪（AI 广告牌，保留） ==================== */
/** 跟随伙伴：小的 AI 精灵广告牌 */
function Follower({ engine }: { engine: GameEngine }) {
  const group = useRef<THREE.Group>(null);
  const species = engine.save.team[0]?.species || 1;
  const tex = useBillboardTexture(ART.spirits, 'white', SPIRIT_CELL[species] || [0, 0]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x - p.dir * 20, p.y + 14);
    group.current.position.set(x, 0.35 + Math.sin(clock.elapsedTime * 3) * 0.08, z);
  });
  if (!tex) return null;
  return (
    <group ref={group}>
      <Billboard><mesh><planeGeometry args={[0.85, 0.85]} /><meshBasicMaterial map={tex} transparent alphaTest={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh></Billboard>
    </group>
  );
}

/** 野怪：AI 精灵广告牌 + 浮动 + 头顶感叹号；点击后自动走向它 */
function WildMonster({ wild, engine }: { wild: WildSpirit; engine: GameEngine }) {
  const group = useRef<THREE.Group>(null);
  const tex = useBillboardTexture(ART.spirits, 'white', SPIRIT_CELL[wild.species] || [0, 0]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const [x, z] = pxToWorld(wild.x, wild.y);
    group.current.position.set(x, 0.28 + Math.sin(clock.elapsedTime * 2.5 + wild.bob) * 0.1, z);
    group.current.scale.setScalar(wild.alert > 0 ? 1.12 : 1);
  });
  if (!tex) return null;
  return (
    <group ref={group} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); engine.setMoveTarget(wild.x, wild.y, e.shiftKey); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <Billboard><mesh><planeGeometry args={[1.0, 1.0]} /><meshBasicMaterial map={tex} transparent alphaTest={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh></Billboard>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27, 0]}><circleGeometry args={[0.42, 20]} /><meshBasicMaterial color="#000000" transparent opacity={0.2} /></mesh>
      {wild.alert > 0 && <Billboard position={[0, 1.0, 0]}><Text fontSize={0.5} color="#ffd34a" outlineWidth={0.04} outlineColor="#7a4a00">!</Text></Billboard>}
    </group>
  );
}

function WildMonsters({ engine, tick }: { engine: GameEngine; tick: number }) {
  return <>{engine.state.wilds.map(w => <WildMonster key={w.id} wild={w} engine={engine} />)}</>;
}

/* ==================== Kenney CC0 3D 素材（场景模型） ==================== */
const NATURE = {
  oak: '/models/nature/tree_oak.glb', pine: '/models/nature/tree_pineDefaultA.glb',
  detailed: '/models/nature/tree_detailed.glb', default: '/models/nature/tree_default.glb',
  bush: '/models/nature/plant_bush.glb', bushLarge: '/models/nature/plant_bushLarge.glb',
  flowerRed: '/models/nature/flower_redA.glb', flowerYellow: '/models/nature/flower_yellowA.glb',
  flowerPurple: '/models/nature/flower_purpleA.glb', grass: '/models/nature/grass.glb',
  rockLarge: '/models/nature/rock_largeA.glb', rockSmall: '/models/nature/rock_smallA.glb'
};
const TOWN = {
  stall: '/models/town/stall.glb', stallGreen: '/models/town/stall-green.glb',
  fountain: '/models/town/fountain-round.glb', lantern: '/models/town/lantern.glb',
  fence: '/models/town/fence.glb', tree: '/models/town/tree.glb', rock: '/models/town/rock-large.glb'
};
useGLTF.preload(NATURE.oak); useGLTF.preload(NATURE.pine);
useGLTF.preload(TOWN.stall); useGLTF.preload(TOWN.fountain);

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* 静默回退 */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Model({ url, scale = 1, rotation = 0, position = [0, 0, 0] }: {
  url: string; scale?: number; rotation?: number; position?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} rotation={[0, rotation, 0]} scale={scale} castShadow receiveShadow />;
}

function FallbackTree({ s }: { s: number }) {
  return <group scale={s}>
    <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.1, 0.14, 1, 6]} /><meshLambertMaterial color="#7a5230" /></mesh>
    <mesh position={[0, 1.3, 0]} castShadow><coneGeometry args={[0.7, 1.5, 7]} /><meshLambertMaterial color="#2f8f5c" /></mesh>
    <mesh position={[0, 1.9, 0]} castShadow><coneGeometry args={[0.5, 1.1, 7]} /><meshLambertMaterial color="#38a568" /></mesh>
  </group>;
}

function Trees({ count, village = false }: { count: number; village?: boolean }) {
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number; url: string; kind: number }[] = [];
    let seed = village ? 77 : 42;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const urls = village ? [TOWN.tree, NATURE.oak, NATURE.detailed] : [NATURE.oak, NATURE.pine, NATURE.detailed, NATURE.default];
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * worldSpanX(PX_W) * 1.05;
      const z = (rnd() - 0.5) * worldSpanY(PX_H) * 1.05;
      const s = 0.75 + rnd() * 0.6;
      arr.push({ x, z, s, url: urls[Math.floor(rnd() * urls.length)], kind: Math.floor(rnd() * 3) });
    }
    return arr;
  }, [count, village]);
  return <>{items.map((t, i) => (
    <ModelBoundary key={i} fallback={<group position={[t.x, 0, t.z]}><FallbackTree s={t.s} /></group>}>
      <group position={[t.x, 0, t.z]} rotation={[0, t.kind * 1.1, 0]} scale={t.s}><Model url={t.url} /></group>
    </ModelBoundary>
  ))}</>;
}

function Foliage({ village = false }: { village?: boolean }) {
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number; url: string; rot: number }[] = [];
    let seed = village ? 918 : 618;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const urls = [NATURE.bush, NATURE.bushLarge, NATURE.flowerRed, NATURE.flowerYellow, NATURE.flowerPurple, NATURE.grass, NATURE.rockSmall, NATURE.rockLarge];
    const n = village ? 30 : 70;
    for (let i = 0; i < n; i++) {
      arr.push({ x: (rnd() - 0.5) * worldSpanX(PX_W), z: (rnd() - 0.5) * worldSpanY(PX_H),
        s: 0.7 + rnd() * 0.9, url: urls[Math.floor(rnd() * urls.length)], rot: rnd() * Math.PI * 2 });
    }
    return arr;
  }, [village]);
  return <>{items.map((f, i) => (
    <ModelBoundary key={i} fallback={null}><Model url={f.url} position={[f.x, 0, f.z]} scale={f.s} rotation={f.rot} /></ModelBoundary>
  ))}</>;
}

function VillageBuildings() {
  const W = worldSpanX(PX_W), H = worldSpanY(PX_H);
  const deco = useMemo(() => [
    { url: TOWN.stall, x: -W * 0.30, z: -H * 0.24, s: 2.2, rot: 0.3 },
    { url: TOWN.stallGreen, x: W * 0.26, z: -H * 0.26, s: 2.2, rot: -0.4 },
    { url: TOWN.fountain, x: 0, z: H * 0.10, s: 2.0, rot: 0 },
    { url: TOWN.lantern, x: -W * 0.16, z: -H * 0.10, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: W * 0.16, z: -H * 0.10, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: -W * 0.16, z: H * 0.26, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: W * 0.16, z: H * 0.26, s: 2.4, rot: 0 },
    { url: TOWN.rock, x: -W * 0.36, z: H * 0.30, s: 1.6, rot: 1.0 }
  ], [W, H]);
  const fences = useMemo(() => {
    const arr: { x: number; z: number; rot: number }[] = [];
    for (let i = -4; i <= 4; i++) arr.push({ x: i * 1.6, z: -H * 0.40, rot: 0 });
    return arr;
  }, [H]);
  return <>
    {deco.map((d, i) => (
      <ModelBoundary key={i} fallback={<mesh position={[d.x, 0.5, d.z]}><boxGeometry args={[1.5, 1, 1]} /><meshLambertMaterial color="#d9885a" /></mesh>}>
        <Model url={d.url} position={[d.x, 0, d.z]} scale={d.s} rotation={d.rot} />
      </ModelBoundary>
    ))}
    {fences.map((f, i) => (
      <ModelBoundary key={'f' + i} fallback={null}><Model url={TOWN.fence} position={[f.x, 0, f.z]} scale={1.6} rotation={f.rot} /></ModelBoundary>
    ))}
  </>;
}

/** 出口传送门：点击可直接切换区域 */
function ExitPortal({ color, engine }: { color: string; engine: GameEngine }) {
  const exit = MAPS[engine.save.progress.map as MapId]?.exits[0];
  const [hover, setHover] = useState(false);
  return <group position={[0, 0, -worldSpanY(PX_H) * 0.42]}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (exit) engine.switchMap(exit.to, exit.spawn); }}
    onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
    <mesh position={[0, 1.1, 0]}>
      <torusGeometry args={[1.0, 0.14, 8, 24]} />
      <meshLambertMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.7 : 0.35} />
    </mesh>
    <Billboard position={[0, 2.5, 0]}><Text fontSize={0.42} color="#ffffff" outlineWidth={0.05} outlineColor="#333">{exit ? '出口 · ' + exit.label : '出口'}</Text></Billboard>
  </group>;
}

/** 地面：AI 草地纹理 + 水面；点击地面设置寻路目标 */
function Ground({ tint, useTextureMap, engine }: { tint: string; useTextureMap: boolean; engine: GameEngine }) {
  const grass = useTexture(ART.sceneGrass);
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(6, 4);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.needsUpdate = true;
  const W = worldSpanX(PX_W), H = worldSpanY(PX_H);
  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const [px, py] = worldToPx(e.point.x, e.point.z);
    engine.setMoveTarget(px, py, e.shiftKey);
  };
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onGroundClick}>
        <planeGeometry args={[W, H]} />
        {useTextureMap ? <meshLambertMaterial map={grass} /> : <meshLambertMaterial color={tint} />}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow onClick={onGroundClick}>
        <planeGeometry args={[W * 1.5, H * 1.6]} />
        <meshLambertMaterial color={useTextureMap ? '#4f9c47' : tint} />
      </mesh>
      {[
        { p: [0, 0, -H / 2 - 1.5] as [number, number, number], s: [W + 6, 3] as [number, number] },
        { p: [0, 0, H / 2 + 1.5] as [number, number, number], s: [W + 6, 3] as [number, number] },
        { p: [-W / 2 - 1.5, 0, 0] as [number, number, number], s: [3, H + 6] as [number, number] },
        { p: [W / 2 + 1.5, 0, 0] as [number, number, number], s: [3, H + 6] as [number, number] }
      ].map((w, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={w.p}>
          <planeGeometry args={w.s} /><meshLambertMaterial color="#3b86c4" transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

function Sky() {
  const tex = useTexture(ART.sceneSky);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const R = 70;
  return <mesh position={[0, 8, 0]}>
    <cylinderGeometry args={[R, R, 60, 48, 1, true]} />
    <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
  </mesh>;
}

function FollowCamera({ engine }: { engine: GameEngine }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(() => {
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x, p.y);
    target.current.set(x, 1.4, z - 2.5);
    const desired = new THREE.Vector3(x, 7.2, z + 14);
    camera.position.lerp(desired, 0.12);
    camera.lookAt(target.current);
  });
  return null;
}

function World({ engine, wildTick, mapId }: { engine: GameEngine; wildTick: number; mapId: MapId }) {
  const isVillage = mapId === 'qingya';
  const cfg = isVillage
    ? { ground: '#8fce74', trees: 20, portal: '#f0b95c' }
    : { ground: '#6cbf5a', trees: 42, portal: '#5fd0a6' };
  return (
    <>
      <color attach="background" args={['#8fd3f4']} />
      <fog attach="fog" args={['#bfe3f0', 30, 58]} />
      <hemisphereLight args={['#ffffff', '#5a8f4a', 1.15]} />
      <directionalLight position={[10, 18, 8]} intensity={1.1} castShadow />
      <Suspense fallback={<mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[200, 200]} /><meshLambertMaterial color="#6cbf5a" /></mesh>}>
        <Sky />
        <Ground key={mapId} tint={cfg.ground} useTextureMap={!isVillage} engine={engine} />
      </Suspense>
      <Suspense fallback={null}>
        <Trees count={cfg.trees} village={isVillage} />
        <Foliage village={isVillage} />
        {isVillage && <VillageBuildings />}
        <ModelBoundary fallback={null}><Npcs engine={engine} mapId={mapId} /></ModelBoundary>
        <ModelBoundary fallback={null}><PlayerCharacter engine={engine} /></ModelBoundary>
      </Suspense>
      {!isVillage && <WildMonsters engine={engine} tick={wildTick} />}
      <ExitPortal color={cfg.portal} engine={engine} />
      <Follower engine={engine} />
      <FollowCamera engine={engine} />
    </>
  );
}

export default function Scene3D({ engine, wildTick }: { engine: GameEngine; wildTick: number }) {
  const mapId = (engine.save.progress.map || 'qingya') as MapId;
  return (
    <Canvas key={mapId} shadows dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 9.5, 11], near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <World engine={engine} wildTick={wildTick} mapId={mapId} />
    </Canvas>
  );
}
