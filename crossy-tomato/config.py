"""
全局配置常量：配色、花种定义、成就定义
"""

# ─── 配色体系 ───
class Colors:
    BG_TIMER      = "#F5E7C8"   # 计时区暖米色
    BG_GARDEN     = "#A7D9A6"   # 花园薄荷绿
    TEXT          = "#5C3D2E"   # 深棕文字
    TEXT_DISABLED = "#A08060"   # 禁用浅棕
    BORDER_OUTER  = "#8B6B4D"   # 外描边深棕
    BORDER_INNER  = "#C4A484"   # 内描边浅棕
    HIGHLIGHT     = "#FFD7A8"   # 选中/悬停浅橙
    PROGRESS      = "#FF9F4A"   # 进度条橙红
    BTN_BG        = "#FFF1E0"   # 按钮底色
    BTN_GREEN     = "#7EC87E"   # 执行中绿
    BTN_BLUE      = "#7EB8E8"   # 休息中蓝
    WHITE         = "#FFFFFF"
    BLACK         = "#000000"

# ─── 主题配色 ───
THEMES = {
    "classic": {  # 经典绿地
        "name": "🌿 经典绿地",
        "bg_timer": "#F5E7C8",
        "bg_garden": "#A7D9A6",
        "text": "#5C3D2E",
        "border_outer": "#8B6B4D",
        "border_inner": "#C4A484",
        "highlight": "#FFD7A8",
        "progress": "#FF9F4A",
        "btn_bg": "#FFF1E0",
    },
    "sakura": {  # 樱花粉
        "name": "🌸 樱花粉",
        "bg_timer": "#F8E0E8",
        "bg_garden": "#F0C8D8",
        "text": "#6B3D4E",
        "border_outer": "#C4849C",
        "border_inner": "#E0A8C0",
        "highlight": "#FFD0E0",
        "progress": "#F080A0",
        "btn_bg": "#FFF0F4",
    },
    "autumn": {  # 秋日棕
        "name": "🍂 秋日棕",
        "bg_timer": "#F0D8B0",
        "bg_garden": "#D8B888",
        "text": "#4E3D2E",
        "border_outer": "#A07850",
        "border_inner": "#C8A070",
        "highlight": "#F0C880",
        "progress": "#E08040",
        "btn_bg": "#F8E8D0",
    },
    "winter": {  # 冬日雪景
        "name": "❄️ 冬日雪景",
        "bg_timer": "#E0E8F0",
        "bg_garden": "#C0D0E0",
        "text": "#2E3D5C",
        "border_outer": "#6080A0",
        "border_inner": "#90B0D0",
        "highlight": "#C0D8F0",
        "progress": "#70A0D0",
        "btn_bg": "#ECF4FC",
    },
}

# ─── 番茄钟默认时长（秒）───
DEFAULT_DURATIONS = {
    "focus":  25 * 60,   # 25分钟专注
    "short":   5 * 60,   # 5分钟短休
    "long":   15 * 60,   # 15分钟长休
}

# ─── 花园网格 ───
GRID_COLS = 6
GRID_ROWS = 5
GRID_TOTAL = GRID_COLS * GRID_ROWS  # 30格

# ─── 花朵稀有度 ───
RARITY_COMMON   = "common"
RARITY_UNCOMMON = "uncommon"
RARITY_RARE     = "rare"

RARITY_COLORS = {
    RARITY_COMMON:   "#8BC34A",
    RARITY_UNCOMMON: "#FF9800",
    RARITY_RARE:     "#E040FB",
}

RARITY_NAMES = {
    RARITY_COMMON:   "★ 普通",
    RARITY_UNCOMMON: "★★ 中级",
    RARITY_RARE:     "★★★ 稀有",
}

# ─── 花朵数据库 ───
# 每朵花: (名称, 稀有度, 主色, 次色, 花瓣数, 花型)
FLOWERS = [
    # 基础花 (common)
    ("红郁金香",   RARITY_COMMON, "#E53935", "#FF8A80", 5, "tulip"),
    ("白郁金香",   RARITY_COMMON, "#FAFAFA", "#E0E0E0", 5, "tulip"),
    ("黄郁金香",   RARITY_COMMON, "#FDD835", "#FFF176", 5, "tulip"),
    ("粉郁金香",   RARITY_COMMON, "#F48FB1", "#F8BBD0", 5, "tulip"),
    ("黑郁金香",   RARITY_COMMON, "#4A148C", "#7B1FA2", 5, "tulip"),
    ("雏菊",       RARITY_COMMON, "#FFFFFF", "#FFF9C4", 8, "daisy"),
    ("波斯菊",     RARITY_COMMON, "#FF80AB", "#F8BBD0", 8, "cosmos"),
    ("三色堇",     RARITY_COMMON, "#7C4DFF", "#E040FB", 5, "pansy"),
    # 中级花 (uncommon)
    ("红风信子",   RARITY_UNCOMMON, "#E53935", "#FF8A80", 6, "hyacinth"),
    ("金盏花",     RARITY_UNCOMMON, "#FF8F00", "#FFD54F", 10, "marigold"),
    ("白百合",     RARITY_UNCOMMON, "#FAFAFA", "#E8F5E9", 6, "lily"),
    ("牵牛花",     RARITY_UNCOMMON, "#5C6BC0", "#9FA8DA", 5, "morning_glory"),
    # 高级花 (rare)
    ("红玫瑰",     RARITY_RARE, "#C62828", "#EF5350", 12, "rose"),
    ("蓝玫瑰",     RARITY_RARE, "#1565C0", "#42A5F5", 12, "rose"),
    ("金玫瑰",     RARITY_RARE, "#FFD600", "#FFFF00", 12, "rose"),
    ("银玫瑰",     RARITY_RARE, "#BDBDBD", "#E0E0E0", 12, "rose"),
]

# 按稀有度分组
FLOWERS_BY_RARITY = {
    RARITY_COMMON:   [f for f in FLOWERS if f[1] == RARITY_COMMON],
    RARITY_UNCOMMON: [f for f in FLOWERS if f[1] == RARITY_UNCOMMON],
    RARITY_RARE:     [f for f in FLOWERS if f[1] == RARITY_RARE],
}

# ─── 成长阶段 ───
STAGE_SEED    = 0
STAGE_SPROUT  = 1
STAGE_GROWING = 2
STAGE_BLOOM   = 3
STAGE_NAMES   = ["种子", "发芽", "幼苗", "盛开"]

# ─── 成就定义 ───
ACHIEVEMENTS = [
    {"id": "first_tomato",    "name": "🌱 新手园丁",    "desc": "完成第1个番茄钟",          "icon": "🌱", "condition": "total >= 1"},
    {"id": "week_streak",     "name": "🌻 向日葵",      "desc": "连续7天打卡",              "icon": "🌻", "condition": "streak >= 7"},
    {"id": "ten_flowers",     "name": "🌸 花开花谢",    "desc": "花园种满10株花",           "icon": "🌸", "condition": "flowers >= 10"},
    {"id": "hundred_tomato",  "name": "👑 番茄之王",    "desc": "累计完成100个番茄钟",      "icon": "👑", "condition": "total >= 100"},
    {"id": "rainbow",         "name": "🌈 彩虹收藏家",  "desc": "集齐所有基础花色",         "icon": "🌈", "condition": "common_types >= 8"},
    {"id": "rare_finder",     "name": "💎 稀有猎人",    "desc": "获得第一朵稀有花",         "icon": "💎", "condition": "rare_count >= 1"},
    {"id": "daily_master",    "name": "⏰ 专注大师",    "desc": "单日完成8个番茄钟",        "icon": "⏰", "condition": "daily_best >= 8"},
    {"id": "full_garden",     "name": "🏝️ 岛屿之主",    "desc": "花园30格全部种满",         "icon": "🏝️", "condition": "flowers >= 30"},
]

# ─── 商店商品 ───
SHOP_ITEMS = [
    {"id": "seed_common",    "name": "基础种子包",    "price": 10,  "desc": "随机获得一朵基础花种子",  "icon": "🌱", "type": "seed", "rarity": RARITY_COMMON},
    {"id": "seed_uncommon",  "name": "中级种子包",    "price": 30,  "desc": "随机获得一朵中级花种子",  "icon": "🌿", "type": "seed", "rarity": RARITY_UNCOMMON},
    {"id": "seed_rare",      "name": "高级种子包",    "price": 100, "desc": "随机获得一朵稀有花种子",  "icon": "🍀", "type": "seed", "rarity": RARITY_RARE},
    {"id": "fence_white",    "name": "白色栅栏",      "price": 20,  "desc": "花园装饰：白色小栅栏",    "icon": "🏗️", "type": "decor", "decor": "fence"},
    {"id": "path_stone",     "name": "石径小路",      "price": 25,  "desc": "花园装饰：石板小径",      "icon": "🪨", "type": "decor", "decor": "path"},
    {"id": "mushroom",       "name": "迷你蘑菇",      "price": 15,  "desc": "花园装饰：可爱小蘑菇",    "icon": "🍄", "type": "decor", "decor": "mushroom"},
    {"id": "bush",           "name": "小灌木丛",      "price": 20,  "desc": "花园装饰：绿色灌木",      "icon": "🌳", "type": "decor", "decor": "bush"},
]

# ─── 村民NPC ───
NPCS = [
    {"name": "阿獺",   "color": "#8D6E63", "lines": [
        "加油哦～专注的时候最帅了！",
        "休息一下也不错嘛～",
        "哇！又完成了一个番茄钟！",
        "花园里的花好像又开了呢～",
        "今天也要元气满满哦！",
    ]},
    {"name": "小潤",   "color": "#64B5F6", "lines": [
        "嗯...专注的感觉真不错。",
        "休息的时候可以看看花园。",
        "恭喜你完成了！",
        "每一朵花都在为你加油呢。",
        "慢慢来，不急的。",
    ]},
    {"name": "莫妮卡", "color": "#F48FB1", "lines": [
        "哇～好厉害！又完成了！",
        "花园越来越漂亮了呢！",
        "要记得休息哦～",
        "你看那朵花开得多美！",
        "今天也是充实的一天！",
    ]},
]

# ─── 窗口设置 ───
WINDOW_WIDTH  = 900
WINDOW_HEIGHT = 700
