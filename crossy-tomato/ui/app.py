"""
主窗口框架：标签页 + 各面板整合
"""
import tkinter as tk
from datetime import datetime, timedelta
from config import (
    Colors, THEMES, DEFAULT_DURATIONS, WINDOW_WIDTH, WINDOW_HEIGHT,
    STAGE_BLOOM, STAGE_SEED, STAGE_SPROUT, STAGE_GROWING,
)
from timer_engine import TimerEngine
from settings_store import load, save
from garden import get_random_seed
from stats import check_achievements
from audio_manager import play_focus_end, play_break_end, play_click, play_reward, play_achievement
from ui.widgets import PILDialog, PILButton
from ui.timer_panel import TimerPanel
from ui.garden_panel import GardenPanel
from ui.shop_panel import ShopPanel
from ui.stats_panel import StatsPanel
from ui.settings_panel import SettingsPanel

class CrossyTomatoApp:
    """动森风格番茄钟主应用"""

    def __init__(self):
        # 窗口
        self.root = tk.Tk()
        self.root.title("🍅 动森番茄钟")
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.root.resizable(True, True)
        self.root.configure(bg=Colors.BG_TIMER)

        # 数据
        self.data = load()
        self.theme = self.data.get("theme", "classic")
        self.theme_colors = THEMES.get(self.theme, THEMES["classic"])

        # 计时引擎
        self.timer = TimerEngine()
        self.timer.on_tick = self._on_timer_tick
        self.timer.on_finish = self._on_timer_finish

        # 当前模式
        self.current_mode = "focus"

        # 构建UI
        self._build_ui()

        # 初始检查连续打卡
        self._check_streak()

        # 关闭时保存
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self):
        """构建主界面"""
        # ─── 顶部标签栏 ───
        tabs_frame = tk.Frame(self.root, bg=self.theme_colors["border_outer"], height=40)
        tabs_frame.pack(fill="x")
        tabs_frame.pack_propagate(False)

        self.tabs = {}
        tab_defs = [
            ("garden", "🏡 花园"),
            ("shop",   "🛒 商店"),
            ("stats",  "🏆 成就"),
            ("settings","⚙️ 设置"),
        ]

        for i, (key, label) in enumerate(tab_defs):
            btn = tk.Label(
                tabs_frame, text=label,
                font=("Arial", 11, "bold"),
                bg=self.theme_colors["border_outer"],
                fg=self.theme_colors["btn_bg"],
                padx=18, pady=8,
                cursor="hand2"
            )
            btn.pack(side="left", expand=True, fill="both")
            btn.bind("<Button-1>", lambda e, k=key: self._switch_tab(k))
            self.tabs[key] = btn

        self._highlight_tab("garden")

        # ─── 内容区 ───
        self.content_frame = tk.Frame(self.root, bg=self.theme_colors["bg_timer"])
        self.content_frame.pack(fill="both", expand=True)

        # 各页面面板
        self.panels = {}

        # 花园页 = 计时面板 + 花园画布
        garden_page = tk.Frame(self.content_frame, bg=self.theme_colors["bg_timer"])
        self.panels["garden_page"] = garden_page

        self.timer_panel = TimerPanel(
            garden_page, self.data,
            on_mode_change=self._on_mode_change,
            theme_colors=self.theme_colors
        )
        self.timer_panel.pack(fill="x")
        # 连接按钮回调
        self.timer_panel._on_start_click = self._start_timer
        self.timer_panel._on_pause_click = self._pause_timer
        self.timer_panel._on_reset_click = self._reset_timer

        self.garden_panel = GardenPanel(
            garden_page, self.data,
            on_flower_click=self._on_flower_click,
            theme_colors=self.theme_colors
        )
        self.garden_panel.pack(fill="both", expand=True)

        # 商店页
        self.shop_panel = ShopPanel(
            self.content_frame, self.data,
            on_buy=self._on_shop_buy,
            theme_colors=self.theme_colors
        )

        # 统计页
        self.stats_panel = StatsPanel(
            self.content_frame, self.data,
            theme_colors=self.theme_colors
        )

        # 设置页
        self.settings_panel = SettingsPanel(
            self.content_frame, self.data,
            on_setting_change=self._on_setting_change,
            theme_colors=self.theme_colors
        )

        self._switch_tab("garden")

    def _switch_tab(self, key):
        """切换标签页"""
        self._highlight_tab(key)
        for name, panel in [
            ("garden", self.panels.get("garden_page")),
            ("shop", self.shop_panel),
            ("stats", self.stats_panel),
            ("settings", self.settings_panel),
        ]:
            if panel is None:
                continue
            if name == key:
                panel.pack(fill="both", expand=True)
            else:
                panel.pack_forget()

    def _highlight_tab(self, active_key):
        """高亮当前标签"""
        for key, btn in self.tabs.items():
            if key == active_key:
                btn.configure(bg=self.theme_colors["highlight"], fg=self.theme_colors["text"])
            else:
                btn.configure(bg=self.theme_colors["border_outer"], fg=self.theme_colors["btn_bg"])

    # ─── 计时器控制 ───
    def _start_timer(self):
        if self.data.get("sound_click", True):
            play_click()
        durations = self.data.get("durations", DEFAULT_DURATIONS)
        self.timer.set_mode(self.current_mode, durations.get(self.current_mode, DEFAULT_DURATIONS[self.current_mode]))
        self.timer.start()
        self.timer_panel.set_timer_state(True)

    def _pause_timer(self):
        if self.data.get("sound_click", True):
            play_click()
        self.timer.pause()
        self.timer_panel.set_timer_state(False)

    def _reset_timer(self):
        if self.data.get("sound_click", True):
            play_click()
        self.timer.reset()
        self.timer_panel.set_timer_state(False)

    def _on_mode_change(self, mode):
        self.current_mode = mode
        self.timer.pause()
        durations = self.data.get("durations", DEFAULT_DURATIONS)
        self.timer.set_mode(mode, durations.get(mode, DEFAULT_DURATIONS[mode]))
        self.timer_panel.set_timer_state(False)

    def _on_timer_tick(self, remaining, total):
        """每秒更新"""
        self.root.after(0, lambda: self.timer_panel.update_display(remaining, total))

    def _on_timer_finish(self, mode):
        """计时结束"""
        self.root.after(0, lambda: self._handle_finish(mode))

    def _handle_finish(self, mode):
        """处理计时完成"""
        is_focus = (mode == "focus")

        # 音效
        if is_focus and self.data.get("sound_focus_end", True):
            play_focus_end()
        elif not is_focus and self.data.get("sound_break_end", True):
            play_break_end()

        self.timer_panel.set_timer_state(False)

        if is_focus:
            # ─── 完成一个番茄钟 ───
            self.data["total_tomatoes"] = self.data.get("total_tomatoes", 0) + 1
            self.data["bell_count"] = self.data.get("bell_count", 0) + 10

            # 每日记录
            today = datetime.now().strftime("%Y-%m-%d")
            daily_log = self.data.get("daily_log", {})
            daily_log[today] = daily_log.get(today, 0) + 1
            self.data["daily_log"] = daily_log

            # 更新单日最佳
            if daily_log[today] > self.data.get("daily_best", 0):
                self.data["daily_best"] = daily_log[today]

            # 连续打卡
            self._update_streak()

            # 检查成就
            new_achievements = check_achievements(self.data)
            if new_achievements:
                for ach in new_achievements:
                    if self.data.get("sound_focus_end", True):
                        play_achievement()
                    self._show_achievement_popup(ach)

            # 获得随机种子
            total = self.data.get("total_tomatoes", 0)
            seed = get_random_seed(total)

            # 村民庆祝
            self.garden_panel.npc_celebrate()

            # 推进花园成长
            self.garden_panel.grow_all()

            # 显示种子获得弹窗（让玩家选择种植位置）
            self._show_seed_popup(seed)

            # 刷新所有面板
            self.timer_panel.refresh_stats()
            self.garden_panel.refresh()
            self.shop_panel.refresh()
            self.stats_panel.refresh()

        else:
            # 休息结束
            self._show_break_done_popup()

    def _show_seed_popup(self, seed):
        """显示获得种子的弹窗"""
        from config import RARITY_NAMES
        name, rarity, primary, secondary, petals, shape = seed
        rarity_text = RARITY_NAMES.get(rarity, "普通")

        dialog = PILDialog(self.root, title="🌱 获得种子！", width=360, height=220)

        tk.Label(
            dialog.body, text="🎉 完成一个番茄钟！",
            font=("Arial", 14, "bold"), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack(pady=(15, 5))

        # 花朵预览色块
        preview = tk.Canvas(dialog.body, width=50, height=50,
                            bg=self.theme_colors["bg_timer"], highlightthickness=0)
        preview.pack(pady=5)
        preview.create_oval(10, 10, 40, 40, fill=primary, outline=secondary, width=2)
        preview.create_oval(20, 20, 30, 30, fill=secondary, outline="")

        tk.Label(
            dialog.body, text=f"获得种子：{name}",
            font=("Arial", 13, "bold"), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack()
        tk.Label(
            dialog.body, text=f"稀有度：{rarity_text}",
            font=("Arial", 11), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack()

        def plant_now():
            dialog.destroy()
            self._switch_tab("garden")
            self.garden_panel.set_pending_seed(seed)
            if self.data.get("sound_focus_end", True):
                play_reward()

        btn_frame = tk.Frame(dialog.body, bg=self.theme_colors["bg_timer"])
        btn_frame.pack(pady=10)

        from ui.widgets import PILButton
        PILButton(
            btn_frame, text="🌱 现在种植", width=110, height=35,
            bg=self.theme_colors["bg_timer"],
            command=plant_now
        ).pack(side="left", padx=10)

        PILButton(
            btn_frame, text="稍后种植", width=100, height=35,
            bg=self.theme_colors["bg_timer"],
            command=dialog.destroy
        ).pack(side="left", padx=10)

        dialog.center_on(self.root)

    def _show_achievement_popup(self, ach):
        """成就解锁弹窗"""
        dialog = PILDialog(self.root, title="🏆 成就解锁！", width=320, height=180)
        tk.Label(
            dialog.body, text=ach["icon"],
            font=("Arial", 36), bg=self.theme_colors["bg_timer"]
        ).pack(pady=(15, 5))
        tk.Label(
            dialog.body, text=ach["name"],
            font=("Arial", 14, "bold"), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack()
        tk.Label(
            dialog.body, text=ach["desc"],
            font=("Arial", 11), fg="#888888",
            bg=self.theme_colors["bg_timer"]
        ).pack()
        dialog.center_on(self.root)

    def _show_break_done_popup(self):
        """休息结束提示"""
        dialog = PILDialog(self.root, title="☕ 休息结束", width=300, height=150)
        tk.Label(
            dialog.body, text="休息时间结束啦！",
            font=("Arial", 14, "bold"), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack(pady=(25, 5))
        tk.Label(
            dialog.body, text="准备好开始下一个番茄钟了吗？",
            font=("Arial", 11), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack()
        dialog.center_on(self.root)

    def _on_flower_click(self, cell_idx, cell_data):
        """点击花朵显示信息"""
        from config import FLOWERS, RARITY_NAMES, STAGE_NAMES
        flower_idx = cell_data["flower_idx"]
        stage = cell_data["stage"]
        plant_date = cell_data.get("plant_date", "未知")
        flower_data = FLOWERS[flower_idx]
        name, rarity, primary, secondary, petals, shape = flower_data

        dialog = PILDialog(self.root, title="花朵信息", width=320, height=220)

        # 预览
        preview = tk.Canvas(dialog.body, width=60, height=60,
                            bg=self.theme_colors["bg_timer"], highlightthickness=0)
        preview.pack(pady=(10, 5))
        preview.create_oval(15, 15, 45, 45, fill=primary, outline=secondary, width=2)
        preview.create_oval(25, 25, 35, 35, fill=secondary, outline="")

        tk.Label(
            dialog.body, text=name,
            font=("Arial", 14, "bold"), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack()
        tk.Label(
            dialog.body, text=f"稀有度：{RARITY_NAMES.get(rarity, '普通')}  |  阶段：{STAGE_NAMES[stage]}",
            font=("Arial", 11), fg=self.theme_colors["text"],
            bg=self.theme_colors["bg_timer"]
        ).pack(pady=3)
        tk.Label(
            dialog.body, text=f"种植时间：{plant_date}",
            font=("Arial", 10), fg="#888888",
            bg=self.theme_colors["bg_timer"]
        ).pack()

        dialog.center_on(self.root)

    # ─── 打卡逻辑 ───
    def _check_streak(self):
        """启动时检查连续打卡"""
        last = self.data.get("last_date", "")
        if not last:
            return
        today = datetime.now().strftime("%Y-%m-%d")
        last_dt = datetime.strptime(last, "%Y-%m-%d")
        today_dt = datetime.strptime(today, "%Y-%m-%d")
        diff = (today_dt - last_dt).days
        if diff > 1:
            # 断签
            self.data["streak"] = 0

    def _update_streak(self):
        """更新连续打卡"""
        today = datetime.now().strftime("%Y-%m-%d")
        last = self.data.get("last_date", "")
        if last == today:
            return  # 今天已打卡
        last_dt = datetime.strptime(last, "%Y-%m-%d") if last else None
        today_dt = datetime.strptime(today, "%Y-%m-%d")
        if last_dt and (today_dt - last_dt).days == 1:
            self.data["streak"] = self.data.get("streak", 0) + 1
        else:
            self.data["streak"] = 1
        self.data["last_date"] = today

    # ─── 其他回调 ───
    def _on_shop_buy(self):
        save(self.data)
        self.timer_panel.refresh_stats()

    def _on_setting_change(self, theme_key=None):
        """设置变更"""
        if theme_key:
            self.theme = theme_key
            self.theme_colors = THEMES.get(theme_key, THEMES["classic"])
            self.timer_panel.apply_theme(self.theme_colors)
            self.garden_panel.apply_theme(self.theme_colors)
            self.shop_panel.apply_theme(self.theme_colors)
            self.stats_panel.apply_theme(self.theme_colors)
            self.settings_panel.apply_theme(self.theme_colors)
            # 更新标签栏
            for btn in self.tabs.values():
                btn.configure(bg=self.theme_colors["border_outer"])
            self._highlight_tab("settings")
        save(self.data)

    def _on_close(self):
        """关闭窗口"""
        self.timer.pause()
        save(self.data)
        self.root.destroy()

    # ─── 运行 ───
    def run(self):
        self.root.mainloop()
