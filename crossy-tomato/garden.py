"""
花园系统：花朵绘制、成长逻辑、种子获取
"""
import random
import time
from config import (
    FLOWERS, FLOWERS_BY_RARITY,
    RARITY_COMMON, RARITY_UNCOMMON, RARITY_RARE,
    STAGE_SEED, STAGE_SPROUT, STAGE_GROWING, STAGE_BLOOM, STAGE_NAMES,
    GRID_COLS, GRID_ROWS, GRID_TOTAL,
)

# ─── 种子获取 ───
def get_random_seed(total_tomatoes):
    """
    根据累计番茄数决定可获得的种子稀有度
    基础花始终可出；累计10个解锁中级；累计50个解锁高级
    概率：基础70%、中级20%、高级10%
    """
    roll = random.random()
    if roll < 0.70 or total_tomatoes < 10:
        pool = FLOWERS_BY_RARITY[RARITY_COMMON]
    elif roll < 0.90 or total_tomatoes < 50:
        pool = FLOWERS_BY_RARITY[RARITY_COMMON] + FLOWERS_BY_RARITY[RARITY_UNCOMMON]
    else:
        pool = FLOWERS
    return random.choice(pool)

# ─── 花朵 Canvas 绘制 ───
def draw_flower(canvas, cx, cy, size, flower_data, stage, theme_colors=None):
    """
    在 Canvas 上绘制指定阶段的花朵
    canvas: Tkinter Canvas
    cx, cy: 中心坐标
    size: 绘制尺寸
    flower_data: (名称, 稀有度, 主色, 次色, 花瓣数, 花型)
    stage: 0=种子 1=发芽 2=幼苗 3=盛开
    返回创建的 item id 列表
    """
    items = []
    name, rarity, primary, secondary, petal_count, shape = flower_data

    if stage == STAGE_SEED:
        # 种子：棕色小椭圆 + 微微露出绿点
        r = size * 0.15
        items.append(canvas.create_oval(
            cx-r, cy-r*0.6, cx+r, cy+r*0.6,
            fill="#8B6B4D", outline="#5C3D2E", width=1, tags=("flower",)
        ))
        items.append(canvas.create_arc(
            cx-r*0.4, cy-r*0.8, cx+r*0.4, cy,
            start=0, extent=180, fill="#A7D9A6", outline="#7EC878",
            tags=("flower",)
        ))
    elif stage == STAGE_SPROUT:
        # 发芽：小绿芽从土里钻出
        # 土
        items.append(canvas.create_oval(
            cx-size*0.25, cy+size*0.1, cx+size*0.25, cy+size*0.3,
            fill="#C4A484", outline="#8B6B4D", width=1, tags=("flower",)
        ))
        # 两片小叶子
        for dx, rot in [(-1, -30), (1, 30)]:
            items.append(canvas.create_oval(
                cx + dx*size*0.15 - size*0.12, cy - size*0.1,
                cx + dx*size*0.15 + size*0.12, cy + size*0.15,
                fill="#7EC878", outline="#5A9A5A", width=1,
                tags=("flower",)
            ))
    elif stage == STAGE_GROWING:
        # 幼苗：细茎 + 小叶片
        stem_h = size * 0.35
        items.append(canvas.create_line(
            cx, cy+size*0.15, cx, cy-stem_h,
            fill="#5A9A5A", width=max(2, size*0.04), tags=("flower",)
        ))
        # 叶片
        for dx, angle in [(-1, 45), (1, -45)]:
            lx = cx + dx * size * 0.2
            ly = cy - stem_h * 0.4
            items.append(canvas.create_oval(
                lx-size*0.12, ly-size*0.08, lx+size*0.12, ly+size*0.08,
                fill="#7EC878", outline="#5A9A5A", width=1, tags=("flower",)
            ))
    elif stage == STAGE_BLOOM:
        # 盛开：根据花型绘制完整花朵
        items.extend(_draw_bloom(canvas, cx, cy, size, flower_data))

    return items

def _draw_bloom(canvas, cx, cy, size, flower_data):
    """绘制盛开的花朵"""
    items = []
    name, rarity, primary, secondary, petal_count, shape = flower_data

    # 茎
    stem_h = size * 0.4
    items.append(canvas.create_line(
        cx, cy+size*0.15, cx, cy-stem_h,
        fill="#3E8E41", width=max(2, size*0.04), tags=("flower",)
    ))
    # 叶子
    for dx in [-1, 1]:
        lx = cx + dx * size * 0.15
        ly = cy - stem_h * 0.3
        items.append(canvas.create_oval(
            lx-size*0.1, ly-size*0.06, lx+size*0.1, ly+size*0.06,
            fill="#5A9A5A", outline="#3E8E41", width=1, tags=("flower",)
        ))

    # 花冠中心
    r = size * 0.12
    items.append(canvas.create_oval(
        cx-r, cy-stem_h-r, cx+r, cy-stem_h+r,
        fill="#FFD54F", outline="#FF8F00", width=1, tags=("flower",)
    ))

    # 根据花型绘制花瓣
    if shape == "tulip":
        # 郁金香：杯状，3-5片大花瓣环绕
        pr = size * 0.18
        for i in range(petal_count):
            angle = (360 / petal_count) * i
            px = cx + pr * 0.6 * _cos_deg(angle)
            py = cy - stem_h + pr * 0.6 * _sin_deg(angle)
            items.append(canvas.create_oval(
                px-pr*0.7, py-pr, px+pr*0.7, py+pr,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
    elif shape == "daisy":
        # 雏菊：细长花瓣环绕
        pr = size * 0.22
        for i in range(petal_count):
            angle = (360 / petal_count) * i
            px = cx + pr * 0.8 * _cos_deg(angle)
            py = cy - stem_h + pr * 0.8 * _sin_deg(angle)
            items.append(canvas.create_oval(
                px-pr*0.15, py-pr*0.5, px+pr*0.15, py+pr*0.5,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
    elif shape == "cosmos":
        # 波斯菊：薄而宽的花瓣
        pr = size * 0.2
        for i in range(petal_count):
            angle = (360 / petal_count) * i
            px = cx + pr * 0.85 * _cos_deg(angle)
            py = cy - stem_h + pr * 0.85 * _sin_deg(angle)
            items.append(canvas.create_oval(
                px-pr*0.2, py-pr*0.5, px+pr*0.2, py+pr*0.5,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
    elif shape == "pansy":
        # 三色堇：上方2大花瓣+下方3小花瓣
        # 上两瓣
        for dx in [-0.4, 0.4]:
            items.append(canvas.create_oval(
                cx+dx*size*0.2-size*0.18, cy-stem_h-size*0.25,
                cx+dx*size*0.2+size*0.18, cy-stem_h+size*0.05,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
        # 下三瓣
        for dx, w in [(-0.35, 0.12), (0, 0.14), (0.35, 0.12)]:
            items.append(canvas.create_oval(
                cx+dx*size-w*size, cy-stem_h+size*0.05,
                cx+dx*size+w*size, cy-stem_h+size*0.28,
                fill=secondary, outline=_darken(secondary), width=1, tags=("flower",)
            ))
    elif shape == "hyacinth":
        # 风信子：钟状小花簇
        for row in range(3):
            for col in range(3):
                px = cx + (col-1) * size * 0.12
                py = cy - stem_h + (row-1) * size * 0.1
                items.append(canvas.create_oval(
                    px-size*0.08, py-size*0.06, px+size*0.08, py+size*0.06,
                    fill=primary if (row+col)%2==0 else secondary,
                    outline=_darken(primary), width=1, tags=("flower",)
                ))
    elif shape == "marigold":
        # 金盏花：密集小花瓣
        for i in range(petal_count):
            angle = (360 / petal_count) * i
            pr = size * 0.15
            px = cx + pr * 0.7 * _cos_deg(angle)
            py = cy - stem_h + pr * 0.7 * _sin_deg(angle)
            items.append(canvas.create_oval(
                px-pr*0.2, py-pr*0.4, px+pr*0.2, py+pr*0.4,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
        # 中心更密
        items.append(canvas.create_oval(
            cx-size*0.08, cy-stem_h-size*0.08,
            cx+size*0.08, cy-stem_h+size*0.08,
            fill="#FF6F00", outline="#E65100", width=1, tags=("flower",)
        ))
    elif shape == "lily":
        # 百合：大喇叭状花瓣
        for i in range(petal_count):
            angle = (360 / petal_count) * i - 90
            px = cx + size * 0.15 * _cos_deg(angle)
            py = cy - stem_h + size * 0.15 * _sin_deg(angle)
            points = [
                cx, cy - stem_h,
                px - size*0.1, py - size*0.15,
                px, py - size*0.05,
                px + size*0.1, py - size*0.15,
            ]
            items.append(canvas.create_polygon(
                points, fill=primary, outline=_darken(primary),
                smooth=True, tags=("flower",)
            ))
    elif shape == "morning_glory":
        # 牵牛花：星形喇叭
        for i in range(petal_count):
            angle = (360 / petal_count) * i - 90
            px = cx + size * 0.18 * _cos_deg(angle)
            py = cy - stem_h + size * 0.18 * _sin_deg(angle)
            items.append(canvas.create_oval(
                px-size*0.1, py-size*0.15, px+size*0.1, py+size*0.15,
                fill=primary, outline=_darken(primary), width=1, tags=("flower",)
            ))
    elif shape == "rose":
        # 玫瑰：层叠花瓣
        for layer in range(3):
            count = petal_count - layer * 3
            if count < 3:
                count = 3
            pr = size * 0.2 - layer * size * 0.04
            for i in range(count):
                angle = (360 / count) * i + layer * 15
                px = cx + pr * 0.6 * _cos_deg(angle)
                py = cy - stem_h + pr * 0.6 * _sin_deg(angle)
                items.append(canvas.create_oval(
                    px-pr*0.5, py-pr*0.5, px+pr*0.5, py+pr*0.5,
                    fill=primary if layer < 2 else secondary,
                    outline=_darken(primary), width=1, tags=("flower",)
                ))

    return items

# ─── 辅助函数 ───
import math

def _cos_deg(deg):
    return math.cos(math.radians(deg))

def _sin_deg(deg):
    return math.sin(math.radians(deg))

def _darken(hex_color):
    """将颜色加深约30%"""
    hex_color = hex_color.lstrip("#")
    r = max(0, int(hex_color[0:2], 16) - 50)
    g = max(0, int(hex_color[2:4], 16) - 50)
    b = max(0, int(hex_color[4:6], 16) - 50)
    return f"#{r:02x}{g:02x}{b:02x}"
