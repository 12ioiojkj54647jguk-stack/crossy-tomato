"""
统计与成就系统
"""
from config import ACHIEVEMENTS, GRID_TOTAL

def check_achievements(data):
    """
    检查并返回新解锁的成就列表
    data: 存档数据字典
    """
    unlocked = set(data.get("achievements", []))
    newly_unlocked = []

    total = data.get("total_tomatoes", 0)
    streak = data.get("streak", 0)
    daily_best = data.get("daily_best", 0)

    # 统计花园
    garden = data.get("garden", [])
    flowers = sum(1 for g in garden if g is not None)
    rare_count = sum(1 for g in garden if g and FLOWER_DATA_IDX(g).get("rarity") == "rare")
    common_types = set()
    for g in garden:
        if g:
            fd = FLOWER_DATA_IDX(g)
            if fd.get("rarity") == "common":
                common_types.add(fd.get("name", ""))

    checks = {
        "total": total,
        "streak": streak,
        "flowers": flowers,
        "rare_count": rare_count,
        "common_types": len(common_types),
        "daily_best": daily_best,
    }

    for ach in ACHIEVEMENTS:
        if ach["id"] in unlocked:
            continue
        cond = ach["condition"]
        # 简单条件解析: "key >= value"
        parts = cond.split(">=")
        if len(parts) == 2:
            key = parts[0].strip()
            val = int(parts[1].strip())
            if checks.get(key, 0) >= val:
                unlocked.add(ach["id"])
                newly_unlocked.append(ach)

    if newly_unlocked:
        data["achievements"] = list(unlocked)

    return newly_unlocked

def FLOWER_DATA_IDX(garden_cell):
    """从花园格子数据获取花朵信息"""
    from config import FLOWERS
    if garden_cell and "flower_idx" in garden_cell:
        idx = garden_cell["flower_idx"]
        if 0 <= idx < len(FLOWERS):
            f = FLOWERS[idx]
            return {"name": f[0], "rarity": f[1]}
    return {}

def get_stats_summary(data):
    """获取统计摘要"""
    total = data.get("total_tomatoes", 0)
    streak = data.get("streak", 0)
    garden = data.get("garden", [])
    flowers = sum(1 for g in garden if g is not None)
    total_minutes = 0
    for mode, secs in data.get("durations", {}).items():
        pass  # 仅用于计算总专注时长
    # 实际专注时长 = 番茄数 * 25分钟
    focus_minutes = total * 25
    hours = focus_minutes // 60
    mins = focus_minutes % 60
    achievements = data.get("achievements", [])
    return {
        "total": total,
        "streak": streak,
        "flowers": flowers,
        "focus_hours": hours,
        "focus_mins": mins,
        "achievement_count": len(achievements),
        "achievement_total": len(ACHIEVEMENTS),
        "daily_log": data.get("daily_log", {}),
    }
