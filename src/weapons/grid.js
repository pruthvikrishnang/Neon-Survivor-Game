import { WORLD } from '../config.js';

export function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

/** Uniform-grid broad phase. Each entity is inserted once by its centre cell. */
export class SpatialGrid {
  constructor(width, height, cellSize = WORLD.gridCell) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const bucket of this.buckets) bucket.length = 0;
  }

  insert(entity) {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(entity.x / this.cellSize)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(entity.y / this.cellSize)));
    this.buckets[row * this.cols + col].push(entity);
  }

  queryCircle(x, y, radius, out = []) {
    out.length = 0;
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const bucket = this.buckets[row * this.cols + col];
        for (const entity of bucket) {
          if (entity.dead) continue;
          const reach = radius + entity.radius;
          const dx = entity.x - x;
          const dy = entity.y - y;
          if (dx * dx + dy * dy <= reach * reach) out.push(entity);
        }
      }
    }
    return out;
  }
}
