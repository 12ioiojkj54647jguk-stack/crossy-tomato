"""
音效管理：使用 macOS 系统提示音
"""
import subprocess
import platform

def _macos_beep(sound="Glass"):
    """播放 macOS 系统音效"""
    if platform.system() == "Darwin":
        try:
            subprocess.Popen(
                ["afplay", f"/System/Library/Sounds/{sound}.aiff"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

def play_focus_end():
    """专注结束音效"""
    _macos_beep("Glass")

def play_break_end():
    """休息结束音效"""
    _macos_beep("Pop")

def play_click():
    """按钮点击音效"""
    _macos_beep("Tink")

def play_reward():
    """获得奖励音效"""
    _macos_beep("Blow")

def play_achievement():
    """成就解锁音效"""
    _macos_beep("Funk")
