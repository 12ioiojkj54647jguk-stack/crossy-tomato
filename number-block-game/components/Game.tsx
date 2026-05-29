"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  COLS,
  ROWS,
  createEmptyGrid,
  generateRandomValue,
  spawnPiece,
  isValidMove,
  stabilize,
  checkGameOver,
  type Grid,
  type Piece,
} from "@/lib/gameEngine";

// Canvas 尺寸常量
const CELL_SIZE = 30;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

// 数字颜色映射
const VALUE_COLORS: Record<number, string> = {
  2: "#eee4da",
  4: "#ede0c8",
  8: "#f2b179",
  16: "#f59563",
  32: "#f67c5f",
  64: "#f65e3b",
  128: "#edcf72",
  256: "#edcc61",
  512: "#edc850",
  1024: "#edc53f",
  2048: "#edc22e",
};

function getBlockColor(value: number): string {
  return VALUE_COLORS[value] || "#3c3a32";
}

function getTextColor(value: number): string {
  return value <= 4 ? "#776e65" : "#f9f6f2";
}

// 兼容的圆角矩形绘制（roundRect 在旧版 Safari 不支持）
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextValue, setNextValue] = useState<number>(generateRandomValue);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // 使用 ref 同步最新状态（避免闭包陷阱）
  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const nextValueRef = useRef(nextValue);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { currentPieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextValueRef.current = nextValue; }, [nextValue]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // 锁定当前方块并触发合并
  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece) return;

    // 将方块固定到网格
    const newGrid = currentGrid.map(row => [...row]);

    // 规则6: 如果当前方块位置已被占据或超出边界，游戏结束
    if (piece.y < 0 || piece.y >= ROWS || piece.x < 0 || piece.x >= COLS || newGrid[piece.y][piece.x] !== 0) {
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    newGrid[piece.y][piece.x] = piece.value;

    // 规则6: 如果方块锁定在 y=0（顶部），游戏结束
    if (piece.y === 0) {
      setGrid(newGrid);
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    // 执行合并稳定化
    const result = stabilize(newGrid);
    setGrid(result.grid);
    setScore(prev => prev + result.scoreGained);

    // 规则6: 合并或下落后，顶部行有方块（y=0 被占据），游戏结束
    if (checkGameOver(result.grid)) {
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    // 生成新方块（通过 ref 读取最新的 nextValue）
    const newPiece = spawnPiece(nextValueRef.current);
    // 规则6: 新方块生成位置被占据，游戏结束
    if (!isValidMove(result.grid, newPiece.x, newPiece.y)) {
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    setCurrentPiece(newPiece);
    const newNext = generateRandomValue();
    setNextValue(newNext);
    nextValueRef.current = newNext;
  }, []);

  // 下落一格
  const moveDown = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newY = piece.y + 1;
    if (isValidMove(currentGrid, piece.x, newY)) {
      setCurrentPiece({ ...piece, y: newY });
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  // 左右移动
  const moveLeft = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newX = piece.x - 1;
    if (isValidMove(currentGrid, newX, piece.y)) {
      setCurrentPiece({ ...piece, x: newX });
    }
  }, []);

  const moveRight = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newX = piece.x + 1;
    if (isValidMove(currentGrid, newX, piece.y)) {
      setCurrentPiece({ ...piece, x: newX });
    }
  }, []);

  // 硬到底
  const hardDrop = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    let newY = piece.y;
    while (isValidMove(currentGrid, piece.x, newY + 1)) {
      newY++;
    }
    // 直接更新 ref，然后同步锁定
    currentPieceRef.current = { ...piece, y: newY };
    setCurrentPiece({ ...piece, y: newY });
    lockPiece();
  }, [lockPiece]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveLeft();
          break;
        case "ArrowRight":
          e.preventDefault();
          moveRight();
          break;
        case "ArrowDown":
          e.preventDefault();
          moveDown();
          break;
        case "ArrowUp":
          e.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveLeft, moveRight, moveDown, hardDrop]);

  // 自动下落定时器
  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const interval = setInterval(() => {
      moveDown();
    }, 500);

    return () => clearInterval(interval);
  }, [gameOver, isPaused, currentPiece, moveDown]);

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = "#bbada0";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 绘制网格背景
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const value = grid[y][x];
        ctx.fillStyle = value === 0 ? "#cdc1b4" : getBlockColor(value);
        const px = x * CELL_SIZE + 2;
        const py = y * CELL_SIZE + 2;
        const size = CELL_SIZE - 4;
        ctx.beginPath();
        drawRoundRect(ctx, px, py, size, size, 4);
        ctx.fill();

        if (value !== 0) {
          ctx.fillStyle = getTextColor(value);
          ctx.font = `bold ${value >= 1000 ? 14 : value >= 100 ? 18 : 22}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        }
      }
    }

    // 绘制当前下落方块
    if (currentPiece) {
      const { x, y, value } = currentPiece;
      if (y >= 0 && y < ROWS) {
        ctx.fillStyle = getBlockColor(value);
        const px = x * CELL_SIZE + 2;
        const py = y * CELL_SIZE + 2;
        const size = CELL_SIZE - 4;
        ctx.beginPath();
        drawRoundRect(ctx, px, py, size, size, 4);
        ctx.fill();

        ctx.fillStyle = getTextColor(value);
        ctx.font = `bold ${value >= 1000 ? 14 : value >= 100 ? 18 : 22}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
      }
    }

    // Game Over 遮罩
    if (gameOver) {
      ctx.fillStyle = "rgba(238, 228, 218, 0.73)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#776e65";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Game Over", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 20);

      ctx.font = "bold 20px Arial";
      ctx.fillText(`得分: ${score}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 20);
    }
  }, [grid, currentPiece, gameOver, score]);

  // 重新开始游戏
  const restart = useCallback(() => {
    const newGrid = createEmptyGrid();
    const firstValue = generateRandomValue();
    const nextVal = generateRandomValue();
    const piece = spawnPiece(firstValue);

    setGrid(newGrid);
    setCurrentPiece(piece);
    setNextValue(nextVal);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);

    // 同步更新 ref，避免闭包读到旧值
    currentPieceRef.current = piece;
    nextValueRef.current = nextVal;
  }, []);

  // 初始化游戏
  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <h1 className="text-3xl font-bold text-gray-800">数字消除方块</h1>

      <div className="flex gap-6 items-start">
        {/* 游戏画布 */}
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          className="rounded-lg shadow-lg"
          tabIndex={0}
        />

        {/* 侧边栏 */}
        <div className="flex flex-col gap-4 min-w-[140px]">
          {/* 得分 */}
          <div className="bg-[#bbada0] rounded-lg p-4 text-center">
            <div className="text-sm text-white/80 font-semibold">得分</div>
            <div className="text-2xl font-bold text-white">{score}</div>
          </div>

          {/* 下一个预览 */}
          <div className="bg-[#bbada0] rounded-lg p-4 text-center">
            <div className="text-sm text-white/80 font-semibold mb-2">下一个</div>
            <div className="flex justify-center">
              <div
                className="w-[50px] h-[50px] rounded-lg flex items-center justify-center font-bold text-xl"
                style={{
                  backgroundColor: getBlockColor(nextValue),
                  color: getTextColor(nextValue),
                }}
              >
                {nextValue}
              </div>
            </div>
          </div>

          {/* 结束游戏按钮 */}
          <button
            onClick={() => {
              if (gameOver) return;
              // 如果有正在下落的方块，先锁定它
              if (currentPieceRef.current) {
                const piece = currentPieceRef.current;
                const currentGrid = gridRef.current;
                const newGrid = currentGrid.map(row => [...row]);
                if (piece.y >= 0 && piece.y < ROWS && piece.x >= 0 && piece.x < COLS && newGrid[piece.y][piece.x] === 0) {
                  newGrid[piece.y][piece.x] = piece.value;
                  const result = stabilize(newGrid);
                  setGrid(result.grid);
                  setScore(prev => prev + result.scoreGained);
                }
              }
              setCurrentPiece(null);
              setGameOver(true);
            }}
            className="bg-[#c0392b] hover:bg-[#e74c3c] text-white font-bold py-2 px-4 rounded-lg transition-colors"
            disabled={gameOver}
          >
            结束游戏
          </button>

          {/* 重新开始按钮 */}
          <button
            onClick={restart}
            className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            重新开始
          </button>

          {/* 暂停/继续 */}
          <button
            onClick={() => setIsPaused(p => !p)}
            className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white font-bold py-2 px-4 rounded-lg transition-colors"
            disabled={gameOver}
          >
            {isPaused ? "继续" : "暂停"}
          </button>

          {/* 操作说明 */}
          <div className="text-xs text-gray-500 space-y-1 mt-2">
            <div>← → 左右移动</div>
            <div>↓ 加速下落</div>
            <div>↑ 直接落底</div>
          </div>
        </div>
      </div>
    </div>
  );
}
