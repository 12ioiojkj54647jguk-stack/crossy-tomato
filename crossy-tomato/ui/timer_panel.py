"""
PIL 渲染的计时面板
"""
import tkinter as tk
from config import Colors, DEFAULT_DURATIONS
from ui.widgets import PILButton
from renderer import (
    wood_frame, draw_timer_display, draw_progress, draw_tab,
    font, ImageTk, ImageCache
)


class TimerPanel(tk.Frame):
    """PIL 渲染的番茄钟计时面板"""

    def __init__(self, parent, data, on_mode_change=None, theme_colors=None, **kwargs):
        super().__init__(parent, **kwargs)
        self.data = data
        self.on_mode_change = on_mode_change
        self.colors = theme_colors or {}
        self._setup_colors()

        self.current_mode = "focus"
        self.timer_running = False

        self._build_ui()

    def _setup_colors(self):
        c = self.colors
        self.bg         = c.get("bg_timer", Colors.BG_TIMER)
        self.text_color = c.get("text", Colors.TEXT)
        self.border_o   = c.get("border_outer", Colors.BORDER_OUTER)
        self.border_i   = c.get("border_inner", Colors.BORDER_INNER)
        self.highlight  = c.get("highlight", Colors.HIGHLIGHT)
        self.progress_c = c.get("progress", Colors.PROGRESS)
        self.btn_bg     = c.get("btn_bg", Colors.BTN_BG)
        self.configure(bg=self.bg)

    def _build_ui(self):
        # ─── 外层木质边框 ───
        outer = tk.Frame(self, bg=self.border_o, padx=3, pady=3)
        outer.pack(fill="x", padx=10, pady=(10, 5))
        inner = tk.Frame(outer, bg=self.border_i, padx=2, pady=2)
        inner.pack(fill="x")
        content = tk.Frame(inner, bg=self.bg, padx=15, pady=10)
        content.pack(fill="x")

        # ─── 模式切换按钮 ───
        mode_frame = tk.Frame(content, bg=self.bg)
        mode_frame.pack(fill="x", pady=(0, 8))

        self.mode_buttons = {}
        modes = [
            ("focus", "🎯 专注（25min）"),
            ("short", "☕ 短休（5min）"),
            ("long",  "🌙 长休（15min）"),
        ]
        for mode_key, mode_text in modes:
            btn = PILButton(
                mode_frame, text=mode_text, width=160, height=35,
                font_size=10, bg_c=self.bg,
                command=lambda m=mode_key: self._switch_mode(m)
            )
            btn.pack(side="left", padx=8)
            self.mode_buttons[mode_key] = btn
        self._update_mode_buttons()

        # ─── 倒计时显示（PIL 渲染） ───
        timer_display = tk.Frame(content, bg=self.bg)
        timer_display.pack(fill="x", pady=5)

        # 装饰
        tk.Label(timer_display, text="🌸", font=("Apple Color Emoji", 16),
                 bg=self.bg).pack(side="left", padx=20)
        tk.Label(timer_display, text="🌿", font=("Apple Color Emoji", 14),
                 bg=self.bg).pack(side="right", padx=20)

        self.time_canvas = tk.Canvas(timer_display, width=280, height=80,
                                     bg=self.bg, highlightthickness=0, bd=0)
        self.time_canvas.pack(side="left", expand=True)
        self._render_timer_display("25:00", "准备专注")

        # ─── 进度条（PIL 渲染） ───
        prog_h = 24
        prog_frame = tk.Frame(content, bg=self.bg)
        prog_frame.pack(fill="x", pady=5)
        self.prog_canvas = tk.Canvas(prog_frame, height=prog_h, bg=self.bg,
                                     highlightthickness=0, bd=0)
        self.prog_canvas.pack(fill="x")
        self._render_progress(0.0)

        # ─── 统计栏 ───
        stats_frame = tk.Frame(content, bg=self.bg)
        stats_frame.pack(fill="x", pady=(8, 5))
        self.stats_label = tk.Label(
            stats_frame, text=self._get_stats_text(),
            font=font(11), fg=self.text_color, bg=self.bg
        )
        self.stats_label.pack()

        # ─── 主控制按钮 ───
        ctrl_frame = tk.Frame(content, bg=self.bg)
        ctrl_frame.pack(fill="x", pady=(5, 0))

        self.btn_start = PILButton(
            ctrl_frame, text="开始", icon="▶",
            width=120, height=40, bg_c=self.bg,
            command=self._on_start_click
        )
        self.btn_start.pack(side="left", padx=20)

        self.btn_pause = PILButton(
            ctrl_frame, text="暂停", icon="⏸",
            width=120, height=40, bg_c=self.bg,
            command=self._on_pause_click
        )
        self.btn_pause.pack(side="left", padx=20)
        self.btn_pause.set_enabled(False)

        self.btn_reset = PILButton(
            ctrl_frame, text="重置", icon="🔄",
            width=120, height=40, bg_c=self.bg,
            command=self._on_reset_click
        )
        self.btn_reset.pack(side="left", padx=20)

    def _get_stats_text(self):
        total = self.data.get("total_tomatoes", 0)
        garden = self.data.get("garden", [])
        flowers = sum(1 for g in garden if g is not None)
        streak = self.data.get("streak", 0)
        return f"🍅 已完成番茄：{total}  |  🌺 花园花朵：{flowers}  |  🔥 连续打卡：{streak}天"

    def _switch_mode(self, mode):
        self.current_mode = mode
        self._update_mode_buttons()
        if self.on_mode_change:
            self.on_mode_change(mode)

    def _update_mode_buttons(self):
        for key, btn in self.mode_buttons.items():
            if key == self.current_mode:
                btn.configure(bg=self.highlight)
                btn._bg_c = self.highlight
            else:
                btn.configure(bg=self.bg)
                btn._bg_c = self.btn_bg
            btn._render()

    def _render_timer_display(self, time_str, label):
        """用 PIL 渲染计时显示"""
        self.time_canvas.delete("all")
        cw = self.time_canvas.winfo_width() or 280
        ch = self.time_canvas.winfo_height() or 80
        img = draw_timer_display(cw, ch, time_str, label,
                                 bg_c=self.bg, text_c=self.text_color)
        self._time_photo = ImageTk.PhotoImage(img)
        self.time_canvas.create_image(cw//2, ch//2, image=self._time_photo)

    def _render_progress(self, ratio):
        """用 PIL 渲染进度条"""
        self.prog_canvas.delete("all")
        cw = self.prog_canvas.winfo_width() or 400
        ch = self.prog_canvas.winfo_height() or 24
        img = draw_progress(cw, ch, ratio, bg_c=self.bg,
                            fill_c=self.progress_c, border_c=self.border_o)
        self._prog_photo = ImageTk.PhotoImage(img)
        self.prog_canvas.create_image(cw//2, ch//2, image=self._prog_photo)

    def update_display(self, remaining, total):
        mins, secs = divmod(remaining, 60)
        time_str = f"{mins:02d}:{secs:02d}"
        label = ""
        if self.timer_running:
            label = {"focus": "专注中", "short": "短休中", "long": "长休中"}.get(self.current_mode, "")
        elif remaining == total:
            label = {"focus": "准备专注", "short": "准备休息", "long": "准备休息"}.get(self.current_mode, "")
        self._render_timer_display(time_str, label)
        ratio = 1 - (remaining / total) if total > 0 else 0
        self._render_progress(ratio)

    def set_timer_state(self, running):
        self.timer_running = running
        if running:
            self.btn_start.set_enabled(False)
            self.btn_pause.set_enabled(True)
        else:
            self.btn_start.set_enabled(True)
            self.btn_pause.set_enabled(False)

    def refresh_stats(self):
        self.stats_label.configure(text=self._get_stats_text())

    def apply_theme(self, theme_colors):
        self.colors = theme_colors
        self._setup_colors()
        for widget in self.winfo_children():
            widget.destroy()
        ImageCache.clear()
        self._build_ui()

    # 回调占位（由主窗口覆盖）
    def _on_start_click(self): pass
    def _on_pause_click(self): pass
    def _on_reset_click(self): pass
