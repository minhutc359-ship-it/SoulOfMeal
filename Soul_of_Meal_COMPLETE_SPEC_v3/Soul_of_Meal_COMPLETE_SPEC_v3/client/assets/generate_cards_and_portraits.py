import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = '/home/sotatek/Documents/prj/SoulOfMeal/SoulOfMeal/Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3/client/assets'
CARDS_DIR = os.path.join(BASE_DIR, 'cards')
PORTRAITS_DIR = os.path.join(BASE_DIR, 'portraits')
AVATARS_DIR = os.path.join(BASE_DIR, 'avatars')

os.makedirs(CARDS_DIR, exist_ok=True)
os.makedirs(PORTRAITS_DIR, exist_ok=True)
os.makedirs(AVATARS_DIR, exist_ok=True)

# Element Colors
ELEMENT_THEMES = {
    'fire': {
        'bg1': (45, 15, 12), 'bg2': (180, 50, 25), 'accent': (255, 160, 40),
        'light': (255, 220, 150), 'name': 'Hỏa', 'border': (221, 104, 74)
    },
    'water': {
        'bg1': (12, 28, 45), 'bg2': (30, 95, 140), 'accent': (90, 200, 240),
        'light': (200, 240, 255), 'name': 'Thủy', 'border': (66, 142, 172)
    },
    'wood': {
        'bg1': (15, 38, 20), 'bg2': (40, 110, 55), 'accent': (120, 215, 110),
        'light': (215, 250, 195), 'name': 'Mộc', 'border': (84, 141, 86)
    },
    'light': {
        'bg1': (42, 35, 15), 'bg2': (160, 125, 40), 'accent': (245, 210, 80),
        'light': (255, 250, 220), 'name': 'Quang', 'border': (184, 146, 60)
    },
    'shadow': {
        'bg1': (28, 18, 38), 'bg2': (75, 45, 95), 'accent': (165, 115, 200),
        'light': (235, 215, 250), 'name': 'Ám', 'border': (117, 98, 126)
    }
}

def draw_radial_gradient(draw, width, height, center_col, outer_col):
    cx, cy = width / 2, height / 2
    max_r = math.hypot(cx, cy)
    for r in range(int(max_r), 0, -4):
        t = r / max_r
        col = (
            int(outer_col[0] * t + center_col[0] * (1 - t)),
            int(outer_col[1] * t + center_col[1] * (1 - t)),
            int(outer_col[2] * t + center_col[2] * (1 - t)),
            255
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

def create_card_art(card_id, title, element, card_type, stats_text):
    W, H = 384, 512
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    theme = ELEMENT_THEMES[element]

    # Card background gradient
    for y in range(H):
        t = y / H
        r = int(theme['bg1'][0] * (1 - t) + theme['bg2'][0] * t)
        g = int(theme['bg1'][1] * (1 - t) + theme['bg2'][1] * t)
        b = int(theme['bg1'][2] * (1 - t) + theme['bg2'][2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Pattern / Magic circle in background
    cx, cy = W // 2, H // 2 - 30
    for rad in [140, 110, 80]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=(*theme['accent'], 60), width=2)
    for angle in range(0, 360, 30):
        rad_angle = math.radians(angle)
        x1 = cx + math.cos(rad_angle) * 75
        y1 = cy + math.sin(rad_angle) * 75
        x2 = cx + math.cos(rad_angle) * 140
        y2 = cy + math.sin(rad_angle) * 140
        draw.line([(x1, y1), (x2, y2)], fill=(*theme['accent'], 40), width=1)

    # Food Spirit / Illustration Centerpiece
    if element == 'fire':
        # Flame spirit with bowl motif
        draw.ellipse([cx - 50, cy + 30, cx + 50, cy + 80], fill=(180, 50, 30), outline=(240, 140, 50), width=3)
        # Noodles & fire
        draw.ellipse([cx - 42, cy + 25, cx + 42, cy + 45], fill=(245, 200, 100))
        # Fire flames rising
        for i in range(7):
            fx = cx - 40 + i * 13
            fh = 50 + (i % 3) * 20
            draw.polygon([(fx, cy + 25), (fx + 8, cy - fh), (fx + 16, cy + 25)], fill=(*theme['accent'], 210))
        # Cute face on the spirit
        draw.ellipse([cx - 30, cy - 35, cx + 30, cy + 20], fill=(255, 235, 200))
        draw.ellipse([cx - 16, cy - 12, cx - 8, cy - 4], fill=(30, 20, 20))
        draw.ellipse([cx + 8, cy - 12, cx + 16, cy - 4], fill=(30, 20, 20))
        draw.ellipse([cx - 22, cy - 4, cx - 14, cy + 2], fill=(255, 140, 120, 160)) # blush
        draw.ellipse([cx + 14, cy - 4, cx + 22, cy + 2], fill=(255, 140, 120, 160))
        draw.arc([cx - 6, cy - 2, cx + 6, cy + 8], 0, 180, fill=(180, 50, 40), width=2)
    elif element == 'water':
        # Water/Pho spirit with steam
        draw.ellipse([cx - 45, cy + 35, cx + 45, cy + 75], fill=(40, 100, 150), outline=(100, 190, 240), width=3)
        # Clear soup & star anise
        draw.ellipse([cx - 38, cy + 30, cx + 38, cy + 48], fill=(210, 185, 130))
        # Water drop body
        draw.polygon([(cx, cy - 60), (cx - 35, cy + 15), (cx + 35, cy + 15)], fill=(*theme['accent'], 190))
        draw.ellipse([cx - 35, cy - 10, cx + 35, cy + 30], fill=(*theme['accent'], 190))
        # Face
        draw.ellipse([cx - 14, cy, cx - 6, cy + 8], fill=(20, 30, 50))
        draw.ellipse([cx + 6, cy, cx + 14, cy + 8], fill=(20, 30, 50))
        draw.arc([cx - 5, cy + 8, cx + 5, cy + 16], 0, 180, fill=(30, 80, 120), width=2)
        # Steam swirls
        for sx in [cx - 30, cx, cx + 30]:
            draw.arc([sx - 10, cy - 80, sx + 10, cy - 40], 270, 90, fill=(240, 250, 255, 140), width=3)
    elif element == 'wood':
        # Spring roll / Leaf spirit
        draw.ellipse([cx - 45, cy - 20, cx + 45, cy + 60], fill=(245, 242, 230), outline=(80, 160, 85), width=3)
        # Shrimp & herb visible through translucent roll
        draw.arc([cx - 30, cy - 5, cx + 10, cy + 35], 180, 360, fill=(240, 110, 90), width=8)
        draw.ellipse([cx + 5, cy + 5, cx + 32, cy + 25], fill=(90, 175, 80))
        # Leaf wings
        draw.polygon([(cx - 40, cy), (cx - 75, cy - 30), (cx - 45, cy + 20)], fill=(70, 160, 75, 200))
        draw.polygon([(cx + 40, cy), (cx + 75, cy - 30), (cx + 45, cy + 20)], fill=(70, 160, 75, 200))
        # Face
        draw.ellipse([cx - 14, cy + 10, cx - 6, cy + 18], fill=(20, 45, 25))
        draw.ellipse([cx + 6, cy + 10, cx + 14, cy + 18], fill=(20, 45, 25))
        draw.arc([cx - 5, cy + 18, cx + 5, cy + 26], 0, 180, fill=(50, 120, 55), width=2)
    elif element == 'light':
        # Banh Bao / Dumpling spirit with halo
        draw.ellipse([cx - 50, cy - 10, cx + 50, cy + 60], fill=(255, 252, 240), outline=(215, 180, 80), width=3)
        # Top pleat of bun
        draw.ellipse([cx - 10, cy - 18, cx + 10, cy - 4], fill=(230, 210, 150))
        # Golden Halo
        draw.ellipse([cx - 40, cy - 55, cx + 40, cy - 35], outline=(255, 225, 70), width=4)
        # Wings of light
        draw.polygon([(cx - 35, cy + 10), (cx - 80, cy - 20), (cx - 45, cy + 40)], fill=(255, 240, 160, 180))
        draw.polygon([(cx + 35, cy + 10), (cx + 80, cy - 20), (cx + 45, cy + 40)], fill=(255, 240, 160, 180))
        # Face
        draw.ellipse([cx - 15, cy + 10, cx - 7, cy + 18], fill=(50, 40, 20))
        draw.ellipse([cx + 7, cy + 10, cx + 15, cy + 18], fill=(50, 40, 20))
        draw.ellipse([cx - 22, cy + 18, cx - 14, cy + 24], fill=(255, 170, 130, 180))
        draw.ellipse([cx + 14, cy + 18, cx + 22, cy + 24], fill=(255, 170, 130, 180))
        draw.arc([cx - 6, cy + 20, cx + 6, cy + 28], 0, 180, fill=(160, 110, 30), width=2)
    else: # shadow
        # Coffee drop / Phin spirit
        # Traditional coffee phin on top
        draw.rectangle([cx - 25, cy - 50, cx + 25, cy - 25], fill=(160, 160, 170), outline=(90, 80, 95), width=2)
        draw.rectangle([cx - 32, cy - 27, cx + 32, cy - 22], fill=(140, 140, 150))
        # Dark coffee drop body
        draw.ellipse([cx - 42, cy - 10, cx + 42, cy + 60], fill=(45, 25, 30), outline=(150, 100, 180), width=3)
        # Condensed milk layer below
        draw.ellipse([cx - 36, cy + 38, cx + 36, cy + 56], fill=(245, 235, 190))
        # Amber glowing eyes
        draw.ellipse([cx - 15, cy + 5, cx - 7, cy + 13], fill=(255, 180, 50))
        draw.ellipse([cx + 7, cy + 5, cx + 15, cy + 13], fill=(255, 180, 50))
        draw.arc([cx - 5, cy + 16, cx + 5, cy + 22], 0, 180, fill=(200, 140, 80), width=2)

    # Frame & Borders
    draw.rectangle([10, 10, W - 10, H - 10], outline=theme['border'], width=4)
    draw.rectangle([16, 16, W - 16, H - 16], outline=(255, 255, 255, 60), width=1)
    
    # Corner ornaments
    for ox, oy in [(10, 10), (W - 10, 10), (10, H - 10), (W - 10, H - 10)]:
        draw.rectangle([ox - 5, oy - 5, ox + 5, oy + 5], fill=theme['accent'])

    # Title header banner
    draw.rectangle([24, 24, W - 24, 62], fill=(15, 20, 25, 200), outline=theme['border'], width=2)
    
    # Type badge
    draw.rectangle([W - 110, 72, W - 24, 96], fill=(*theme['bg2'], 230), outline=theme['accent'], width=1)
    
    # Bottom stats banner
    draw.rectangle([24, H - 90, W - 24, H - 24], fill=(15, 20, 25, 220), outline=theme['border'], width=2)

    # Add text labels
    try:
        font_lg = ImageFont.load_default()
    except Exception:
        font_lg = None

    draw.text((36, 35), title, fill=(255, 255, 255), font=font_lg)
    draw.text((W - 100, 78), card_type.upper(), fill=(255, 255, 255), font=font_lg)
    draw.text((36, H - 75), stats_text, fill=theme['light'], font=font_lg)
    draw.text((36, H - 50), f"Element: {element.upper()} | Soul of Meal", fill=(170, 180, 175), font=font_lg)

    img.save(os.path.join(CARDS_DIR, f"{card_id}.png"))
    print(f"  ✓ Saved card {card_id}.png")

def create_character_portrait(char_id, name, element, role):
    W, H = 512, 512
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    theme = ELEMENT_THEMES[element]

    # Background circle
    cx, cy = W // 2, H // 2
    draw_radial_gradient(draw, W, H, theme['bg2'], theme['bg1'])
    
    # Decorative rings
    draw.ellipse([cx - 210, cy - 210, cx + 210, cy + 210], outline=(*theme['accent'], 120), width=3)
    draw.ellipse([cx - 195, cy - 195, cx + 195, cy + 195], outline=(*theme['light'], 80), width=1)
    
    # Draw character chibi portrait
    # Body
    draw.ellipse([cx - 70, cy + 40, cx + 70, cy + 180], fill=theme['bg2'], outline=theme['border'], width=3)
    # Head
    draw.ellipse([cx - 95, cy - 110, cx + 95, cy + 80], fill=(255, 235, 205), outline=(180, 140, 110), width=2)
    
    # Element-specific Hair and Hat
    if element == 'fire':
        # Red-orange spiky flame hair
        for i in range(8):
            hx = cx - 90 + i * 25
            draw.polygon([(hx, cy - 40), (hx + 15, cy - 145 - (i % 3) * 15), (hx + 30, cy - 40)], fill=(225, 75, 40))
        # Ladle over shoulder
        draw.rectangle([cx + 80, cy - 100, cx + 95, cy + 140], fill=(139, 69, 19))
        draw.ellipse([cx + 65, cy - 140, cx + 110, cy - 90], fill=(160, 82, 45))
    elif element == 'water':
        # Blue graceful flowing hair
        draw.ellipse([cx - 105, cy - 130, cx + 105, cy - 10], fill=(60, 130, 180))
        draw.ellipse([cx - 120, cy - 70, cx - 70, cy + 100], fill=(50, 110, 160))
        draw.ellipse([cx + 70, cy - 70, cx + 120, cy + 100], fill=(50, 110, 160))
        # Water drops floating
        draw.ellipse([cx - 140, cy - 50, cx - 110, cy - 10], fill=(*theme['accent'], 180))
        draw.ellipse([cx + 110, cy - 70, cx + 135, cy - 35], fill=(*theme['accent'], 180))
    elif element == 'wood':
        # Green hair with flowers and leaves
        draw.ellipse([cx - 105, cy - 130, cx + 105, cy - 10], fill=(70, 140, 75))
        for fx in [cx - 60, cx + 60]:
            draw.ellipse([fx - 20, cy - 110, fx + 20, cy - 70], fill=(255, 230, 140)) # flower
            draw.ellipse([fx - 10, cy - 100, fx + 10, cy - 80], fill=(255, 120, 140))
    elif element == 'light':
        # Dumpling chef hat
        draw.ellipse([cx - 90, cy - 160, cx + 90, cy - 80], fill=(255, 250, 235), outline=(210, 180, 100), width=3)
        draw.rectangle([cx - 75, cy - 95, cx + 75, cy - 60], fill=(255, 250, 235))
        # Golden halo
        draw.ellipse([cx - 110, cy - 200, cx + 110, cy - 160], outline=(255, 220, 80), width=5)
    else: # shadow
        # Dark purple ninja cowl / shadow hood
        draw.ellipse([cx - 105, cy - 135, cx + 105, cy + 10], fill=(55, 35, 65))
        # Amber glowing eyes in the dark
        draw.ellipse([cx - 45, cy - 15, cx - 15, cy + 5], fill=(255, 175, 45))
        draw.ellipse([cx + 15, cy - 15, cx + 45, cy + 5], fill=(255, 175, 45))

    # Eyes & Face (for non-shadow)
    if element != 'shadow':
        draw.ellipse([cx - 50, cy - 25, cx - 20, cy + 5], fill=(35, 25, 20))
        draw.ellipse([cx + 20, cy - 25, cx + 50, cy + 5], fill=(35, 25, 20))
        # Eye glints
        draw.ellipse([cx - 42, cy - 22, cx - 32, cy - 12], fill=(255, 255, 255))
        draw.ellipse([cx + 28, cy - 22, cx + 38, cy - 12], fill=(255, 255, 255))
        # Blush
        draw.ellipse([cx - 65, cy + 5, cx - 35, cy + 25], fill=(255, 140, 130, 150))
        draw.ellipse([cx + 35, cy + 5, cx + 65, cy + 25], fill=(255, 140, 130, 150))
        # Smile
        draw.arc([cx - 15, cy + 15, cx + 15, cy + 35], 0, 180, fill=(180, 60, 50), width=3)

    # Outer ornate frame
    draw.rectangle([12, 12, W - 12, H - 12], outline=theme['border'], width=4)
    draw.rectangle([18, 18, W - 18, H - 18], outline=(255, 255, 255, 80), width=1)

    # Name banner at bottom
    draw.rectangle([40, H - 75, W - 40, H - 25], fill=(18, 24, 28, 230), outline=theme['border'], width=2)
    draw.text((cx - 80, H - 60), f"{name} ({role.upper()})", fill=theme['light'])

    img.save(os.path.join(PORTRAITS_DIR, f"{char_id}.png"))
    print(f"  ✓ Saved portrait {char_id}.png")

    # Also create circular avatar 128x128
    avatar = img.resize((128, 128), Image.Resampling.LANCZOS)
    mask = Image.new('L', (128, 128), 0)
    ImageDraw.Draw(mask).ellipse([2, 2, 126, 126], fill=255)
    avatar_circ = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    avatar_circ.paste(avatar, (0, 0), mask)
    avatar_draw = ImageDraw.Draw(avatar_circ)
    avatar_draw.ellipse([2, 2, 126, 126], outline=theme['border'], width=3)
    avatar_circ.save(os.path.join(AVATARS_DIR, f"avatar_{char_id.replace('chr_', '')}.png"))
    print(f"  ✓ Saved avatar avatar_{char_id.replace('chr_', '')}.png")

def main():
    print("🎨 Generating Card Art for 18 Catalog Cards...")
    cards = [
        ("card_demo_01", "Bún Bò Hỏa Thần", "fire", "unit", "300 ATK / 500 DEF · Cost 1"),
        ("card_demo_02", "Phở Lam Hải Long", "water", "unit", "500 ATK / 750 DEF · Cost 2"),
        ("card_demo_03", "Gỏi Cuốn Thanh Tiên", "wood", "unit", "700 ATK / 1000 DEF · Cost 3"),
        ("card_demo_04", "Bánh Bao Kim Quang", "light", "unit", "900 ATK / 1250 DEF · Cost 4"),
        ("card_demo_05", "Cà Phê Huyền Dạ", "shadow", "unit", "1100 ATK / 500 DEF · Cost 5"),
        ("card_demo_06", "Hỏa Diệm Tiên Phong", "fire", "unit", "300 ATK / 750 DEF · Cost 1"),
        ("card_demo_07", "Thủy Kính Hộ Vệ", "water", "unit", "500 ATK / 1000 DEF · Cost 2"),
        ("card_demo_08", "Mộc Tinh Tầm Đạo", "wood", "unit", "700 ATK / 1250 DEF · Cost 3"),
        ("card_demo_09", "Thánh Quang Kỵ Sĩ", "light", "unit", "900 ATK / 500 DEF · Cost 4"),
        ("card_demo_10", "Ám Ảnh Cà Phê Trảo", "shadow", "fast_spell", "Sát thương nhanh: 470 · Cost 5"),
        ("card_demo_11", "Ớt Hiểm Bộc Phát", "fire", "fast_spell", "Sát thương nhanh: 500 · Cost 1"),
        ("card_demo_12", "Thanh Thủy Trảm", "water", "fast_spell", "Sát thương nhanh: 530 · Cost 2"),
        ("card_demo_13", "Dây Leo Gai Nhọn", "wood", "fast_spell", "Sát thương nhanh: 560 · Cost 3"),
        ("card_demo_14", "Khiên Xử Hấp Thu", "light", "trap", "Bẫy phản đòn: 590 · Cost 4"),
        ("card_demo_15", "Hắc Vụ Trói Buộc", "shadow", "trap", "Bẫy phản đòn: 620 · Cost 5"),
        ("card_demo_16", "Hỏa Trận Liệt Diệm", "fire", "trap", "Bẫy phản đòn: 650 · Cost 1"),
        ("card_demo_17", "Sóng Thần Nước Hầm", "water", "slow_spell", "Đại pháp thuật: 680 · Cost 2"),
        ("card_demo_18", "Rừng Già Thức Tỉnh", "wood", "slow_spell", "Đại pháp thuật: 710 · Cost 3"),
    ]

    for cid, name, el, ctype, stats in cards:
        create_card_art(cid, name, el, ctype, stats)

    print("\n👑 Generating Character Portraits & Avatars...")
    characters = [
        ("chr_bunbo_holinh", "Bún Bò Hỏa Linh", "fire", "Fighter"),
        ("chr_pho_lamvu", "Phở Lam Vũ", "water", "Mage"),
        ("chr_goicuon_diepnhi", "Gỏi Cuốn Diệp Nhi", "wood", "Support"),
        ("chr_banhbao_bachngoc", "Bánh Bao Bạch Ngọc", "light", "Guardian"),
        ("chr_caphe_davu", "Cà Phê Dạ Vũ", "shadow", "Assassin"),
        ("boss_thief", "Bếp Trưởng Hỏa Diệm", "fire", "Boss"),
    ]

    for cid, name, el, role in characters:
        create_character_portrait(cid, name, el, role)

    print("\n✨ All card art and portraits generated successfully!")

if __name__ == '__main__':
    main()
