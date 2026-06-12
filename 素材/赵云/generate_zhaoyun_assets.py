from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


OUT_DIR = Path(__file__).resolve().parent

SILVER = "#d8d8e8"
SILVER_DARK = "#8f96aa"
SILVER_LIGHT = "#f4f6ff"
WHITE = "#ffffff"
BLUE = "#7ecbff"
BLUE_DEEP = "#2f86d8"
GOLD = "#d4a037"
INK = "#252a38"
SKIN = "#f3c7a2"
SKIN_SHADE = "#d99b78"
HAIR = "#252130"
RED = "#bf3548"


def rgba(hex_color, alpha=255):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def draw_polyline(draw, points, fill, width, joint="curve"):
    if len(points) >= 2:
        draw.line(points, fill=fill, width=width, joint=joint)


def draw_glow_line(layer, points, color, width):
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    draw_polyline(gd, points, rgba(color, 80), width + 8)
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    layer.alpha_composite(glow)
    ImageDraw.Draw(layer).line(points, fill=rgba(color, 245), width=width, joint="curve")


def draw_spear(layer, cx, cy, angle=-0.25, length=138, offset=(0, 0), scale=1.0):
    draw = ImageDraw.Draw(layer)
    ox, oy = offset
    length *= scale
    butt = (cx + ox - cos(angle) * length * 0.45, cy + oy - sin(angle) * length * 0.45)
    tip = (cx + ox + cos(angle) * length * 0.55, cy + oy + sin(angle) * length * 0.55)
    draw_glow_line(layer, [butt, tip], BLUE, int(4 * scale))
    draw.line([butt, tip], fill=rgba(SILVER_LIGHT), width=max(2, int(3 * scale)))
    nx, ny = -sin(angle), cos(angle)
    head_base = (tip[0] - cos(angle) * 18 * scale, tip[1] - sin(angle) * 18 * scale)
    spear_head = [
        (tip[0] + cos(angle) * 9 * scale, tip[1] + sin(angle) * 9 * scale),
        (head_base[0] + nx * 8 * scale, head_base[1] + ny * 8 * scale),
        (head_base[0] - nx * 8 * scale, head_base[1] - ny * 8 * scale),
    ]
    draw.polygon(spear_head, fill=rgba(SILVER_LIGHT), outline=rgba(INK))
    draw.line([head_base, tip], fill=rgba(BLUE), width=max(2, int(2 * scale)))
    tassel = [
        (head_base[0] - cos(angle) * 5 * scale, head_base[1] - sin(angle) * 5 * scale),
        (head_base[0] - cos(angle) * 13 * scale + nx * 10 * scale, head_base[1] - sin(angle) * 13 * scale + ny * 10 * scale),
        (head_base[0] - cos(angle) * 20 * scale - nx * 8 * scale, head_base[1] - sin(angle) * 20 * scale - ny * 8 * scale),
    ]
    draw.line(tassel, fill=rgba(WHITE), width=max(2, int(4 * scale)), joint="curve")


def draw_chibi_zhaoyun(layer, box, pose="idle", scale=1.0):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx = x0 + w * 0.5
    foot = y0 + h * 0.84
    bob = {
        "idle": 0,
        "run": -3,
        "charge": 1,
        "thrust": -1,
        "recover": 1,
        "dodge": -2,
        "victory": -4,
        "hurt": 3,
    }.get(pose, 0)
    lean = {
        "idle": 0,
        "run": 8,
        "charge": -10,
        "thrust": 15,
        "recover": 3,
        "dodge": -18,
        "victory": 2,
        "hurt": -14,
    }.get(pose, 0)
    cy = y0 + h * 0.48 + bob
    draw = ImageDraw.Draw(layer)

    if pose == "thrust":
        spear_angle, spear_len, spear_off = -0.04, 155, (20, -7)
    elif pose == "charge":
        spear_angle, spear_len, spear_off = -0.34, 132, (-5, 5)
    elif pose == "victory":
        spear_angle, spear_len, spear_off = -1.35, 126, (22, -26)
    elif pose == "dodge":
        spear_angle, spear_len, spear_off = -0.55, 125, (-4, 10)
    elif pose == "hurt":
        spear_angle, spear_len, spear_off = 0.28, 118, (4, 12)
    else:
        spear_angle, spear_len, spear_off = -0.25, 130, (6, 2)
    draw_spear(layer, cx + lean * 0.25, cy + 11, spear_angle, spear_len, spear_off, scale)

    # Cape and white robe.
    cape_shift = 10 if pose in {"run", "thrust", "dodge"} else 3
    robe = [
        (cx - 34 + lean * 0.18, cy + 18),
        (cx + 20 + lean * 0.25, cy + 18),
        (cx + 38 + cape_shift + lean * 0.15, foot - 28),
        (cx + 4 + lean * 0.12, foot - 16),
        (cx - 43 + lean * 0.10, foot - 26),
    ]
    draw.polygon(robe, fill=rgba(WHITE), outline=rgba(INK))
    draw.line([robe[0], robe[3]], fill=rgba(SILVER_DARK), width=3)

    # Legs.
    if pose == "run":
        legs = [((cx - 19, foot - 32), (cx - 42, foot - 3)), ((cx + 11, foot - 33), (cx + 39, foot - 8))]
    elif pose == "dodge":
        legs = [((cx - 22, foot - 32), (cx - 54, foot - 8)), ((cx + 6, foot - 34), (cx + 26, foot - 4))]
    elif pose == "hurt":
        legs = [((cx - 18, foot - 31), (cx - 33, foot - 5)), ((cx + 12, foot - 31), (cx + 30, foot - 4))]
    else:
        legs = [((cx - 16, foot - 32), (cx - 28, foot - 4)), ((cx + 13, foot - 32), (cx + 27, foot - 4))]
    for a, b in legs:
        draw.line([a, b], fill=rgba(INK), width=13)
        draw.line([a, b], fill=rgba(SILVER_DARK), width=7)
        draw.ellipse((b[0] - 11, b[1] - 4, b[0] + 16, b[1] + 6), fill=rgba(INK))

    # Torso armor.
    body = (cx - 29 + lean * 0.15, cy - 18, cx + 31 + lean * 0.15, cy + 50)
    draw.rounded_rectangle(body, radius=15, fill=rgba(SILVER), outline=rgba(INK), width=4)
    draw.polygon(
        [
            (body[0] + 9, body[1] + 5),
            (body[2] - 8, body[1] + 10),
            (body[2] - 13, body[3] - 9),
            (body[0] + 11, body[3] - 6),
        ],
        fill=rgba(SILVER_LIGHT),
    )
    draw.line([(cx - 22, cy + 10), (cx + 24, cy + 10)], fill=rgba(GOLD), width=4)
    draw.line([(cx, cy - 12), (cx - 4, cy + 43)], fill=rgba(SILVER_DARK), width=3)

    # Arms.
    if pose == "thrust":
        arms = [((cx - 18, cy + 1), (cx + 39, cy + 2)), ((cx + 10, cy + 20), (cx + 55, cy + 9))]
    elif pose == "victory":
        arms = [((cx - 16, cy), (cx + 6, cy - 31)), ((cx + 12, cy + 17), (cx + 30, cy - 25))]
    elif pose == "hurt":
        arms = [((cx - 22, cy + 4), (cx - 48, cy + 15)), ((cx + 18, cy + 12), (cx + 38, cy + 31))]
    else:
        arms = [((cx - 20, cy + 4), (cx - 43, cy + 23)), ((cx + 20, cy + 9), (cx + 44, cy + 4))]
    for a, b in arms:
        draw.line([a, b], fill=rgba(INK), width=13)
        draw.line([a, b], fill=rgba(SILVER), width=8)
        draw.ellipse((b[0] - 5, b[1] - 5, b[0] + 7, b[1] + 7), fill=rgba(SKIN), outline=rgba(INK), width=2)

    # Neck and head.
    draw.ellipse((cx - 10 + lean * 0.1, cy - 39, cx + 12 + lean * 0.1, cy - 16), fill=rgba(SKIN), outline=rgba(INK), width=3)
    head = (cx - 34 + lean * 0.28, cy - 90, cx + 37 + lean * 0.28, cy - 28)
    draw.ellipse(head, fill=rgba(SKIN), outline=rgba(INK), width=4)
    draw.pieslice((head[0] + 1, head[1] - 6, head[2] + 2, head[1] + 35), 178, 355, fill=rgba(HAIR))
    draw.ellipse((cx - 2 + lean * 0.28, cy - 65, cx + 7 + lean * 0.28, cy - 58), fill=rgba(INK))
    draw.arc((cx + 5 + lean * 0.28, cy - 56, cx + 22 + lean * 0.28, cy - 44), 8, 80, fill=rgba(RED), width=2)

    # Silver helmet and white crest.
    helm = [
        (cx - 39 + lean * 0.28, cy - 70),
        (cx - 23 + lean * 0.28, cy - 101),
        (cx + 27 + lean * 0.28, cy - 103),
        (cx + 42 + lean * 0.28, cy - 68),
        (cx + 29 + lean * 0.28, cy - 58),
        (cx - 30 + lean * 0.28, cy - 59),
    ]
    draw.polygon(helm, fill=rgba(SILVER), outline=rgba(INK))
    draw.polygon(
        [
            (cx - 10 + lean * 0.28, cy - 101),
            (cx + 8 + lean * 0.28, cy - 116),
            (cx + 17 + lean * 0.28, cy - 100),
        ],
        fill=rgba(SILVER_LIGHT),
        outline=rgba(INK),
    )
    crest_points = [
        (cx + 11 + lean * 0.28, cy - 106),
        (cx + 27 + lean * 0.28, cy - 126),
        (cx + 44 + lean * 0.28, cy - 117),
        (cx + 30 + lean * 0.28, cy - 100),
    ]
    draw.line(crest_points, fill=rgba(INK), width=8, joint="curve")
    draw.line(crest_points, fill=rgba(WHITE), width=5, joint="curve")

    if pose == "hurt":
        draw.line([(cx - 14, cy - 67), (cx - 1, cy - 59)], fill=rgba(INK), width=3)
        draw.line([(cx + 15, cy - 69), (cx + 3, cy - 60)], fill=rgba(INK), width=3)


def fit_alpha(img, margin=36, bottom_margin=None):
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img
    crop = img.crop(bbox)
    cw, ch = crop.size
    max_w = img.size[0] - margin * 2
    max_h = img.size[1] - margin - (bottom_margin if bottom_margin is not None else margin)
    ratio = min(max_w / cw, max_h / ch, 1)
    new_size = (max(1, int(cw * ratio)), max(1, int(ch * ratio)))
    if new_size != crop.size:
        crop = crop.resize(new_size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    x = (img.size[0] - new_size[0]) // 2
    if bottom_margin is None:
        y = (img.size[1] - new_size[1]) // 2
    else:
        y = img.size[1] - bottom_margin - new_size[1]
    out.alpha_composite(crop, (x, y))
    return out


def make_sprite_sheet():
    img = Image.new("RGBA", (1024, 512), (0, 0, 0, 0))
    poses = ["idle", "run", "charge", "thrust", "recover", "dodge", "victory", "hurt"]
    for i, pose in enumerate(poses):
        col, row = i % 4, i // 4
        x, y = col * 256, row * 256
        cell = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        draw_chibi_zhaoyun(cell, (44, 33, 212, 236), pose)
        cell = fit_alpha(cell, margin=39, bottom_margin=40)
        img.alpha_composite(cell, (x, y))
    img.save(OUT_DIR / "赵云精灵表.png")


def make_portrait():
    img = Image.new("RGBA", (640, 896), (0, 0, 0, 0))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((238, 777, 402, 831), fill=rgba(BLUE, 55))
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(glow)
    draw = ImageDraw.Draw(img)

    # Long spear behind the body.
    draw_spear(img, 340, 420, -1.02, 620, (40, 10), 1.45)

    # Robe/cape.
    draw.polygon([(242, 300), (370, 318), (440, 782), (326, 826), (202, 781)], fill=rgba(WHITE), outline=rgba(INK))
    draw.polygon([(215, 345), (278, 315), (318, 796), (192, 756)], fill=rgba("#eef3ff"), outline=rgba(INK))
    draw.line([(265, 346), (244, 770)], fill=rgba(SILVER_DARK), width=5)

    # Legs and boots.
    for a, b in [((277, 624), (250, 803)), ((347, 624), (391, 802))]:
        draw.line([a, b], fill=rgba(INK), width=34)
        draw.line([a, b], fill=rgba(SILVER_DARK), width=21)
        draw.ellipse((b[0] - 29, b[1] - 9, b[0] + 42, b[1] + 17), fill=rgba(INK))

    # Armor.
    draw.rounded_rectangle((232, 265, 388, 536), radius=44, fill=rgba(SILVER), outline=rgba(INK), width=8)
    draw.polygon([(258, 286), (369, 310), (351, 512), (254, 498)], fill=rgba(SILVER_LIGHT))
    draw.line([(252, 379), (372, 395)], fill=rgba(GOLD), width=10)
    draw.line([(312, 276), (302, 525)], fill=rgba(SILVER_DARK), width=6)
    draw.arc((258, 316, 362, 450), 195, 340, fill=rgba(BLUE_DEEP), width=5)

    # Arms.
    for a, b in [((241, 320), (174, 444)), ((378, 330), (460, 408))]:
        draw.line([a, b], fill=rgba(INK), width=31)
        draw.line([a, b], fill=rgba(SILVER), width=21)
        draw.ellipse((b[0] - 15, b[1] - 15, b[0] + 18, b[1] + 18), fill=rgba(SKIN), outline=rgba(INK), width=5)

    # Head.
    draw.ellipse((286, 210, 338, 269), fill=rgba(SKIN), outline=rgba(INK), width=6)
    draw.ellipse((223, 102, 395, 258), fill=rgba(SKIN), outline=rgba(INK), width=9)
    draw.pieslice((225, 86, 399, 198), 178, 356, fill=rgba(HAIR))
    draw.ellipse((307, 165, 327, 183), fill=rgba(INK))
    draw.arc((322, 191, 363, 226), 10, 78, fill=rgba(RED), width=5)
    draw.polygon([(210, 145), (251, 65), (362, 58), (402, 150), (372, 190), (234, 189)], fill=rgba(SILVER), outline=rgba(INK))
    draw.polygon([(286, 62), (329, 24), (356, 65)], fill=rgba(SILVER_LIGHT), outline=rgba(INK))
    draw.line([(330, 47), (372, 5), (421, 31), (384, 78)], fill=rgba(INK), width=20, joint="curve")
    draw.line([(330, 47), (372, 5), (421, 31), (384, 78)], fill=rgba(WHITE), width=12, joint="curve")
    draw.line([(240, 189), (370, 190)], fill=rgba(GOLD), width=8)

    img = fit_alpha(img, margin=36, bottom_margin=42)
    img.save(OUT_DIR / "赵云立绘.png")


def draw_icon_frame(draw, x, y, title_color=SILVER):
    draw.rounded_rectangle((x + 23, y + 23, x + 233, y + 233), radius=30, fill=rgba("#253040", 226), outline=rgba(GOLD), width=8)
    draw.rounded_rectangle((x + 37, y + 37, x + 219, y + 219), radius=22, outline=rgba(SILVER_LIGHT), width=3)
    draw.arc((x + 47, y + 47, x + 209, y + 209), 210, 330, fill=rgba(title_color, 110), width=8)


def make_skill_icons():
    img = Image.new("RGBA", (768, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for idx in range(6):
        x, y = (idx % 3) * 256, (idx // 3) * 256
        draw_icon_frame(draw, x, y)
        cx, cy = x + 128, y + 128
        if idx == 0:
            # Attack: silver spear.
            draw_glow_line(img, [(x + 67, y + 177), (x + 188, y + 70)], BLUE, 6)
            draw.line([(x + 67, y + 177), (x + 188, y + 70)], fill=rgba(SILVER_LIGHT), width=7)
            draw.polygon([(x + 198, y + 60), (x + 179, y + 78), (x + 195, y + 91)], fill=rgba(SILVER_LIGHT), outline=rgba(INK))
        elif idx == 1:
            # Defense: helmet.
            draw.polygon([(cx - 69, cy - 14), (cx - 38, cy - 74), (cx + 48, cy - 76), (cx + 74, cy - 9), (cx + 49, cy + 51), (cx - 52, cy + 52)], fill=rgba(SILVER), outline=rgba(INK))
            draw.polygon([(cx - 10, cy - 75), (cx + 18, cy - 109), (cx + 42, cy - 73)], fill=rgba(SILVER_LIGHT), outline=rgba(INK))
            draw.line([(cx + 20, cy - 74), (cx + 60, cy - 105), (cx + 93, cy - 77)], fill=rgba(WHITE), width=10)
        elif idx == 2:
            # Passive: dragon mark.
            points = [(cx - 66, cy + 33), (cx - 30, cy - 38), (cx + 31, cy - 48), (cx + 62, cy - 2), (cx + 12, cy + 47)]
            draw.line(points, fill=rgba(INK), width=24, joint="curve")
            draw.line(points, fill=rgba(BLUE), width=15, joint="curve")
            draw.ellipse((cx + 48, cy - 26, cx + 83, cy + 10), fill=rgba(SILVER_LIGHT), outline=rgba(INK), width=4)
            draw.polygon([(cx + 72, cy - 17), (cx + 94, cy - 36), (cx + 85, cy - 4)], fill=rgba(GOLD), outline=rgba(INK))
        elif idx == 3:
            # Ultimate: charging lances.
            for off in [-28, 0, 28]:
                draw.line([(cx - 72, cy + 58 + off), (cx + 69, cy - 58 + off)], fill=rgba(SILVER_LIGHT), width=6)
                draw.polygon([(cx + 79, cy - 67 + off), (cx + 55, cy - 51 + off), (cx + 71, cy - 34 + off)], fill=rgba(BLUE), outline=rgba(INK))
            draw.arc((cx - 80, cy - 80, cx + 80, cy + 80), 215, 330, fill=rgba(GOLD), width=12)
        elif idx == 4:
            # Buff: silver aura.
            draw.ellipse((cx - 58, cy - 58, cx + 58, cy + 58), outline=rgba(BLUE), width=12)
            draw.ellipse((cx - 33, cy - 33, cx + 33, cy + 33), fill=rgba(SILVER_LIGHT), outline=rgba(INK), width=5)
            for a in range(0, 360, 60):
                px = cx + cos(a * pi / 180) * 82
                py = cy + sin(a * pi / 180) * 82
                draw.polygon([(px, py - 13), (px + 9, py + 8), (px - 9, py + 8)], fill=rgba(GOLD), outline=rgba(INK))
        else:
            # Bond/loyalty: shield and Shu ribbon.
            draw.polygon([(cx, cy - 83), (cx + 66, cy - 48), (cx + 51, cy + 45), (cx, cy + 86), (cx - 51, cy + 45), (cx - 66, cy - 48)], fill=rgba(SILVER), outline=rgba(INK))
            draw.line([(cx, cy - 55), (cx, cy + 59)], fill=rgba(SILVER_LIGHT), width=12)
            draw.line([(cx - 45, cy - 18), (cx + 45, cy - 18)], fill=rgba(GOLD), width=10)
            draw.polygon([(cx - 47, cy + 9), (cx, cy + 34), (cx + 47, cy + 9), (cx + 35, cy + 58), (cx, cy + 82), (cx - 35, cy + 58)], fill=rgba(RED, 210), outline=rgba(INK))
    img.save(OUT_DIR / "赵云技能.png")


def make_preview():
    html = """<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>赵云素材预览</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #1f2633; color: #eef3ff; }
  main { max-width: 1180px; margin: 0 auto; padding: 24px; }
  section { margin-bottom: 28px; }
  .checker { padding: 18px; border: 1px solid #536073; background:
    linear-gradient(45deg, #2c3444 25%, transparent 25%),
    linear-gradient(-45deg, #2c3444 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2c3444 75%),
    linear-gradient(-45deg, transparent 75%, #2c3444 75%);
    background-size: 32px 32px; background-position: 0 0, 0 16px, 16px -16px, -16px 0;
  }
  img { max-width: 100%; image-rendering: auto; display: block; margin: 0 auto; }
  .small img { width: 384px; }
</style>
<main>
  <h1>赵云素材预览</h1>
  <section><h2>精灵表</h2><div class="checker"><img src="赵云精灵表.png" alt="赵云精灵表"></div></section>
  <section class="small"><h2>立绘</h2><div class="checker"><img src="赵云立绘.png" alt="赵云立绘"></div></section>
  <section><h2>技能图标</h2><div class="checker"><img src="赵云技能.png" alt="赵云技能"></div></section>
</main>
</html>
"""
    (OUT_DIR / "preview.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    make_sprite_sheet()
    make_portrait()
    make_skill_icons()
    make_preview()
