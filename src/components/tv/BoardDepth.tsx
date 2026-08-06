import { useEffect, useRef } from "react";

type Node = { color: string; phase: number; speed: number; vx: number; vy: number; x: number; y: number; z: number };

type Props = { energy: number };

export function BoardDepth({ energy }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !parent || !context) return undefined;

    let frame = 0;
    let width = 0;
    let height = 0;
    let lastTime = performance.now();
    let nodes: Node[] = [];
    const palette = ["183,255,131", "130,164,255", "255,190,103"];

    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      nodes = Array.from({ length: 28 }, (_, index) => ({
        color: palette[index % palette.length],
        phase: Math.random() * Math.PI * 2,
        speed: 0.0002 + Math.random() * 0.00042,
        vx: (Math.random() - 0.5) * 0.014,
        vy: (Math.random() - 0.5) * 0.01,
        x: (Math.random() - 0.5) * width * 1.2,
        y: (Math.random() - 0.5) * height * 1.15,
        z: 0.28 + Math.random() * 0.66,
      }));
    };

    const project = (x: number, y: number, z: number) => ({ x: width / 2 + x * (0.82 / z), y: height / 2 + y * (0.82 / z), z });

    const render = (time: number) => {
      const delta = Math.min(40, time - lastTime);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      const movement = 1 + energy * 2.2;
      const points = nodes.map(node => {
        node.x += node.vx * delta * movement;
        node.y += node.vy * delta * movement;
        node.z += Math.sin(time * node.speed + node.phase) * 0.00045 * movement;
        if (Math.abs(node.x) > width * 0.7) node.vx *= -1;
        if (Math.abs(node.y) > height * 0.66) node.vy *= -1;
        return { ...project(node.x, node.y, node.z), node };
      });

      for (let index = 0; index < points.length; index += 1) {
        for (let next = index + 1; next < points.length; next += 1) {
          const first = points[index];
          const second = points[next];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance > 118 || Math.abs(first.z - second.z) > 0.22) continue;
          const alpha = (1 - distance / 118) * (0.11 + energy * 0.36);
          context.strokeStyle = `rgba(183,255,131,${alpha})`;
          context.lineWidth = 0.6 + energy * 0.8;
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.stroke();
        }
      }

      points.forEach(({ node, x, y, z }) => {
        const size = 1.5 + (1 - z) * 4 + energy * 1.8;
        const alpha = 0.34 + (1 - z) * 0.32 + energy * 0.2;
        context.fillStyle = `rgba(${node.color},${alpha})`;
        context.shadowBlur = 8 + energy * 16;
        context.shadowColor = `rgba(${node.color},0.8)`;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      });
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
  }, [energy]);

  return <canvas aria-hidden="true" className="board-depth" ref={canvasRef} />;
}
