"""
PIL 渲染的设置面板
"""
import tkinter as tk
from config import Colors, THEMES, DEFAULT_DURATIONS
from renderer import draw_toggle, draw_slider_track, tkfont, font, ImageTk, ImageCache
from ui.widgets import PILButton, PILDialog


class SettingsPanel(tk.Frame):
    """PIL 渲染的设置页面"""

    def __init__(self, parent, data, on_setting_change=None, theme_colors=None, **kwargs):
        super().__init__(parent, **kwargs)
        self.data = data
        self.on_setting_change = on_setting_change
        self.colors = theme_colors or {}
        self._setup_colors()
        self._build_ui()

    def _setup_colors(self):
        c = self.colors
        self.bg = c.get("bg_timer", Colors.BG_TIMER)
        self.text_color = c.get("text", Colors.TEXT)
        self.configure(bg=self.bg)

    def _build_ui(self):
        top = tk.Frame(self, bg=self.bg)
        top.pack(fill="x", padx=15, pady=10)
        tk.Label(top, text="⚙️ 设置", font=tkfont(16, bold=True),
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
        durations = self.data.get("durations", DEFAULT_DURATIONS)

        # ─── 时长设置 ───
        self._section("⏱️ 计时时长")
        self._slider("专注时长", durations.get("focus",25*60), 5, 60, "focus")
        self._slider("短休时长", durations.get("short",5*60), 1, 30, "short")
        self._slider("长休时长", durations.get("long",15*60), 5, 60, "long")

        # ─── 音效 ───
        self._section("🔊 音效设置")
        self._switch("专注结束提示音", "sound_focus_end")
        self._switch("休息结束提示音", "sound_break_end")
        self._switch("按钮点击音效", "sound_click")

        # ─── 主题 ───
        self._section("🎨 主题配色")
        self.theme_var = tk.StringVar(value=self.data.get("theme","classic"))
        for key, theme in THEMES.items():
            rb = tk.Radiobutton(
                self.content, text=theme["name"], variable=self.theme_var, value=key,
                font=tkfont(11), fg=self.text_color, bg=self.bg,
                selectcolor=self.bg, activebackground=self.bg,
                command=self._on_theme_change
            )
            rb.pack(anchor="w", padx=20, pady=3)

        # ─── 花园重置 ───
        self._section("⚠️ 危险操作")
        PILButton(self.content, text="🗑️ 重置花园", width=140, height=38,
                  bg_c=self.bg, command=self._confirm_reset).pack(pady=5)
        tk.Label(self.content, text="⚠️ 此操作将清空所有花园进度，不可恢复！",
                 font=tkfont(9), fg="#E57373", bg=self.bg).pack()

    def _section(self, text):
        tk.Frame(self.content, bg="#C4A484", height=1).pack(fill="x", pady=(15,8))
        tk.Label(self.content, text=text, font=tkfont(12, bold=True),
                 fg=self.text_color, bg=self.bg).pack(anchor="w", pady=(0,5))

    def _slider(self, label, value, min_v, max_v, key):
        frame = tk.Frame(self.content, bg=self.bg)
        frame.pack(fill="x", pady=3, padx=10)
        tk.Label(frame, text=label, font=tkfont(11),
                 fg=self.text_color, bg=self.bg, width=10, anchor="w").pack(side="left")
        var = tk.IntVar(value=value//60)
        tk.Scale(frame, from_=min_v, to=max_v, orient="horizontal", variable=var,
                 bg=self.bg, fg=self.text_color, highlightthickness=0,
                 troughcolor="#C4A484", length=200,
                 command=lambda v,k=key: self._on_dur(k,int(v))).pack(side="left", padx=10)
        vl = tk.Label(frame, text=f"{value//60} 分钟", font=tkfont(11, bold=True),
                      fg=self.text_color, bg=self.bg, width=8)
        vl.pack(side="left")

    def _switch(self, label, key):
        frame = tk.Frame(self.content, bg=self.bg)
        frame.pack(fill="x", pady=3, padx=10)
        tk.Label(frame, text=label, font=tkfont(11),
                 fg=self.text_color, bg=self.bg, anchor="w").pack(side="left")
        var = tk.BooleanVar(value=self.data.get(key, True))
        cb = tk.Checkbutton(frame, variable=var, bg=self.bg,
                            activebackground=self.bg, selectcolor=self.bg,
                            command=lambda k=key,v=var: self._on_sw(k,v))
        cb.pack(side="right", padx=10)

    def _on_dur(self, key, mins):
        self.data["durations"][key] = mins * 60
        if self.on_setting_change: self.on_setting_change()

    def _on_sw(self, key, var):
        self.data[key] = var.get()
        if self.on_setting_change: self.on_setting_change()

    def _on_theme_change(self):
        tk = self.theme_var.get()
        self.data["theme"] = tk
        if self.on_setting_change: self.on_setting_change(theme_key=tk)

    def _confirm_reset(self):
        d = PILDialog(self.winfo_toplevel(), title="⚠️ 确认重置", width=350, height=200,
                      bg_c=self.bg)
        tk.Label(d.body, text="确定要清空花园吗？", font=tkfont(14, bold=True),
                 fg="#E57373", bg=self.bg).pack(pady=(20,5))
        tk.Label(d.body, text="所有花朵和进度都将丢失，\n此操作不可恢复！",
                 font=tkfont(11), fg=self.text_color, bg=self.bg, justify="center").pack(pady=5)
        bf = tk.Frame(d.body, bg=self.bg)
        bf.pack(pady=15)
        PILButton(bf, text="确定重置", width=100, height=35, bg_c=self.bg,
                  command=lambda: self._do_reset(d)).pack(side="left", padx=10)
        PILButton(bf, text="取消", width=100, height=35, bg_c=self.bg,
                  command=d.destroy).pack(side="left", padx=10)
        d.center_on(self.winfo_toplevel())

    def _do_reset(self, dialog):
        from config import GRID_TOTAL
        self.data["garden"] = [None]*GRID_TOTAL
        self.data["bell_count"] = 0
        self.data["inventory"] = []
        self.data["decor"] = []
        dialog.destroy()
        if self.on_setting_change: self.on_setting_change()

    def apply_theme(self, tc):
        self.colors = tc
        self._setup_colors()
        ImageCache.clear()
        for w in self.winfo_children():
            w.destroy()
        self._build_ui()
