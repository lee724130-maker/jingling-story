import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Gender } from '@shared/types';

/** 主角 3D 展示模型路径（压缩后的 AI 生成模型，约 1.6MB/个） */
export function trainerModelOf(gender: Gender): string {
  return gender === 'female' ? '/models/characters/female_ai.glb' : '/models/characters/male_ai.glb';
}

// 预加载两个模型，切换性别时无闪烁
useGLTF.preload('/models/characters/male_ai.glb');
useGLTF.preload('/models/characters/female_ai.glb');

function Model({ gender }: { gender: Gender }) {
  const { scene } = useGLTF(trainerModelOf(gender));

  // 归一化高度到目标尺寸、贴地、开启阴影；useGLTF 缓存同一对象，需 clone 避免两性别实例互串
  const model = React.useMemo(() => {
    const m = scene.clone(true);
    m.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const mesh = o as THREE.Mesh;
        if (mesh.material) (mesh.material as THREE.Material).side = THREE.DoubleSide;
      }
    });
    const box = new THREE.Box3().setFromObject(m);
    const h = box.max.y - box.min.y || 1;
    m.scale.setScalar(1.9 / h);
    const box2 = new THREE.Box3().setFromObject(m);
    // 让模型中心对齐原点，配合 Canvas 默认 lookAt(0,0,0) 拍全身
    m.position.y -= (box2.min.y + box2.max.y) / 2;
    return m;
  }, [scene]);

  // 固定背对镜头（模型默认面朝 +Z，旋转 π 让背面朝向相机），静止站好无动画
  return <group rotation={[0, Math.PI, 0]}>
    <primitive object={model} />
  </group>;
}

/** 主面板主角：实时 3D 模型展示（透明背景，站在村口）。WebGL 不可用时由外层降级到立绘图片。 */
export default function TrainerModel3D({ gender, onError }: { gender: Gender; onError?: () => void }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // 检测 WebGL 可用性，不可用时通知外层降级到立绘图片
    try {
      const c = document.createElement('canvas');
      if (!c.getContext('webgl2') && !c.getContext('webgl')) { setFailed(true); onError?.(); }
    } catch { setFailed(true); onError?.(); }
  }, [onError]);

  if (failed) return null; // 外层根据 onError 切换到降级图

  return <Canvas
    camera={{ position: [0, 0.15, 3.6], fov: 38, near: 0.01, far: 100 }}
    gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
    dpr={[1, 2]}
    onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    style={{ background: 'transparent', width: '100%', height: '100%' }}
  >
    <ambientLight intensity={1.5} />
    <hemisphereLight args={[0xffffff, 0x778899, 1.6]} />
    <directionalLight position={[2.5, 4, 3]} intensity={2.8} />
    <directionalLight position={[-3, 2, -2]} intensity={1.1} />
    <Suspense fallback={null}>
      <Model gender={gender} />
    </Suspense>
  </Canvas>;
}
