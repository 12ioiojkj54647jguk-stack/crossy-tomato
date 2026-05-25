"""
村民NPC系统
"""
import random
import time
from config import NPCS

class NPC:
    def __init__(self, canvas, x, y, data, size=40):
        self.canvas = canvas
        self.x = x
        self.y = y
        self.data = data
        self.size = size
        self.items = []
        self._anim_offset = 0
        self._anim_dir = 1
        self._draw()

    def _draw(self):
        """绘制村民（圆润可爱风格）"""
        s = self.size
        c = self.data["color"]
        # 身体（椭圆）
        self.items.append(self.canvas.create_oval(
            self.x - s*0.3, self.y - s*0.1,
            self.x + s*0.3, self.y + s*0.4,
            fill=c, outline="#5C3D2E", width=2
        ))
        # 头（圆）
        self.items.append(self.canvas.create_oval(
            self.x - s*0.25, self.y - s*0.45,
            self.x + s*0.25, self.y + s*0.05,
            fill=c, outline="#5C3D2E", width=2
        ))
        # 眼睛
        for dx in [-0.08, 0.08]:
            self.items.append(self.canvas.create_oval(
                self.x + dx*s - s*0.03, self.y - s*0.3,
                self.x + dx*s + s*0.03, self.y - s*0.24,
                fill="#5C3D2E", outline=""
            ))
        # 嘴巴（微笑弧线）
        self.items.append(self.canvas.create_arc(
            self.x - s*0.06, self.y - s*0.25,
            self.x + s*0.06, self.y - s*0.18,
            start=0, extent=-180, style="arc", outline="#5C3D2E", width=2
        ))
        # 名字标签
        self.items.append(self.canvas.create_text(
            self.x, self.y + s*0.55,
            text=self.data["name"], fill="#5C3D2E",
            font=("Arial", 9, "bold")
        ))

    def animate(self):
        """小幅摆动动画"""
        self._anim_offset += 0.3 * self._anim_dir
        if abs(self._anim_offset) > 3:
            self._anim_dir *= -1
        for item in self.items:
            self.canvas.move(item, 0, self._anim_dir * 0.3)

    def celebrate(self):
        """完成番茄钟时的庆祝：上下跳动"""
        for _ in range(3):
            for item in self.items:
                self.canvas.move(item, 0, -3)
            self.canvas.update()
            time.sleep(0.1)
            for item in self.items:
                self.canvas.move(item, 0, 3)
            self.canvas.update()
            time.sleep(0.1)

    def get_random_line(self):
        """获取随机台词"""
        return random.choice(self.data["lines"])

    def destroy(self):
        """清除绘制"""
        for item in self.items:
            self.canvas.delete(item)
        self.items.clear()
