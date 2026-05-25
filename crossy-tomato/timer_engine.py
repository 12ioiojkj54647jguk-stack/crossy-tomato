"""
番茄钟计时引擎
"""
import time
import threading

class TimerEngine:
    def __init__(self):
        self.mode = "focus"          # focus / short / long
        self.remaining = 0            # 剩余秒数
        self.total = 0                # 总秒数
        self.running = False
        self._timer_thread = None
        self._stop_event = threading.Event()
        # 回调
        self.on_tick = None           # 每秒回调(remaining, total)
        self.on_finish = None         # 计时结束回调(mode)

    def set_mode(self, mode, duration_sec):
        """设置模式与时长"""
        self.mode = mode
        self.total = duration_sec
        self.remaining = duration_sec
        self.running = False
        self._stop_event.set()

    def start(self):
        """开始计时"""
        if self.running:
            return
        if self.remaining <= 0:
            self.remaining = self.total
        self.running = True
        self._stop_event.clear()
        self._timer_thread = threading.Thread(target=self._run, daemon=True)
        self._timer_thread.start()

    def pause(self):
        """暂停"""
        self.running = False
        self._stop_event.set()

    def reset(self):
        """重置"""
        self.running = False
        self._stop_event.set()
        self.remaining = self.total
        if self.on_tick:
            self.on_tick(self.remaining, self.total)

    def _run(self):
        """计时线程"""
        while self.running and self.remaining > 0:
            if self._stop_event.wait(1.0):
                return
            self.remaining -= 1
            if self.on_tick:
                self.on_tick(self.remaining, self.total)
        if self.running and self.remaining <= 0:
            self.running = False
            if self.on_finish:
                self.on_finish(self.mode)
