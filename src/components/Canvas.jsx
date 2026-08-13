import { useEffect, useRef } from "react";

const W = 220;
const H = 220;
const STRENGTH = 450;

const mapRange = (v, inMin, inMax, outMin, outMax) =>
  ((v - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

const getIndex = (y, x, data) => y * 4 * data.width + x * 4;

function calculateQuantError(o, n) {
  const oc = parseInt((o.r + o.g + o.b) / 3, 10);
  const nc = parseInt((n.r + n.g + n.b) / 3, 10);
  return { r: oc - nc, g: oc - nc, b: oc - nc, a: 255 };
}

function addError(imageData, factor, x, y, errR, errG, errB) {
  const i = getIndex(y, x, imageData);
  imageData.data[i] = imageData.data[i] + errR * factor;
  imageData.data[i + 1] = imageData.data[i] + errG * factor;
  imageData.data[i + 2] = imageData.data[i] + errB * factor;
}

function distributeError(imageData, x, y, errR, errG, errB) {
  addError(imageData, 7 / 16, x + 1, y, errR, errG, errB);
  addError(imageData, 3 / 16, x - 1, y + 1, errR, errG, errB);
  addError(imageData, 5 / 16, x, y + 1, errR, errG, errB);
  addError(imageData, 1 / 16, x + 1, y + 1, errR, errG, errB);
}

export default function Canvas({ src = "/nataliya.jpg" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const ctx = c.getContext("2d", { willReadFrequently: true });
    c.width = W;
    c.height = H;

    let particles = [];
    let frame = null;
    let cancelled = false;
    let mx = -1000;
    let my = -1000;

    const onMouseOut = () => {
      mx = -300;
      my = -300;
    };

    const onMouseMove = (e) => {
      mx = mapRange(e.offsetX, 0, c.offsetWidth, 0, W);
      my = mapRange(e.offsetY, 0, c.offsetHeight, 0, H);
    };

    const onTouchMove = (e) => {
      const bounds = c.getBoundingClientRect();
      const t = e.targetTouches[0];
      mx = mapRange(t.clientX - bounds.left, 0, c.offsetWidth, 0, W);
      my = mapRange(t.clientY - bounds.top, 0, c.offsetHeight, 0, H);
    };

    c.addEventListener("mouseout", onMouseOut);
    c.addEventListener("mousemove", onMouseMove);
    c.addEventListener("touchmove", onTouchMove, { passive: true });

    const pixelate = () => {
      const imageData = ctx.getImageData(0, 0, W, H);
      ctx.clearRect(0, 0, W, H);

      for (let y = 0, y2 = imageData.height - 1; y < y2; y++) {
        for (let x = 1, x2 = imageData.width - 1; x < x2; x++) {
          const index = getIndex(y, x, imageData);
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];

          const v = parseInt((r + g + b) / 3 > 128 ? 255 : 0, 10);

          imageData.data[index] = v;
          imageData.data[index + 1] = v;
          imageData.data[index + 2] = v;

          const qe = calculateQuantError({ r, g, b }, { r: v, g: v, b: v });
          distributeError(imageData, x, y, qe.r, qe.g, qe.b);

          particles.push({
            x,
            y,
            ox: x,
            oy: y,
            r: imageData.data[index],
            g: imageData.data[index + 1],
            b: imageData.data[index + 2],
          });
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const step = () => {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - mx;
        const dy = p.y - my;
        const angle = Math.atan2(dy, dx);
        const dist = STRENGTH / Math.sqrt(dx * dx + dy * dy);
        p.x += Math.cos(angle) * dist;
        p.y += Math.sin(angle) * dist;
        p.x += (p.ox - p.x) * 0.1;
        p.y += (p.oy - p.y) * 0.1;
      }

      const out = ctx.createImageData(W, H);
      const data = out.data;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const n = (~~p.x + ~~p.y * W) * 4;
        data[n] = p.r;
        data[n + 1] = p.g;
        data[n + 2] = p.b;
        data[n + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);

      frame = requestAnimationFrame(step);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      pixelate();
      step();
    };
    img.src = src;

    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      c.removeEventListener("mouseout", onMouseOut);
      c.removeEventListener("mousemove", onMouseMove);
      c.removeEventListener("touchmove", onTouchMove);
      particles = [];
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className="portrait"
      width={W}
      height={H}
      aria-label="A dithered portrait of Nataliya that scatters when you move the cursor over it"
      role="img"
    />
  );
}
