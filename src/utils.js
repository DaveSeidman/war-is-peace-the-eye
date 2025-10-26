export const randomColor = () => {
  const r = Math.floor(Math.random() * 205 + 50);
  const g = Math.floor(Math.random() * 205 + 50);
  const b = Math.floor(Math.random() * 205 + 50);
  return `rgba(${r},${g},${b},0.9)`;
};

const iou = (a, b) => {
  const x1 = Math.max(a.originX, b.originX);
  const y1 = Math.max(a.originY, b.originY);
  const x2 = Math.min(a.originX + a.width, b.originX + b.width);
  const y2 = Math.min(a.originY + a.height, b.originY + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
};

const predictBox = (p) =>
  !p.box
    ? null
    : {
      originX: p.box.originX + (p.vx ?? 0),
      originY: p.box.originY + (p.vy ?? 0),
      width: p.box.width,
      height: p.box.height,
    };

export const matchToPrevious = (box, prevList, iouThreshold = 0.3) => {
  let best = null;
  let bestScore = iouThreshold;
  for (const p of prevList) {
    if (!p.box) continue;
    const predicted = predictBox(p);
    const overlap = iou(box, predicted);
    if (overlap > bestScore) {
      best = p;
      bestScore = overlap;
    }
  }
  return best ? best.id : null;
};