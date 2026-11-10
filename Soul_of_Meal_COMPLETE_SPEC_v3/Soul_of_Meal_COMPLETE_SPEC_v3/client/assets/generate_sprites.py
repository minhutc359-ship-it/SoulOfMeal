#!/usr/bin/env python3
"""
Soul of Meal - Complete Sprite & Asset Generator
Generates all pixel art sprite sheets, icons, UI elements, map tiles, and effects.
Uses Pillow (PIL) to draw everything programmatically.
"""

import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "sprites")
FRAME_SIZE = 64
SHEET_COLS = 6  # max frames per row
SHEET_ROWS = 10  # animation clips
SHEET_W = SHEET_COLS * FRAME_SIZE  # 384
SHEET_H = SHEET_ROWS * FRAME_SIZE  # 640

ANIMATION_SPEC = [
    ("idle", 4),
    ("walk", 6),
    ("run", 6),
    ("attack_a", 4),
    ("attack_b", 4),
    ("hit", 2),
    ("skill_01", 4),
    ("ultimate_01", 6),
    ("defeat", 4),
    ("victory", 4),
]

# ─── Utility Helpers ─────────────────────────────────────────────────────────

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def hex_to_rgba(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGBA colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def darken(color, factor=0.7):
    return (int(color[0]*factor), int(color[1]*factor), int(color[2]*factor), color[3] if len(color)>3 else 255)


def lighten(color, factor=1.3):
    return (min(255, int(color[0]*factor)), min(255, int(color[1]*factor)), min(255, int(color[2]*factor)), color[3] if len(color)>3 else 255)


def draw_ellipse_aa(img, bbox, fill=None, outline=None):
    """Draw an anti-aliased ellipse by drawing at 2x and downscaling."""
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    tmp = Image.new('RGBA', (w*2, h*2), (0,0,0,0))
    d = ImageDraw.Draw(tmp)
    d.ellipse([0, 0, w*2-1, h*2-1], fill=fill, outline=outline)
    tmp = tmp.resize((w, h), Image.LANCZOS)
    img.paste(tmp, (x0, y0), tmp)


def draw_rounded_rect(draw, bbox, radius, fill=None, outline=None):
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill)
    draw.pieslice([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=fill)
    draw.pieslice([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=fill)
    draw.pieslice([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=fill)
    draw.pieslice([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=fill)
    if outline:
        draw.arc([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=outline)
        draw.arc([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=outline)
        draw.arc([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=outline)
        draw.arc([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=outline)
        draw.line([x0+radius, y0, x1-radius, y0], fill=outline)
        draw.line([x0+radius, y1, x1-radius, y1], fill=outline)
        draw.line([x0, y0+radius, x0, y1-radius], fill=outline)
        draw.line([x1, y0+radius, x1, y1-radius], fill=outline)


# ─── Character Definitions ───────────────────────────────────────────────────

CHARACTERS = {
    "chr_bunbo_holinh": {
        "name": "Bún Bò Hỏa Linh",
        "element": "fire",
        "role": "fighter",
        "primary": "#dd684a",
        "secondary": "#f5a623",
        "accent": "#ff6b35",
        "hair": "#2c1810",
        "skin": "#f0c8a0",
        "outline": "#3d1f10",
    },
    "chr_pho_lamvu": {
        "name": "Phở Lam Vũ",
        "element": "water",
        "role": "mage",
        "primary": "#428eac",
        "secondary": "#c8a96e",
        "accent": "#8ecae6",
        "hair": "#1a1a2e",
        "skin": "#f2d5b8",
        "outline": "#1a2a3a",
    },
    "chr_goicuon_diepnhi": {
        "name": "Gỏi Cuốn Diệp Nhi",
        "element": "wood",
        "role": "support",
        "primary": "#548d56",
        "secondary": "#a8d5a2",
        "accent": "#f5f0dc",
        "hair": "#4a7c59",
        "skin": "#fae0c8",
        "outline": "#2d4a30",
    },
    "chr_banhbao_bachngoc": {
        "name": "Bánh Bao Bạch Ngọc",
        "element": "light",
        "role": "tank",
        "primary": "#b8923c",
        "secondary": "#fff5db",
        "accent": "#f0d77d",
        "hair": "#e8d5b0",
        "skin": "#fce8d0",
        "outline": "#6b5520",
    },
    "chr_caphe_davu": {
        "name": "Cà Phê Dạ Vũ",
        "element": "shadow",
        "role": "assassin",
        "primary": "#75627e",
        "secondary": "#3c2415",
        "accent": "#d4a574",
        "hair": "#1a0e08",
        "skin": "#e8cdb0",
        "outline": "#1a0e08",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER SPRITE DRAWING
# ═══════════════════════════════════════════════════════════════════════════════

class ChibiDrawer:
    """Draws a chibi character on a 64x64 frame."""

    def __init__(self, char_cfg):
        self.cfg = char_cfg
        self.primary = hex_to_rgba(char_cfg["primary"])
        self.secondary = hex_to_rgba(char_cfg["secondary"])
        self.accent = hex_to_rgba(char_cfg["accent"])
        self.hair_c = hex_to_rgba(char_cfg["hair"])
        self.skin = hex_to_rgba(char_cfg["skin"])
        self.outline = hex_to_rgba(char_cfg["outline"])
        self.eye_white = (255, 255, 255, 255)
        self.eye_pupil = (20, 20, 30, 255)
        self.eye_shine = (255, 255, 255, 230)
        self.mouth = (200, 100, 100, 255)
        self.shadow_c = (0, 0, 0, 50)
        self.role = char_cfg["role"]

    def new_frame(self):
        return Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    # ── Body parts ────────────────────────────────────────────────────────

    def draw_shadow(self, draw, cx=32, cy=58, w=20, h=5):
        draw.ellipse([cx-w, cy-h, cx+w, cy+h], fill=self.shadow_c)

    def draw_body(self, draw, cx=32, top=36, bot=54, width=10, sway=0):
        """Draw the torso/body."""
        x0 = cx - width + sway
        x1 = cx + width + sway
        # Body
        draw.rectangle([x0, top, x1, bot], fill=self.primary, outline=self.outline)
        # Belt / decoration line
        belt_y = top + (bot - top) // 2
        draw.line([x0, belt_y, x1, belt_y], fill=self.secondary, width=2)

    def draw_legs(self, draw, cx=32, top=52, step_offset=0, frame=0):
        """Draw two legs with walking offset."""
        lx = cx - 6
        rx = cx + 3
        leg_h = 8
        # Walking offset for left/right legs
        l_off = step_offset
        r_off = -step_offset
        # Left leg
        draw.rectangle([lx, top + l_off, lx + 5, top + leg_h + l_off],
                        fill=darken(self.primary), outline=self.outline)
        # Right leg
        draw.rectangle([rx, top + r_off, rx + 5, top + leg_h + r_off],
                        fill=darken(self.primary), outline=self.outline)
        # Shoes
        shoe_c = darken(self.secondary, 0.8)
        draw.rectangle([lx-1, top + leg_h + l_off - 2, lx + 6, top + leg_h + l_off + 1],
                        fill=shoe_c, outline=self.outline)
        draw.rectangle([rx-1, top + leg_h + r_off - 2, rx + 6, top + leg_h + r_off + 1],
                        fill=shoe_c, outline=self.outline)

    def draw_arms(self, draw, cx=32, body_top=36, arm_angle=0, sway=0):
        """Draw two arms."""
        arm_c = self.skin
        sleeve_c = self.primary
        # Left arm
        lax = cx - 12 + sway
        lay = body_top + 4
        draw.rectangle([lax, lay + arm_angle, lax + 5, lay + 12 + arm_angle],
                        fill=sleeve_c, outline=self.outline)
        draw.rectangle([lax, lay + 10 + arm_angle, lax + 5, lay + 14 + arm_angle],
                        fill=arm_c, outline=self.outline)
        # Right arm
        rax = cx + 8 + sway
        draw.rectangle([rax, lay - arm_angle, rax + 5, lay + 12 - arm_angle],
                        fill=sleeve_c, outline=self.outline)
        draw.rectangle([rax, lay + 10 - arm_angle, rax + 5, lay + 14 - arm_angle],
                        fill=arm_c, outline=self.outline)

    def draw_head(self, draw, img, cx=32, cy=24, bob=0, blink=False, expression="normal"):
        """Draw the chibi head with face."""
        hcx = cx
        hcy = cy + bob
        hw = 14  # head half-width
        hh = 13  # head half-height

        # Hair back (behind head)
        draw.ellipse([hcx-hw-2, hcy-hh-3, hcx+hw+2, hcy+4],
                      fill=self.hair_c, outline=self.outline)

        # Head/face
        draw.ellipse([hcx-hw, hcy-hh, hcx+hw, hcy+hh],
                      fill=self.skin, outline=self.outline)

        # Hair on top
        draw.ellipse([hcx-hw-1, hcy-hh-2, hcx+hw+1, hcy-2],
                      fill=self.hair_c, outline=self.outline)
        # Hair bangs
        draw.arc([hcx-10, hcy-hh, hcx+2, hcy], 200, 340, fill=self.hair_c, width=3)
        draw.arc([hcx-2, hcy-hh, hcx+10, hcy], 200, 340, fill=self.hair_c, width=3)

        # Eyes
        ey = hcy + 1
        if blink:
            draw.line([hcx-7, ey, hcx-3, ey], fill=self.eye_pupil, width=1)
            draw.line([hcx+3, ey, hcx+7, ey], fill=self.eye_pupil, width=1)
        else:
            # Left eye
            draw.ellipse([hcx-9, ey-3, hcx-3, ey+3], fill=self.eye_white)
            draw.ellipse([hcx-8, ey-2, hcx-4, ey+2], fill=self.eye_pupil)
            img.putpixel((hcx-7, ey-1), self.eye_shine)
            # Right eye
            draw.ellipse([hcx+3, ey-3, hcx+9, ey+3], fill=self.eye_white)
            draw.ellipse([hcx+4, ey-2, hcx+8, ey+2], fill=self.eye_pupil)
            img.putpixel((hcx+5, ey-1), self.eye_shine)

        # Blush
        blush = (255, 180, 180, 100)
        draw_ellipse_aa(img, [hcx-12, ey+2, hcx-6, ey+5], fill=blush)
        draw_ellipse_aa(img, [hcx+6, ey+2, hcx+12, ey+5], fill=blush)

        # Mouth
        if expression == "happy":
            draw.arc([hcx-3, ey+3, hcx+3, ey+8], 0, 180, fill=self.mouth, width=1)
        elif expression == "hurt":
            draw.arc([hcx-3, ey+5, hcx+3, ey+9], 180, 360, fill=self.mouth, width=1)
        elif expression == "open":
            draw.ellipse([hcx-2, ey+4, hcx+2, ey+7], fill=self.mouth)
        else:
            draw.line([hcx-2, ey+5, hcx+2, ey+5], fill=self.mouth, width=1)

    def draw_hat_or_accessory(self, draw, img, cx=32, cy=24, bob=0):
        """Draw character-specific headgear."""
        hcy = cy + bob
        role = self.role
        if role == "fighter":
            # Bowl-shaped hat with steam
            draw.arc([cx-16, hcy-20, cx+16, hcy-6], 180, 360,
                     fill=self.secondary, width=4)
            draw.rectangle([cx-16, hcy-14, cx+16, hcy-10],
                           fill=self.secondary, outline=self.outline)
            # Steam/fire wisps
            for i, sx in enumerate([cx-8, cx, cx+8]):
                steam_h = 6 + (i % 2) * 3
                draw.line([sx, hcy-20, sx-2, hcy-20-steam_h], fill=self.accent, width=2)
                draw.line([sx, hcy-20, sx+2, hcy-20-steam_h-2], fill=lighten(self.accent), width=1)
        elif role == "mage":
            # Wizard hat shaped like a pho bowl cone
            points = [(cx, hcy-28), (cx-12, hcy-10), (cx+12, hcy-10)]
            draw.polygon(points, fill=self.primary, outline=self.outline)
            # Star anise at top
            draw.ellipse([cx-3, hcy-30, cx+3, hcy-24], fill=self.secondary)
            # Brim
            draw.ellipse([cx-15, hcy-14, cx+15, hcy-8], fill=darken(self.primary), outline=self.outline)
        elif role == "support":
            # Herb/leaf crown
            for angle_off in [-12, -6, 0, 6, 12]:
                lx = cx + angle_off
                ly = hcy - 16
                draw.ellipse([lx-3, ly-4, lx+3, ly+1], fill=self.primary)
                draw.ellipse([lx-2, ly-3, lx+2, ly], fill=self.secondary)
            # Small flower
            draw.ellipse([cx-2, hcy-18, cx+2, hcy-14], fill=(255, 220, 220, 255))
        elif role == "tank":
            # Round bao bun top decoration - pleated crown
            draw.arc([cx-14, hcy-20, cx+14, hcy-8], 180, 360,
                     fill=self.secondary, width=5)
            # Pleats
            for px in range(cx-12, cx+13, 4):
                draw.line([px, hcy-16, px, hcy-12], fill=self.outline, width=1)
            # Light glow dot
            draw.ellipse([cx-2, hcy-22, cx+2, hcy-18], fill=self.accent)
        elif role == "assassin":
            # Hood/mask
            draw.arc([cx-15, hcy-18, cx+15, hcy-4], 180, 360,
                     fill=darken(self.primary), width=6)
            # Coffee drip pattern
            for dx in [-8, 0, 8]:
                draw.line([cx+dx, hcy-16, cx+dx, hcy-12],
                          fill=self.accent, width=1)

    def draw_weapon(self, draw, img, cx=32, body_top=36, weapon_angle=0, show=True):
        """Draw character-specific weapon."""
        if not show:
            return
        role = self.role
        wx = cx + 14
        wy = body_top + 2
        if role == "fighter":
            # Big wooden ladle
            draw.rectangle([wx, wy + weapon_angle, wx+3, wy+18+weapon_angle],
                           fill=(139, 90, 43, 255), outline=self.outline)
            draw.ellipse([wx-3, wy+weapon_angle-4, wx+6, wy+weapon_angle+4],
                         fill=(160, 100, 50, 255), outline=self.outline)
        elif role == "mage":
            # Noodle staff with star anise
            draw.rectangle([wx, wy + weapon_angle, wx+2, wy+20+weapon_angle],
                           fill=self.secondary, outline=self.outline)
            # Star anise ornament
            star_cx = wx + 1
            star_cy = wy + weapon_angle - 3
            for a in range(0, 360, 45):
                rad = math.radians(a)
                sx = int(star_cx + 4 * math.cos(rad))
                sy = int(star_cy + 4 * math.sin(rad))
                draw.line([star_cx, star_cy, sx, sy], fill=self.accent, width=1)
            draw.ellipse([star_cx-2, star_cy-2, star_cx+2, star_cy+2], fill=self.secondary)
        elif role == "support":
            # Healing herb bundle
            for hoff in range(3):
                hx = wx + hoff * 2
                draw.rectangle([hx, wy+8+weapon_angle, hx+1, wy+16+weapon_angle],
                               fill=(100, 70, 40, 255))
                draw.ellipse([hx-2, wy+4+weapon_angle, hx+3, wy+9+weapon_angle],
                             fill=self.secondary)
        elif role == "tank":
            # Shield
            draw.ellipse([wx-2, wy+weapon_angle, wx+10, wy+16+weapon_angle],
                         fill=self.primary, outline=self.outline)
            draw.ellipse([wx+1, wy+3+weapon_angle, wx+7, wy+13+weapon_angle],
                         fill=self.accent)
            # Cross on shield
            draw.line([wx+4, wy+4+weapon_angle, wx+4, wy+12+weapon_angle],
                      fill=self.secondary, width=2)
            draw.line([wx+1, wy+8+weapon_angle, wx+7, wy+8+weapon_angle],
                      fill=self.secondary, width=2)
        elif role == "assassin":
            # Dual daggers
            draw.polygon([(wx, wy+weapon_angle), (wx+2, wy-6+weapon_angle),
                          (wx+4, wy+weapon_angle)],
                         fill=(200, 200, 210, 255), outline=self.outline)
            # Second dagger on left side
            lx = cx - 16
            draw.polygon([(lx, wy-weapon_angle), (lx+2, wy-6-weapon_angle),
                          (lx+4, wy-weapon_angle)],
                         fill=(200, 200, 210, 255), outline=self.outline)

    # ── Role-specific body adjustments ────────────────────────────────────

    def draw_role_details(self, draw, img, cx=32, body_top=36, bot=54):
        """Add role-specific body decorations."""
        if self.role == "fighter":
            # Apron
            draw.rectangle([cx-8, body_top+4, cx+8, bot-2],
                           fill=lighten(self.secondary), outline=self.outline)
            draw.line([cx-8, body_top+4, cx+8, body_top+4], fill=self.accent, width=1)
        elif self.role == "mage":
            # Flowing cloak edges
            draw.polygon([(cx-12, body_top+6), (cx-16, bot+2), (cx-10, bot)],
                         fill=darken(self.primary, 0.8))
            draw.polygon([(cx+12, body_top+6), (cx+16, bot+2), (cx+10, bot)],
                         fill=darken(self.primary, 0.8))
        elif self.role == "support":
            # Rice paper shawl
            draw.arc([cx-14, body_top-2, cx+14, body_top+10], 0, 180,
                     fill=self.accent, width=2)
        elif self.role == "tank":
            # Make body rounder/wider
            draw_ellipse_aa(img, [cx-14, body_top-2, cx+14, bot+2],
                           fill=self.secondary)
            draw.ellipse([cx-12, body_top, cx+12, bot],
                         fill=self.primary, outline=self.outline)
            # Pleated armor edge
            for px in range(cx-10, cx+11, 4):
                draw.line([px, bot-3, px, bot+1], fill=self.outline, width=1)
        elif self.role == "assassin":
            # Scarf/cape
            draw.polygon([(cx-4, body_top-2), (cx+4, body_top-2),
                          (cx+8, body_top+8), (cx-8, body_top+8)],
                         fill=darken(self.primary))

    # ── Element effect particles ──────────────────────────────────────────

    def draw_element_particles(self, img, draw, cx=32, cy=32, frame=0, intensity=1):
        """Draw element-specific floating particles."""
        element = self.cfg["element"]
        random.seed(frame * 7 + hash(element))
        for i in range(int(3 * intensity)):
            px = cx + random.randint(-20, 20)
            py = cy + random.randint(-24, 10) - (frame % 4) * 2
            if 0 <= px < 64 and 0 <= py < 64:
                if element == "fire":
                    c = self.accent if i % 2 == 0 else self.secondary
                    draw.ellipse([px-1, py-1, px+1, py+1], fill=(*c[:3], 180))
                elif element == "water":
                    c = self.accent
                    draw.ellipse([px-1, py-2, px+1, py+1], fill=(*c[:3], 150))
                elif element == "wood":
                    c = self.secondary
                    # Tiny leaf shape
                    draw.ellipse([px-2, py-1, px+1, py+1], fill=(*c[:3], 160))
                elif element == "light":
                    c = self.accent
                    # Sparkle
                    draw.line([px-2, py, px+2, py], fill=(*c[:3], 200), width=1)
                    draw.line([px, py-2, px, py+2], fill=(*c[:3], 200), width=1)
                elif element == "shadow":
                    c = self.primary
                    draw.ellipse([px-1, py-1, px+2, py+2], fill=(*c[:3], 120))

    # ── Full frame composers ─────────────────────────────────────────────

    def draw_full_character(self, frame_idx=0, bob=0, sway=0, step=0,
                            arm_angle=0, weapon_angle=0, show_weapon=True,
                            expression="normal", blink=False, particles=0,
                            tilt=0, alpha_mult=1.0, body_top=36, body_bot=54,
                            leg_top=52, head_cy=24, extra_fn=None):
        """Compose a full character frame."""
        img = self.new_frame()
        draw = ImageDraw.Draw(img)
        cx = 32 + sway

        # Shadow on ground
        self.draw_shadow(draw, cx=32, cy=58)

        # Legs
        self.draw_legs(draw, cx=cx, top=leg_top, step_offset=step)

        # Body
        self.draw_body(draw, cx=cx, top=body_top+bob, bot=body_bot+bob, sway=0)
        self.draw_role_details(draw, img, cx=cx, body_top=body_top+bob, bot=body_bot+bob)

        # Arms
        self.draw_arms(draw, cx=cx, body_top=body_top+bob, arm_angle=arm_angle)

        # Weapon
        self.draw_weapon(draw, img, cx=cx, body_top=body_top+bob,
                         weapon_angle=weapon_angle, show=show_weapon)

        # Head
        self.draw_head(draw, img, cx=cx, cy=head_cy, bob=bob,
                       blink=blink, expression=expression)

        # Hat / accessory
        self.draw_hat_or_accessory(draw, img, cx=cx, cy=head_cy, bob=bob)

        # Element particles
        if particles > 0:
            self.draw_element_particles(img, draw, cx=cx, cy=32, frame=frame_idx,
                                         intensity=particles)

        # Extra drawing function (for special animations)
        if extra_fn:
            extra_fn(draw, img, frame_idx, cx, bob)

        # Apply alpha
        if alpha_mult < 1.0:
            r, g, b, a = img.split()
            a = a.point(lambda p: int(p * alpha_mult))
            img = Image.merge('RGBA', (r, g, b, a))

        return img

    # ── Animation generators ─────────────────────────────────────────────

    def gen_idle(self, num_frames=4):
        frames = []
        bobs = [0, -1, -1, 0]
        for i in range(num_frames):
            blink = (i == 2)
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i % 4], blink=blink,
                expression="normal", particles=0.3
            ))
        return frames

    def gen_walk(self, num_frames=6):
        frames = []
        steps = [0, 2, 3, 0, -2, -3]
        bobs = [0, -1, 0, 0, -1, 0]
        sways = [0, 1, 0, 0, -1, 0]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i], step=steps[i], sway=sways[i],
                expression="normal"
            ))
        return frames

    def gen_run(self, num_frames=6):
        frames = []
        steps = [0, 3, 5, 0, -3, -5]
        bobs = [0, -2, -1, 0, -2, -1]
        sways = [0, 2, 1, 0, -2, -1]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i], step=steps[i], sway=sways[i],
                arm_angle=steps[i], expression="normal"
            ))
        return frames

    def gen_attack_a(self, num_frames=4):
        frames = []
        arm_angles = [0, -8, -12, -4]
        weapon_angles = [0, -10, -16, -6]
        expressions = ["normal", "open", "open", "normal"]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, arm_angle=arm_angles[i],
                weapon_angle=weapon_angles[i],
                expression=expressions[i], particles=0.5 if i >= 1 else 0
            ))
        return frames

    def gen_attack_b(self, num_frames=4):
        frames = []
        arm_angles = [0, -4, -14, -2]
        sways = [0, -2, 4, 0]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, arm_angle=arm_angles[i], sway=sways[i],
                weapon_angle=arm_angles[i],
                expression="open" if i in (1,2) else "normal",
                particles=1.0 if i == 2 else 0
            ))
        return frames

    def gen_hit(self, num_frames=2):
        frames = []
        for i in range(num_frames):
            def hit_flash(draw, img, fi, cx, bob, idx=i):
                if idx == 0:
                    # Red flash overlay
                    overlay = Image.new('RGBA', (64, 64), (255, 50, 50, 60))
                    img.paste(Image.alpha_composite(img, overlay), (0, 0))
            frames.append(self.draw_full_character(
                frame_idx=i, sway=4 if i == 0 else -2,
                expression="hurt", bob=-1 if i == 0 else 0,
                extra_fn=hit_flash,
                alpha_mult=0.8 if i == 0 else 1.0
            ))
        return frames

    def gen_skill(self, num_frames=4):
        frames = []
        bobs = [0, -2, -3, -1]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i], arm_angle=-6 if i in (1,2) else 0,
                expression="open" if i in (1,2) else "happy",
                particles=1.5 if i >= 1 else 0.5, show_weapon=True
            ))
        return frames

    def gen_ultimate(self, num_frames=6):
        frames = []
        bobs = [0, -1, -3, -5, -3, 0]
        for i in range(num_frames):
            part_intensity = 2.0 if i in (2, 3, 4) else 0.8
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i],
                arm_angle=-10 if i in (2, 3) else 0,
                weapon_angle=-12 if i in (2, 3) else 0,
                expression="open" if i in (2, 3, 4) else "happy",
                particles=part_intensity, show_weapon=True
            ))
        return frames

    def gen_defeat(self, num_frames=4):
        frames = []
        tilts = [0, 2, 4, 6]
        alphas = [1.0, 0.9, 0.75, 0.6]
        bobs = [0, 2, 5, 8]
        for i in range(num_frames):
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i], sway=tilts[i],
                expression="hurt", show_weapon=False,
                alpha_mult=alphas[i], particles=0
            ))
        return frames

    def gen_victory(self, num_frames=4):
        frames = []
        bobs = [0, -3, -5, -2]
        for i in range(num_frames):
            def victory_stars(draw, img, fi, cx, bob, idx=i):
                if idx >= 1:
                    random.seed(idx * 13)
                    for s in range(idx + 1):
                        sx = cx + random.randint(-18, 18)
                        sy = 8 + random.randint(0, 12)
                        star_c = (255, 230, 100, 200)
                        draw.line([sx-2, sy, sx+2, sy], fill=star_c, width=1)
                        draw.line([sx, sy-2, sx, sy+2], fill=star_c, width=1)
            frames.append(self.draw_full_character(
                frame_idx=i, bob=bobs[i],
                arm_angle=-8 if i in (1, 2) else 0,
                expression="happy", particles=0.5,
                extra_fn=victory_stars
            ))
        return frames

    def generate_sprite_sheet(self):
        """Generate the complete sprite sheet (384x640)."""
        sheet = Image.new('RGBA', (SHEET_W, SHEET_H), (0, 0, 0, 0))

        generators = [
            self.gen_idle,       # row 0: 4
            self.gen_walk,       # row 1: 6
            self.gen_run,        # row 2: 6
            self.gen_attack_a,   # row 3: 4
            self.gen_attack_b,   # row 4: 4
            self.gen_hit,        # row 5: 2
            self.gen_skill,      # row 6: 4
            self.gen_ultimate,   # row 7: 6
            self.gen_defeat,     # row 8: 4
            self.gen_victory,    # row 9: 4
        ]

        for row, (anim_name, num_frames) in enumerate(ANIMATION_SPEC):
            gen_fn = generators[row]
            frames = gen_fn(num_frames)
            for col, frame_img in enumerate(frames):
                x = col * FRAME_SIZE
                y = row * FRAME_SIZE
                sheet.paste(frame_img, (x, y), frame_img)

        return sheet


# ═══════════════════════════════════════════════════════════════════════════════
# ELEMENT ICONS (32x32)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_icon_fire(output_path):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Flame shape
    flame_outer = hex_to_rgba("#dd684a")
    flame_inner = hex_to_rgba("#f5a623")
    flame_core = hex_to_rgba("#fff5db")
    # Outer flame
    draw.polygon([(16, 2), (8, 18), (12, 22), (16, 16), (20, 22), (24, 18)],
                 fill=flame_outer)
    draw.ellipse([8, 16, 24, 30], fill=flame_outer)
    # Inner flame
    draw.polygon([(16, 6), (11, 18), (14, 22), (16, 18), (18, 22), (21, 18)],
                 fill=flame_inner)
    draw.ellipse([11, 17, 21, 27], fill=flame_inner)
    # Core
    draw.ellipse([13, 19, 19, 25], fill=flame_core)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def generate_icon_water(output_path):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    water_c = hex_to_rgba("#428eac")
    water_light = hex_to_rgba("#8ecae6")
    water_core = (220, 240, 255, 255)
    # Droplet
    draw.polygon([(16, 3), (6, 18), (16, 28), (26, 18)], fill=water_c)
    draw.ellipse([7, 14, 25, 28], fill=water_c)
    # Inner highlight
    draw.polygon([(16, 7), (10, 18), (16, 25), (22, 18)], fill=water_light)
    draw.ellipse([10, 16, 22, 26], fill=water_light)
    # Shine
    draw.ellipse([12, 12, 16, 17], fill=water_core)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def generate_icon_wood(output_path):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    leaf_c = hex_to_rgba("#548d56")
    leaf_light = hex_to_rgba("#a8d5a2")
    stem_c = (100, 70, 40, 255)
    # Leaf shape
    draw.polygon([(16, 2), (4, 16), (10, 26), (16, 22), (22, 26), (28, 16)],
                 fill=leaf_c)
    # Vein
    draw.line([16, 4, 16, 24], fill=stem_c, width=1)
    draw.line([16, 10, 10, 16], fill=stem_c, width=1)
    draw.line([16, 10, 22, 16], fill=stem_c, width=1)
    draw.line([16, 16, 12, 22], fill=stem_c, width=1)
    draw.line([16, 16, 20, 22], fill=stem_c, width=1)
    # Light spots
    draw.ellipse([10, 8, 14, 12], fill=leaf_light)
    # Stem
    draw.line([16, 24, 16, 30], fill=stem_c, width=2)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def generate_icon_light(output_path):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    gold = hex_to_rgba("#b8923c")
    light_gold = hex_to_rgba("#f0d77d")
    white = (255, 255, 240, 255)
    # Sun/star shape
    cx, cy = 16, 16
    # Outer rays
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        r = 13 if angle % 90 == 0 else 10
        ex = int(cx + r * math.cos(rad))
        ey = int(cy + r * math.sin(rad))
        draw.line([cx, cy, ex, ey], fill=gold, width=2)
    # Center circle
    draw.ellipse([cx-7, cy-7, cx+7, cy+7], fill=light_gold, outline=gold)
    draw.ellipse([cx-4, cy-4, cx+4, cy+4], fill=white)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def generate_icon_shadow(output_path):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    purple = hex_to_rgba("#75627e")
    dark = hex_to_rgba("#3c2415")
    accent = hex_to_rgba("#d4a574")
    # Crescent moon
    draw.ellipse([6, 4, 26, 28], fill=purple)
    draw.ellipse([10, 4, 30, 28], fill=(0, 0, 0, 0))  # cut out
    # Re-draw to make crescent
    img2 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(img2)
    d2.ellipse([6, 4, 26, 28], fill=purple)
    # Mask out the right part
    mask = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    dm = ImageDraw.Draw(mask)
    dm.ellipse([12, 4, 32, 28], fill=(0, 0, 0, 255))
    # Composite
    r, g, b, a = img2.split()
    _, _, _, ma = mask.split()
    # Subtract mask alpha from image alpha
    from PIL import ImageChops
    a = ImageChops.subtract(a, ma)
    img2 = Image.merge('RGBA', (r, g, b, a))
    # Add stars
    d3 = ImageDraw.Draw(img2)
    for sx, sy in [(20, 8), (24, 14), (22, 22)]:
        d3.point((sx, sy), fill=accent)
        d3.point((sx+1, sy), fill=accent)
        d3.point((sx, sy+1), fill=accent)
    img2.save(output_path)
    print(f"  ✓ {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# UI CARD FRAMES (200x280)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_card_frame(output_path, rarity="R"):
    w, h = 200, 280
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if rarity == "R":
        border_c = (160, 120, 80, 255)    # Bronze
        bg_c = (40, 35, 30, 220)
        inner_c = (180, 140, 100, 180)
        corner_c = (200, 160, 110, 255)
    elif rarity == "SR":
        border_c = (180, 190, 200, 255)   # Silver
        bg_c = (30, 35, 45, 220)
        inner_c = (160, 170, 190, 180)
        corner_c = (220, 225, 235, 255)
    else:  # SSR
        border_c = (220, 180, 60, 255)    # Gold
        bg_c = (45, 35, 20, 220)
        inner_c = (200, 170, 80, 180)
        corner_c = (255, 220, 100, 255)

    # Background
    draw_rounded_rect(draw, [4, 4, w-5, h-5], 8, fill=bg_c)

    # Border
    for i in range(3):
        off = i
        draw_rounded_rect(draw, [off, off, w-1-off, h-1-off], 10-i,
                          outline=lerp_color(border_c, (0,0,0,255), i*0.2))

    # Inner frame for character art
    draw.rectangle([12, 12, w-13, h-70], outline=inner_c)
    draw.rectangle([13, 13, w-14, h-71], outline=inner_c)

    # Bottom info area
    draw.rectangle([12, h-60, w-13, h-14], outline=inner_c)

    # Corner decorations
    corner_size = 12
    for cx, cy in [(8, 8), (w-9, 8), (8, h-9), (w-9, h-9)]:
        draw.ellipse([cx-corner_size//2, cy-corner_size//2,
                      cx+corner_size//2, cy+corner_size//2],
                     fill=corner_c, outline=border_c)

    # Rarity text area
    draw.rectangle([w//2-30, h-55, w//2+30, h-40], fill=border_c)

    # SSR glow effect
    if rarity == "SSR":
        glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for gi in range(5, 0, -1):
            alpha = 20 * gi
            gd.rectangle([4-gi, 4-gi, w-5+gi, h-5+gi],
                          outline=(255, 220, 80, alpha))
        img = Image.alpha_composite(glow, img)

    # Star slots at bottom
    star_y = h - 35
    num_stars = {"R": 3, "SR": 4, "SSR": 5}[rarity]
    star_start = w // 2 - num_stars * 8
    for si in range(num_stars):
        sx = star_start + si * 16
        draw_star_small(ImageDraw.Draw(img), sx, star_y, 5, corner_c)

    img.save(output_path)
    print(f"  ✓ {output_path}")


def draw_star_small(draw, cx, cy, r, color):
    points = []
    for i in range(10):
        angle = math.radians(i * 36 - 90)
        rr = r if i % 2 == 0 else r * 0.4
        points.append((int(cx + rr * math.cos(angle)),
                        int(cy + rr * math.sin(angle))))
    draw.polygon(points, fill=color)


# ═══════════════════════════════════════════════════════════════════════════════
# MAP TILES
# ═══════════════════════════════════════════════════════════════════════════════

def gen_tile_grass(output_path, dark=False):
    size = 48
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if dark:
        base = (60, 130, 60, 255)
        accent = (50, 110, 50, 255)
    else:
        base = (100, 180, 80, 255)
        accent = (85, 160, 70, 255)
    draw.rectangle([0, 0, size-1, size-1], fill=base)
    # Grass texture
    random.seed(42 if dark else 37)
    for _ in range(20):
        gx = random.randint(0, size-1)
        gy = random.randint(0, size-1)
        draw.point((gx, gy), fill=accent)
    # Grass blades
    for _ in range(6):
        bx = random.randint(4, size-5)
        by = random.randint(4, size-5)
        draw.line([bx, by, bx-1, by-3], fill=darken(base, 0.85), width=1)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_tile_path(output_path):
    size = 48
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    base = (180, 150, 110, 255)
    dark = (160, 130, 90, 255)
    draw.rectangle([0, 0, size-1, size-1], fill=base)
    random.seed(55)
    for _ in range(15):
        gx = random.randint(0, size-3)
        gy = random.randint(0, size-3)
        draw.ellipse([gx, gy, gx+random.randint(2,5), gy+random.randint(2,4)],
                     fill=dark)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_tile_water(output_path):
    size = 48
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    base = (70, 140, 200, 255)
    highlight = (100, 170, 230, 200)
    draw.rectangle([0, 0, size-1, size-1], fill=base)
    # Water ripples
    for wy in range(6, size, 12):
        for wx in range(0, size, 8):
            draw.arc([wx, wy, wx+10, wy+6], 0, 180, fill=highlight, width=1)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_tree(output_path, variant=1):
    w, h = 48, 96
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    trunk_c = (110, 75, 40, 255)
    trunk_dark = (85, 55, 30, 255)

    if variant == 1:
        leaf_c = (50, 140, 50, 255)
        leaf_light = (80, 180, 80, 255)
    else:
        leaf_c = (40, 120, 70, 255)
        leaf_light = (70, 160, 90, 255)

    # Trunk
    draw.rectangle([20, 50, 28, 90], fill=trunk_c, outline=trunk_dark)
    # Trunk texture
    draw.line([23, 55, 23, 85], fill=trunk_dark, width=1)

    # Canopy
    if variant == 1:
        # Round tree
        draw.ellipse([4, 10, 44, 55], fill=leaf_c, outline=darken(leaf_c))
        draw.ellipse([8, 15, 38, 48], fill=leaf_light)
        draw.ellipse([14, 8, 34, 30], fill=leaf_c)
        draw.ellipse([16, 12, 32, 28], fill=leaf_light)
    else:
        # Triangular/pine-like
        draw.polygon([(24, 5), (6, 40), (42, 40)], fill=leaf_c, outline=darken(leaf_c))
        draw.polygon([(24, 15), (10, 50), (38, 50)], fill=leaf_c, outline=darken(leaf_c))
        draw.polygon([(24, 10), (12, 38), (36, 38)], fill=leaf_light)

    # Shadow at base
    draw.ellipse([14, 86, 34, 94], fill=(0, 0, 0, 40))
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_house(output_path, roof_color_hex, name="kitchen"):
    w, h = 128, 96
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    roof_c = hex_to_rgba(roof_color_hex)
    wall_c = (240, 230, 210, 255)
    wall_dark = (210, 200, 180, 255)
    wood_c = (130, 90, 50, 255)
    window_c = (160, 210, 240, 255)
    door_c = (100, 65, 35, 255)

    # Shadow
    draw.ellipse([20, 80, 108, 94], fill=(0, 0, 0, 40))

    # Walls
    draw.rectangle([20, 40, 108, 82], fill=wall_c, outline=darken(wall_c))
    # Wall detail
    draw.line([20, 55, 108, 55], fill=wall_dark, width=1)
    draw.line([20, 70, 108, 70], fill=wall_dark, width=1)

    # Door
    draw.rectangle([56, 55, 72, 82], fill=door_c, outline=darken(door_c))
    draw.ellipse([68, 66, 71, 69], fill=(200, 170, 60, 255))  # Knob

    # Windows
    for wx in [30, 86]:
        draw.rectangle([wx, 48, wx+16, 58], fill=window_c, outline=wood_c)
        draw.line([wx+8, 48, wx+8, 58], fill=wood_c, width=1)
        draw.line([wx, 53, wx+16, 53], fill=wood_c, width=1)

    # Roof
    draw.polygon([(14, 40), (64, 10), (114, 40)], fill=roof_c, outline=darken(roof_c))
    # Roof lines
    for ry in range(18, 40, 6):
        lx = int(14 + (64-14) * (ry-10)/(40-10))
        rx = int(114 - (114-64) * (ry-10)/(40-10))
        draw.line([lx-2, ry, rx+2, ry], fill=darken(roof_c, 0.85), width=1)

    # Chimney
    draw.rectangle([88, 14, 96, 32], fill=darken(roof_c, 0.7), outline=darken(roof_c, 0.5))
    # Smoke
    draw.ellipse([88, 8, 96, 15], fill=(200, 200, 200, 100))
    draw.ellipse([86, 4, 94, 11], fill=(200, 200, 200, 70))

    # Sign or extra detail per house type
    if name == "kitchen":
        # Small flame icon on sign
        draw.rectangle([38, 42, 50, 50], fill=wood_c)
        draw.polygon([(44, 42), (40, 48), (48, 48)], fill=(220, 100, 50, 255))
    elif name == "guild":
        # Shield icon
        draw.rectangle([38, 42, 50, 50], fill=wood_c)
        draw.polygon([(44, 43), (39, 45), (44, 50), (49, 45)], fill=(100, 140, 180, 255))
    elif name == "merchant":
        # Coin icon
        draw.rectangle([38, 42, 50, 50], fill=wood_c)
        draw.ellipse([40, 43, 48, 49], fill=(220, 200, 60, 255))

    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_chest(output_path, is_open=False):
    size = 32
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    chest_c = (140, 90, 40, 255)
    chest_dark = (100, 65, 30, 255)
    metal_c = (200, 180, 60, 255)
    metal_dark = (160, 140, 40, 255)

    # Shadow
    draw.ellipse([4, 26, 28, 31], fill=(0, 0, 0, 40))

    if is_open:
        # Open lid (tilted back)
        draw.rectangle([4, 4, 28, 12], fill=chest_c, outline=chest_dark)
        draw.line([4, 8, 28, 8], fill=metal_c, width=1)
        # Inside glow
        draw.rectangle([6, 12, 26, 18], fill=(255, 240, 150, 200))
        # Sparkles
        draw.point((12, 10), fill=(255, 255, 200, 255))
        draw.point((20, 8), fill=(255, 255, 200, 255))
        draw.point((16, 6), fill=(255, 255, 200, 255))
    else:
        # Closed lid
        draw.arc([4, 6, 28, 18], 180, 360, fill=chest_c, width=6)

    # Body
    draw.rectangle([4, 14, 28, 26], fill=chest_c, outline=chest_dark)
    # Metal bands
    draw.line([4, 18, 28, 18], fill=metal_c, width=1)
    draw.line([4, 22, 28, 22], fill=metal_c, width=1)
    draw.line([16, 14, 16, 26], fill=metal_c, width=1)
    # Lock
    draw.rectangle([14, 16, 18, 20], fill=metal_dark, outline=metal_c)

    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_portal(output_path):
    size = 48
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    outer_c = (120, 80, 180, 255)
    inner_c = (80, 140, 220, 200)
    core_c = (180, 220, 255, 180)
    glow_c = (140, 180, 255, 80)

    # Glow
    draw_ellipse_aa(img, [4, 4, 44, 44], fill=glow_c)

    # Outer ring
    draw.ellipse([6, 6, 42, 42], outline=outer_c, width=3)
    # Inner ring
    draw.ellipse([10, 10, 38, 38], outline=inner_c, width=2)
    # Core swirl
    draw.ellipse([14, 14, 34, 34], fill=core_c)
    draw.ellipse([18, 18, 30, 30], fill=(200, 230, 255, 220))
    # Center bright spot
    draw.ellipse([21, 21, 27, 27], fill=(255, 255, 255, 240))

    # Runes around the ring
    for angle in range(0, 360, 60):
        rad = math.radians(angle)
        rx = int(24 + 18 * math.cos(rad))
        ry = int(24 + 18 * math.sin(rad))
        draw.rectangle([rx-1, ry-1, rx+1, ry+1], fill=outer_c)

    img.save(output_path)
    print(f"  ✓ {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# BATTLE EFFECTS (4-frame strips, 48x48 per frame => 192x48)
# ═══════════════════════════════════════════════════════════════════════════════

def gen_effect_strip(output_path, effect_type):
    frame_size = 48
    num_frames = 4
    strip = Image.new('RGBA', (frame_size * num_frames, frame_size), (0, 0, 0, 0))

    for fi in range(num_frames):
        frame = Image.new('RGBA', (frame_size, frame_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        cx, cy = 24, 24
        progress = fi / (num_frames - 1)  # 0.0 to 1.0

        if effect_type == "hit_spark":
            alpha = int(255 * (1 - progress * 0.6))
            c = (255, 255, 200, alpha)
            c2 = (255, 200, 100, alpha)
            size = int(6 + progress * 12)
            # Cross spark
            draw.line([cx-size, cy, cx+size, cy], fill=c, width=2)
            draw.line([cx, cy-size, cx, cy+size], fill=c, width=2)
            # Diagonal
            ds = int(size * 0.7)
            draw.line([cx-ds, cy-ds, cx+ds, cy+ds], fill=c2, width=1)
            draw.line([cx+ds, cy-ds, cx-ds, cy+ds], fill=c2, width=1)
            # Center flash
            cr = max(2, int(4 * (1 - progress)))
            draw.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=(255, 255, 255, alpha))

        elif effect_type == "fire_burst":
            alpha = int(255 * (1 - progress * 0.5))
            outer = (220, 80, 30, alpha)
            inner = (255, 180, 50, alpha)
            core = (255, 255, 200, alpha)
            r = int(4 + progress * 16)
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=outer)
            draw.ellipse([cx-r+3, cy-r+3, cx+r-3, cy+r-3], fill=inner)
            draw.ellipse([cx-3, cy-3, cx+3, cy+3], fill=core)
            # Sparks flying outward
            random.seed(fi * 11)
            for _ in range(3 + fi * 2):
                angle = random.random() * math.pi * 2
                dist = r + random.randint(2, 8)
                sx = int(cx + dist * math.cos(angle))
                sy = int(cy + dist * math.sin(angle))
                if 0 <= sx < 48 and 0 <= sy < 48:
                    draw.point((sx, sy), fill=inner)

        elif effect_type == "water_splash":
            alpha = int(255 * (1 - progress * 0.5))
            c1 = (70, 150, 220, alpha)
            c2 = (140, 200, 240, alpha)
            c3 = (200, 230, 255, alpha)
            r = int(3 + progress * 14)
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c1)
            draw.ellipse([cx-r+2, cy-r+2, cx+r-2, cy+r-2], fill=c2)
            # Water droplets
            for a in range(0, 360, 45):
                rad = math.radians(a)
                dr = r + 4 + fi * 3
                dx = int(cx + dr * math.cos(rad))
                dy = int(cy + dr * math.sin(rad))
                if 2 <= dx < 46 and 2 <= dy < 46:
                    draw.ellipse([dx-2, dy-2, dx+1, dy+1], fill=c3)

        elif effect_type == "leaf_swirl":
            alpha = int(255 * (1 - progress * 0.4))
            leaf = (80, 170, 80, alpha)
            leaf2 = (120, 200, 100, alpha)
            # Swirling leaves
            for li in range(4 + fi):
                angle = math.radians(li * 90 + fi * 30)
                dist = 6 + fi * 4
                lx = int(cx + dist * math.cos(angle))
                ly = int(cy + dist * math.sin(angle))
                if 2 <= lx < 46 and 2 <= ly < 46:
                    draw.ellipse([lx-3, ly-1, lx+2, ly+1],
                                 fill=leaf if li % 2 == 0 else leaf2)
            # Central green glow
            gr = int(3 + progress * 4)
            draw.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=(100, 200, 100, int(alpha * 0.6)))

        elif effect_type == "light_flash":
            alpha = int(255 * max(0, 1 - progress * 0.8))
            gold = (255, 230, 100, alpha)
            white = (255, 255, 240, alpha)
            r = int(4 + progress * 18)
            # Radial burst
            for a in range(0, 360, 15):
                rad = math.radians(a)
                lr = r if a % 30 == 0 else int(r * 0.6)
                ex = int(cx + lr * math.cos(rad))
                ey = int(cy + lr * math.sin(rad))
                draw.line([cx, cy, ex, ey], fill=gold, width=1)
            # Center
            cr = max(2, int(6 - progress * 4))
            draw.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=white)

        elif effect_type == "shadow_fade":
            alpha = int(200 * (1 - progress * 0.6))
            dark = (60, 40, 80, alpha)
            purple = (120, 80, 160, int(alpha * 0.7))
            r = int(6 + progress * 12)
            # Dark spreading circle
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=dark)
            # Wispy edges
            for a in range(0, 360, 40):
                rad = math.radians(a + fi * 15)
                wr = r + random.randint(2, 6)
                wx2 = int(cx + wr * math.cos(rad))
                wy = int(cy + wr * math.sin(rad))
                if 2 <= wx2 < 46 and 2 <= wy < 46:
                    draw.ellipse([wx2-2, wy-2, wx2+2, wy+2], fill=purple)

        elif effect_type == "heal_glow":
            alpha = int(220 * (1 - progress * 0.4))
            green = (100, 220, 120, alpha)
            white = (220, 255, 220, alpha)
            spark = (255, 255, 200, alpha)
            r = int(4 + progress * 10)
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=green)
            draw.ellipse([cx-r+3, cy-r+3, cx+r-3, cy+r-3], fill=white)
            # Plus sign
            draw.rectangle([cx-1, cy-5, cx+1, cy+5], fill=spark)
            draw.rectangle([cx-5, cy-1, cx+5, cy+1], fill=spark)
            # Rising sparkles
            for si in range(fi + 1):
                sy_pos = cy - 8 - si * 5
                sx_pos = cx + (si - 1) * 6
                if 0 <= sx_pos < 48 and 0 <= sy_pos < 48:
                    draw.point((sx_pos, sy_pos), fill=spark)
                    draw.point((sx_pos+1, sy_pos), fill=spark)

        strip.paste(frame, (fi * frame_size, 0), frame)

    strip.save(output_path)
    print(f"  ✓ {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# MISC UI ASSETS
# ═══════════════════════════════════════════════════════════════════════════════

def gen_logo_mark(output_path):
    """128x128 game logo mark with stylized 味 character."""
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background circle
    draw.ellipse([8, 8, 120, 120], fill=(45, 30, 20, 240), outline=(200, 160, 80, 255))
    draw.ellipse([10, 10, 118, 118], outline=(220, 180, 100, 255), width=2)

    # Stylized 味 character drawn with lines
    c = (240, 200, 100, 255)
    c2 = (255, 220, 140, 255)

    # Top horizontal 口 radical (mouth) part - simplified
    # Top part (口)
    draw.rectangle([40, 30, 70, 50], outline=c, width=2)

    # Bottom part - 未 radical
    # Horizontal stroke
    draw.line([30, 62, 98, 62], fill=c, width=3)
    # Vertical center stroke
    draw.line([64, 52, 64, 98], fill=c, width=3)
    # Left diagonal
    draw.line([64, 70, 34, 95], fill=c2, width=2)
    # Right diagonal
    draw.line([64, 70, 94, 95], fill=c2, width=2)
    # Top short horizontal
    draw.line([48, 52, 80, 52], fill=c, width=2)

    # Decorative flame wisps around
    flame_c = (220, 100, 50, 150)
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        fx = int(64 + 52 * math.cos(rad))
        fy = int(64 + 52 * math.sin(rad))
        draw.ellipse([fx-3, fy-3, fx+3, fy+3], fill=flame_c)

    # "Soul of Meal" glow ring
    draw.arc([14, 14, 114, 114], 0, 360, fill=(200, 160, 80, 100), width=1)

    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_mana_gem(output_path):
    size = 24
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Diamond shape
    points = [(12, 2), (22, 12), (12, 22), (2, 12)]
    draw.polygon(points, fill=(80, 120, 220, 255), outline=(40, 60, 160, 255))
    # Facets
    draw.polygon([(12, 2), (17, 10), (12, 12), (7, 10)],
                 fill=(100, 150, 240, 255))
    # Shine
    draw.polygon([(8, 8), (12, 4), (14, 8)], fill=(180, 210, 255, 200))
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_gold_coin(output_path):
    size = 24
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Coin
    draw.ellipse([2, 2, 22, 22], fill=(220, 190, 50, 255), outline=(160, 130, 30, 255))
    draw.ellipse([4, 4, 20, 20], fill=(240, 210, 80, 255))
    # $ or coin symbol
    draw.ellipse([8, 8, 16, 16], outline=(180, 150, 40, 255), width=1)
    draw.line([12, 6, 12, 18], fill=(180, 150, 40, 255), width=1)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_star(output_path, filled=True):
    size = 16
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = 8, 8
    c = (255, 220, 50, 255) if filled else (120, 120, 120, 255)
    outline_c = (200, 170, 30, 255) if filled else (80, 80, 80, 255)
    # 5-pointed star
    points = []
    for i in range(10):
        angle = math.radians(i * 36 - 90)
        r = 7 if i % 2 == 0 else 3
        points.append((int(cx + r * math.cos(angle)),
                        int(cy + r * math.sin(angle))))
    if filled:
        draw.polygon(points, fill=c, outline=outline_c)
    else:
        draw.polygon(points, fill=(60, 60, 60, 100), outline=outline_c)
    img.save(output_path)
    print(f"  ✓ {output_path}")


def gen_bar_frame(output_path, bar_type="hp"):
    w, h = 64, 12
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Outer frame
    draw.rectangle([0, 0, w-1, h-1], fill=(30, 30, 30, 220), outline=(80, 80, 80, 255))
    # Inner area
    draw.rectangle([2, 2, w-3, h-3], fill=(20, 20, 20, 200))
    # Color indicator
    if bar_type == "hp":
        bar_c = (200, 60, 60, 255)
        bar_light = (240, 100, 80, 255)
    else:
        bar_c = (60, 160, 200, 255)
        bar_light = (100, 200, 240, 255)
    # Fill bar (about 75%)
    fill_w = int((w - 6) * 0.75)
    draw.rectangle([3, 3, 3 + fill_w, h-4], fill=bar_c)
    draw.rectangle([3, 3, 3 + fill_w, 5], fill=bar_light)  # Shine
    img.save(output_path)
    print(f"  ✓ {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GENERATION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  Soul of Meal - Asset Generator")
    print("=" * 60)

    # Ensure output directories
    sprites_dir = OUTPUT_DIR
    icons_dir = os.path.join(sprites_dir, "icons")
    ui_dir = os.path.join(sprites_dir, "ui")
    maps_dir = os.path.join(sprites_dir, "maps")
    effects_dir = os.path.join(sprites_dir, "effects")
    for d in [sprites_dir, icons_dir, ui_dir, maps_dir, effects_dir]:
        ensure_dir(d)

    # ── 1. Character Sprite Sheets ────────────────────────────────────────
    print("\n📦 Generating Character Sprite Sheets...")
    for char_id, char_cfg in CHARACTERS.items():
        print(f"\n  🎨 {char_cfg['name']} ({char_id})")
        drawer = ChibiDrawer(char_cfg)
        sheet = drawer.generate_sprite_sheet()
        output_path = os.path.join(sprites_dir, f"{char_id}.png")
        sheet.save(output_path)
        print(f"  ✓ Saved {output_path} ({sheet.size[0]}x{sheet.size[1]})")

    # ── 2. Element Icons ──────────────────────────────────────────────────
    print("\n🔮 Generating Element Icons...")
    generate_icon_fire(os.path.join(icons_dir, "icon_fire.png"))
    generate_icon_water(os.path.join(icons_dir, "icon_water.png"))
    generate_icon_wood(os.path.join(icons_dir, "icon_wood.png"))
    generate_icon_light(os.path.join(icons_dir, "icon_light.png"))
    generate_icon_shadow(os.path.join(icons_dir, "icon_shadow.png"))

    # ── 3. UI Card Frames ─────────────────────────────────────────────────
    print("\n🃏 Generating UI Card Frames...")
    generate_card_frame(os.path.join(ui_dir, "card_frame_R.png"), "R")
    generate_card_frame(os.path.join(ui_dir, "card_frame_SR.png"), "SR")
    generate_card_frame(os.path.join(ui_dir, "card_frame_SSR.png"), "SSR")

    # ── 4. Map Tiles ──────────────────────────────────────────────────────
    print("\n🗺️  Generating Map Tiles...")
    gen_tile_grass(os.path.join(maps_dir, "tile_grass_light.png"), dark=False)
    gen_tile_grass(os.path.join(maps_dir, "tile_grass_dark.png"), dark=True)
    gen_tile_path(os.path.join(maps_dir, "tile_path.png"))
    gen_tile_water(os.path.join(maps_dir, "tile_water.png"))
    gen_tree(os.path.join(maps_dir, "tree_01.png"), variant=1)
    gen_tree(os.path.join(maps_dir, "tree_02.png"), variant=2)
    gen_house(os.path.join(maps_dir, "house_kitchen.png"), "#dd684a", "kitchen")
    gen_house(os.path.join(maps_dir, "house_guild.png"), "#6b8e6b", "guild")
    gen_house(os.path.join(maps_dir, "house_merchant.png"), "#c8a030", "merchant")
    gen_chest(os.path.join(maps_dir, "chest_closed.png"), is_open=False)
    gen_chest(os.path.join(maps_dir, "chest_open.png"), is_open=True)
    gen_portal(os.path.join(maps_dir, "portal.png"))

    # ── 5. Battle Effects ─────────────────────────────────────────────────
    print("\n⚔️  Generating Battle Effects...")
    effects = [
        ("hit_spark", "hit_spark.png"),
        ("fire_burst", "fire_burst.png"),
        ("water_splash", "water_splash.png"),
        ("leaf_swirl", "leaf_swirl.png"),
        ("light_flash", "light_flash.png"),
        ("shadow_fade", "shadow_fade.png"),
        ("heal_glow", "heal_glow.png"),
    ]
    for etype, fname in effects:
        gen_effect_strip(os.path.join(effects_dir, fname), etype)

    # ── 6. Misc UI Assets ─────────────────────────────────────────────────
    print("\n🎮 Generating Misc UI Assets...")
    gen_logo_mark(os.path.join(ui_dir, "logo_mark.png"))
    gen_mana_gem(os.path.join(ui_dir, "mana_gem.png"))
    gen_gold_coin(os.path.join(ui_dir, "gold_coin.png"))
    gen_star(os.path.join(ui_dir, "star_filled.png"), filled=True)
    gen_star(os.path.join(ui_dir, "star_empty.png"), filled=False)
    gen_bar_frame(os.path.join(ui_dir, "hp_bar_frame.png"), "hp")
    gen_bar_frame(os.path.join(ui_dir, "energy_bar_frame.png"), "energy")

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ✅ Asset generation complete!")
    print("=" * 60)

    # Count generated files
    total_files = 0
    for root, dirs, files in os.walk(sprites_dir):
        for f in files:
            if f.endswith('.png'):
                total_files += 1
                fpath = os.path.join(root, f)
                fsize = os.path.getsize(fpath)
                rel = os.path.relpath(fpath, sprites_dir)

    print(f"\n  Total PNG files generated: {total_files}")
    print(f"  Output directory: {sprites_dir}")

    # List all files
    print("\n  📂 Generated files:")
    for root, dirs, files in os.walk(sprites_dir):
        level = root.replace(sprites_dir, '').count(os.sep)
        indent = '  ' * (level + 2)
        subdir = os.path.basename(root)
        if level > 0:
            print(f"{indent}📁 {subdir}/")
        for f in sorted(files):
            if f.endswith('.png'):
                fpath = os.path.join(root, f)
                fsize = os.path.getsize(fpath)
                print(f"{indent}  📄 {f} ({fsize:,} bytes)")


if __name__ == "__main__":
    main()
