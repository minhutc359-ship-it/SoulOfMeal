import os
import math
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = '/home/sotatek/Documents/prj/SoulOfMeal/SoulOfMeal/Soul_of_Meal_COMPLETE_SPEC_v3/Soul_of_Meal_COMPLETE_SPEC_v3'
CROPS_DIR = os.path.join(BASE_DIR, 'references/visuals/crops')
REFS_DIR = os.path.join(BASE_DIR, 'references/original_user_images')
CLIENT_ASSETS = os.path.join(BASE_DIR, 'client/assets')

SPRITES_DIR = os.path.join(CLIENT_ASSETS, 'sprites')
CARDS_DIR = os.path.join(CLIENT_ASSETS, 'cards')
PORTRAITS_DIR = os.path.join(CLIENT_ASSETS, 'portraits')
AVATARS_DIR = os.path.join(CLIENT_ASSETS, 'avatars')
MAPS_DIR = os.path.join(SPRITES_DIR, 'maps')
ICONS_DIR = os.path.join(SPRITES_DIR, 'icons')
UI_DIR = os.path.join(SPRITES_DIR, 'ui')

for d in [SPRITES_DIR, CARDS_DIR, PORTRAITS_DIR, AVATARS_DIR, MAPS_DIR, ICONS_DIR, UI_DIR]:
    os.makedirs(d, exist_ok=True)

# -------------------------------------------------------------
# Helper: Make white/cream background transparent
# -------------------------------------------------------------
def make_transparent(im, bg_color=(253, 242, 225), tolerance=35):
    im = im.convert('RGBA')
    data = []
    for p in im.getdata():
        r, g, b, a = p
        diff = abs(r - bg_color[0]) + abs(g - bg_color[1]) + abs(b - bg_color[2])
        # Background is pale yellowish-cream
        is_bg = (diff < tolerance and b < 233) or (r > 248 and g > 238 and b < 232)
        if is_bg:
            data.append((0, 0, 0, 0))
        elif diff < tolerance + 25 and b < 233:
            alpha = int(255 * (diff - tolerance) / 25)
            data.append((r, g, b, max(0, min(255, alpha))))
        else:
            data.append((r, g, b, 255))
    im.putdata(data)
    return im

# -------------------------------------------------------------
# 1. CHARACTER PORTRAITS & AVATARS
# -------------------------------------------------------------
print("👑 1. Extracting Official Character Portraits & Avatars...")

# A. Bún Bò Hỏa Linh
hero_im = Image.open(os.path.join(CROPS_DIR, 'character/hero_full.png'))
# Crop Bún Bò Hỏa Linh full portrait
bunbo_portrait = hero_im.crop((115, 5, 645, 495)).resize((512, 512), Image.Resampling.LANCZOS)
bunbo_portrait.save(os.path.join(PORTRAITS_DIR, 'chr_bunbo_holinh.png'))

# B. Starter Roster: Phở Lam Vũ, Gỏi Cuốn Diệp Nhi, Bánh Bao Bạch Ngọc, Cà Phê Dạ Vũ
roster_im = Image.open(os.path.join(CROPS_DIR, 'character/starter_roster.png'))

pho_crop = roster_im.crop((245, 10, 465, 215)).resize((512, 512), Image.Resampling.LANCZOS)
pho_crop.save(os.path.join(PORTRAITS_DIR, 'chr_pho_lamvu.png'))

goicuon_crop = roster_im.crop((465, 10, 680, 215)).resize((512, 512), Image.Resampling.LANCZOS)
goicuon_crop.save(os.path.join(PORTRAITS_DIR, 'chr_goicuon_diepnhi.png'))

banhbao_crop = roster_im.crop((680, 10, 895, 215)).resize((512, 512), Image.Resampling.LANCZOS)
banhbao_crop.save(os.path.join(PORTRAITS_DIR, 'chr_banhbao_bachngoc.png'))

caphe_crop = roster_im.crop((895, 10, 1115, 215)).resize((512, 512), Image.Resampling.LANCZOS)
caphe_crop.save(os.path.join(PORTRAITS_DIR, 'chr_caphe_davu.png'))

# C. Boss: Bếp Trưởng Hỏa Diệm from guide_adventure.png panel 6
adv_im = Image.open(os.path.join(REFS_DIR, 'guide_adventure.png'))
boss_crop = adv_im.crop((540, 1000, 920, 1260)).resize((512, 512), Image.Resampling.LANCZOS)
boss_crop.save(os.path.join(PORTRAITS_DIR, 'boss_thief.png'))

# D. NPC: Cô Bếp Lilia from npcs.png
npcs_im = Image.open(os.path.join(CROPS_DIR, 'environment/npcs.png'))
lilia_crop = npcs_im.crop((45, 150, 320, 365)).resize((512, 512), Image.Resampling.LANCZOS)
lilia_crop.save(os.path.join(PORTRAITS_DIR, 'npc_lilia.png'))

# Build Circular Avatar Badges (128x128)
avatar_configs = [
    ('avatar_bunbo_holinh.png', bunbo_portrait, (221, 104, 74)),
    ('avatar_pho_lamvu.png', pho_crop, (66, 142, 172)),
    ('avatar_goicuon_diepnhi.png', goicuon_crop, (84, 141, 86)),
    ('avatar_banhbao_bachngoc.png', banhbao_crop, (184, 146, 60)),
    ('avatar_caphe_davu.png', caphe_crop, (117, 98, 126)),
    ('avatar_boss_thief.png', boss_crop, (181, 78, 62)),
    ('avatar_lilia.png', lilia_crop, (120, 160, 80)),
]

for fname, src_img, border_col in avatar_configs:
    av = src_img.resize((128, 128), Image.Resampling.LANCZOS)
    mask = Image.new('L', (128, 128), 0)
    ImageDraw.Draw(mask).ellipse([2, 2, 125, 125], fill=255)
    av_circ = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    av_circ.paste(av, (0, 0), mask)
    draw_av = ImageDraw.Draw(av_circ)
    draw_av.ellipse([2, 2, 125, 125], outline=border_col, width=3)
    draw_av.ellipse([5, 5, 122, 122], outline=(255, 255, 255, 150), width=1)
    av_circ.save(os.path.join(AVATARS_DIR, fname))

print("  ✓ Portraits & Avatars saved.")

# -------------------------------------------------------------
# 2. MAP BUILDINGS & OBJECTS
# -------------------------------------------------------------
print("🗺️ 2. Extracting Official Map Buildings & Props...")

b_im = Image.open(os.path.join(CROPS_DIR, 'environment/buildings.png'))
kitchen_art = b_im.crop((12, 55, 270, 195)).resize((176, 118), Image.Resampling.LANCZOS)
kitchen_art.save(os.path.join(MAPS_DIR, 'house_kitchen.png'))

guild_art = b_im.crop((270, 55, 530, 195)).resize((176, 118), Image.Resampling.LANCZOS)
guild_art.save(os.path.join(MAPS_DIR, 'house_guild.png'))

merchant_art = b_im.crop((180, 195, 365, 365)).resize((176, 118), Image.Resampling.LANCZOS)
merchant_art.save(os.path.join(MAPS_DIR, 'house_merchant.png'))

props_im = Image.open(os.path.join(CROPS_DIR, 'environment/props.png'))
cherry_tree = props_im.crop((280, 175, 425, 315)).resize((64, 80), Image.Resampling.LANCZOS)
cherry_tree.save(os.path.join(MAPS_DIR, 'tree_01.png'))
cherry_tree.save(os.path.join(MAPS_DIR, 'tree_02.png'))

# Chests from guide_adventure.png panel 7
chest_box = adv_im.crop((195, 1270, 365, 1375)).resize((64, 48), Image.Resampling.LANCZOS)
chest_box.save(os.path.join(MAPS_DIR, 'chest_closed.png'))
chest_box.save(os.path.join(MAPS_DIR, 'chest_open.png'))

# Portal from village_overview.png
village_im = Image.open(os.path.join(CROPS_DIR, 'environment/village_overview.png'))
portal_art = village_im.crop((70, 170, 210, 320)).resize((64, 64), Image.Resampling.LANCZOS)
portal_art.save(os.path.join(MAPS_DIR, 'portal.png'))

print("  ✓ Map buildings & props saved.")

# -------------------------------------------------------------
# 3. HIGH-RES OFFICIAL CARD ARTS (18 Cards)
# -------------------------------------------------------------
print("🃏 3. Building High-Resolution Official TCG Card Arts...")

elem_im = Image.open(os.path.join(CROPS_DIR, 'vfx/elements.png'))
# 5 elemental bowls
dish_fire = elem_im.crop((15, 60, 220, 375)).resize((384, 512), Image.Resampling.LANCZOS)
dish_water = elem_im.crop((240, 60, 445, 375)).resize((384, 512), Image.Resampling.LANCZOS)
dish_wood = elem_im.crop((465, 60, 670, 375)).resize((384, 512), Image.Resampling.LANCZOS)
dish_light = elem_im.crop((690, 60, 895, 375)).resize((384, 512), Image.Resampling.LANCZOS)
dish_shadow = elem_im.crop((915, 60, 1115, 375)).resize((384, 512), Image.Resampling.LANCZOS)

tcg_im = Image.open(os.path.join(REFS_DIR, 'guide_tcg.png'))
# Spell "Tiệc Thịnh Soạn"
card_feast = tcg_im.crop((285, 620, 455, 785)).resize((384, 512), Image.Resampling.LANCZOS)
# Trap "Bẫy Ngon Tuyệt Hảo"
card_trap_best = tcg_im.crop((615, 800, 770, 960)).resize((384, 512), Image.Resampling.LANCZOS)
# Dragon Combo "Hương Vị Bùng Nổ"
card_dragon = tcg_im.crop((570, 1070, 895, 1225)).resize((384, 512), Image.Resampling.LANCZOS)
# Fire Deck "Bếp Lửa Bùng Cháy"
deck_fire = tcg_im.crop((195, 205, 290, 310)).resize((384, 512), Image.Resampling.LANCZOS)
# Water Deck "Dòng Chảy Hương Vị"
deck_water = tcg_im.crop((300, 205, 395, 310)).resize((384, 512), Image.Resampling.LANCZOS)
# Wood Deck "Vườn Xanh Tươi Ngon"
deck_wood = tcg_im.crop((405, 205, 500, 310)).resize((384, 512), Image.Resampling.LANCZOS)

# Map 18 catalog cards to real illustrations
card_mapping = {
    'card_demo_01': dish_fire,      # Bún Bò Hỏa Thần
    'card_demo_02': dish_water,     # Phở Lam Hải Long
    'card_demo_03': dish_wood,      # Gỏi Cuốn Thanh Tiên
    'card_demo_04': dish_light,     # Bánh Bao Kim Quang
    'card_demo_05': dish_shadow,    # Cà Phê Huyền Dạ
    'card_demo_06': deck_fire,       # Hỏa Diệm Tiên Phong
    'card_demo_07': deck_water,      # Thủy Kính Hộ Vệ
    'card_demo_08': deck_wood,       # Mộc Tinh Tầm Đạo
    'card_demo_09': banhbao_crop.resize((384, 512)), # Thánh Quang Kỵ Sĩ
    'card_demo_10': caphe_crop.resize((384, 512)),   # Ám Ảnh Cà Phê Trảo (Fast Spell)
    'card_demo_11': card_dragon,     # Ớt Hiểm Bộc Phát (Fast Spell)
    'card_demo_12': card_feast,      # Tiệc Thịnh Soạn (Fast Spell)
    'card_demo_13': dish_wood,       # Dây Leo Gai Nhọn (Fast Spell)
    'card_demo_14': card_trap_best,  # Khiên Xử Hấp Thu (Trap)
    'card_demo_15': dish_shadow,     # Hắc Vụ Trói Buộc (Trap)
    'card_demo_16': card_trap_best,  # Hỏa Trận Liệt Diệm (Trap)
    'card_demo_17': deck_water,      # Sóng Thần Nước Hầm (Slow Spell)
    'card_demo_18': deck_wood,       # Rừng Già Thức Tỉnh (Slow Spell)
}

for cid, cimg in card_mapping.items():
    cimg.save(os.path.join(CARDS_DIR, f"{cid}.png"))

print("  ✓ 18 Official Card Arts saved.")

# -------------------------------------------------------------
# 4. REAL CHIBI SPRITE SHEET FOR BÚN BÒ HỎA LINH
# -------------------------------------------------------------
print("⚔️ 4. Extracting Real Chibi Sprite Frames from animation_key_poses.png...")

kp_im = Image.open(os.path.join(CROPS_DIR, 'character/animation_key_poses.png'))

# Crop boxes for each pose without label text
pose_boxes = {
    'idle': (45, 46, 172, 164),
    'walk': (215, 46, 345, 164),
    'run': (375, 46, 520, 164),
    'attack_a': (25, 205, 185, 328),
    'attack_b': (190, 205, 365, 328),
    'skill_01': (375, 205, 545, 328),
    'ultimate_01': (20, 365, 240, 492),
    'hit': (255, 365, 390, 492),
    'defeat': (255, 365, 390, 492), # Uses fallen/hit pose
    'victory': (405, 365, 540, 492),
}

extracted_poses = {}
for clip_name, box in pose_boxes.items():
    raw_pose = kp_im.crop(box)
    clean_pose = make_transparent(raw_pose, (253, 242, 225), tolerance=32)
    clean_pose = clean_pose.resize((64, 64), Image.Resampling.LANCZOS)
    extracted_poses[clip_name] = clean_pose

# Assemble into 384x640 Sprite Sheet for Bún Bò Hỏa Linh
# 6 cols (64px) x 10 rows (64px)
SPRITE_W, SPRITE_H = 64, 64
sheet = Image.new('RGBA', (6 * SPRITE_W, 10 * SPRITE_H), (0, 0, 0, 0))

clip_rows = [
    ('idle', 4),
    ('walk', 6),
    ('run', 6),
    ('attack_a', 4),
    ('attack_b', 4),
    ('hit', 2),
    ('skill_01', 4),
    ('ultimate_01', 6),
    ('defeat', 4),
    ('victory', 4),
]

for row_idx, (clip_name, n_frames) in enumerate(clip_rows):
    base_frame = extracted_poses[clip_name]
    for col_idx in range(n_frames):
        # Subtle animation variations (bobbing/scaling per frame)
        frame = base_frame.copy()
        if clip_name in ['idle', 'walk', 'run']:
            bob = int(1.5 * (col_idx % 2))
            f_anim = Image.new('RGBA', (SPRITE_W, SPRITE_H), (0, 0, 0, 0))
            f_anim.paste(frame, (0, bob))
            frame = f_anim
        elif clip_name == 'defeat':
            # Fade out
            alpha = max(80, 255 - col_idx * 50)
            f_anim = frame.copy()
            r, g, b, a = f_anim.split()
            a = a.point(lambda p: int(p * alpha / 255))
            f_anim.putalpha(a)
            frame = f_anim

        sheet.paste(frame, (col_idx * SPRITE_W, row_idx * SPRITE_H))

sheet.save(os.path.join(SPRITES_DIR, 'chr_bunbo_holinh.png'))
print("  ✓ Real Chibi Sprite Sheet saved: chr_bunbo_holinh.png")

# Also assemble Boss Sprite Sheet (96x96 frame, 576x960) using authentic Bếp Trưởng Hỏa Diệm
boss_frame_raw = boss_crop.resize((96, 96), Image.Resampling.LANCZOS)
boss_sheet = Image.new('RGBA', (6 * 96, 10 * 96), (0, 0, 0, 0))
for row_idx, (clip_name, n_frames) in enumerate(clip_rows):
    for col_idx in range(n_frames):
        b_frame = boss_frame_raw.copy()
        bob = int(2 * (col_idx % 2))
        f_b = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
        f_b.paste(b_frame, (0, bob))
        boss_sheet.paste(f_b, (col_idx * 96, row_idx * 96))

boss_sheet.save(os.path.join(SPRITES_DIR, 'boss_thief.png'))
print("  ✓ Real Boss Sprite Sheet saved: boss_thief.png")

# Extract Real Element Icons (32x32)
icon_boxes = [
    ('icon_fire.png', (58, 48, 108, 98)),
    ('icon_water.png', (268, 48, 318, 98)),
    ('icon_wood.png', (448, 48, 498, 98)),
    ('icon_light.png', (628, 48, 678, 98)),
    ('icon_shadow.png', (835, 48, 885, 98)),
]
for fname, box in icon_boxes:
    ic = elem_im.crop(box).resize((32, 32), Image.Resampling.LANCZOS)
    ic.save(os.path.join(ICONS_DIR, fname))

print("  ✓ Real Element Icons saved.")
print("\n🎉 ALL OFFICIAL HIGH-RES ASSETS REBUILT SUCCESSFULLY!")
