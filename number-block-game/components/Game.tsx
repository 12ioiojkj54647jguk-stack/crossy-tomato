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

const CELL_SIZE = 30;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

// Muted pastel palette for number blocks
const VALUE_COLORS: Record<number, { bg: string; text: string }> = {
  2:     { bg: "#F5F0EB", text: "#6B5B4F" },
  4:     { bg: "#EDE8E1", text: "#5E4E42" },
  8:     { bg: "#FDEBEC", text: "#9F2F2D" },
  16:    { bg: "#E1F3FE", text: "#1F6C9F" },
  32:    { bg: "#EDF3EC", text: "#346538" },
  64:    { bg: "#FBF3DB", text: "#956400" },
  128:   { bg: "#F0E6FF", text: "#5B2D8E" },
  256:   { bg: "#FFE8E0", text: "#8B3A1A" },
  512:   { bg: "#E0F7F0", text: "#1A6B5A" },
  1024:  { bg: "#E6E0FF", text: "#3D2D6B" },
  2048:  { bg: "#FFE0F0", text: "#6B1A4A" },
};

function getBlockStyle(value: number) {
  return VALUE_COLORS[value] || { bg: "#111111", text: "#FFFFFF" };
}

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
  const [nextValue, setNextValue] = useState<number>(() => generateRandomValue());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const nextValueRef = useRef(nextValue);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const isFastDropRef = useRef(false);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { currentPieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextValueRef.current = nextValue; }, [nextValue]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece) return;

    const newGrid = currentGrid.map(row => [...row]);

    if (piece.y < 0 || piece.y >= ROWS || piece.x < 0 || piece.x >= COLS || newGrid[piece.y][piece.x] !== 0) {
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    newGrid[piece.y][piece.x] = piece.value;

    if (piece.y === 0) {
      setGrid(newGrid);
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    const result = stabilize(newGrid);
    setGrid(result.grid);
    setScore(prev => prev + result.scoreGained);

    if (checkGameOver(result.grid)) {
      setGameOver(true);
      setCurrentPiece(null);
      return;
    }

    const newPiece = spawnPiece(nextValueRef.current);
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

  const hardDrop = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    let newY = piece.y;
    while (isValidMove(currentGrid, piece.x, newY + 1)) {
      newY++;
    }
    currentPieceRef.current = { ...piece, y: newY };
    setCurrentPiece({ ...piece, y: newY });
    lockPiece();
  }, [lockPiece]);

  // 结束游戏
  const endGame = useCallback(() => {
    if (gameOverRef.current) return;
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
  }, []);

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
          isFastDropRef.current = true;
          moveDown();
          break;
        case "ArrowUp":
          e.preventDefault();
          hardDrop();
          break;
        case " ":
          e.preventDefault();
          setIsPaused(p => !p);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        isFastDropRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [moveLeft, moveRight, moveDown, hardDrop]);

  // 自动下落
  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const interval = setInterval(() => {
      moveDown();
    }, isFastDropRef.current ? 100 : 500);

    return () => clearInterval(interval);
  }, [gameOver, isPaused, currentPiece, moveDown]);

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 背景 - 暖白
    ctx.fillStyle = "#F7F6F3";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 网格线 - 极淡
    ctx.strokeStyle = "#EAEAEA";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH, y * CELL_SIZE);
      ctx.stroke();
    }

    // 方块
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const value = grid[y][x];
        if (value !== 0) {
          const { bg, text } = getBlockStyle(value);
          ctx.fillStyle = bg;
          const px = x * CELL_SIZE + 1;
          const py = y * CELL_SIZE + 1;
          const size = CELL_SIZE - 2;
          drawRoundRect(ctx, px, py, size, size, 3);
          ctx.fillStyle = text;
          ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        }
      }
    }

    // 当前下落方块
    if (currentPiece) {
      const { x, y, value } = currentPiece;
      if (y >= 0 && y < ROWS) {
        const { bg, text } = getBlockStyle(value);
        ctx.fillStyle = bg;
        const px = x * CELL_SIZE + 1;
        const py = y * CELL_SIZE + 1;
        const size = CELL_SIZE - 2;
        drawRoundRect(ctx, px, py, size, size, 3);
        ctx.fillStyle = text;
        ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
      }
    }

    // Game Over 遮罩
    if (gameOver) {
      ctx.fillStyle = "rgba(247, 246, 243, 0.85)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#111111";
      ctx.font = `600 28px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Game Over", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 16);

      ctx.fillStyle = "#787774";
      ctx.font = `400 15px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.fillText(`得分: ${score}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 16);
    }

    // 暂停遮罩
    if (isPaused && !gameOver) {
      ctx.fillStyle = "rgba(247, 246, 243, 0.85)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#111111";
      ctx.font = `600 24px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paused", BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
    }
  }, [grid, currentPiece, gameOver, score, isPaused]);

  // 重新开始
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

    currentPieceRef.current = piece;
    nextValueRef.current = nextVal;
  }, []);

  // 初始化
  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-8 select-none"
      style={{ fontFamily: '"SF Pro Display", "Geist Sans", system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">
          数字消除方块
        </h1>
        <p className="text-[12px] text-[#787774] tracking-wide">
          相邻三个相同数字自动合并
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* 游戏画布 */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            className="block"
            style={{
              borderRadius: "8px",
              border: "1px solid #EAEAEA",
              background: "#F7F6F3",
            }}
            tabIndex={0}
          />
        </div>

        {/* 侧边栏 */}
        <div className="flex flex-col gap-4 min-w-[160px]">
          {/* 得分 - Double Bezel */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-2 font-medium">
              得分
            </div>
            <div className="text-[28px] font-semibold tracking-[-0.03em] text-[#111111] tabular-nums">
              {score}
            </div>
          </div>

          {/* 下一个预览 */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">
              下一个
            </div>
            <div className="flex justify-center">
              <div
                className="w-[44px] h-[44px] flex items-center justify-center font-semibold text-[15px]"
                style={{
                  background: getBlockStyle(nextValue).bg,
                  color: getBlockStyle(nextValue).text,
                  borderRadius: "6px",
                  border: "1px solid #EAEAEA",
                }}
              >
                {nextValue}
              </div>
            </div>
          </div>

          {/* 操作说明 */}
          <div
            className="px-5 py-4"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">
              操作
            </div>
            <div className="flex flex-col gap-2">
              {[
                ["← →", "左右移动"],
                ["↓", "加速下落"],
                ["↑", "直接落底"],
                ["Space", "暂停 / 继续"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 text-[10px] font-medium"
                    style={{
                      background: "#F7F6F3",
                      border: "1px solid #EAEAEA",
                      borderRadius: "4px",
                      color: "#555",
                      fontFamily: '"SF Mono", "Geist Mono", monospace',
                    }}
                  >
                    {key}
                  </span>
                  <span className="text-[12px] text-[#787774]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 按钮组 */}
          <div className="flex flex-col gap-2">
            {/* 结束游戏 */}
            <button
              onClick={endGame}
              disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: gameOver ? "#EAEAEA" : "#111111",
                color: gameOver ? "#AAA" : "#FFFFFF",
                borderRadius: "6px",
                border: "none",
                cursor: gameOver ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#333333";
                  e.currentTarget.style.transform = "scale(0.98)";
                }
              }}
              onMouseLeave={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#111111";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              结束游戏
            </button>

            {/* 重新开始 */}
            <button
              onClick={restart}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: "#F7F6F3",
                color: "#111111",
                borderRadius: "6px",
                border: "1px solid #EAEAEA",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EAEAEA";
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F7F6F3";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              重新开始
            </button>

            {/* 暂停/继续 */}
            <button
              onClick={() => setIsPaused(p => !p)}
              disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: gameOver ? "#F7F6F3" : "#FFFFFF",
                color: gameOver ? "#AAA" : "#111111",
                borderRadius: "6px",
                border: "1px solid #EAEAEA",
                cursor: gameOver ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#F7F6F3";
                  e.currentTarget.style.transform = "scale(0.98)";
                }
              }}
              onMouseLeave={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              {isPaused ? "继续" : "暂停"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
