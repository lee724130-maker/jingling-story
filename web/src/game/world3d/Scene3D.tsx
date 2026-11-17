/* 精灵物语 · 第三人称 3D 世界场景（React Three Fiber）
 * 逻辑仍由 GameEngine 驱动（像素坐标），本组件只做渲染；战斗/过场仍走原有 2D overlay。 */
import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text, useTexture } from '@react-three/drei';
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

/* ---------- 程序化树木（数量按地图配置） ---------- */
function Trees({ count }: { count: number }) {
  const trees = useMemo(() => {
    const arr: {x:number;z:number;s:number}[] = [];
    let seed = 42;
    const rnd = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; };
    for (let i = 0; i < count; i++) {
      const x = (rnd()-0.5)*worldSpanX(PX_W)*1.05;
      const z = (rnd()-0.5)*worldSpanY(PX_H)*1.05;
      const s = 0.7 + rnd()*0.7;
      arr.push({x,z,s});
    }
    return arr;
  }, [count]);
  return <>{trees.map((t,i) => (
    <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
      <mesh position={[0,0.5,0]} castShadow><cylinderGeometry args={[0.1,0.14,1,6]} /><meshLambertMaterial color="#7a5230" /></mesh>
      <mesh position={[0,1.3,0]} castShadow><coneGeometry args={[0.7,1.5,7]} /><meshLambertMaterial color="#2f8f5c" /></mesh>
      <mesh position={[0,1.9,0]} castShadow><coneGeometry args={[0.5,1.1,7]} /><meshLambertMaterial color="#38a568" /></mesh>
    </group>
  ))}</>;
}

/* ---------- 新手村建筑：几栋程序化小屋 + 招牌（AI 场景图之外用几何体补齐） ---------- */
function VillageBuildings() {
  const houses = useMemo(() => {
    const W = worldSpanX(PX_W), H = worldSpanY(PX_H);
    return [
      { x: -W*0.34, z: -H*0.28, c: '#d9885a' },  // 商店（暖橙屋顶）
      { x:  W*0.30, z: -H*0.30, c: '#7b9fd6' },  // 村长屋（蓝屋顶）
      { x: -W*0.30, z:  H*0.24, c: '#9b7fc4' },  // 向导屋（紫屋顶）
      { x:  W*0.32, z:  H*0.22, c: '#c9a25a' }   // 民宅（黄屋顶）
    ];
  }, []);
  return <>{houses.map((h, i) => (
    <group key={i} position={[h.x, 0, h.z]}>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[2.4, 1.5, 2.0]} /><meshLambertMaterial color="#efe3c8" /></mesh>
      <mesh position={[0, 1.65, 0]} castShadow><coneGeometry args={[1.9, 1.0, 4]} /><meshLambertMaterial color={h.c} /></mesh>
      <mesh position={[0, 0.5, 1.02]}><boxGeometry args={[0.6, 1.0, 0.06]} /><meshLambertMaterial color="#8a5a34" /></mesh>
      <mesh position={[0.75, 0.85, 1.02]}><boxGeometry args={[0.4, 0.4, 0.06]} /><meshLambertMaterial color="#bfe6f5" /></mesh>
    </group>
  ))}</>;
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
    ? { ground: '#8fce74', trees: 26, portal: '#f0b95c' }
    : { ground: '#6cbf5a', trees: 90, portal: '#5fd0a6' };
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
      <Trees count={cfg.trees} />
      {isVillage ? <VillageBuildings /> : <WildMonsters engine={engine} tick={wildTick} />}
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
