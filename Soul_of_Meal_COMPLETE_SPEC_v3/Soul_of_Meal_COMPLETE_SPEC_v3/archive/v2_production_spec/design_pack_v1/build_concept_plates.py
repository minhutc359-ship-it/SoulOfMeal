from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
from pathlib import Path
from io import BytesIO
import cairosvg
R=Path('/mnt/data/soul_of_meal_design_v1')
P1=Image.open('/mnt/data/a_highly_detailed_multi_panel_game_development_des.png').convert('RGB')
P2=Image.open('/mnt/data/a_highly_detailed_colorful_infographic_style_g.png').convert('RGB')
W,H=2400,1580
FONT='/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'; BOLD='/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'
N=lambda s:ImageFont.truetype(FONT,s)
B=lambda s:ImageFont.truetype(BOLD,s)
C={'bg':'#FAF5EB','wine':'#593144','dark':'#332737','gold':'#F2B956','paper':'#FFFFFF','frame':'#D6BB8B','muted':'#77636F','sage':'#E5EFDF'}

def rr(d,bb,fill,r=20,outline=None,width=3): d.rounded_rectangle(bb,radius=r,fill=fill,outline=outline,width=width)

def paste_cover(dst,im,bbox):
 x,y,w,h=bbox; src=im.copy()
 # crop to aspect by center
 tw,th=src.size; ar=w/h
 if tw/th>ar:
  nw=int(th*ar);left=(tw-nw)//2;src=src.crop((left,0,left+nw,th))
 else:
  nh=int(tw/ar);top=(th-nh)//2;src=src.crop((0,top,tw,top+nh))
 src=src.resize((w,h),Image.Resampling.LANCZOS)
 dst.paste(src,(x,y))

def paste_contain(dst,im,bbox):
 x,y,w,h=bbox
 src=im.copy()
 scale=min(w/src.width,h/src.height)
 nw,nh=round(src.width*scale),round(src.height*scale)
 src=src.resize((nw,nh),Image.Resampling.LANCZOS)
 dst.paste(src,(x+(w-nw)//2,y+(h-nh)//2))

def base(no,title,subtitle):
 im=Image.new('RGB',(W,H),C['bg']);d=ImageDraw.Draw(im)
 d.rectangle((0,0,W,135),fill=C['wine'])
 d.text((55,22),f'{no}   {title}',font=B(47),fill='#FFFFFF')
 d.text((57,86),subtitle,font=N(25),fill='#FBEACD')
 rr(d,(34,160,1360,1460),C['paper'],20,C['frame'])
 rr(d,(1390,160,2365,1460),C['paper'],20,C['frame'])
 d.text((60,1492),'SOUL OF MEAL • PRODUCTION ARTBOARD v1.0',font=B(23),fill=C['wine'])
 d.text((1520,1492),'Thông số chuẩn: tài liệu Markdown + JSON đi kèm',font=N(22),fill=C['muted'])
 return im,d

def section(d,y,title,lines,accent='#A66643',gap=49):
 rr(d,(1420,y,2332,y+53),accent,13)
 d.text((1440,y+9),title,font=B(25),fill='#FFFFFF')
 yy=y+76
 for line in lines:
  d.text((1445,yy),line,font=N(25),fill=C['dark']);yy+=gap
 return yy+26

def art_caption(d,x,y,s):
 rr(d,(x,y,x+1220,y+49),C['wine'],8)
 d.text((x+16,y+7),s,font=B(24),fill='#FFFFFF')

def board_char():
 im,d=base('01','CHARACTER SHEET','Turnaround • expression • motion • asset IDs • character style')
 art_caption(d,58,184,'MINH HỌA VỊ LINH + TURNAROUND + KEY POSES')
 # large fiery character + turnaround + expressions
 paste_cover(im,P1.crop((9,137,465,452)),(60,250,670,538))
 paste_cover(im,P2.crop((570,60,872,270)),(748,250,585,295))
 paste_cover(im,P2.crop((580,270,870,452)),(748,563,585,225))
 art_caption(d,58,828,'ROSTER 5 VỊ LINH / PALETTE CỐT LÕI')
 swatches=[('#F36B3F','Bún Bò Hỏa Linh'),('#52B7E7','Phở Lam Vũ'),('#5CBF73','Gỏi Cuốn Diệp Nhi'),('#F8D36A','Bánh Bao Bạch Ngọc'),('#825DC8','Cà Phê Dạ Vũ')]
 for i,(col,name) in enumerate(swatches):
  y=903+i*90;rr(d,(70,y,1328,y+70),'#FFF9EF',14,col,3)
  d.ellipse((86,y+12,129,y+55),fill=col)
  d.text((150,y+15),name,font=B(27),fill=C['dark'])
 y=187
 y=section(d,y,'KÍCH THƯỚC CHUẨN',['Full art: 2048 × 3072 px','Portrait: 2048 × 2048 px','Card: 768 × 1024 px','Ultimate cut-in: 2048 × 1152 px','Chibi world: cao 80–112 world units'])
 y=section(d,y,'ANIMATION STATES',['Idle / Walk / Run / Attack A / Attack B','Skill / Ultimate / Hit / Stun','Victory / Defeat / Interact','Rendering 60 FPS; keyframes 24–30 FPS'],'#825DC8')
 y=section(d,y,'NAMING + RUNTIME',['chr_bunbo_holinh','chr_bunbo_holinh.anim.attack_a','Socket: hand_r, blade_tip, spine, feet','Animation events điều khiển VFX/SFX'],'#387D6A')
 im.save(R/'01_character_sheet'/'CHARACTER_CONCEPT_PLATE.png',quality=95)

def board_env():
 im,d=base('02','ENVIRONMENT SHEET','Map zones • interactive buildings • NPC schedules • spatial units')
 art_caption(d,58,184,'WORLD MAP + LÀNG ẨM THỰC / ART REFERENCE')
 paste_cover(im,P1.crop((477,151,761,332)),(60,245,660,395))
 paste_cover(im,P2.crop((891,59,1275,297)),(739,245,594,395))
 art_caption(d,58,670,'CÔNG TRÌNH / NPC / TILE + PROP')
 paste_cover(im,P2.crop((894,308,1272,452)),(60,733,707,330))
 paste_cover(im,P1.crop((1007,133,1533,542)),(789,733,545,330))
 rr(d,(60,1091,1331,1412),'#E9F0D9',15)
 lines=['Chunk streaming 16×16 tiles; foreground Y-sort theo chân actor.',
        'Cửa / NPC / rương có trigger + state machine riêng.',
        'Thiết kế tất cả công trình có giá trị tương tác hoặc kể chuyện.',
        'Đường chính 3–4 tiles; đường phụ 2 tiles.']
 for i,s in enumerate(lines):d.text((86,1138+i*61),s,font=N(24),fill=C['dark'])
 y=187
 y=section(d,y,'KÍCH THƯỚC WORLD',['1 tile: 64 × 64 world units','Map làng: 64 × 48 tiles','Map units: 4096 × 3072','Chunk: 16×16 tiles / 1024×1024 u'])
 y=section(d,y,'GÓI MAP / PROPS',['env_village_square','env_build_lilia_kitchen','env_prop_chest_wood','npc_lilia / npc_market_merchant'],'#387D6A')
 y=section(d,y,'CÁC TRẠNG THÁI',['Door: closed → opening → entered','Chest: closed → claimed → opened','NPC: patrol → focus → dialogue','Harvest: ripe → harvest → depleted'],'#825DC8')
 im.save(R/'02_environment_sheet'/'ENVIRONMENT_CONCEPT_PLATE.png',quality=95)

def board_ui():
 im,d=base('03','UI WIREFRAME','Responsive layout • 16 screens • CTA states • navigation')
 art_caption(d,58,184,'SCREEN REFERENCES — HOME / ADVENTURE / TCG / CHESS')
 wire=Image.open(BytesIO(cairosvg.svg2png(url=str(R/'03_ui_wireframe'/'UI_BLUEPRINT.svg'),output_width=1600,output_height=1000))).convert('RGB')
 paste_contain(im,wire.crop((20,110,1580,920)),(60,249,1273,750))
 rr(d,(60,1035,1331,1418),'#EBE4F2',15)
 ls=['Screen IDs: screen_home • screen_adventure_explore',
     'screen_adventure_battle • screen_tcg_match',
     'screen_autochess_match • screen_vilin_detail',
     'Khi đang đánh nhau: không cuộn trang để tìm nút.',
     'Text hiển thị bằng font runtime, KHÔNG bake vào art.']
 for i,s in enumerate(ls):d.text((85,1080+i*65),s,font=N(24),fill=C['dark'])
 y=187
 y=section(d,y,'ARTBOARD & SAFE AREA',['Portrait: 390 × 844 dp','Landscape: 960 × 540 dp','UI export 2×–3× / icon SVG','Tap target: min 44 × 44 dp'])
 y=section(d,y,'16 MÀN HÌNH',['Splash, Home, World Map, Explore, Quest','Team, Battle, Result, Vị Linh, Gacha','Deck Builder, TCG, Chess Lobby, Chess','Settings, Update Prompt'],'#387D6A')
 y=section(d,y,'STATES & EVENTS',['default / pressed / focused / disabled','loading / error / empty / success','card.drag > validate > resolve','update.detected > download > reload'],'#825DC8')
 im.save(R/'03_ui_wireframe'/'UI_CONCEPT_PLATE.png',quality=95)

def board_combat():
 im,d=base('04','COMBAT STORYBOARD','Character → cast → projectile → collision → damage → recovery')
 art_caption(d,58,184,'ADVENTURE COMBAT / TCG TRAPS / AUTO CHESS PHASE')
 paste_cover(im,P2.crop((748,510,1529,755)),(60,245,1273,403))
 paste_cover(im,P1.crop((475,595,1005,792)),(60,675,625,340))
 paste_cover(im,P1.crop((1015,694,1530,881)),(705,675,630,340))
 rr(d,(60,1040,1333,1414),'#F1E5DF',15)
 ll=['Gameplay rules → combat event → animation/VFX/SFX.',
    'Hit được xác nhận tại collider hoặc simulation event.',
    'TCG phản ứng/bẫy: phải có quyền response window.',
    'Auto Chess: unit.move → attack → hit → cast_complete.',
    'Không tính damage từ ánh sáng/hình ảnh tự vẽ.']
 for i,s in enumerate(ll):d.text((89,1084+i*63),s,font=N(24),fill=C['dark'])
 y=187
 y=section(d,y,'ĐÒN ĐÁNH MẪU',['Attack A: 30f / 500ms','Skill Phở Lam Vũ: 72f / 1200ms','Ultimate Bún Bò: 150f / 2500ms','Hits: F64, F72 và F100 (main AoE)'])
 y=section(d,y,'BẮT BUỘC CÓ',['cast_start / target_lock','projectile_spawn / hit_confirmed','damage_applied / impact_fx','cast_complete / event deduplication'],'#B54A56')
 y=section(d,y,'ASSET & PHƯƠNG PHÁP',['skill_bunbo_ngonluaamthuc','vfx_fire_bunbo_ultimate_impact','Animations follow combat event IDs','Cut-in ngắn có thể bỏ qua, damage không đổi'],'#387D6A')
 im.save(R/'04_combat_storyboard'/'COMBAT_CONCEPT_PLATE.png',quality=95)

def board_vfx():
 im,d=base('05','VFX / SFX STYLE GUIDE','Five elements • cast/travel/impact • event-driven audio • performance')
 art_caption(d,58,184,'EFFECT REFERENCE / ELEMENT VFX SILHOUETTES')
 paste_cover(im,P1.crop((1012,690,1536,875)),(60,247,1273,320))
 paste_cover(im,P2.crop((12,865,930,1013)),(60,596,1273,280))
 art_caption(d,58,919,'CHỐT 5 NGUYÊN TỐ VÀ QUY TẮC HIỂN THỊ')
 pal=[('#F36B3F','FIRE','Flame / Ember'),('#52B7E7','WATER','Splash / Ring'),('#5CBF73','WOOD','Vine / Leaf'),('#F8D36A','LIGHT','Halo / Star'),('#825DC8','SHADOW','Mist / Crescent')]
 for i,(col,name,desc) in enumerate(pal):
  x=65+i*254;rr(d,(x,985,x+232,1250),'#FFFDF8',13,col,4)
  d.ellipse((x+55,1012,x+175,1132),fill=col)
  d.text((x+24,1161),name,font=B(22),fill=C['dark'])
  d.text((x+19,1207),desc,font=N(17),fill=C['muted'])
 d.text((74,1323),'VFX theo nhân vật > theo hệ > neutral; ưu tiên telegraph dễ đọc.',font=N(24),fill=C['wine'])
 y=187
 y=section(d,y,'EFFECT MASTER',['Small: 512 × 512 px · 120–250ms','Medium: 1024 × 1024 px','Ultimate: 2048 × 2048 px','Anticipation → Trail → Hit → Dissipate'])
 y=section(d,y,'SOUND SOURCES',['WAV source 48 kHz / 24-bit','Runtime: OGG / compatible fallback','Master true peak target ≤ -1 dBTP','Bus: Music, Ambience, SFX, UI, Voice'],'#387D6A')
 y=section(d,y,'BUDGET & EVENT IDs',['Low ~120 active particles','Medium ~250 / High ~650','sfx_fire_blast_large','combat.hit_confirmed → VFX+SFX'],'#825DC8')
 im.save(R/'05_vfx_sfx_style_guide'/'VFX_SFX_CONCEPT_PLATE.png',quality=95)

for fn in [board_char,board_env,board_ui,board_combat,board_vfx]: fn()
print('Created 5 plates')
