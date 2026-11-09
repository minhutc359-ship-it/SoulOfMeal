import svgwrite, pathlib, math
from svgwrite import cm
root=pathlib.Path('/mnt/data/soul_of_meal_design_v1')
BG='#FBF6EA'; WINE='#5B3044'; DARK='#332637'; GOLD='#E8AD4F'; CREAM='#FFFFFF'; LIGHT='#F7E3BF'; STROKE='#CBAE81'; GREEN='#80BA85'
FONT='DejaVu Sans,Arial,sans-serif'

def new(path,title,subtitle):
 d=svgwrite.Drawing(str(path),size=('1600px','1000px'),viewBox='0 0 1600 1000')
 d.add(d.rect(insert=(0,0),size=(1600,1000),fill=BG))
 d.add(d.rect(insert=(0,0),size=(1600,90),fill=WINE))
 d.add(d.text(title,insert=(42,43),font_size=33,fill='#FFFFFF',font_family=FONT,font_weight='bold'))
 d.add(d.text(subtitle,insert=(44,73),font_size=18,fill='#F7E2B6',font_family=FONT))
 d.add(d.text('SOUL OF MEAL · DESIGN BLUEPRINT v1.0',insert=(1225,970),font_size=12,fill=WINE,font_family=FONT))
 return d

def box(d,x,y,w,h,title=None,color='#FFFFFF'):
 d.add(d.rect(insert=(x,y),size=(w,h),rx=18,ry=18,fill=color,stroke=STROKE,stroke_width=2))
 if title:
  d.add(d.rect(insert=(x,y),size=(w,41),rx=16,fill=WINE))
  d.add(d.text(title,insert=(x+19,y+28),font_size=19,fill='white',font_family=FONT,font_weight='bold'))
 return x+18,y+60

def txt(d,x,y,s,size=17,color=DARK,weight='normal'):
 d.add(d.text(s,insert=(x,y),font_family=FONT,font_size=size,fill=color,font_weight=weight))

def lines(d,x,y,L,size=16,lh=29,color=DARK):
 for i,s in enumerate(L): txt(d,x,y+i*lh,s,size,color)

def circ(d,x,y,r,fill): d.add(d.circle(center=(x,y),r=r,fill=fill))

# 01 character
p=root/'01_character_sheet'/'CHARACTER_BLUEPRINT.svg'; d=new(p,'01  CHARACTER SHEET','Tỷ lệ · turnaround · biểu cảm · animation · ID tài nguyên')
box(d,28,111,975,405,'ROSTER CHUẨN — 5 VỊ LINH')
chars=[('Bún Bò Hỏa Linh','chr_bunbo_holinh','#F36B3F','Hỏa / Đấu sĩ'),('Phở Lam Vũ','chr_pho_lamvu','#52B7E7','Thủy / Pháp sư'),('Gỏi Cuốn Diệp Nhi','chr_goicuon_diepnhi','#5CBF73','Mộc / Hỗ trợ'),('Bánh Bao Bạch Ngọc','chr_banhbao_bachngoc','#F6D46B','Quang / Đỡ đòn'),('Cà Phê Dạ Vũ','chr_caphe_davu','#825DC8','Âm / Sát thủ')]
for i,(name,id,col,role) in enumerate(chars):
 x=50+i*189
 d.add(d.rect(insert=(x,179),size=(174,287),rx=14,fill='#FEF7EA',stroke=col,stroke_width=3))
 circ(d,x+87,253,53,col); circ(d,x+87,235,23,'#FFEFDE')
 d.add(d.ellipse(center=(x+87,358),r=(45,61),fill=col,opacity=.83))
 txt(d,x+12,408,name,14,DARK,'bold'); txt(d,x+12,430,role,14); txt(d,x+10,454,id,10,WINE)
box(d,1020,111,552,405,'ASSET KÍCH THƯỚC')
lines(d,1044,189,['Full Illustration       2048×3072 px','Bust Portrait           2048×2048 px','Card Illustration      768×1024 px','Ultimate Cut-in        2048×1152 px','Character Icon         512×512 px','Rig Atlas              ≤2048×2048 px','In-game height         80–112 world units','Combat height          112–160 world units','Timeline               render 60 FPS'],18,32)
box(d,28,536,755,382,'MOTION STATES / EVENT HOOKS')
items=[('Idle','2.4–3.2s'),('Walk','0.65s'),('Run','0.45s'),('Attack A','0.50s'),('Attack B','0.62s'),('Skill','0.9–1.3s'),('Ultimate','2.50s'),('Hit','0.2–0.32s'),('Victory','1.2–1.8s')]
for i,(name,tm) in enumerate(items):
 row,col=divmod(i,3); x=52+col*237;y=611+row*85
 d.add(d.rect(insert=(x,y),size=(217,68),rx=11,fill=LIGHT,stroke=STROKE)); txt(d,x+15,y+26,name,18,WINE,'bold'); txt(d,x+15,y+50,tm,16)
box(d,801,536,771,382,'HANDOFF / IMPLEMENTATION')
lines(d,824,612,['Turnaround: trước · 3/4 · bên · sau','Biểu cảm: 8 bắt buộc + 4 tùy chọn','Rig sockets: hand_r · blade_tip · spine · feet','Hitbox đặt ở chân/thân, KHÔNG theo tóc/áo','Gọi VFX/SFX bằng event, không timeout UI','Asset key: chr_bunbo_holinh.anim.attack_a','Phân biệt: source px / display world units','5 nhân vật tái dùng giữa 3 chế độ'],18,39)
d.save()

# 02 map
p=root/'02_environment_sheet'/'ENVIRONMENT_BLUEPRINT.svg';d=new(p,'02  ENVIRONMENT SHEET','Bố cục Làng Ẩm Thực · tile/chunk · collision · vòng tương tác NPC')
box(d,28,111,1000,809,'MAP BLOCKOUT — env_village_square / 64×48 tiles')
# map grid 8x6 for a clean abstraction
x0,y0=50,184;cw,ch=112,104
for r in range(6):
 for c in range(8):
  col='#ECDFBB' if (r+c)%2 else '#E5EFCF'
  d.add(d.rect(insert=(x0+c*cw,y0+r*ch),size=(cw,ch),fill=col,stroke='#D4C9A4',stroke_width=1))
# paths
for r,c in [(r,3) for r in range(6)]+[(r,4) for r in range(6)]+[(3,c) for c in range(8)]:
 d.add(d.rect(insert=(x0+c*cw+5,y0+r*ch+5),size=(cw-10,ch-10),rx=5,fill='#D5B28D',opacity=.7))
placements=[(0,3,'CỔNG RỪNG','#66AC7E'),(0,1,'VƯỜN','#8EBE5A'),(1,6,'CẦU GỖ','#79BED0'),(2,1,'BẢNG NV','#C78C60'),(2,5,'GUILD','#AA8BC5'),(3,3,'QUẢNG TRƯỜNG','#E8AF59'),(4,5,'BẾP LILIA','#E88F71'),(4,1,'QUÁN BÁNH','#E7B9AC'),(5,4,'SPAWN','#83C4C3'),(5,0,'RƯƠNG','#CFB04E')]
for r,c,name,col in placements:
 xx=x0+c*cw+4;yy=y0+r*ch+14
 d.add(d.rect(insert=(xx,yy),size=(cw-8,74),rx=10,fill=col,stroke=WINE,stroke_width=1.5))
 txt(d,xx+9,yy+43,name,12,WINE,'bold')
txt(d,53,854,'Map: 4096 × 3072 world units  •  chunk: 1024×1024  •  1 tile: 64×64',17,WINE,'bold')
box(d,1045,111,527,378,'OBJECT FOOTPRINT / TRIGGER')
lines(d,1063,180,['Nhà nhỏ              4×4 đến 6×5 tile','Guild hall           8×6 đến 10×8 tile','Cửa                  trigger 64×32 units','NPC                  cao 64–96 units','Interaction radius   1.25 tile (~80 u)','Các lớp: ground → props → entity','                → foreground → lights','Y-sort dựa chân actor, không top texture'],15,36)
box(d,1045,507,527,413,'TƯƠNG TÁC & TRẠNG THÁI')
lines(d,1062,579,['NPC: patrol → in_range → talk → idle','Rương: closed → open → claimed','Cửa: closed → opening → interior','Locked: show reason + hint unlock','Nguyên liệu: ripe → harvest → depleted','Quest ! / ? là overlay, không bake vào art','Mái nhà che actor phải fade opacity','Mỗi công trình nổi bật cần gameplay value'],16,39)
d.save()

# 03 UI
p=root/'03_ui_wireframe'/'UI_BLUEPRINT.svg';d=new(p,'03  UI WIREFRAME','6 màn hình lõi: home · exploration · character · adventure combat · TCG · Auto Chess')
box(d,27,110,510,800,'PORTRAIT 390×844 dp / 3 SCREENS')
for i,label in enumerate(['HOME','ADVENTURE','VỊ LINH']):
 x=49+i*155;y=188;w=140;h=548
 d.add(d.rect(insert=(x,y),size=(w,h),rx=12,fill='#FFFDF8',stroke=WINE,stroke_width=3))
 d.add(d.rect(insert=(x+7,y+9),size=(w-14,44),rx=5,fill=LIGHT));txt(d,x+15,y+37,label,12,WINE,'bold')
 if i==0:
  d.add(d.rect(insert=(x+11,y+61),size=(w-22,235),rx=7,fill='#B1D7BD'));txt(d,x+19,y+182,'HERO ART',12,WINE)
  for j,s in enumerate(['ADVENTURE','TCG','AUTO CHESS']):
   d.add(d.rect(insert=(x+12,y+312+j*53),size=(w-24,45),rx=8,fill=GOLD));txt(d,x+16,y+341+j*53,s,11,WINE,'bold')
 elif i==1:
  d.add(d.rect(insert=(x+11,y+60),size=(w-22,378),rx=4,fill='#C4DBA1'));circ(d,x+70,y+251,20,'#AC523C');circ(d,x+37,y+393,25,'#DAAD67');circ(d,x+107,y+393,23,'#F4B642')
  txt(d,x+16,y+470,'HUD + QUEST',12,WINE)
 else:
  d.add(d.rect(insert=(x+11,y+61),size=(w-22,240),rx=5,fill='#C0D4E5'));txt(d,x+28,y+180,'FULL ART',12,WINE)
  txt(d,x+16,y+329,'LV / STAR / STAT',11,WINE)
  for j,t in enumerate(['SKILL','EQUIP','BOND']):txt(d,x+19,y+367+j*34,t,11,WINE)
 d.add(d.rect(insert=(x+11,y+500),size=(w-22,36),rx=5,fill=WINE))
 txt(d,x+18,y+524,'NAV / ACTION',11,'#FFFFFF')
box(d,555,110,1018,800,'LANDSCAPE 960×540 dp / COMBAT · TCG · AUTO CHESS')
for i,label in enumerate(['ADVENTURE COMBAT','TCG MATCH','AUTO CHESS MATCH']):
 y=182+i*226;x=581;w=965;h=202
 d.add(d.rect(insert=(x,y),size=(w,h),rx=13,fill='#FFFDFA',stroke=WINE,stroke_width=2))
 txt(d,x+16,y+27,label,18,WINE,'bold')
 d.add(d.rect(insert=(x+15,y+37),size=(w-30,37),rx=6,fill=LIGHT))
 txt(d,x+24,y+61,'TOP: HP / WAVE / ROUND / TIMER',15,WINE)
 d.add(d.rect(insert=(x+15,y+82),size=(w-30,69),rx=7,fill=['#D8E4CF','#D7CBE9','#D8E0C8'][i]))
 txt(d,x+25,y+124,['ARENA • ACTORS / TARGETS','CARD BOARD • TRAP SLOTS • PRIORITY','BOARD GRID • TRAITS • PLAYER STATS'][i],17,WINE,'bold')
 d.add(d.rect(insert=(x+15,y+156),size=(w-30,33),rx=5,fill=WINE))
 txt(d,x+25,y+179,['5 PORTRAITS / ULTIMATE','PLAYER HAND / MANA / PASS','SHOP 5 SLOTS / REROLL / XP / BENCH'][i],16,'white')
d.save()

# 04 combat
a=root/'04_combat_storyboard'/'COMBAT_BLUEPRINT.svg';d=new(a,'04  COMBAT STORYBOARD','Từng frame · cast / travel / hit / impact / recovery · gameplay event authority')
for row,(title,length,steps,col) in enumerate([
 ('ATTACK A / BÚN BÒ HỎA LINH','30f / 0.5s',[('0–5','APPROACH'),('6–11','WIND-UP'),('12–17','SLASH'),('F18','HIT + DMG'),('19–24','KNOCKBACK'),('25–29','RECOVER')],'#F37D46'),
 ('SKILL / PHỞ LAM VŨ','72f / 1.2s',[('0–11','CAST'),('12–23','CHARGE'),('F24','SPAWN'),('25–47','PROJECTILE'),('F48','HIT + DMG'),('49–71','STATUS / EXIT')],'#4FADD8'),
 ('ULTIMATE / BÚN BÒ HỎA LINH','150f / 2.5s',[('0–17','CAST'),('18–47','CUT-IN'),('48–63','DASH'),('64–72','2 HITS'),('73–99','AOE'),('F100','MAIN IMPACT')],'#B94858')]):
 y=121+row*264
 box(d,30,y,1540,243,title)
 txt(d,1358,y+29,length,16,'#FFFFFF','bold')
 xx=54
 for i,(frames,phase) in enumerate(steps):
  x=xx+i*252; yy=y+72
  d.add(d.rect(insert=(x,yy),size=(235,118),rx=12,fill='#FFF8EB',stroke=col,stroke_width=3))
  d.add(d.rect(insert=(x,yy),size=(235,32),rx=10,fill=col))
  txt(d,x+15,yy+23,frames,17,'#FFFFFF','bold')
  txt(d,x+12,yy+77,phase,17,WINE,'bold')
  if i<5:
   d.add(d.line((x+235,yy+59),(x+252,yy+59),stroke=WINE,stroke_width=3))
 txt(d,55,y+215,['HIT event chỉ 1 lần / attack instance.','Projectile impact đúng collider; orphan projectile cleanup.','F64/F72 hit phụ; F100 main AoE; cinematic có reduced-motion.'][row],15,WINE)
d.save()

# 05 effects/audio
p=root/'05_vfx_sfx_style_guide'/'VFX_SFX_BLUEPRINT.svg';d=new(p,'05  VFX / SFX STYLE GUIDE','Element signatures · effect layers · mix bus · mobile budget · asset event naming')
box(d,28,112,1544,282,'5 NGUYÊN TỐ — CHUNG PHƯƠNG PHÁP, RIÊNG SILHOUETTE')
elems=[('HỎA','fire','#F36B3F','arc · ember · blast'),('THỦY','water','#52B7E7','wave · bubble · splash'),('MỘC','wood','#5CBF73','leaf · vine · bloom'),('QUANG','light','#F8D36A','halo · star · shield'),('ÂM','shadow','#825DC8','mist · crescent · shard')]
for i,(name,id,col,shape) in enumerate(elems):
 x=50+i*306
 d.add(d.rect(insert=(x,181),size=(283,174),rx=16,fill='#FFFDF7',stroke=col,stroke_width=3))
 circ(d,x+141,245,40,col)
 txt(d,x+17,304,name+' / '+id,19,WINE,'bold');txt(d,x+17,331,shape,15)
box(d,28,418,748,490,'VFX PIPELINE / BUDGET')
lines(d,53,487,['Anticipation → Core → Trail → Impact → Aftermath','Hit FX chỉ phát khi combat.hit_confirmed.','Asset hierarchy: character > element > neutral.','Small hit: 512×512 px · 120–250ms','Mid hit: 1024×1024 px · 200–400ms','Ultimate FX: 2048×2048 master · 400–900ms','Low ~120 / Medium ~250 / High ~650 particles','VFX sockets: blade_tip · muzzle · target.center','Không che telegraph / HP / UI tối quan trọng'],17,42)
box(d,795,418,777,490,'SFX / AUDIO BUS / IMPLEMENTATION')
lines(d,823,487,['Master (true peak target ≤ -1 dBTP)','   ├ Music: BGM / adaptive stems','   ├ Ambience: village, forest, water','   ├ SFX_Gameplay: hit, skills, traps, chess','   ├ SFX_UI: button, panel, toast','   └ Voice: character lines & warnings','Source WAV 48kHz / 24-bit; runtime OGG/fallback','Ultimate voice: duck BGM ~ -4dB','sfx_fire_blast_large  |  vo_chr_bunbo_ultimate_vi'],17,42)
d.save()
print('created 5 svg blueprints')
