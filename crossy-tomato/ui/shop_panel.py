"""
PIL 渲染的商店面板
"""
import tkinter as tk
from config import Colors, SHOP_ITEMS, FLOWERS, FLOWERS_BY_RARITY
from renderer import draw_shop_card, font, ImageTk, ImageCache
from ui.widgets import PILButton, PILDialog


class ShopPanel(tk.Frame):
    """铃钱商店"""

    def __init__(self, parent, data, on_buy=None, theme_colors=None, **kwargs):
        super().__init__(parent, **kwargs)
        self.data = data
        self.on_buy = on_buy
        self.colors = theme_colors or {}
        self._setup_colors()
        self._build_ui()

    def _setup_colors(self):
        c = self.colors
        self.bg = c.get("bg_timer", Colors.BG_TIMER)
        self.text_color = c.get("text", Colors.TEXT)
        self.configure(bg=self.bg)

    def _build_ui(self):
        # 顶部
        top = tk.Frame(self, bg=self.bg)
        top.pack(fill="x", padx=15, pady=10)
        self.bell_label = tk.Label(
            top, text=f"💰 铃钱：{self.data.get('bell_count', 0)}",
            font=font(16, bold=True), fg=self.text_color, bg=self.bg
        ).pack(side="left")
        tk.Label(top, text="🛒 商店", font=font(16, bold=True),
                 fg=self.text_color, bg=self.bg).pack(side="right")

        # 可滚动商品列表
        container = tk.Frame(self, bg=self.bg)
        container.pack(fill="both", expand=True, padx=15, pady=5)
        canvas = tk.Canvas(container, bg=self.bg, highlightthickness=0)
        scrollbar = tk.Scrollbar(container, orient="vertical", command=canvas.yview)
        self.items_frame = tk.Frame(canvas, bg=self.bg)
        self.items_frame.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.items_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self._populate_items()

    def _populate_items(self):
        for w in self.items_frame.winfo_children():
            w.destroy()
        bell = self.data.get("bell_count", 0)
        for item in SHOP_ITEMS:
            self._create_item_row(item, bell)
            tk.Frame(self.items_frame, bg="#C4A484", height=1).pack(fill="x", padx=5)

    def _create_item_row(self, item, bell):
        row = tk.Frame(self.items_frame, bg=self.bg, pady=4)
        row.pack(fill="x", padx=5, pady=2)

        can = bell >= item["price"]
        # PIL 商品卡片
        cw = 440; ch = 64
        card_img = draw_shop_card(cw, ch, item["icon"], item["name"],
                                   item["desc"], item["price"], can,
                                   bg_c=self.btn_bg, border_c=self.border_i)
        self._card_photo = ImageTk.PhotoImage(card_img)
        card_label = tk.Label(row, image=self._card_photo, bg=self.bg)
        card_label.pack(side="left", fill="x", expand=True)

        # 购买按钮
        btn = PILButton(row, text="购买", width=80, height=32,
                        enabled=can, bg_c=self.bg,
                        command=lambda i=item: self._buy_item(i))
        btn.pack(side="right", padx=8)

    def _buy_item(self, item):
        bell = self.data.get("bell_count", 0)
        if bell < item["price"]:
            return
        self.data["bell_count"] = bell - item["price"]
        if item["type"] == "seed":
            inv = self.data.get("inventory", [])
            inv.append(item)
            self.data["inventory"] = inv
            self._show_result(f"获得了 {item['icon']} {item['name']}！\n去花园种下它吧～")
        elif item["type"] == "decor":
            dec = self.data.get("decor", [])
            dec.append(item)
            self.data["decor"] = dec
            self._show_result(f"购买了 {item['icon']} {item['name']}！\n已应用到花园～")
        if self.on_buy:
            self.on_buy()
        self.bell_label.configure(text=f"💰 铃钱：{self.data.get('bell_count', 0)}")
        self._populate_items()

    def _show_result(self, msg):
        d = PILDialog(self.winfo_toplevel(), title="购买成功！", width=300, height=150,
                      bg_c=self.bg)
        tk.Label(d.body, text=msg, font=font(12),
                 fg=self.text_color, bg=self.bg, justify="center").pack(expand=True, pady=20)
        d.center_on(self.winfo_toplevel())

    def refresh(self):
        self.bell_label.configure(text=f"💰 铃钱：{self.data.get('bell_count', 0)}")
        self._populate_items()

    def apply_theme(self, tc):
        self.colors = tc
        self._setup_colors()
        ImageCache.clear()
        for w in self.winfo_children():
            w.destroy()
        self._build_ui()

    @property
    def btn_bg(self):
        return self.colors.get("btn_bg", Colors.BTN_BG)

    @property
    def border_i(self):
        return self.colors.get("border_inner", Colors.BORDER_INNER)
