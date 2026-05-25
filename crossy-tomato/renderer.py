"""
PIL 渲染引擎：所有视觉元素的高品质绘制
"""
import math
import hashlib
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageTk

# ─── 字体管理 ───
class _FontCache:
    _cache = {}
    @classmethod
    def get(cls, name, size):
        key = (name, size)
        if key not in cls._cache:
            cls._cache[key] = cls._load(name, size)
        return cls._cache[key]
    @classmethod
    def _load(cls, name, size):
        paths = {
            "regular": "/System/Library/Fonts/PingFang.ttc",
            "bold":    "/System/Library/Fonts/PingFang.ttc",
            "emoji":   "/System/Library/Fonts/Apple Color Emoji.ttc",
        }
        try:
            if name == "bold":
                return ImageFont.truetype(paths[name], size, index=2)
            return ImageFont.truetype(paths[name], size)
        except Exception:
            return ImageFont.load_default()

def font(size, bold=False):
    return _FontCache.get("bold" if bold else "regular", size)

def font_emoji(size):
    return _FontCache.get("emoji", size)


# ─── 图片缓存 ───
class ImageCache:
    _cache = {}
    @classmethod
    def make_key(cls, *args):
        raw = "|".join(str(a) for a in args)
        return hashlib.md5(raw.encode()).hexdigest()
    @classmethod
    def get(cls, key):
        return cls._cache.get(key)
    @classmethod
    def put(cls, key, img):
        cls._cache[key] = img
    @classmethod
    def clear(cls):
        cls._cache.clear()


# ─── 工具函数 ───
def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def _lerp(c1, c2, t):
    t = max(0, min(1, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def _rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1], radius=r, fill=255)
    return m

def _noise(img, intensity=6):
    arr = img.copy()
    px = arr.load()
    rng = random.Random(42)
    for y in range(arr.height):
        for x in range(arr.width):
            r, g, b = px[x, y][:3]
            n = rng.randint(-intensity, intensity)
            px[x,y] = (max(0,min(255,r+n)), max(0,min(255,g+n)), max(0,min(255,b+n)))
    return Image.blend(img, arr, 0.15)


# ═══════════════════════════════════════════
# 1. 木质边框框架
# ═══════════════════════════════════════════
def wood_frame(w, h, outer_c, inner_c, bg_c, radius=12):
    key = ImageCache.make_key("wf", w, h, outer_c, inner_c, bg_c, radius)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0,0,w-1,h-1], radius=radius, fill=_hex(outer_c)+(255,))
    d.rounded_rectangle([3,3,w-4,h-4], radius=radius-2, fill=_hex(inner_c)+(255,))
    d.rounded_rectangle([6,6,w-7,h-7], radius=radius-4, fill=_hex(bg_c)+(255,))
    img = _noise(img, 5)
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 2. 水彩背景
# ═══════════════════════════════════════════
def watercolor_bg(w, h, base_c):
    key = ImageCache.make_key("wcb", w, h, base_c)
    c = ImageCache.get(key)
    if c: return c
    base = _hex(base_c)
    img = Image.new("RGBA", (w, h), base+(255,))
    rng = random.Random(w*1000+h)
    for _ in range(10):
        cx, cy = rng.randint(0,w), rng.randint(0,h)
        r = rng.randint(w//6, w//3)
        lighter = _lerp(base, (255,255,255), 0.15)
        darker  = _lerp(base, (0,0,0), 0.08)
        ov = Image.new("RGBA", (w,h), (0,0,0,0))
        ImageDraw.Draw(ov).ellipse([cx-r,cy-r,cx+r,cy+r],
                                   fill=(lighter if rng.random()>0.5 else darker)+(25,))
        img = Image.alpha_composite(img, ov.filter(ImageFilter.GaussianBlur(r//3)))
    img = _noise(img, 3)
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 3. 草地背景
# ═══════════════════════════════════════════
def grass_bg(w, h, base_green="#A7D9A6"):
    key = ImageCache.make_key("grass", w, h, base_green)
    c = ImageCache.get(key)
    if c: return c
    base = _hex(base_green)
    img = Image.new("RGBA", (w, h), base+(255,))
    d = ImageDraw.Draw(img)
    rng = random.Random(12345)
    light = _lerp(base, (255,255,255), 0.12)
    dark  = _lerp(base, (0,0,0), 0.10)
    for _ in range(50):
        x,y = rng.randint(-20,w+20), rng.randint(-20,h+20)
        r = rng.randint(15,50)
        ov = Image.new("RGBA",(w,h),(0,0,0,0))
        ImageDraw.Draw(ov).ellipse([x-r,y-r,x+r,y-r],
                                   fill=(light if rng.random()>0.4 else dark)+(20,))
        img = Image.alpha_composite(img, ov.filter(ImageFilter.GaussianBlur(r//4)))
    for _ in range(80):
        x,y = rng.randint(0,w), rng.randint(0,h)
        hl = rng.randint(4,12)
        clr = light if rng.random()>0.5 else dark
        d.line([(x,y),(x+int(hl*math.sin(math.radians(rng.randint(-20,20)))),
                     y-int(hl*math.cos(math.radians(rng.randint(-20,20)))))],
               fill=clr+(50,), width=rng.randint(1,3))
    img = _noise(img, 2)
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 4. 花朵绘制
# ═══════════════════════════════════════════
def draw_flower(size, flower_data, stage):
    """绘制花朵，返回 RGBA Image"""
    name, rarity, primary, secondary, petal_count, shape = flower_data
    key = ImageCache.make_key("fl", size, name, stage)
    c = ImageCache.get(key)
    if c: return c

    img = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cx, cy = size//2, size//2
    P = _hex(primary)
    S = _hex(secondary)
    stem = (76, 139, 76, 255)
    leaf = (92, 166, 92, 255)
    leaf_d = (62, 120, 62, 255)
    sun = (255, 210, 50, 255)

    if stage == 0:  # 种子
        d.ellipse([cx-size//5,cy+size//8,cx+size//5,cy+size//4],
                  fill=(160,120,80,255), outline=(120,90,60,255))
        d.ellipse([cx-size//8,cy-size//12,cx+size//8,cy+size//6],
                  fill=(140,100,60,255), outline=(100,70,40,255))
        d.arc([cx-size//12,cy-size//8,cx+size//12,cy], 0, 180,
              fill=(120,180,100,200), width=2)

    elif stage == 1:  # 发芽
        d.ellipse([cx-size//4,cy+size//6,cx+size//4,cy+size//3],
                  fill=(160,120,80,255), outline=(120,90,60,255))
        d.line([(cx,cy+size//8),(cx,cy-size//6)], fill=stem, width=max(2,size//20))
        for dx,angle in [(-1,-35),(1,35)]:
            lx=cx+dx*size//6; ly=cy-size//8
            lf=Image.new("RGBA",(size//3,size//5),(0,0,0,0))
            ImageDraw.Draw(lf).ellipse([2,2,size//3-2,size//5-2], fill=leaf)
            lf=lf.rotate(angle,resample=Image.BICUBIC)
            img.paste(lf,(lx-size//6,ly-size//10),lf)

    elif stage == 2:  # 幼苗
        sh = size//3
        pts=[(cx,cy+size//6)]
        for i in range(1,6):
            t=i/5; pts.append((cx+int(math.sin(t*0.5)*size*0.03), cy+size//6-int(t*sh)))
        for i in range(len(pts)-1):
            d.line([pts[i],pts[i+1]], fill=stem, width=max(2,size//18))
        for dx,angle,ty in [(-1,50,0.5),(1,-50,0.3)]:
            lx=cx+dx*size//5; ly=cy-int(sh*ty)
            lf=Image.new("RGBA",(size//3,size//5),(0,0,0,0))
            ld=ImageDraw.Draw(lf)
            ld.ellipse([1,1,size//3-1,size//5-1], fill=leaf)
            ld.line([(size//6,size//10),(size//6,size//5-size//10)], fill=leaf_d, width=1)
            lf=lf.rotate(angle,resample=Image.BICUBIC)
            img.paste(lf,(lx-size//6,ly-size//10),lf)

    elif stage == 3:  # 盛开
        sh = size//3
        pts=[(cx,cy+size//6)]
        for i in range(1,6):
            t=i/5; pts.append((cx+int(math.sin(t*0.4)*size*0.02), cy+size//6-int(t*sh)))
        for i in range(len(pts)-1):
            d.line([pts[i],pts[i+1]], fill=stem, width=max(2,size//16))
        for dx,angle,ty in [(-1,45,0.55),(1,-45,0.35)]:
            lx=cx+dx*size//4; ly=cy-int(sh*ty)
            lf=Image.new("RGBA",(size//3,size//5),(0,0,0,0))
            ld=ImageDraw.Draw(lf)
            ld.ellipse([1,1,size//3-1,size//5-1], fill=leaf)
            ld.line([(size//6,size//10),(size//6,size//5-size//10)], fill=leaf_d, width=1)
            lf=lf.rotate(angle,resample=Image.BICUBIC)
            img.paste(lf,(lx-size//6,ly-size//10),lf)
        top = cy - sh
        _bloom(img, d, cx, top, size, petal_count, shape, P, S, sun)

    ImageCache.put(key, img)
    return img


def _bloom(img, d, cx, top, size, n, shape, P, S, sun):
    """绘制盛开花冠"""
    r = size//6
    if shape == "tulip":
        for i in range(n):
            a = (360/n)*i-90
            px=cx+int(r*0.5*math.cos(math.radians(a)))
            py=top+int(r*0.5*math.sin(math.radians(a)))
            pl=Image.new("RGBA",(r*2,int(r*1.4)),(0,0,0,0))
            pd=ImageDraw.Draw(pl)
            for py2 in range(int(r*1.4)):
                t=py2/(r*1.4)
                pd.ellipse([r-r*0.4,py2-1,r+r*0.4,py2+1], fill=_lerp(P,S,t*0.5)+(230,))
            pl=pl.rotate(a,resample=Image.BICUBIC)
            img.paste(pl,(px-r,py-int(r*0.7)),pl)
    elif shape == "daisy":
        for i in range(n):
            a=(360/n)*i-90
            pl=Image.new("RGBA",(r//3,int(r*1.2)),(0,0,0,0))
            pd=ImageDraw.Draw(pl)
            for py in range(int(r*1.2)):
                t=py/(r*1.2)
                pd.ellipse([1,py,r//3-1,py+1], fill=_lerp(P,S,t*0.3)+(220,))
            pl=pl.rotate(a,resample=Image.BICUBIC)
            px=cx+int(r*0.3*math.cos(math.radians(a)))
            py=top+int(r*0.3*math.sin(math.radians(a)))
            img.paste(pl,(px-r//6,py-int(r*0.6)),pl)
    elif shape == "cosmos":
        for i in range(n):
            a=(360/n)*i-90
            pl=Image.new("RGBA",(r//2,int(r*1.0)),(0,0,0,0))
            ImageDraw.Draw(pl).ellipse([0,0,r//2,int(r*1.0)], fill=P+(200,), outline=S+(150,))
            pl=pl.rotate(a,resample=Image.BICUBIC)
            px=cx+int(r*0.35*math.cos(math.radians(a)))
            py=top+int(r*0.35*math.sin(math.radians(a)))
            img.paste(pl,(px-r//4,py-int(r*0.5)),pl)
    elif shape == "pansy":
        br=int(r*0.9); sr=int(r*0.6)
        for dx in [-0.4,0.4]:
            bx=cx+int(dx*r*0.8); by=top-int(r*0.2)
            pl=Image.new("RGBA",(br,br),(0,0,0,0))
            ImageDraw.Draw(pl).ellipse([0,0,br,br], fill=P+(220,), outline=S+(150,))
            img.paste(pl,(bx-br//2,by-br//2),pl)
        for dx,w in [-0.35,0,0.35]:
            bx=cx+int(dx*r); by=top+int(r*0.3)
            bh=int(sr*1.2)
            pl=Image.new("RGBA",(sr,bh),(0,0,0,0))
            ImageDraw.Draw(pl).ellipse([0,0,sr,bh], fill=S+(220,),
                                        outline=_lerp(S,(0,0,0),0.2)+(150,))
            img.paste(pl,(bx-sr//2,by),pl)
    elif shape == "hyacinth":
        for row in range(3):
            for col in range(4):
                px=cx+(col-1.5)*r//3; py=top+(row-1)*r//3
                bell=r//4; c=P if (row+col)%2==0 else S
                d.ellipse([px-bell,py-bell,px+bell,py+bell], fill=c+(220,),
                          outline=_lerp(c,(0,0,0),0.15)+(150,))
                d.ellipse([px-bell//2,py,px+bell//2,py+bell//2],
                          fill=_lerp(c,(0,0,0),0.1)+(200,))
    elif shape == "marigold":
        for layer in range(3):
            cnt=max(6,n-layer*2); pr=r-layer*r//5
            for i in range(cnt):
                a=(360/cnt)*i+layer*10
                px=cx+int(pr*0.6*math.cos(math.radians(a)))
                py=top+int(pr*0.6*math.sin(math.radians(a)))
                c=P if layer<2 else S
                d.ellipse([px-r//6,py-r//8,px+r//6,py+r//8], fill=c+(220,))
        d.ellipse([cx-r//4,top-r//4,cx+r//4,top+r//4],
                  fill=(230,140,20,255), outline=(200,120,10,200))
    elif shape == "lily":
        for i in range(n):
            a=(360/n)*i-90
            pl=Image.new("RGBA",(r,int(r*1.5)),(0,0,0,0))
            pd=ImageDraw.Draw(pl)
            pts=[(r//2,0),(0,int(r*1.2)),(r//4,int(r*1.5)),
                 (r*3//4,int(r*1.5)),(r,int(r*1.2))]
            pd.polygon(pts, fill=P+(220,))
            pd.arc([0,0,r,int(r*0.6)], 200, 140, fill=S+(100,), width=2)
            pl=pl.rotate(a,resample=Image.BICUBIC)
            px=cx+int(r*0.2*math.cos(math.radians(a)))
            py=top+int(r*0.2*math.sin(math.radians(a)))
            img.paste(pl,(px-r//2,py-int(r*0.75)),pl)
    elif shape == "morning_glory":
        for i in range(n):
            a=(360/n)*i-90
            pl=Image.new("RGBA",(r,int(r*0.8)),(0,0,0,0))
            pd=ImageDraw.Draw(pl)
            pts=[(r//2,0),(0,int(r*0.6)),(r//2,int(r*0.8)),(r,int(r*0.6))]
            pd.polygon(pts, fill=P+(210,))
            pl=pl.rotate(a,resample=Image.BICUBIC)
            px=cx+int(r*0.15*math.cos(math.radians(a)))
            py=top+int(r*0.15*math.sin(math.radians(a)))
            img.paste(pl,(px-r//2,py-int(r*0.4)),pl)
    elif shape == "rose":
        for layer in range(3):
            cnt=max(3,n-layer*3); pr=r-layer*r//5
            for i in range(cnt):
                a=(360/cnt)*i+layer*15
                px=cx+int(pr*0.55*math.cos(math.radians(a)))
                py=top+int(pr*0.55*math.sin(math.radians(a)))
                c=P if layer<2 else S
                d.ellipse([px-pr//2,py-pr//2,px+pr//2,py+pr//2], fill=c+(220,),
                          outline=_lerp(c,(0,0,0),0.15)+(100,))

    # 花蕊中心
    cr = max(3, r//4)
    d.ellipse([cx-cr,top-cr,cx+cr,top+cr], fill=sun, outline=_lerp(sun,(0,0,0),0.2)+(180,))
    # 花蕊小点
    for i in range(5):
        a=(360/5)*i
        sx=cx+int(cr*0.5*math.cos(math.radians(a)))
        sy=top+int(cr*0.5*math.sin(math.radians(a)))
        d.ellipse([sx-1,sy-1,sx+1,sy+1], fill=(200,150,20,200))


# ═══════════════════════════════════════════
# 5. NPC 村民绘制
# ═══════════════════════════════════════════
def draw_npc(size, name, color):
    """绘制圆润可爱的动森风格村民"""
    key = ImageCache.make_key("npc", size, name, color)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cx, cy = size//2, size//2
    body_c = _hex(color)
    darker = _lerp(body_c, (0,0,0), 0.2)

    # 身体
    d.ellipse([cx-size//3,cy-size//8,cx+size//3,cy+size//3],
              fill=body_c+(255,), outline=darker+(200,))
    # 头
    head_r = size//3
    d.ellipse([cx-head_r,cy-head_r-size//6,cx+head_r,cy+size//6],
              fill=body_c+(255,), outline=darker+(200,))
    # 眼睛（大圆眼睛，动森风格）
    eye_y = cy - size//8
    for dx in [-0.12, 0.12]:
        ex = cx + int(dx*size)
        # 眼白
        d.ellipse([ex-size//14,eye_y-size//14,cx+int(dx*size)+size//14,eye_y+size//14],
                  fill=(255,255,255,255), outline=darker+(150,))
        # 瞳孔
        d.ellipse([ex-size//20,eye_y-size//20,ex+size//20,eye_y+size//20],
                  fill=(40,30,20,255))
        # 高光
        d.ellipse([ex-size//30,eye_y-size//16,ex+size//40,eye_y-size//30],
                  fill=(255,255,255,200))
    # 微笑
    d.arc([cx-size//12,eye_y+size//20,cx+size//12,eye_y+size//10],
          0, -180, fill=darker+(200,), width=2)
    # 腮红
    for dx in [-0.18, 0.18]:
        bx = cx + int(dx*size)
        by = eye_y + size//16
        blush = Image.new("RGBA",(size//6,size//10),(0,0,0,0))
        ImageDraw.Draw(blush).ellipse([0,0,size//6,size//10], fill=(255,150,150,80,))
        img.paste(blush,(bx-size//12,by-size//20),blush)

    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 6. 装饰元素
# ═══════════════════════════════════════════
def draw_cloud(w=80, h=40):
    """蓬松云朵"""
    key = ImageCache.make_key("cloud", w, h)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    # 多个圆叠加
    circles = [(w//4,h//2,h//3), (w//2,h//3,h//2), (w*3//4,h//2,h//3),
               (w//3,h*2//3,h//4), (w*2//3,h*2//3,h//4)]
    for cx,cy,r in circles:
        ov=Image.new("RGBA",(w,h),(0,0,0,0))
        ImageDraw.Draw(ov).ellipse([cx-r,cy-r,cx+r,cy+r], fill=(255,255,255,180,))
        img=Image.alpha_composite(img, ov.filter(ImageFilter.GaussianBlur(2)))
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 7. 木质按钮
# ═══════════════════════════════════════════
def draw_button(w, h, text, state="normal", bg_c="#FFF1E0", fg_c="#5C3D2E",
               outer_c="#8B6B4D", inner_c="#C4A484", radius=8):
    """绘制木质风格按钮，返回 RGBA Image"""
    key = ImageCache.make_key("btn", w, h, text, state, bg_c)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(img)

    if state == "disabled":
        bg = _lerp(_hex(bg_c), (200,200,200), 0.3)
        fg = (160,150,140,255)
        oc = _lerp(_hex(outer_c), (180,180,180), 0.3)
        ic = _lerp(_hex(inner_c), (180,180,180), 0.3)
    elif state == "pressed":
        bg = _lerp(_hex(bg_c), (0,0,0), 0.12)
        fg = _hex(fg_c)+(255,)
        oc = _hex(outer_c)+(255,)
        ic = _hex(inner_c)+(255,)
    elif state == "hover":
        bg = _lerp(_hex(bg_c), (255,210,150), 0.3)
        fg = _hex(fg_c)+(255,)
        oc = _hex(outer_c)+(255,)
        ic = _hex(inner_c)+(255,)
    else:  # normal
        bg = _hex(bg_c)+(255,)
        fg = _hex(fg_c)+(255,)
        oc = _hex(outer_c)+(255,)
        ic = _hex(inner_c)+(255,)

    # 外框
    d.rounded_rectangle([0,0,w-1,h-1], radius=radius, fill=oc)
    # 内框
    d.rounded_rectangle([2,2,w-3,h-3], radius=radius-1, fill=ic)
    # 底色
    d.rounded_rectangle([4,4,w-5,h-5], radius=radius-2, fill=bg)

    # 文字
    f = font(max(10, h//3))
    bbox = d.textbbox((0,0), text, font=f)
    tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    tx = (w-tw)//2; ty = (h-th)//2
    if state == "pressed":
        ty += 1
    d.text((tx,ty), text, fill=fg, font=f)

    img = _noise(img, 3)
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 8. 进度条
# ═══════════════════════════════════════════
def draw_progress(w, h, ratio, bg_c="#F5E7C8", fill_c="#FF9F4A",
                  border_c="#8B6B4D"):
    """绘制木质边框进度条"""
    key = ImageCache.make_key("prog", w, h, ratio, bg_c, fill_c)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    # 外框
    d.rounded_rectangle([0,0,w-1,h-1], radius=h//2, fill=_hex(border_c)+(255,))
    # 背景
    d.rounded_rectangle([2,2,w-3,h-3], radius=h//2-1, fill=_hex(bg_c)+(255,))
    # 填充
    if ratio > 0:
        fill_w = max(h, int((w-4)*ratio))
        d.rounded_rectangle([2,2,fill_w,h-3], radius=h//2-1, fill=_hex(fill_c)+(255,))
        # 高光
        d.rounded_rectangle([2,2,fill_w,h//2], radius=h//2-1,
                            fill=(255,255,255,40,))
    img = _noise(img, 2)
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 9. 成就徽章
# ═══════════════════════════════════════════
def draw_badge(size, icon_text, name, unlocked=True, bg_c="#FFD7A8"):
    """绘制成就徽章"""
    key = ImageCache.make_key("badge", size, icon_text, name, unlocked)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(size,size),(0,0,0,0))
    d = ImageDraw.Draw(img)
    cx, cy = size//2, size//2
    r = size//2-2

    if unlocked:
        # 外圈光晕
        for i in range(3):
            ov=Image.new("RGBA",(size,size),(0,0,0,0))
            ImageDraw.Draw(ov).ellipse(
                [cx-r-i*2,cy-r-i*2,cx+r+i*2,cy+r+i*2],
                fill=(255,210,100,30-i*10,))
            img=Image.alpha_composite(img,ov)
        # 主圆
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=_hex(bg_c)+(255,),
                  outline=(180,140,60,255), width=2)
        # 高光
        d.ellipse([cx-r+3,cy-r+3,cx+r-8,cy+r-8], fill=(255,255,255,30,))
    else:
        # 未解锁：灰色
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=(200,200,200,180,),
                  outline=(160,160,160,200), width=2)
        # 锁标记
        d.text((cx,cy-2), "🔒", font=font_emoji(size//3), anchor="mm")

    # 图标
    if unlocked:
        d.text((cx,cy-size//8), icon_text, font=font_emoji(size//3), anchor="mm")

    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 10. 柱状图
# ═══════════════════════════════════════════
def draw_bar_chart(w, h, values, labels, bar_c="#FF9F4A", text_c="#5C3D2E"):
    """
    绘制简易柱状图
    values: list of int
    labels: list of str
    """
    key = ImageCache.make_key("chart", w, h, tuple(values), tuple(labels))
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)

    pad = 30
    chart_h = h - pad*2
    chart_w = w - pad*2
    n = len(values)
    if n == 0:
        ImageCache.put(key, img)
        return img

    max_v = max(values) if max(values) > 0 else 1
    bar_w = chart_w // n - 8

    bc = _hex(bar_c)+(255,)
    tc = _hex(text_c)+(255,)

    for i,(v,lab) in enumerate(zip(values,labels)):
        x = pad + i*(bar_w+8)
        bh = int((v/max_v)*chart_h)
        y = h - pad - bh
        # 柱子（圆角）
        d.rounded_rectangle([x,y,x+bar_w,h-pad], radius=4, fill=bc)
        # 高光
        d.rounded_rectangle([x,y,x+bar_w//3,h-pad], radius=4,
                            fill=(255,255,255,30,))
        # 标签
        f = font(9)
        d.text((x+bar_w//2,h-pad+12), lab, fill=tc, font=f, anchor="mt")
        if v > 0:
            d.text((x+bar_w//2,y-8), str(v), fill=tc, font=font(8), anchor="mb")

    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 11. 标签页按钮
# ═══════════════════════════════════════════
def draw_tab(w, h, text, active=False, bg_active="#FFD7A8", bg_normal="#8B6B4D",
             text_active="#5C3D2E", text_normal="#FFF1E0"):
    """绘制标签页按钮"""
    key = ImageCache.make_key("tab", w, h, text, active)
    c = ImageCache.get(key)
    if c: return c
    bg = _hex(bg_active) if active else _hex(bg_normal)
    fg = _hex(text_active) if active else _hex(text_normal)
    img = Image.new("RGBA",(w,h), bg+(255,))
    d = ImageDraw.Draw(img)
    f = font(max(10,h//3), bold=active)
    d.text((w//2,h//2), text, fill=fg+(255,), font=f, anchor="mm")
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 12. 数字时钟面板
# ═══════════════════════════════════════════
def draw_timer_display(w, h, time_str, label, bg_c="#F5E7C8", text_c="#5C3D2E"):
    """绘制大号数字计时显示"""
    key = ImageCache.make_key("tmr", w, h, time_str, label, bg_c)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    # 背景
    d.rounded_rectangle([0,0,w-1,h-1], radius=16,
                        fill=_hex(bg_c)+(255,), outline=_lerp(_hex(text_c),(0,0,0),0.3)+(80,))
    # 时间数字
    f = font(min(h//2, 48), bold=True)
    d.text((w//2,h//2-8), time_str, fill=_hex(text_c)+(255,), font=f, anchor="mm")
    # 标签
    lf = font(max(10,h//6))
    d.text((w//2,h-12), label, fill=_lerp(_hex(text_c),(128,128,128),0.3)+(200,),
           font=lf, anchor="mb")
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 13. 商品卡片
# ═══════════════════════════════════════════
def draw_shop_card(w, h, icon, name, desc, price, can_afford=True,
                   bg_c="#FFF1E0", border_c="#C4A484"):
    """绘制商店商品卡片"""
    key = ImageCache.make_key("shop", w, h, name, price, can_afford)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    bg = _hex(bg_c)+(255,) if can_afford else _lerp(_hex(bg_c),(200,200,200),0.4)+(255,)
    bc = _hex(border_c)+(255,) if can_afford else (180,180,180,200)
    d.rounded_rectangle([0,0,w-1,h-1], radius=10, fill=bg, outline=bc, width=2)
    # 图标
    d.text((30,h//2), icon, font=font_emoji(24), anchor="mm")
    # 名称
    d.text((55, h//3), name, fill=_hex("#5C3D2E")+(255,) if can_afford else (150,150,150,255,),
           font=font(12, bold=True), anchor="lm")
    # 描述
    d.text((55, h*2//3), desc, fill=(136,136,136,200) if can_afford else (180,180,180,200),
           font=font(9), anchor="lm")
    # 价格
    d.text((w-15, h//2), f"💰{price}", fill=_hex("#E67E22")+(255,) if can_afford else (180,180,180,255,),
           font=font(11, bold=True), anchor="rm")
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 14. 数据卡片
# ═══════════════════════════════════════════
def draw_stat_card(w, h, title, value, bg_c="#FFF1E0", text_c="#5C3D2E"):
    """统计数据卡片"""
    key = ImageCache.make_key("statcard", w, h, title, value)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0,0,w-1,h-1], radius=10,
                        fill=_hex(bg_c)+(255,), outline=_hex("#C4A484")+(200,))
    d.text((w//2, h//3), title, fill=_lerp(_hex(text_c),(128,128,128),0.4)+(200,),
           font=font(10), anchor="mm")
    d.text((w//2, h//2+5), str(value), fill=_hex(text_c)+(255,),
           font=font(min(20,h//3), bold=True), anchor="mm")
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 15. 开关控件
# ═══════════════════════════════════════════
def draw_toggle(w, h, on=True, on_c="#7EC87E", off_c="#CCCCCC"):
    """绘制开关"""
    key = ImageCache.make_key("toggle", w, h, on)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    bg = _hex(on_c) if on else _hex(off_c)
    d.rounded_rectangle([0,0,w-1,h-1], radius=h//2, fill=bg+(255,))
    # 圆形手柄
    if on:
        cx = w - h//2 - 2
    else:
        cx = h//2 + 2
    d.ellipse([cx-h//2+2, 2, cx+h//2-2, h-2], fill=(255,255,255,255,),
              outline=(200,200,200,150))
    ImageCache.put(key, img)
    return img


# ═══════════════════════════════════════════
# 16. 滑块轨道
# ═══════════════════════════════════════════
def draw_slider_track(w, h, ratio, track_c="#C4A484", fill_c="#FF9F4A"):
    """绘制滑块轨道"""
    key = ImageCache.make_key("slider", w, h, ratio)
    c = ImageCache.get(key)
    if c: return c
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    cy = h//2
    # 轨道背景
    d.rounded_rectangle([0,cy-h//6,w-1,cy+h//6], radius=h//6, fill=_hex(track_c)+(200,))
    # 填充部分
    if ratio > 0:
        fill_w = max(h, int(w*ratio))
        d.rounded_rectangle([0,cy-h//6,fill_w,cy+h//6], radius=h//6, fill=_hex(fill_c)+(255,))
    # 手柄
    hx = int(w*ratio)
    d.ellipse([hx-h//2,2,hx+h//2,h-2], fill=(255,255,255,255,),
              outline=_hex("#8B6B4D")+(200,), width=2)
    ImageCache.put(key, img)
    return img
