// Component hiển thị mô hình 3D giải phẫu chấn thương của ngựa kèm đường chỉ Vector giải thích (tựa Ảnh 2).
// Sử dụng Three.js WebGL native, OrbitControls, 3D markers phát sáng và SVG leader lines phản hồi theo camera.
import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RotateCw, Eye, Activity, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import type { BodyRegion, InjuryType, RecoveryStatus, TrackedInjury } from '../../../api/types';
import { bodyRegionLabel } from '../../../lib/api-labels';
import { formatDate } from '../../../lib/format';
import { suggestBodyRegion } from '../../../lib/injury-position';
import { cn } from '../../../components/ui';

export interface HorseInjury3DViewerProps {
  injuries: TrackedInjury[];
  horseName?: string;
  className?: string;
  readOnly?: boolean;
  onSelectInjury?: (injury: TrackedInjury) => void;
  onAddPoint?: (point: { x: number; y: number; z: number; bodyRegion: BodyRegion }) => void;
}

interface ProjectedMarker {
  injury: TrackedInjury;
  screenX: number;
  screenY: number;
  side: 'left' | 'right';
  targetY: number;
  visible: boolean;
  color: string;
}

const INJURY_TYPE_NAMES: Record<InjuryType, string> = {
  FRACTURE: 'Gãy xương',
  SPRAIN: 'Bong gân',
  STRAIN: 'Căng cơ',
  WOUND: 'Vết thương hở',
  LACERATION: 'Rách da / Dây chằng',
  INFLAMMATION: 'Viêm gân / Cơ',
  CONTUSION: 'Đụng giập / Bầm',
  INFECTION: 'Nhiễm trùng',
  OTHER: 'Khác',
};

const STATUS_COLORS: Record<RecoveryStatus, { hex: string; bg: string; text: string; label: string }> = {
  ACUTE: { hex: '#ef4444', bg: 'bg-red-50 ring-red-200 text-red-700', text: 'text-red-600', label: 'Cấp tính' },
  RECOVERING: { hex: '#f59e0b', bg: 'bg-amber-50 ring-amber-200 text-amber-800', text: 'text-amber-600', label: 'Đang hồi phục' },
  HEALED: { hex: '#10b981', bg: 'bg-emerald-50 ring-emerald-200 text-emerald-800', text: 'text-emerald-600', label: 'Đã lành' },
};

type PresetView = 'LATERAL_LEFT' | 'LATERAL_RIGHT' | 'FRONT' | 'TOP' | 'PERSPECTIVE';

export function HorseInjury3DViewer({
  injuries,
  horseName,
  className = '',
  readOnly = true,
  onSelectInjury,
  onAddPoint,
}: HorseInjury3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<PresetView>('LATERAL_LEFT');
  const [projectedMarkers, setProjectedMarkers] = useState<ProjectedMarker[]>([]);
  const [addingMode, setAddingMode] = useState(false);

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const horseMeshRef = useRef<THREE.Group | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const activeInjuries = useMemo(() => {
    // Ưu tiên hiển thị các chấn thương cấp tính và đang hồi phục
    return [...injuries].sort((a, b) => {
      const order: Record<RecoveryStatus, number> = { ACUTE: 0, RECOVERING: 1, HEALED: 2 };
      return order[a.currentRecoveryStatus] - order[b.currentRecoveryStatus];
    });
  }, [injuries]);

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Mặc định góc Lateral Left (nhìn ngang sườn trái chuẩn như Ảnh 2)
    camera.position.set(3.6, 1.25, 0.1);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    // 3. OrbitControls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // không xoay xuống dưới đất quá nhiều
    controls.target.set(0, 1.05, 0); // tâm xoay ở giữa ngực/thân ngựa
    controlsRef.current = controls;

    // 4. Ánh sáng y học chuyên nghiệp (Studio Medical Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.6);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdcfce7, 0.7); // ánh sáng xanh nhạt đồng cỏ tự nhiên
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Group chứa markers
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // 5. Tải mô hình 3D GLB
    const loader = new GLTFLoader();
    setLoading(true);
    setLoadError(null);

    loader.load(
      '/models/horse-anatomy.glb',
      (gltf) => {
        const model = gltf.scene;
        horseMeshRef.current = model;

        // Tinh chỉnh vật liệu cơ bắp giải phẫu màu đất nung/cơ bắp nhã nhặn
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Áp dụng shader làm nổi bật khối cơ giải phẫu
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = 0.55;
              mat.metalness = 0.05;
              // Màu warm sand / terracotta thanh lịch tựa sách giải phẫu
              if (!mat.color || mat.color.getHex() === 0xffffff) {
                mat.color = new THREE.Color(0xd4a373);
              }
            }
          }
        });

        // Bounding box chuẩn hóa tâm
        const box = new THREE.Box3().setFromObject(model);
        // Giữ móng chân gần mặt phẳng y=0
        model.position.y = -box.min.y;
        controls.target.set(0, (box.max.y - box.min.y) * 0.55, 0);
        controls.update();

        scene.add(model);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Không tải được mô hình 3D:', error);
        setLoadError('Không thể nạp mô hình giải phẫu 3D. Hãy kiểm tra kết nối mạng.');
        setLoading(false);
      },
    );

    // 6. Raycast click để chọn hoặc thêm điểm chấn thương
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (!horseMeshRef.current || !cameraRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(horseMeshRef.current.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        // Đổi sang root-local của mô hình
        const localPoint = horseMeshRef.current.worldToLocal(hit.point.clone());
        const suggested = suggestBodyRegion(localPoint);

        if (onAddPoint && addingMode) {
          onAddPoint({ x: localPoint.x, y: localPoint.y, z: localPoint.z, bodyRegion: suggested });
          setAddingMode(false);
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    // 7. Render Loop & Chiếu tọa độ Markers 3D -> 2D
    let isMounted = true;
    const clock = new THREE.Clock();

    const animate = () => {
      if (!isMounted) return;
      animationFrameRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      controls.update();

      // Hiệu ứng nhịp đập cho markers 3D
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((child) => {
          if (child.name.startsWith('pulse-')) {
            const scale = 1 + 0.35 * Math.sin(elapsedTime * 4);
            child.scale.set(scale, scale, scale);
          }
        });
      }

      renderer.render(scene, camera);

      // Cập nhật tọa độ màn hình cho đường Vector Leader Lines
      if (containerRef.current && cameraRef.current && activeInjuries.length > 0) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        const currentCamera = cameraRef.current;

        const leftList: ProjectedMarker[] = [];
        const rightList: ProjectedMarker[] = [];

        activeInjuries.forEach((inj) => {
          const worldPos = new THREE.Vector3(inj.position.x, inj.position.y, inj.position.z);
          if (horseMeshRef.current) {
            worldPos.applyMatrix4(horseMeshRef.current.matrixWorld);
          }
          const projected = worldPos.clone().project(currentCamera);

          const screenX = ((projected.x + 1) / 2) * w;
          const screenY = ((-projected.y + 1) / 2) * h;
          const visible = projected.z < 1.0 && screenX > 20 && screenX < w - 20 && screenY > 20 && screenY < h - 20;

          // Phân loại sang lề trái hoặc phải màn hình
          const side: 'left' | 'right' = screenX < w / 2 ? 'left' : 'right';
          const color = STATUS_COLORS[inj.currentRecoveryStatus]?.hex ?? '#ef4444';

          const marker: ProjectedMarker = {
            injury: inj,
            screenX,
            screenY,
            side,
            targetY: screenY,
            visible,
            color,
          };

          if (side === 'left') leftList.push(marker);
          else rightList.push(marker);
        });

        // Tự động giãn cách đều các thẻ để không bị đè lên nhau
        const spaceMarkers = (list: ProjectedMarker[]) => {
          list.sort((a, b) => a.screenY - b.screenY);
          const minGap = 68; // khoảng cách tối thiểu giữa 2 thẻ
          let lastY = 40;
          list.forEach((m) => {
            if (m.targetY < lastY) m.targetY = lastY;
            lastY = m.targetY + minGap;
          });
        };

        spaceMarkers(leftList);
        spaceMarkers(rightList);

        setProjectedMarkers([...leftList, ...rightList]);
      }
    };

    animate();

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      isMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      canvas.removeEventListener('click', handleCanvasClick);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [activeInjuries, addingMode, onAddPoint]);

  // Cập nhật 3D Marker Spheres khi danh sách chấn thương thay đổi
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    // Xóa markers cũ
    while (markersGroup.children.length > 0) {
      const obj = markersGroup.children[0];
      markersGroup.remove(obj);
    }

    // Tạo markers mới
    activeInjuries.forEach((injury) => {
      const { x, y, z } = injury.position;
      const colorHex = STATUS_COLORS[injury.currentRecoveryStatus]?.hex ?? '#ef4444';
      const color = new THREE.Color(colorHex);

      const markerAnchor = new THREE.Group();
      markerAnchor.position.set(x, y, z);

      // Điểm tâm đỏ phát sáng
      const coreGeo = new THREE.SphereGeometry(0.038, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      markerAnchor.add(coreMesh);

      // Vòng tròn phát sáng nhịp đập
      const pulseGeo = new THREE.RingGeometry(0.045, 0.075, 24);
      const pulseMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pulseMesh.name = `pulse-${injury.id}`;
      // Vòng tròn luôn hướng về camera hoặc vuông góc
      pulseMesh.rotation.x = Math.PI / 2;
      markerAnchor.add(pulseMesh);

      markersGroup.add(markerAnchor);
    });
  }, [activeInjuries]);

  // Chuyển góc nhìn camera theo Presets
  const setCameraPreset = (preset: PresetView) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCurrentView(preset);
    const target = controls.target;

    switch (preset) {
      case 'LATERAL_LEFT':
        // Nhìn ngang sườn trái (Lateral View - như Ảnh 2)
        camera.position.set(3.4, target.y + 0.15, 0);
        break;
      case 'LATERAL_RIGHT':
        // Nhìn ngang sườn phải
        camera.position.set(-3.4, target.y + 0.15, 0);
        break;
      case 'FRONT':
        // Nhìn từ phía trước đầu
        camera.position.set(0, target.y + 0.25, 3.2);
        break;
      case 'TOP':
        // Nhìn từ trên xuống 45 độ
        camera.position.set(2.2, target.y + 2.5, 1.8);
        break;
      case 'PERSPECTIVE':
      default:
        camera.position.set(2.8, target.y + 0.6, 2.2);
        break;
    }

    controls.update();
  };

  return (
    <div className={cn('relative flex flex-col rounded-2xl bg-gradient-to-b from-stone-50 to-emerald-50/30 p-4 ring-1 ring-gray-200/80 shadow-card overflow-hidden', className)}>
      {/* Tiêu đề & Công cụ góc nhìn */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 z-10">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-gray-900 text-base">
            <Activity size={18} className="text-emerald-700" />
            Sơ đồ Giải phẫu & Vị trí Chấn thương 3D
            {horseName && <span className="font-normal text-gray-500">· {horseName}</span>}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Mô hình giải phẫu hình thể trực quan. Đường vector tự động chỉ nhãn giải thích chấn thương tương tự sơ đồ y khoa.
          </p>
        </div>

        {/* Thanh công cụ Preset góc nhìn */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-gray-200 text-xs">
            <button
              type="button"
              onClick={() => setCameraPreset('LATERAL_LEFT')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition',
                currentView === 'LATERAL_LEFT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900',
              )}
              title="Góc nhìn nghiêng sườn trái (Lateral Left - Chuẩn sách giải phẫu)"
            >
              Nghiêng trái
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('LATERAL_RIGHT')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition',
                currentView === 'LATERAL_RIGHT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900',
              )}
              title="Góc nhìn nghiêng sườn phải"
            >
              Nghiêng phải
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('FRONT')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition',
                currentView === 'FRONT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900',
              )}
              title="Góc nhìn chính diện"
            >
              Chính diện
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('TOP')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition',
                currentView === 'TOP' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900',
              )}
              title="Góc nhìn từ trên lưng"
            >
              Lưng / Trên
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('PERSPECTIVE')}
              className={cn(
                'rounded-md px-2 py-1 font-medium transition text-gray-500 hover:text-gray-900',
                currentView === 'PERSPECTIVE' && 'bg-gray-100 font-semibold',
              )}
              title="Đặt lại góc nhìn mặc định"
            >
              <RotateCw size={12} />
            </button>
          </div>

          {!readOnly && onAddPoint && (
            <button
              type="button"
              onClick={() => setAddingMode(!addingMode)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition',
                addingMode ? 'bg-amber-500 text-white ring-amber-600 animate-pulse' : 'bg-white text-emerald-800 ring-emerald-300 hover:bg-emerald-50',
              )}
            >
              <Plus size={13} /> {addingMode ? 'Click lên thân ngựa…' : 'Chấm điểm tổn thương'}
            </button>
          )}
        </div>
      </div>

      {/* Vùng Render 3D Canvas và SVG Vector Overlay */}
      <div ref={containerRef} className="relative h-[480px] w-full select-none rounded-xl bg-gradient-to-b from-stone-100/70 via-stone-50 to-emerald-50/40 ring-1 ring-stone-200/70">
        <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-xs z-20">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="mt-2 text-xs font-semibold text-gray-700">Đang tải mô hình giải phẫu 3D…</p>
          </div>
        )}

        {/* Error Notification */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 p-4 text-center z-20">
            <AlertCircle size={32} className="text-red-500" />
            <p className="mt-2 text-sm font-semibold text-gray-900">{loadError}</p>
          </div>
        )}

        {/* SVG Vector Leader Lines (tựa Ảnh 2) */}
        {!loading && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="vector-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.18" />
              </filter>
            </defs>
            {projectedMarkers.map((marker) => {
              if (!marker.visible) return null;
              const isSelected = selectedId === marker.injury.id;
              const isLeft = marker.side === 'left';
              const cardAnchorX = isLeft ? 190 : (containerRef.current?.clientWidth ?? 800) - 190;
              const cardAnchorY = marker.targetY + 24;

              // Elbow point nối giữa điểm chấn thương 3D và thẻ ghi chú 2D
              const elbowX = isLeft ? marker.screenX - 35 : marker.screenX + 35;
              const elbowY = cardAnchorY;

              return (
                <g key={marker.injury.id} className="transition-opacity duration-300">
                  {/* Điểm neo tại chấn thương */}
                  <circle
                    cx={marker.screenX}
                    cy={marker.screenY}
                    r={isSelected ? 5.5 : 4}
                    fill={marker.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    filter="url(#vector-glow)"
                  />
                  {/* Đường chỉ Vector gãy khúc thanh lịch */}
                  <polyline
                    points={`${marker.screenX},${marker.screenY} ${elbowX},${elbowY} ${cardAnchorX},${cardAnchorY}`}
                    fill="none"
                    stroke={marker.color}
                    strokeWidth={isSelected ? 2.5 : 1.75}
                    strokeDasharray={isSelected ? undefined : '4 3'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected ? 1 : 0.85}
                  />
                  {/* Điểm chốt tại thẻ ghi chú */}
                  <circle cx={cardAnchorX} cy={cardAnchorY} r={3} fill={marker.color} />
                </g>
              );
            })}
          </svg>
        )}

        {/* Floating Callout Cards ở hai bên lề (tựa Ảnh 2) */}
        {!loading &&
          projectedMarkers.map((marker) => {
            if (!marker.visible) return null;
            const isSelected = selectedId === marker.injury.id;
            const isLeft = marker.side === 'left';
            const statusConfig = STATUS_COLORS[marker.injury.currentRecoveryStatus] ?? STATUS_COLORS.ACUTE;
            const lastHistory = marker.injury.history[marker.injury.history.length - 1];

            return (
              <div
                key={marker.injury.id}
                style={{
                  top: `${marker.targetY}px`,
                  [isLeft ? 'left' : 'right']: '12px',
                }}
                onClick={() => {
                  setSelectedId(marker.injury.id);
                  onSelectInjury?.(marker.injury);
                }}
                className={cn(
                  'pointer-events-auto absolute w-[172px] cursor-pointer rounded-xl bg-white/95 p-2.5 text-xs shadow-md backdrop-blur-md ring-1 transition-all duration-200 z-15 hover:scale-102 hover:shadow-lg',
                  isSelected ? 'ring-2 ring-emerald-600 shadow-emerald-tint' : 'ring-gray-200/90 hover:ring-emerald-400',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-gray-900 truncate">
                    {bodyRegionLabel[marker.injury.bodyRegion] ?? marker.injury.bodyRegion}
                  </span>
                  <span className={cn('rounded px-1.5 py-0.2 text-[10px] font-semibold ring-1', statusConfig.bg)}>
                    {statusConfig.label}
                  </span>
                </div>

                <p className="mt-1 font-semibold text-gray-800 text-[11px]">
                  {INJURY_TYPE_NAMES[marker.injury.injuryType] ?? marker.injury.injuryType}
                </p>

                {lastHistory?.notes && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-gray-500 leading-tight">
                    {lastHistory.notes}
                  </p>
                )}

                <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 text-[9px] text-gray-400">
                  <span>{formatDate(marker.injury.firstExamDate)}</span>
                  <span className="text-emerald-700 font-medium">{marker.injury.history.length} lần khám</span>
                </div>
              </div>
            );
          })}

        {/* Hướng dẫn tương tác xoay 3D ở góc dưới */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-2 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-medium text-gray-600 backdrop-blur-xs ring-1 ring-gray-200 z-10">
          <Eye size={12} className="text-emerald-700" />
          <span>Kéo chuột để xoay 360° · Cuộn để phóng to/thu nhỏ</span>
        </div>

        {/* Thống kê nhanh chấn thương */}
        <div className="pointer-events-none absolute bottom-2.5 right-3 flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-gray-700 backdrop-blur-xs ring-1 ring-gray-200 z-10">
          <span>Tổng số vết: {injuries.length}</span>
          <span className="text-red-600">
            {injuries.filter((i) => i.currentRecoveryStatus === 'ACUTE').length} cấp tính
          </span>
        </div>
      </div>

      {/* Thông điệp khi ngựa hoàn toàn khỏe mạnh không có chấn thương */}
      {injuries.length === 0 && !loading && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/80">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>Chiến mã hiện không có chấn thương nào đang điều trị. Thể trạng cơ xương khớp ổn định.</span>
        </div>
      )}
    </div>
  );
}