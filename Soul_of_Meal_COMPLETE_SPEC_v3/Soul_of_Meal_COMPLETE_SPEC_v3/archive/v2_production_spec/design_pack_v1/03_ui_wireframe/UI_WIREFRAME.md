# 03 — UI Wireframe & Interaction Specification

**Mục tiêu:** dựng UI không cần phỏng đoán bố cục từ ảnh minh họa. Từng màn hình có ID, region layout, state, interaction, asset key, event, responsive rule.

## A. Design system v1

### A1. Artboards và đơn vị

| Target | Logical artboard | Export preview | Display rule |
|---|---:|---:|---|
| Mobile portrait | **390 × 844 dp** | 1170×2532 px @3x | Home, Adventure, Character, Quest, Gacha |
| Mobile landscape | **960 × 540 dp** | 1920×1080 px @2x | TCG, Auto Chess, Adventure combat tùy chế độ |
| Tablet portrait | 768 × 1024 dp | 1536×2048 px @2x | hai cột với modal lớn |
| Desktop landscape | 1440 × 900 dp | 2880×1800 px @2x | trung tâm max-width 1440, mở panel phụ |

- `dp` là đơn vị logic của UI, không tương đương pixel thiết bị vật lý. Không định vị mọi thứ bằng pixel cố định; dùng anchors/flex/grid/aspect.
- Safe area: padding 16 dp tối thiểu portrait, 20 dp landscape; cộng inset thật từ OS/notch. Không đưa nút thao tác quan trọng xuống vùng gesture hệ thống.
- Scale spacing: 4 / 8 / 12 / 16 / 24 / 32 dp; corner radius 8/12/16; outline 2 dp.
- Tap target ≥ 44×44 dp; icon nhỏ vẫn phải có invisible tap target.
- Body text 14–16 dp; heading 20–28 dp; chú thích min 12 dp; text dynamic / localization wrap. Tránh đưa thông tin thực vào ảnh.

### A2. Tokens

| Token | Value | Usage |
|---|---|---|
| `color.bg.parchment` | `#FFF4DE` | card / modal |
| `color.bg.wood` | `#6A3F32` | khung cổ tích |
| `color.accent.gold` | `#F4B642` | CTA / reward |
| `color.accent.fire` | `#F36B3F` | fire & danger |
| `color.accent.water` | `#52B7E7` | water & utility |
| `color.accent.wood` | `#5CBF73` | nature & success |
| `color.accent.light` | `#F8DE73` | light |
| `color.accent.shadow` | `#825DC8` | shadow |
| `color.text.primary` | `#392A34` | text trên nền sáng |
| `color.text.inverse` | `#FFF9EE` | text trên nền tối |
| `shadow.card` | `0 6px 16px #36221A29` | panel |
| `motion.fast` | 120 ms | tap/click |
| `motion.normal` | 220 ms | tab/modal |
| `motion.scene` | 350 ms | transition scene |

Trạng thái nút: `default` → `hover` (desktop) → `pressed` → `focused` (keyboard) → `disabled` / `loading`. Loading khóa gửi lặp, trả về error có retry. Focus ring hiện rõ, không chỉ đổi màu.

### A3. Asset UI thống nhất

- `ui_btn_primary`, `ui_btn_secondary`, `ui_btn_ghost`, `ui_btn_danger` (9-slice SVG/PNG hoặc CSS); tối thiểu 5 states.
- `ui_panel_parchment`, `ui_panel_dark`, `ui_panel_modal`, `ui_modal_overlay`, `ui_toast_success`, `ui_toast_error`.
- `ui_icon_adventure`, `ui_icon_tcg`, `ui_icon_autochess`, `ui_icon_vilin`, `ui_icon_gacha`, `ui_icon_quests`, `ui_icon_settings` — SVG viewBox 64×64.
- `ui_avatar_frame_n/r/sr/ssr`, `ui_badge_element_*`, `ui_badge_role_*`, `ui_badge_new`, `ui_reward_shine`.
- `ui_progress_hp`, `ui_progress_energy`, `ui_progress_load`, `ui_tabs`, `ui_scrollbar`.
- `ui_illustration_home_bg` thiết kế bản 1920×1080 px cho landscape; bản portrait 1080×1920 px **có focal-safe zone**, không crop mặt nhân vật.

## B. Screen inventory và hợp đồng trạng thái

| Screen ID | Orientation | Thành phần lõi | Primary action | Các trạng thái bắt buộc |
|---|---|---|---|---|
| `screen_splash` | both | logo, loading bar, version | continue | load/update/offline/error |
| `screen_home` | portrait preferred | hero/Vị Linh, mode CTA, bottom nav, resource | enter mode | default/news/new reward |
| `screen_world_map` | portrait | world illustration + hotspots, quests | select zone | locked/unlocked/selected/loading |
| `screen_adventure_explore` | both | scene, joystick, interaction, minimap, quest | move/interact | moving/dialogue/combat-trigger/menu |
| `screen_quest_journal` | portrait | tabs, list, detail, track | accept/track | new/active/complete/claimed/empty |
| `screen_team_builder` | portrait | 5 slots, filter roster, power preview | save team | valid/invalid/locked/loading |
| `screen_adventure_battle` | landscape preferred | battle field, HUD, portrait/skill row, wave/time | ultimate | ready/casting/cooldown/win/lose |
| `screen_battle_result` | both | victory/defeat, rewards, progress | claim/continue | pending/claimed/error |
| `screen_vilin_detail` | portrait | full art, stats, equipment, skill, stories | upgrade | owned/locked/maxed/missing resource |
| `screen_gacha` | portrait | banner, odds, draw buttons, preview | draw | ready/pending/reveal/error |
| `screen_tcg_deck_builder` | landscape preferred | card collection, deck list, cost curve | edit/save | valid/invalid/empty/filters |
| `screen_tcg_match` | landscape | board, two trap slots, hand, hero HP, priority | play/respond/pass | my-priority/opponent-priority/resolve/win |
| `screen_autochess_lobby` | portrait | lineup preset, bot/rank choices | start match | ready/matching/error |
| `screen_autochess_match` | landscape | hex/square board, shop, traits, income, timer | buy/drag/reroll | preparation/combat/reward/end |
| `screen_settings` | both | audio, graphics, language, accessibility | save | dirty/saving/saved/error |
| `screen_update_prompt` | both | patch notes, progress, reload | update/retry | detected/downloading/install/restart/error |

## C. Layout wireframe chính (tọa độ dp tham chiếu)

### C1. Home — 390×844 dp

```text
┌──────────────────────────────────────────┐
│ [Profile 40] Lv.30 [⚡] [Gold] [Crystal] │  top 0–68 + safe area
├──────────────────────────────────────────┤
│                                          │
│     LIVELY VILLAGE + CHIBI HERO          │  hero zone y=76..466
│    (portrait anchored at x≈170)          │
│        [speech bubble / idle]            │
│                                          │
├──────────────────────────────────────────┤
│ [Adventure — Khám phá]                   │  CTA y=470..526
│ [TCG]                [Auto Chess]        │  CTA y=534..600
├──────────────────────────────────────────┤
│ [Nhiệm vụ mới] [Sự kiện] [Bạn bè]         │  contextual shortcuts
├──────────────────────────────────────────┤
│ Home   Vị Linh  Triệu Hồi  Cửa Hàng      │  bottom nav 76dp + inset
└──────────────────────────────────────────┘
```

Default art background not clickable except touch zones `home_companion_interact` (tap returns randomized idle social animation). Buttons open modes. Hero must never mask CTA or resource text.

### C2. Adventure HUD — portrait 390×844 dp

- Top y=0..64: minimap 112×112 dp at upper right, quest short tracker under top-left.
- Center y=80..640: world viewport, player roughly x=195, y=470.
- Bottom-left joystick base 112×112 dp within safe area.
- Bottom-right: interact 56×56, menu 44×44, quick map 44×44.
- Quest panel collapsible. During dialogue: overlay bottom 240dp with portrait, speaker name, up to 3 lines and 2 choices.
- **World collision input protected** while modal open. `E`/tap only when target in interaction range.

### C3. Adventure Battle — landscape 960×540 dp

- Top 0..64: enemy HP/boss name, wave `2/3`, timer + pause.
- Arena center x=0..960, y=68..396.
- Bottom 396..540: 5 actor portraits (~88×88 each) + energy 76×8 + ultimate buttons.
- Skill button disabled until energy >= cost AND actor alive; cast has 100–150ms visual response before dramatic cut-in. Screen shake must not move HUD.
- User may tap target to change priority; selected target gets subtle ring not a full opaque overlay.

### C4. TCG Match — landscape 960×540 dp

```text
[Opponent hero HP]       [Trap trap] [Opponent hand backs]
[Enemy board units x5; positions row top y=100..205]
──────────────── reaction/priority bar ────────────────
[Friendly board units x5; positions row y=252..350]
[Own trap slot A] [Own trap slot B] [Pass/End Turn]
[Player hero 8000HP] [5-card hand art] [Mana 5/10]
```

- Hand cards min 100×142 dp expanded, compact overlap in 960 width; selection lifts and shows readable text in a side zoom panel, not tiny text inside card.
- `priority_player` vs `priority_opponent` always explicit; pending stack shown in center-right 180×168 dp.
- Trap slot remains visible even when empty; face-down shows icon; hover/press expands inspect for owner only.
- Sự kiện: `card.drag.start`, `card.play.request`, `match.response.open`, `match.response.pass`, `trap.trigger`, `match.resolve.complete`.

### C5. Auto Chess Match — landscape 960×540 dp

- Top 0..60: round, timer, standings, HP.
- Left x=0..90: synergy panel collapsed/expanded.
- Board center x=95..795, y=60..385; active grid highlighted on drag.
- Right x=800..960: trait + player table mini; collapsible on 960 width.
- Bottom y=388..540: row 5 shop cards x≈115–745; action buttons `reroll`, `xp`, `lock`; bench 6 slots behind shop tab.
- Khi combat: shop disabled/read-only, `phase_combat` banner; touch units inspect stats, không kéo thả.

### C6. Vị Linh Detail — portrait 390×844 dp

- Header 60 dp: Back, title, favorite.
- Character illustration in y=80..450, can toggle `art` / `chibi` preview, no text baked into art.
- Stats area y=440..610: name, stars, level, HP/ATK/DEF, element/role.
- Tab bar y=615..659: `Kỹ năng | Trang bị | Thân thiết | Truyện`.
- Content region y=668..766 scroll contained within tab; fixed bottom CTA y=772..830 `Nâng cấp`.
- If no material, CTA disabled + shortcut `Tìm nguyên liệu`.

## D. Interaction rules per flow

### U1. Vào chế độ

`home.btn_tcg` → check tutorial unlocked → load resources → transition 350ms → TCG lobby. If download needed show progress (bytes + cancel), preserve current home state.

### U2. TCG action

Tap card → inspect → drag to valid zone → highlight target → confirm play (or instant on release if setting enabled) → game server/local rules validation → card enters stack → opponents respond → resolve → VFX+SFX. Invalid target returns card to hand + tooltip; no card is discarded if play rejected.

### U3. Auto Chess interaction

Shop card tap → buy if gold/bench permit → animate to bench → drag to tile while `phase_prepare` → if 3-of-kind, upgrade event → effect. If board full: move to bench or inform clearly; must not lose purchased unit.

### U4. Update modal

`update_detected` → notes (Vietnamese plain text) → Update → download progress (0–100% plus bytes) → ready → reload; `error` → retry/close where safe; persistent save sync before reload. PWA user may need close/reopen depending on platform; do not promise auto-install everywhere.

## E. UI state/error model

| Component | Standard states | Recovery |
|---|---|---|
| Button | default, hover, pressed, focused, disabled, loading | restore default if request fails |
| Card | idle, hover, selected, dragging, targeted, exhausted | snap back if invalid |
| Quest | new, accepted, tracking, ready_claim, claimed | prevent duplicate claim |
| Gacha | idle, confirm, processing, reveal, result, error | idempotent transaction ID |
| Download | waiting, downloading, verifying, installed, failed | retry or continue compatible version |
| Battle HUD | idle, target_selected, casting, locked, battle_end | ignore clicks while locked |
| Toast | info, warning, success, error | auto-dismiss 3–5s except action-required |

## F. Accessibility & localization

- Focus order theo thứ tự đọc; input gamepad và keyboard mapping ở settings; text/controls không bị cắt khi locale dài hơn.
- Text màu chính trên parchment đạt độ tương phản tối thiểu 4.5:1 nơi khả thi; trạng thái game không chỉ phân biệt bằng màu.
- `reduced_motion`: bỏ shake, flash, camera cut-in dài và giảm particle, **không bỏ gameplay telegraph**.
- `sfx/voice/music` điều chỉnh riêng; subtitle cho thoại, hiệu ứng âm thanh quan trọng có icon.
- Responsive test ở 360×780, 390×844, 430×932 portrait và 960×540, 1280×720 landscape.
- Font UI Unicode Vietnamese full glyph coverage, fallback sans-serif; không cài text gameplay trực tiếp vào đồ họa.

## G. Acceptance

- 16 screen IDs định nghĩa đầy đủ, navigation và Back/Close nhất quán; không có dead-end.
- 6 wireframe chính được kiểm tra trên portrait/landscape đúng định hướng, không đè HUD/camera notch.
- 100% CTA có loading/disabled/error; tap target >=44dp; text tiếng Việt có thể scale.
- Gameplay TCG/Chess không yêu cầu cuộn toàn trang để xem bàn và thao tác bắt buộc.
- UI sound/animation liên kết event, không tự ý gọi âm thanh hai lần sau route transition.
