"""
PIL 渲染的花园面板：6×5 网格 + 村民NPC + 动画
"""
import tkinter as tk
import random
import time
from config import (
    Colors, GRID_COLS, GRID_ROWS, GRID_TOTAL,
    STAGE_SEED, STAGE_SPROUT, STAGE_GROWING, STAGE_BLOOM, STAGE_NAMES,
    RARITY_COLORS, RARITY_NAMES, FLOWERS,
)
from renderer import (
    grass_bg, draw_flower, draw_npc, draw_cloud,
    draw_button, font, tkfont, font_emoji, ImageTk, ImageCache
)
from PIL import Image
from ui.widgets import PILDialog


class GardenPanel(tk.Frame):
    """PIL 渲染的花园画布"""

    def __init__(self, parent, data, theme_colors=None,
                 on_flower_click=None, **kwargs):
        super().__init__(parent, **kwargs)
        self.data = data
        self.on_flower_click = on_flower_click
        self.colors = theme_colors or {}
        self._setup_colors()

        # 拖拽
        self._drag_cell = None
        self._drag_data = None

        # 动画
        self._clouds = []
        self._butterflies = []
        self._npcs = []
        self._npc_photos = []

        # 种植
        self._pending_seed = None
        self._selecting_cell = False

        # PIL 图片引用保持
        self._bg_photo = None
        self._cell_photos = {}

        self._build_ui()
        self._start_animations()

    def _setup_colors(self):
        c = self.colors
        self.bg_garden = c.get("bg_garden", Colors.BG_GARDEN)
        self.text_color = c.get("text", Colors.TEXT)
        self.border_i = c.get("border_inner", Colors.BORDER_INNER)
        self.configure(bg=self.bg_garden)

    def _build_ui(self):
        self.canvas = tk.Canvas(self, bg=self.bg_garden, highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True, padx=5, pady=5)
        self.canvas.bind("<Configure>", self._on_resize)
        self.canvas.bind("<Button-1>", self._on_click)

    def _on_resize(self, event=None):
        self._draw_garden()

    def _draw_garden(self):
        """绘制整个花园（PIL 背景 + Canvas 叠加）"""
        self.canvas.delete("all")
        self._cell_photos.clear()

        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        if w < 10 or h < 10:
            return

        npc_w = 110
        garden_w = w - npc_w - 20
        garden_h = h - 20
        cell_w = garden_w / GRID_COLS
        cell_h = garden_h / GRID_ROWS
        ox, oy = 10, 10

        # ─── PIL 草地背景 ───
        bg_img = grass_bg(w, h, self.bg_garden)
        self._bg_photo = ImageTk.PhotoImage(bg_img)
        self.canvas.create_image(0, 0, anchor="nw", image=self._bg_photo)

        # ─── 网格 + 花朵 ───
        garden = self.data.get("garden", [None] * GRID_TOTAL)
        cell_size = int(min(cell_w, cell_h) * 0.42)

        for row in range(GRID_ROWS):
            for col in range(GRID_COLS):
                idx = row * GRID_COLS + col
                cx = int(ox + col * cell_w + cell_w / 2)
                cy = int(oy + row * cell_h + cell_h / 2)

                # 格子边框
                m = 3
                self.canvas.create_rectangle(
                    int(ox+col*cell_w+m), int(oy+row*cell_h+m),
                    int(ox+(col+1)*cell_w-m), int(oy+(row+1)*cell_h-m),
                    fill="", outline=self.border_i, width=1, stipple="gray50"
                )

                # 花朵
                if garden[idx] is not None:
                    cell = garden[idx]
                    fd = FLOWERS[cell["flower_idx"]]
                    stage = cell["stage"]
                    f_img = draw_flower(cell_size * 2, fd, stage)
                    photo = ImageTk.PhotoImage(f_img)
                    self._cell_photos[idx] = photo
                    self.canvas.create_image(cx, cy, image=photo)

                    # 稀有度光环
                    if stage == STAGE_BLOOM:
                        rc = RARITY_COLORS.get(fd[1], "#8BC34A")
                        r = int(cell_size * 0.6)
                        self.canvas.create_oval(cx-r, cy-r, cx+r, cy+r,
                                                fill="", outline=rc, width=2, dash=(3,3))

        # ─── 装饰：云朵 ───
        self._clouds.clear()
        for i in range(3):
            cx = 80 + i * 200
            cy = 25 + i * 15
            cimg = draw_cloud(80, 40)
            cphoto = ImageTk.PhotoImage(cimg)
            cid = self.canvas.create_image(cx, cy, image=cphoto)
            self._clouds.append({"id": cid, "photo": cphoto,
                                  "x": cx, "y": cy, "speed": 0.15 + i*0.08})

        # ─── 装饰：蝴蝶 ───
        self._butterflies.clear()
        for i in range(2):
            bx = random.randint(50, max(w-150, 60))
            by = random.randint(40, max(h-40, 50))
            bimg = Image.new("RGBA", (24, 24), (0,0,0,0))
            bd = tk.Canvas(tk.Tk(), width=24, height=24)  # dummy
            # 用 emoji 代替复杂绘制
            bphoto = None
            bid = self.canvas.create_text(bx, by, text="🦋",
                                          font=("Apple Color Emoji", 14))
            self._butterflies.append({
                "id": bid, "x": bx, "y": by,
                "dx": random.choice([-1,1]) * random.uniform(0.3, 0.7),
                "dy": random.choice([-1,1]) * random.uniform(0.2, 0.5),
            })

        # ─── NPC 村民 ───
        self._npcs.clear()
        self._npc_photos.clear()
        npc_x = w - npc_w + 55
        npc_spacing = h // 5
        from config import NPCS
        for i, npc_data in enumerate(NPCS):
            npc_y = 40 + npc_spacing * (i + 1)
            npc_img = draw_npc(60, npc_data["name"], npc_data["color"])
            npc_photo = ImageTk.PhotoImage(npc_img)
            nid = self.canvas.create_image(npc_x, npc_y, image=npc_photo)
            name_id = self.canvas.create_text(
                npc_x, npc_y + 40, text=npc_data["name"],
                fill=self.text_color, font=tkfont(10, bold=True)
            )
            self._npcs.append({
                "id": nid, "name_id": name_id, "photo": npc_photo,
                "x": npc_x, "y": npc_y,
                "data": npc_data, "base_y": npc_y,
                "oscillate": 0, "osc_dir": 1,
            })

        # ─── NPC 区域标签 ───
        self.canvas.create_text(
            npc_x, 25, text="🏘️ 邻居",
            fill=self.text_color, font=tkfont(10, bold=True)
        )

        # ─── 种植提示 ───
        if self._selecting_cell and self._pending_seed:
            self.canvas.create_text(
                w//2, h-15, text="🌱 点击一个空格子种下种子",
                fill=self.text_color, font=tkfont(12, bold=True),
                tags=("hint",)
            )

    def _start_animations(self):
        self._animate()

    def _animate(self):
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()

        # 云朵飘动
        for c in self._clouds:
            c["x"] += c["speed"]
            if c["x"] > w + 50:
                c["x"] = -50
            try:
                self.canvas.coords(c["id"], int(c["x"]), c["y"])
            except Exception:
                pass

        # 蝴蝶飞舞
        for b in self._butterflies:
            b["x"] += b["dx"]
            b["y"] += b["dy"]
            if b["x"] < 30 or b["x"] > w - 130:
                b["dx"] *= -1
            if b["y"] < 30 or b["y"] > h - 30:
                b["dy"] *= -1
            if random.random() < 0.02:
                b["dx"] = random.choice([-1,1]) * random.uniform(0.3, 0.7)
                b["dy"] = random.choice([-1,1]) * random.uniform(0.2, 0.5)
            try:
                self.canvas.coords(b["id"], int(b["x"]), int(b["y"]))
            except Exception:
                pass

        # NPC 摆动
        for npc in self._npcs:
            npc["oscillate"] += 0.4 * npc["osc_dir"]
            if abs(npc["oscillate"]) > 3:
                npc["osc_dir"] *= -1
            ny = npc["base_y"] + npc["oscillate"]
            try:
                self.canvas.coords(npc["id"], npc["x"], int(ny))
                self.canvas.coords(npc["name_id"], npc["x"], int(ny) + 40)
            except Exception:
                pass

        self.after(100, self._animate)

    def _on_click(self, event):
        cell = self._get_cell_at(event.x, event.y)
        if cell is None:
            self._check_npc_click(event.x, event.y)
            return

        if self._selecting_cell and self._pending_seed:
            garden = self.data.get("garden", [None] * GRID_TOTAL)
            if garden[cell] is None:
                self._plant_seed(cell)
        else:
            garden = self.data.get("garden", [None] * GRID_TOTAL)
            if garden[cell] is not None:
                self._drag_cell = cell
                self._drag_data = garden[cell]
                if self.on_flower_click:
                    self.on_flower_click(cell, garden[cell])

    def _get_cell_at(self, x, y):
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        npc_w = 110
        gw = w - npc_w - 20
        gh = h - 20
        cw = gw / GRID_COLS
        ch = gh / GRID_ROWS
        ox, oy = 10, 10
        for row in range(GRID_ROWS):
            for col in range(GRID_COLS):
                x1, y1 = ox+col*cw, oy+row*ch
                x2, y2 = x1+cw, y1+ch
                if x1 <= x <= x2 and y1 <= y <= y2:
                    return row * GRID_COLS + col
        return None

    def _check_npc_click(self, x, y):
        w = self.canvas.winfo_width()
        npc_x = w - 110 + 55
        for npc in self._npcs:
            if abs(x - npc["x"]) < 30 and abs(y - npc["y"]) < 45:
                self._show_npc_dialog(npc)
                break

    def _show_npc_dialog(self, npc):
        line = random.choice(npc["data"]["lines"])
        name = npc["data"]["name"]
        dialog = PILDialog(self.winfo_toplevel(), title=name, width=320, height=180,
                           bg_c=self.colors.get("bg_timer", Colors.BG_TIMER))
        tk.Label(dialog.body, text=name, font=tkfont(14, bold=True),
                 fg=self.text_color, bg=self.colors.get("bg_timer", Colors.BG_TIMER)).pack(pady=(15,5))
        tk.Label(dialog.body, text=f"「{line}」", font=tkfont(12),
                 fg=self.text_color, bg=self.colors.get("bg_timer", Colors.BG_TIMER),
                 wraplength=260, justify="center").pack(pady=10)
        dialog.center_on(self.winfo_toplevel())

    def set_pending_seed(self, flower_data):
        self._pending_seed = flower_data
        self._selecting_cell = True
        self._draw_garden()

    def _plant_seed(self, cell_idx):
        if self._pending_seed is None:
            return
        garden = self.data.get("garden", [None] * GRID_TOTAL)
        flower_idx = FLOWERS.index(self._pending_seed)
        garden[cell_idx] = {
            "flower_idx": flower_idx,
            "stage": STAGE_SEED,
            "plant_date": time.strftime("%Y-%m-%d %H:%M"),
        }
        self.data["garden"] = garden
        self._pending_seed = None
        self._selecting_cell = False
        self._draw_garden()

    def npc_celebrate(self):
        """村民庆祝动画"""
        for npc in self._npcs:
            base = npc["base_y"]
            for offset in [-8, -4, 0, -4, -8, 0]:
                npc["base_y"] = base + offset
                self.canvas.coords(npc["id"], npc["x"], int(base+offset))
                self.canvas.update()
                time.sleep(0.08)
            npc["base_y"] = base

    def grow_all(self):
        garden = self.data.get("garden", [])
        changed = False
        for cell in garden:
            if cell is not None and cell["stage"] < STAGE_BLOOM:
                cell["stage"] += 1
                changed = True
        if changed:
            self._draw_garden()

    def apply_theme(self, tc):
        self.colors = tc
        self._setup_colors()
        ImageCache.clear()
        self._draw_garden()

    def refresh(self):
        self._draw_garden()
