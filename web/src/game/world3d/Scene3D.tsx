/* 精灵物语 · 第三人称 3D 世界场景（React Three Fiber）
 * 逻辑仍由 GameEngine 驱动（像素坐标），本组件只做渲染；战斗/过场仍走原有 2D overlay。 */
import React, { Suspense, useMemo, useRef, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text, useTexture, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { GameEngine, WildSpirit } from '../engine';
import { ART, SPIRIT_CELL, MONSTERS } from '../config';
import { pxToWorld, worldSpanX, worldSpanY, PX_W, PX_H } from './coords';
import { useBillboardTexture } from './useBillboardTexture';

/* ---------- 玩家：AI 立绘广告牌 + 走动摆动 ---------- */
function Player({ engine }: { engine: GameEngine }) {
  const group = useRef<THREE.Group>(null);
  const tex = useBillboardTexture(engine.save.profile.gender === 'female' ? ART.trainerFemale : ART.trainerMale, 'light');
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x, p.y);
    group.current.position.set(x, 0, z);
    const walking = p.walking;
    const t = clock.elapsedTime;
    group.current.children[0].rotation.z = walking ? Math.sin(t * 10) * 0.06 : Math.sin(t * 2) * 0.02;
    group.current.children[0].position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.12 : 0;
  });
  if (!tex) return null;
  return (
    <group ref={group}>
      <Billboard>
        <mesh castShadow>
          <planeGeometry args={[1.5, 2.1]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </Billboard>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/* ---------- 跟随伙伴：小的 AI 精灵广告牌 ---------- */
function Follower({ engine }: { engine: GameEngine }) {
  const group = useRef<THREE.Group>(null);
  const species = engine.save.team[0]?.species || 1;
  const tex = useBillboardTexture(ART.spirits, 'white', SPIRIT_CELL[species] || [0,0]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x - p.dir * 20, p.y + 14);
    group.current.position.set(x, 0.35 + Math.sin(clock.elapsedTime * 3) * 0.08, z);
  });
  if (!tex) return null;
  return (
    <group ref={group}>
      <Billboard>
        <mesh>
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/* ---------- 野怪：AI 精灵广告牌 + 浮动 + 头顶感叹号 ---------- */
function WildMonster({ wild, engine }: { wild: WildSpirit; engine: GameEngine }) {
  const group = useRef<THREE.Group>(null);
  const tex = useBillboardTexture(ART.spirits, 'white', SPIRIT_CELL[wild.species] || [0,0]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const [x, z] = pxToWorld(wild.x, wild.y);
    group.current.position.set(x, 0.28 + Math.sin(clock.elapsedTime * 2.5 + wild.bob) * 0.1, z);
    group.current.scale.setScalar(wild.alert > 0 ? 1.12 : 1);
  });
  if (!tex) return null;
  return (
    <group ref={group}>
      <Billboard>
        <mesh>
          <planeGeometry args={[1.0, 1.0]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </Billboard>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.27, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
      {wild.alert > 0 && (
        <Billboard position={[0, 1.0, 0]}>
          <Text fontSize={0.5} color="#ffd34a" outlineWidth={0.04} outlineColor="#7a4a00">!</Text>
        </Billboard>
      )}
    </group>
  );
}

/* ---------- 野怪列表：每帧从 engine 读取最新位置 ---------- */
function WildMonsters({ engine, tick }: { engine: GameEngine; tick: number }) {
  // tick 来自外部 setState 触发重渲染以增减野怪；位置由 useFrame 每帧直接读 engine
  return <>{engine.state.wilds.map(w => <WildMonster key={w.id} wild={w} engine={engine} />)}</>;
}

/* ---------- Kenney CC0 3D 素材（真实模型替换程序化几何体） ---------- */
const NATURE = {
  oak: '/models/nature/tree_oak.glb',
  pine: '/models/nature/tree_pineDefaultA.glb',
  detailed: '/models/nature/tree_detailed.glb',
  default: '/models/nature/tree_default.glb',
  bush: '/models/nature/plant_bush.glb',
  bushLarge: '/models/nature/plant_bushLarge.glb',
  flowerRed: '/models/nature/flower_redA.glb',
  flowerYellow: '/models/nature/flower_yellowA.glb',
  flowerPurple: '/models/nature/flower_purpleA.glb',
  grass: '/models/nature/grass.glb',
  rockLarge: '/models/nature/rock_largeA.glb',
  rockSmall: '/models/nature/rock_smallA.glb'
};
const TOWN = {
  stall: '/models/town/stall.glb',
  stallGreen: '/models/town/stall-green.glb',
  fountain: '/models/town/fountain-round.glb',
  lantern: '/models/town/lantern.glb',
  fence: '/models/town/fence.glb',
  tree: '/models/town/tree.glb',
  rock: '/models/town/rock-large.glb'
};
// 预加载常用模型，减少首次进入的加载闪烁
useGLTF.preload(NATURE.oak);
useGLTF.preload(NATURE.pine);
useGLTF.preload(TOWN.stall);
useGLTF.preload(TOWN.fountain);

/** 加载失败兜底：渲染程序化圆锥树，保证场景永不空白 */
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* 静默回退 */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** 通用 GLB 模型渲染：useGLTF 克隆场景，统一投影 */
function Model({ url, scale = 1, rotation = 0, position = [0,0,0] }: {
  url: string; scale?: number; rotation?: number; position?: [number,number,number];
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} rotation={[0, rotation, 0]} scale={scale} castShadow receiveShadow />;
}

/** 程序化回退树（模型加载失败时使用） */
function FallbackTree({ s }: { s: number }) {
  return <group scale={s}>
    <mesh position={[0,0.5,0]} castShadow><cylinderGeometry args={[0.1,0.14,1,6]} /><meshLambertMaterial color="#7a5230" /></mesh>
    <mesh position={[0,1.3,0]} castShadow><coneGeometry args={[0.7,1.5,7]} /><meshLambertMaterial color="#2f8f5c" /></mesh>
    <mesh position={[0,1.9,0]} castShadow><coneGeometry args={[0.5,1.1,7]} /><meshLambertMaterial color="#38a568" /></mesh>
  </group>;
}

/* ---------- 树林：Kenney 真实树木模型（多种随机） ---------- */
function Trees({ count, village = false }: { count: number; village?: boolean }) {
  const items = useMemo(() => {
    const arr: {x:number;z:number;s:number;url:string;kind:number}[] = [];
    let seed = village ? 77 : 42;
    const rnd = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; };
    const urls = village ? [TOWN.tree, NATURE.oak, NATURE.detailed] : [NATURE.oak, NATURE.pine, NATURE.detailed, NATURE.default];
    for (let i = 0; i < count; i++) {
      const x = (rnd()-0.5)*worldSpanX(PX_W)*1.05;
      const z = (rnd()-0.5)*worldSpanY(PX_H)*1.05;
      const s = 0.75 + rnd()*0.6;
      arr.push({ x, z, s, url: urls[Math.floor(rnd()*urls.length)], kind: Math.floor(rnd()*3) });
    }
    return arr;
  }, [count, village]);
  return <>{items.map((t,i) => (
    <ModelBoundary key={i} fallback={<group position={[t.x,0,t.z]}><FallbackTree s={t.s} /></group>}>
      <group position={[t.x, 0, t.z]} rotation={[0, t.kind * 1.1, 0]} scale={t.s}>
        <Model url={t.url} />
      </group>
    </ModelBoundary>
  ))}</>;
}

/* ---------- 植被点缀：花草 + 岩石（草原/村庄通用，真实模型） ---------- */
function Foliage({ village = false }: { village?: boolean }) {
  const items = useMemo(() => {
    const arr: {x:number;z:number;s:number;url:string;rot:number}[] = [];
    let seed = village ? 918 : 618;
    const rnd = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; };
    const urls = [NATURE.bush, NATURE.bushLarge, NATURE.flowerRed, NATURE.flowerYellow, NATURE.flowerPurple, NATURE.grass, NATURE.rockSmall, NATURE.rockLarge];
    const n = village ? 30 : 70;
    for (let i = 0; i < n; i++) {
      arr.push({ x:(rnd()-0.5)*worldSpanX(PX_W), z:(rnd()-0.5)*worldSpanY(PX_H),
        s:0.7+rnd()*0.9, url:urls[Math.floor(rnd()*urls.length)], rot:rnd()*Math.PI*2 });
    }
    return arr;
  }, [village]);
  return <>{items.map((f,i) => (
    <ModelBoundary key={i} fallback={null}>
      <Model url={f.url} position={[f.x,0,f.z]} scale={f.s} rotation={f.rot} />
    </ModelBoundary>
  ))}</>;
}

/* ---------- 新手村建筑：Kenney 中世纪素材（商店摊/喷泉/路灯/围栏/树） ---------- */
function VillageBuildings() {
  const W = worldSpanX(PX_W), H = worldSpanY(PX_H);
  const deco = useMemo(() => [
    { url: TOWN.stall, x: -W*0.30, z: -H*0.24, s: 2.2, rot: 0.3 },      // 商店摊
    { url: TOWN.stallGreen, x: W*0.26, z: -H*0.26, s: 2.2, rot: -0.4 }, // 村长摊位
    { url: TOWN.fountain, x: 0, z: H*0.10, s: 2.0, rot: 0 },            // 中央喷泉
    { url: TOWN.lantern, x: -W*0.16, z: -H*0.10, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: W*0.16, z: -H*0.10, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: -W*0.16, z: H*0.26, s: 2.4, rot: 0 },
    { url: TOWN.lantern, x: W*0.16, z: H*0.26, s: 2.4, rot: 0 },
    { url: TOWN.rock, x: -W*0.36, z: H*0.30, s: 1.6, rot: 1.0 }
  ], [W, H]);
  // 围栏：沿村庄后排摆一排
  const fences = useMemo(() => {
    const arr: {x:number;z:number;rot:number}[] = [];
    for (let i = -4; i <= 4; i++) arr.push({ x: i*1.6, z: -H*0.40, rot: 0 });
    return arr;
  }, [H]);
  return <>
    {deco.map((d,i) => (
      <ModelBoundary key={i} fallback={<mesh position={[d.x,0.5,d.z]}><boxGeometry args={[1.5,1,1]} /><meshLambertMaterial color="#d9885a" /></mesh>}>
        <Model url={d.url} position={[d.x,0,d.z]} scale={d.s} rotation={d.rot} />
      </ModelBoundary>
    ))}
    {fences.map((f,i) => (
      <ModelBoundary key={'f'+i} fallback={null}>
        <Model url={TOWN.fence} position={[f.x,0,f.z]} scale={1.6} rotation={f.rot} />
      </ModelBoundary>
    ))}
  </>;
}

/* ---------- 出口传送门标识（新手村上方 / 草原返回点） ---------- */
function ExitPortal({ color }: { color: string }) {
  return <group position={[0, 0, -worldSpanY(PX_H)*0.42]}>
    <mesh position={[0, 1.1, 0]}>
      <torusGeometry args={[1.0, 0.14, 8, 24]} />
      <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
    <Billboard position={[0, 2.5, 0]}>
      <Text fontSize={0.42} color="#ffffff" outlineWidth={0.05} outlineColor="#333">出口</Text>
    </Billboard>
  </group>;
}

/* ---------- 地面：AI 草地纹理 + 边界水面 ---------- */
function Ground({ tint, useTextureMap }: { tint: string; useTextureMap: boolean }) {
  const grass = useTexture(ART.sceneGrass);
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(6, 4);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.needsUpdate = true;
  const W = worldSpanX(PX_W), H = worldSpanY(PX_H);
  return (
    <>
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W, H]} />
        {useTextureMap
          ? <meshLambertMaterial map={grass} />
          : <meshLambertMaterial color={tint} />}
      </mesh>
      {/* 外围缓冲地面（有限范围，不遮挡天空远景） */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.03,0]} receiveShadow>
        <planeGeometry args={[W*1.5, H*1.6]} />
        <meshLambertMaterial color={useTextureMap ? '#4f9c47' : tint} />
      </mesh>
      {/* 边界水面 */}
      {[
        {p:[0,0,-H/2-1.5] as [number,number,number], s:[W+6,3] as [number,number]},
        {p:[0,0,H/2+1.5] as [number,number,number], s:[W+6,3] as [number,number]},
        {p:[-W/2-1.5,0,0] as [number,number,number], s:[3,H+6] as [number,number]},
        {p:[W/2+1.5,0,0] as [number,number,number], s:[3,H+6] as [number,number]}
      ].map((w,i) => (
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={w.p}>
          <planeGeometry args={w.s} />
          <meshLambertMaterial color="#3b86c4" transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

/* ---------- 天空远景：AI 天空图做圆柱内壁 ---------- */
function Sky() {
  const tex = useTexture(ART.sceneSky);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const R = 70;
  return (
    <mesh position={[0, 8, 0]}>
      <cylinderGeometry args={[R, R, 60, 48, 1, true]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

/* ---------- 第三人称跟随相机 ---------- */
function FollowCamera({ engine }: { engine: GameEngine }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(() => {
    const p = engine.state.player;
    const [x, z] = pxToWorld(p.x, p.y);
    target.current.set(x, 1.4, z - 2.5);
    // 斜后上方俯视（类似朱紫的第三人称视角，俯角约 25° 以露出天空远景）
    const desired = new THREE.Vector3(x, 7.2, z + 14);
    camera.position.lerp(desired, 0.12);
    camera.lookAt(target.current);
  });
  return null;
}

/* ---------- 场景根 ---------- */
function World({ engine, wildTick, mapId }: { engine: GameEngine; wildTick: number; mapId: string }) {
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
      <Suspense fallback={<mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[200,200]} /><meshLambertMaterial color="#6cbf5a" /></mesh>}>
        <Sky />
        <Ground key={mapId} tint={cfg.ground} useTextureMap={!isVillage} />
      </Suspense>
      <Suspense fallback={null}>
        <Trees count={cfg.trees} village={isVillage} />
        <Foliage village={isVillage} />
        {isVillage && <VillageBuildings />}
      </Suspense>
      {!isVillage && <WildMonsters engine={engine} tick={wildTick} />}
      <ExitPortal color={cfg.portal} />
      <Follower engine={engine} />
      <Player engine={engine} />
      <FollowCamera engine={engine} />
    </>
  );
}

export default function Scene3D({ engine, wildTick }: { engine: GameEngine; wildTick: number }) {
  const mapId = engine.save.progress.map || 'qingya';
  return (
    <Canvas key={mapId} shadows dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 9.5, 11], near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <World engine={engine} wildTick={wildTick} mapId={mapId} />
    </Canvas>
  );
}
