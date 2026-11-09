import json, csv, pathlib
root=pathlib.Path('/mnt/data/soul_of_meal_design_v1/schemas')
entries=[]
def add(id, domain, path, size, fmt, status='P0', category=None, notes=None):
    entries.append(dict(id=id, domain=domain, path=path, design_size=size, runtime_format=fmt, priority=status, category=category or domain, notes=notes or ''))
char_ids=['chr_bunbo_holinh','chr_pho_lamvu','chr_goicuon_diepnhi','chr_banhbao_bachngoc','chr_caphe_davu']
for ch in char_ids:
    for part,size,ext in [('full','2048x3072 px','webp'),('portrait','2048x2048 px','webp'),('card','768x1024 px','webp'),('cutin_ultimate','2048x1152 px','webp'),('avatar','512x512 px','webp')]:
        add(f'{ch}_{part}','character',f'assets/characters/{ch}/art/{part}_v001.{ext}',size,ext)
    add(f'{ch}_skeleton','character',f'assets/characters/{ch}/rig/skeleton.json','rig vector coordinates','json')
    add(f'{ch}_atlas_0','character',f'assets/characters/{ch}/rig/atlas_0.webp','<=2048x2048 px','webp')
    add(f'{ch}_animation_events','character',f'assets/characters/{ch}/animations/events.json','events timing/frames','json')
for id,size in [('env_village_square','64x48 tiles @64 units'),('env_village_lilia_kitchen','interior 28x20 tiles'),('env_village_guild_hall','interior 36x24 tiles'),('env_village_market','48x32 tiles'),('env_forest_entrance','48x32 tiles')]:
    add(id,'environment',f'assets/world/maps/{id}/map.json',size,'json')
for id,size in [('env_prop_banhbao_statue','384x512 px'),('env_build_lilia_kitchen','1024x1024 px'),('env_build_guild_hall','1536x1024 px'),('env_prop_questboard','256x384 px'),('env_prop_chest_wood','256x256 px'),('env_prop_berry_bush','256x256 px'),('env_prop_bridge_wood','modular 4x1 tiles'),('env_prop_door_generic','128x192 px'),('env_prop_sign_forest','256x256 px'),('env_prop_lantern','128x256 px')]:
    add(id,'environment',f'assets/world/props/{id}.webp',size,'webp')
for id in ['npc_lilia','npc_market_merchant','npc_guild_guard','npc_ingredient_collector','npc_child_explorer']:
    add(id,'npc',f'assets/npcs/{id}/rig/atlas_0.webp','<=2048x2048 px','webp')
ui_ids=['ui_btn_primary','ui_btn_secondary','ui_btn_ghost','ui_btn_danger','ui_panel_parchment','ui_panel_dark','ui_panel_modal','ui_modal_overlay','ui_toast_success','ui_toast_error','ui_icon_adventure','ui_icon_tcg','ui_icon_autochess','ui_icon_vilin','ui_icon_gacha','ui_icon_quests','ui_icon_settings','ui_progress_hp','ui_progress_energy','ui_progress_load','ui_avatar_frame_ssr','ui_reward_shine']
for id in ui_ids:
    add(id,'ui',f'assets/ui/{id}.svg','vector/9-slice','svg')
add('ui_illustration_home_bg_portrait','ui','assets/ui/backgrounds/home_portrait.webp','1080x1920 px','webp')
add('ui_illustration_home_bg_landscape','ui','assets/ui/backgrounds/home_landscape.webp','1920x1080 px','webp')
vfx_ids=['vfx_fire_slash_a','vfx_fire_hit_small','vfx_fire_bunbo_ultimate_cast','vfx_fire_bunbo_ultimate_impact','vfx_water_cast_ring','vfx_water_splash_medium','vfx_wood_heal_bloom','vfx_light_shield_bubble','vfx_shadow_cut_01','vfx_tcg_trap_reveal','vfx_chess_merge_star','vfx_fire_anticipation_small','vfx_fire_dash_trail']
for id in vfx_ids:
    add(id,'vfx',f'assets/vfx/{id}/effect.json','512–2048 px master; scaled in world','json')
sfx_ids=['sfx_ui_confirm','sfx_ui_cancel','sfx_page_open','sfx_card_draw','sfx_tcg_trap_flip','sfx_shop_buy','sfx_star_upgrade','sfx_fire_whoosh_a','sfx_blade_impact','sfx_water_splash_medium','sfx_fire_blast_large','sfx_victory_fanfare','vo_chr_bunbo_ultimate_vi','sfx_step_light','sfx_enemy_hit_short','sfx_water_gather','sfx_fire_dash','sfx_round_start','sfx_victory_small','sfx_pick_unit']
for id in sfx_ids:
    add(id,'audio',f'assets/audio/{"voice" if id.startswith("vo_") else "sfx"}/{id}_v001.ogg','48 kHz source','ogg')
for id in ['bgm_home_village','bgm_forest_explore','bgm_sea_explore','bgm_volcano_explore','bgm_adventure_battle','bgm_boss_hoadiem','bgm_tcg_match','bgm_autochess_match','bgm_gacha_reveal','bgm_main_hanhtrinhvigiac']:
    add(id,'audio',f'assets/audio/bgm/{id}_v001.ogg','48 kHz source, loop markers metadata','ogg')
manifest={"pack_version":"1.0.0","design_status":"proposed_not_production_ready","coordinate_rules":{"ui_portrait_dp":[390,844],"ui_landscape_dp":[960,540],"world_tile_units":[64,64],"runtime_target_fps":60},"characters":char_ids,"assets":entries}
(root/'assets.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

screens=[
('screen_splash','both','loading/update/offline/error','version compare; retry on failure'),
('screen_home','portrait','default/new_reward/news','adventure/tcg/autochess routes'),
('screen_world_map','portrait','locked/unlocked/selected/loading','zone click + details'),
('screen_adventure_explore','both','idle/moving/interacting/dialogue/encounter','movement + modal interaction'),
('screen_quest_journal','portrait','new/active/complete/claimed/empty','accept/track/claim'),
('screen_team_builder','portrait','valid/invalid/locked/loading','save 5 slots'),
('screen_adventure_battle','landscape','ready/casting/cooldown/win/lose','ultimate timing + HUD readability'),
('screen_battle_result','both','pending/claimed/error','idempotent rewards'),
('screen_vilin_detail','portrait','owned/locked/maxed/missing_resources','upgrade/skin/bond'),
('screen_gacha','portrait','idle/confirm/processing/reveal/error','draw txn ID + odds'),
('screen_tcg_deck_builder','landscape','valid/invalid/empty/filtered','36 card rules'),
('screen_tcg_match','landscape','my_priority/opponent_priority/stack_resolving/win','trap reaction & damage'),
('screen_autochess_lobby','portrait','ready/matching/error','normal/hard/extreme bot'),
('screen_autochess_match','landscape','preparation/combat/reward/end','5 shop slots/traits/gold'),
('screen_settings','both','dirty/saving/saved/error','persist volume + reduced_motion'),
('screen_update_prompt','both','detected/downloading/verifying/restart/error','progress+retry+no save loss')
]
with (root/'screen_states.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(['screen_id','orientation','mandatory_states','acceptance']); w.writerows(screens)

schema={
 '$schema':'https://json-schema.org/draft/2020-12/schema',
 '$id':'https://soul-of-meal.local/schema/events.json',
 'title':'Soul of Meal runtime event contract',
 'type':'object',
 'required':['event_id','type','instance_id','timestamp_ms','payload'],
 'properties':{
   'event_id':{'type':'string','minLength':1},
   'type':{'type':'string','enum':['animation.cast_start','animation.projectile_spawn','combat.hit_confirmed','combat.damage_applied','combat.status_applied','combat.cast_complete','interaction.open','interaction.close','ui.card.play.request','ui.trap.trigger','vfx.spawn','sfx.play','chess.unit.merge','update.detected']},
   'instance_id':{'type':'string','minLength':1},
   'timestamp_ms':{'type':'integer','minimum':0},
   'actor_id':{'type':'string'},
   'target_id':{'type':'string'},
   'map_id':{'type':'string'},
   'payload':{'type':'object','additionalProperties':True},
   'correlation_id':{'type':'string'}
 },
 'additionalProperties':False,
 'description':'Transport-neutral event envelope. Handler must deduplicate event_id/action instance; combat.server authoritative in PvP.'
}
(root/'events.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf-8')
print('assets',len(entries),'screens',len(screens))
