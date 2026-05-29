// 游戏常量
export const COLS = 10;
export const ROWS = 20;

// 类型定义
export type Grid = number[][];

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  x: number;
  y: number;
  value: number;
}

export interface MergeResult {
  positions: Position[];
  sum: number;
  placeAt: Position;
}

export interface StabilizeResult {
  grid: Grid;
  scoreGained: number;
}

// 创建空网格
export function createEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 深拷贝网格
export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

// 按概率生成随机数字：2(60%), 4(30%), 8(10%)
export function generateRandomValue(): number {
  const rand = Math.random();
  if (rand < 0.6) return 2;
  if (rand < 0.9) return 4;
  return 8;
}

// 生成新方块（顶部中间）
export function spawnPiece(value: number): Piece {
  return { x: Math.floor(COLS / 2), y: 0, value };
}

// 碰撞检测
export function isValidMove(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return grid[y][x] === 0;
}

// 查找连通块（BFS）
export function findConnected(grid: Grid, startX: number, startY: number, visited: boolean[][]): Position[] {
  const value = grid[startY][startX];
  if (value === 0) return [];

  const positions: Position[] = [];
  const queue: Position[] = [{ x: startX, y: startY }];
  visited[startY][startX] = true;

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    positions.push(current);

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (
        nx >= 0 && nx < COLS &&
        ny >= 0 && ny < ROWS &&
        !visited[ny][nx] &&
        grid[ny][nx] === value
      ) {
        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return positions;
}

// 计算连通块的放置位置：取最左上的格子（x 最小，x 相同时 y 最小）
export function calcPlacePosition(positions: Position[]): Position {
  let best = positions[0];
  for (const p of positions) {
    if (p.x < best.x || (p.x === best.x && p.y < best.y)) {
      best = p;
    }
  }
  return { x: best.x, y: best.y };
}

// 查找所有可合并的连通块（大小 >= 3）
export function findAllMerges(grid: Grid): MergeResult[] {
  const visited: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const merges: MergeResult[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 0 && !visited[y][x]) {
        const connected = findConnected(grid, x, y, visited);
        if (connected.length >= 3) {
          const sum = connected.length * grid[connected[0].y][connected[0].x];
          const placeAt = calcPlacePosition(connected);
          merges.push({ positions: connected, sum, placeAt });
        }
      }
    }
  }

  return merges;
}

// 重力下落：每列从下往上压缩非空值
export function applyGravity(grid: Grid): void {
  for (let x = 0; x < COLS; x++) {
    const values: number[] = [];
    // 从下往上收集非空值
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y][x] !== 0) {
        values.push(grid[y][x]);
      }
    }
    // 从底部开始填充
    for (let y = ROWS - 1; y >= 0; y--) {
      grid[y][x] = values.length > 0 ? values.shift()! : 0;
    }
  }
}

// 从多个连通块中选一个进行合并：选最靠下的（y 最大），y 相同时选最靠左的（x 最小）
export function selectOneMerge(merges: MergeResult[]): MergeResult {
  let best = merges[0];
  for (const merge of merges) {
    if (merge.placeAt.y > best.placeAt.y ||
        (merge.placeAt.y === best.placeAt.y && merge.placeAt.x < best.placeAt.x)) {
      best = merge;
    }
  }
  return best;
}

// 执行单次合并操作：清除该连通块所有格子，在放置位置放入合并后的值
export function applySingleMerge(grid: Grid, merge: MergeResult): number {
  const score = merge.sum * 10;

  // 清除连通块所有格子
  for (const pos of merge.positions) {
    grid[pos.y][pos.x] = 0;
  }

  // 在放置位置放入合并后的值
  grid[merge.placeAt.y][merge.placeAt.x] += merge.sum;

  return score;
}

// 递归稳定化：合并+重力直到没有可合并的
export function stabilize(grid: Grid): StabilizeResult {
  const newGrid = cloneGrid(grid);
  let totalScore = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const merges = findAllMerges(newGrid);
    if (merges.length === 0) break;

    const selected = selectOneMerge(merges);
    totalScore += applySingleMerge(newGrid, selected);
    applyGravity(newGrid);
  }

  return { grid: newGrid, scoreGained: totalScore };
}

// 检查游戏结束（顶部行是否有方块）
export function checkGameOver(grid: Grid): boolean {
  for (let x = 0; x < COLS; x++) {
    if (grid[0][x] !== 0) return true;
  }
  return false;
}
