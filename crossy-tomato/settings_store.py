"""
数据持久化：本地 JSON 存档
"""
import json
import os
from pathlib import Path

SAVE_DIR  = Path.home() / ".crossy-tomato"
SAVE_FILE = SAVE_DIR / "save.json"

def _default_data():
    """返回默认存档结构"""
    return {
        "total_tomatoes": 0,
        "streak": 0,
        "last_date": "",
        "daily_best": 0,
        "bell_count": 0,
        "achievements": [],
        "theme": "classic",
        "durations": {"focus": 25*60, "short": 5*60, "long": 15*60},
        "sound_focus_end": True,
        "sound_break_end": True,
        "sound_click": True,
        "garden": [None] * 30,  # 30格，每格 {flower_idx, stage, plant_date} 或 None
        "inventory": [],         # 背包物品
        "decor": [],             # 已购买装饰位置
        "daily_log": {},         # {"2026-05-25": count}
    }

def load():
    """加载存档，不存在则返回默认"""
    if SAVE_FILE.exists():
        try:
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 补全缺失字段
            default = _default_data()
            for k, v in default.items():
                if k not in data:
                    data[k] = v
            return data
        except Exception:
            return _default_data()
    return _default_data()

def save(data):
    """保存存档到本地"""
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
