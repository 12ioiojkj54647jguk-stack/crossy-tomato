"""
PIL 渲染的统计/成就面板
"""
import tkinter as tk
from config import Colors, ACHIEVEMENTS, GRID_TOTAL
from stats import get_stats_summary
from renderer import draw_stat_card, draw_badge, draw_bar_chart, tkfont, font, ImageTk, ImageCache
from datetime import datetime, timedelta


class StatsPanel(tk.Frame):
    """PIL 渲染的统计与成就页面"""

    def __init__(self, parent, data, theme_colors=None, **kwargs):
        super().__init__(parent, **kwargs)
        self.data = data
        self.colors = theme_colors or {}
        self._setup_colors()
        self._build_ui()

    def _setup_colors(self):
        c = self.colors
        self.bg = c.get("bg_timer", Colors.BG_TIMER)
        self.text_color = c.get("text", Colors.TEXT)
        self.progress_c = c.get("progress", Colors.PROGRESS)
        self.highlight = c.get("highlight", Colors.HIGHLIGHT)
        self.btn_bg = c.get("btn_bg", Colors.BTN_BG)
        self.configure(bg=self.bg)

    def _build_ui(self):
        top = tk.Frame(self, bg=self.bg)
        top.pack(fill="x", padx=15, pady=10)
        tk.Label(top, text="🏆 统计与成就", font=tkfont(16, bold=True),
                 fg=self.text_color, bg=self.bg).pack(side="left")

        container = tk.Frame(self, bg=self.bg)
        container.pack(fill="both", expand=True, padx=15, pady=5)
        canvas = tk.Canvas(container, bg=self.bg, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical", command=canvas.yview)
        self.content = tk.Frame(canvas, bg=self.bg)
        self.content.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.content, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self._populate_content()

    def _populate_content(self):
        for w in self.content.winfo_children():
            w.destroy()

        summary = get_stats_summary(self.data)
        unlocked = set(self.data.get("achievements", []))

        # ─── 数据卡片（PIL 渲染） ───
        cards_frame = tk.Frame(self.content, bg=self.bg)
        cards_frame.pack(fill="x", pady=(0, 15))

        cards_data = [
            ("🍅 总番茄数", str(summary["total"])),
            ("🔥 最长连续", f"{summary['streak']}天"),
            ("🌺 花园花卉", f"{summary['flowers']}/{GRID_TOTAL}"),
            ("⏱️ 累计专注", f"{summary['focus_hours']}h{summary['focus_mins']}m"),
        ]
        cw = 130; ch = 80
        for title, value in cards_data:
            card_img = draw_stat_card(cw, ch, title, value,
                                      bg_c=self.btn_bg, text_c=self.text_color)
            photo = ImageTk.PhotoImage(card_img)
            lbl = tk.Label(cards_frame, image=photo, bg=self.bg)
            lbl._photo = photo  # 保持引用
            lbl.pack(side="left", expand=True, fill="both", padx=4)

        # ─── 柱状图（PIL 渲染） ───
        chart_frame = tk.Frame(self.content, bg=self.bg)
        chart_frame.pack(fill="x", pady=10)
        tk.Label(chart_frame, text="📊 最近7天专注趋势", font=tkfont(12, bold=True),
                 fg=self.text_color, bg=self.bg).pack(anchor="w", pady=(0,5))

        today = datetime.now()
        days, counts = [], []
        max_c = 1
        for i in range(6, -1, -1):
            d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            days.append(d[5:])
            c = summary["daily_log"].get(d, 0)
            counts.append(c)
            if c > max_c: max_c = c

        chart_w = 500; chart_h = 120
        chart_img = draw_bar_chart(chart_w, chart_h, counts, days,
                                   bar_c=self.progress_c, text_c=self.text_color)
        self._chart_photo = ImageTk.PhotoImage(chart_img)
        chart_lbl = tk.Label(chart_frame, image=self._chart_photo, bg=self.bg)
        chart_lbl.pack()

        # ─── 成就徽章（PIL 渲染） ───
        ach_frame = tk.Frame(self.content, bg=self.bg)
        ach_frame.pack(fill="x", pady=10)
        tk.Label(ach_frame, text="🏅 成就徽章", font=tkfont(12, bold=True),
                 fg=self.text_color, bg=self.bg).pack(anchor="w", pady=(0,5))

        ach_grid = tk.Frame(ach_frame, bg=self.bg)
        ach_grid.pack(fill="x")

        badge_size = 70
        for i, ach in enumerate(ACHIEVEMENTS):
            row, col = divmod(i, 4)
            is_unlocked = ach["id"] in unlocked
            badge_img = draw_badge(badge_size, ach["icon"], ach["name"],
                                   is_unlocked, bg_c=self.highlight)
            photo = ImageTk.PhotoImage(badge_img)
            cell = tk.Frame(ach_grid, bg=self.bg)
            cell.grid(row=row, column=col, padx=5, pady=5, sticky="nsew")
            lbl = tk.Label(cell, image=photo, bg=self.bg)
            lbl._photo = photo
            lbl.pack()
            tk.Label(cell, text=ach["name"], font=tkfont(9, bold=True),
                     fg=self.text_color if is_unlocked else "#A08060",
                     bg=self.bg).pack()
            tk.Label(cell, text=ach["desc"], font=tkfont(8),
                     fg="#888" if is_unlocked else "#B0A090",
                     bg=self.bg, wraplength=120).pack()

    def refresh(self):
        self._populate_content()

    def apply_theme(self, tc):
        self.colors = tc
        self._setup_colors()
        ImageCache.clear()
        for w in self.winfo_children():
            w.destroy()
        self._build_ui()

