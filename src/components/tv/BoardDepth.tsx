import { useEffect, useRef } from "react";

type Star = { color: string; speed: number; x: number; y: number; z: number };
type Cube = { color: string; phase: number; size: number; speed: number; x: number; y: number; z: number };

export function BoardDepth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const parent = canvas.parentElement;
    if (!parent) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let frame = 0;
    let lastTime = performance.now();
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let cubes: Cube[] = [];

    const resetStar = (star: Star, far = false) => {
      star.x = (Math.random() - 0.5) * width * 1.45;
      star.y = (Math.random() - 0.5) * height * 1.25;
      star.z = far ? 0.25 + Math.random() * 0.85 : 0.06 + Math.random() * 1.04;
      star.speed = 0.34 + Math.random() * 0.52;
      star.color = ["126,255,194", "130,164,255", "255,195,98"][Math.floor(Math.random() * 3)];
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from({ length: 82 }, () => {
        const star = { color: "", speed: 0, x: 0, y: 0, z: 0 };
        resetStar(star, true);
        return star;
      });
      cubes = Array.from({ length: 9 }, (_, index) => ({
        color: ["183,255,131", "143,183,255", "255,193,102"][index % 3],
        phase: Math.random() * Math.PI * 2,
        size: 13 + Math.random() * 20,
        speed: 0.00048 + Math.random() * 0.00036,
        x: (Math.random() - 0.5) * width * 1.15,
        y: (Math.random() - 0.5) * height * 1.05,
        z: 0.22 + Math.random() * 0.67 + index * 0.015,
      }));
    };

    const project = (x: number, y: number, z: number) => ({
      scale: 0.86 / z,
      x: width / 2 + x * (0.86 / z),
      y: height / 2 + y * (0.86 / z),
    });

    const drawCube = (cube: Cube, time: number) => {
      const angle = cube.phase + time * cube.speed;
      const half = cube.size / 2;
      const vertices = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => {
        const localX = x * half;
        const localY = y * half;
        const localZ = z * half;
        const rotatedX = localX * Math.cos(angle) - localZ * Math.sin(angle);
        const rotatedZ = localX * Math.sin(angle) + localZ * Math.cos(angle);
        return project(cube.x + rotatedX, cube.y + localY, cube.z + rotatedZ / 220);
      })));
      const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
      context.strokeStyle = `rgba(${cube.color},0.44)`;
      context.lineWidth = 1.25;
      context.shadowBlur = 10;
      context.shadowColor = `rgba(${cube.color},0.5)`;
      context.beginPath();
      edges.forEach(([from, to]) => {
        context.moveTo(vertices[from].x, vertices[from].y);
        context.lineTo(vertices[to].x, vertices[to].y);
      });
      context.stroke();
      context.shadowBlur = 0;
    };

    const render = (time: number) => {
      const delta = Math.min(40, time - lastTime);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      stars.forEach(star => {
        const previousZ = star.z;
        star.z -= star.speed * delta / 1000;
        if (star.z < 0.045) resetStar(star, true);
        const point = project(star.x, star.y, star.z);
        const trail = project(star.x, star.y, previousZ);
        const size = Math.min(4.3, 0.52 + (1 - star.z) * 3.5);
        const alpha = Math.min(0.78, 0.14 + (1 - star.z) * 0.52);
        context.strokeStyle = `rgba(${star.color},${alpha * 0.48})`;
        context.lineWidth = Math.max(0.6, size * 0.34);
        context.beginPath();
        context.moveTo(trail.x, trail.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        context.fillStyle = `rgba(${star.color},${alpha})`;
        context.shadowBlur = 12;
        context.shadowColor = `rgba(${star.color},0.72)`;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      });
      cubes.forEach(cube => drawCube(cube, time));
      frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    frame = window.requestAnimationFrame(render);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas aria-hidden="true" className="board-depth" ref={canvasRef} />;
}
