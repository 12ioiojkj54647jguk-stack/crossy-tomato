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

// 生成特殊方塊（炸彈或冰凍）
export function generateSpecialValue(): number {
  // 50% 機率炸彈 (0), 50% 機率冰凍 (-1)
  return Math.random() < 0.5 ? 0 : -1;
}

// 生成新方块（頂部中間）
export function spawnPiece(value: number): Piece {
  return { x: Math.floor(COLS / 2), y: 0, value };
}

// 碰撞檢測
export function isValidMove(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return grid[y][x] === 0;
}

// 查找連通塊（BFS）
export function findConnected(grid: Grid, startX: number, startY: number, visited: boolean[][]): Position[] {
  const value = grid[startY][startX];
  if (value <= 0) return [];  // 特殊方塊不參與合併

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

// 計算連通塊的放置位置：取最左上的格子（x 最小，x 相同時 y 最小）
export function calcPlacePosition(positions: Position[]): Position {
  let best = positions[0];
  for (const p of positions) {
    if (p.x < best.x || (p.x === best.x && p.y < best.y)) {
      best = p;
    }
  }
  return { x: best.x, y: best.y };
}

// 查找所有可合併的連通塊（大小 >= 3）
export function findAllMerges(grid: Grid): MergeResult[] {
  const visited: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const merges: MergeResult[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] > 0 && !visited[y][x]) {
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

// 重力下落：每列從下往上壓縮非空值
export function applyGravity(grid: Grid): void {
  for (let x = 0; x < COLS; x++) {
    const values: number[] = [];
    // 從下往上收集非空值
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y][x] !== 0) {
        values.push(grid[y][x]);
      }
    }
    // 從底部開始填充
    for (let y = ROWS - 1; y >= 0; y--) {
      grid[y][x] = values.length > 0 ? values.shift()! : 0;
    }
  }
}

// 從多個連通塊中選一個進行合併：選最靠下的（y 最大），y 相同時選最靠左的（x 最小）
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

// 執行單次合併操作：清除該連通塊所有格子，在放置位置放入合併後的值
export function applySingleMerge(grid: Grid, merge: MergeResult): number {
  const score = merge.sum * 10;

  // 清除連通塊所有格子
  for (const pos of merge.positions) {
    grid[pos.y][pos.x] = 0;
  }

  // 在放置位置放入合併後的值
  grid[merge.placeAt.y][merge.placeAt.x] += merge.sum;

  return score;
}

// 炸彈效果：清除周圍 3x3 區域
export function applyBomb(grid: Grid, x: number, y: number): Position[] {
  const cleared: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[ny][nx] !== 0) {
        cleared.push({ x: nx, y: ny });
        grid[ny][nx] = 0;
      }
    }
  }
  return cleared;
}

// 遞歸穩定化：合併+重力直到沒有可合併的
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

// 檢查遊戲結束：頂部行（y=0）有任何方塊
export function checkGameOver(grid: Grid): boolean {
  for (let x = 0; x < COLS; x++) {
    if (grid[0][x] !== 0) return true;
  }
  return false;
}
