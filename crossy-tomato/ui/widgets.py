"""
PIL 渲染的UI组件：木质按钮、弹窗等
"""
import tkinter as tk
from config import Colors
from renderer import draw_button, font, ImageTk


class PILButton(tk.Label):
    """用 PIL 渲染图片的交互按钮"""

    def __init__(self, parent, text, icon="", width=120, height=40,
                 command=None, font_size=11, enabled=True,
                 bg_c=None, fg_c=None, outer_c=None, inner_c=None, **kwargs):
        # 过滤掉 tk.Label 不支持的参数
        label_kwargs = {}
        for k, v in kwargs.items():
            if k not in ('font_size',):
                label_kwargs[k] = v
        super().__init__(parent, bg=bg_c or Colors.BG_TIMER,
                         cursor="hand2", **label_kwargs)
        self._text = text
        self._icon = icon
        self._cmd = command
        self._enabled = enabled
        self._btn_w = width
        self._btn_h = height
        self._font_size = font_size
        self._state = "normal"
        self._bg_c  = bg_c  or Colors.BTN_BG
        self._fg_c  = fg_c  or Colors.TEXT
        self._outer = outer_c or Colors.BORDER_OUTER
        self._inner = inner_c or Colors.BORDER_INNER
        self._render()
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<ButtonRelease-1>", self._on_release)

    def _render(self):
        display = f"{self._icon} {self._text}" if self._icon else self._text
        st = "disabled" if not self._enabled else self._state
        img = draw_button(self._btn_w, self._btn_h, display, state=st,
                          bg_c=self._bg_c, fg_c=self._fg_c,
                          outer_c=self._outer, inner_c=self._inner)
        self._photo = ImageTk.PhotoImage(img)
        self.configure(image=self._photo)

    def _on_enter(self, e):
        if self._enabled:
            self._state = "hover"
            self._render()

    def _on_leave(self, e):
        if self._enabled:
            self._state = "normal"
            self._render()

    def _on_press(self, e):
        if self._enabled:
            self._state = "pressed"
            self._render()

    def _on_release(self, e):
        if self._enabled:
            self._state = "normal"
            self._render()
            if self._cmd:
                self._cmd()

    def set_enabled(self, enabled):
        self._enabled = enabled
        self._state = "normal"
        self._render()

    def set_text(self, text):
        self._text = text
        self._render()


class PILDialog(tk.Toplevel):
    """PIL 渲染的动森风格弹窗"""

    def __init__(self, parent, title="", width=400, height=300, modal=True,
                 bg_c=None, text_c=None):
        super().__init__(parent)
        self._bg_c = bg_c or Colors.BG_TIMER
        self._text_c = text_c or Colors.TEXT
        self.configure(bg=self._bg_c)
        self.geometry(f"{width}x{height}")
        self.resizable(False, False)
        self.transient(parent)
        if modal:
            self.grab_set()

        # 标题栏
        title_h = 36
        title_frame = tk.Frame(self, bg=Colors.BORDER_OUTER, height=title_h)
        title_frame.pack(fill="x")
        title_frame.pack_propagate(False)
        tk.Label(title_frame, text=f" {title}", bg=Colors.BORDER_OUTER,
                 fg=Colors.BTN_BG, font=font(13, bold=True),
                 anchor="w", padx=10).pack(fill="both", expand=True)

        # 内容区
        self.body = tk.Frame(self, bg=self._bg_c)
        self.body.pack(fill="both", expand=True, padx=12, pady=10)

        # 关闭按钮
        btn_frame = tk.Frame(self, bg=self._bg_c)
        btn_frame.pack(fill="x", padx=12, pady=(0, 10))
        PILButton(btn_frame, text="关闭", width=80, height=32,
                  bg_c=self._bg_c, command=self.destroy).pack(side="right")

    def center_on(self, parent):
        self.update_idletasks()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        pw, ph = parent.winfo_width(), parent.winfo_height()
        x = px + (pw - self.winfo_width()) // 2
        y = py + (ph - self.winfo_height()) // 2
        self.geometry(f"+{x}+{y}")
