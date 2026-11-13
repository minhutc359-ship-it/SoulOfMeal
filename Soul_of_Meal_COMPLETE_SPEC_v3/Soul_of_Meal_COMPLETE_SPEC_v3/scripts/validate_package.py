#!/usr/bin/env python3
"""Validate completeness of the Soul of Meal v3 specification package."""
import hashlib,json,sys
from pathlib import Path

def validate(root):
    errors=[];info={};must=['README.md','AGENTS.md','FILE_INDEX.json','docs/00_foundation/PROJECT_BIBLE.md','docs/01_gameplay/ADVENTURE_RULEBOOK.md','docs/01_gameplay/TCG_RULEBOOK.md','docs/01_gameplay/AUTO_CHESS_RULEBOOK.md','docs/02_art/SPRITE_PIPELINE.md','docs/03_engineering/ADVENTURE_RULES_REFERENCE.md','docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md','docs/03_engineering/TCG_RULES_REFERENCE.md','.agents/skills/soul-of-meal-sprite/SKILL.md','references/visuals/VISUAL_MANIFEST.json']
    for p in must:
        if not (root/p).is_file(): errors.append(f'Missing: {p}')
    try:
        index=json.loads((root/'FILE_INDEX.json').read_text(encoding='utf8'))
        indexed_paths=set()
        for entry in index['files']:
            path=entry['path'];indexed_paths.add(path);target=root/path
            if not target.is_file():
                errors.append(f'File index missing: {path}')
                continue
            content=target.read_bytes()
            if len(content)!=entry['bytes']: errors.append(f'File index size mismatch: {path}')
            if hashlib.sha256(content).hexdigest()!=entry['sha256']: errors.append(f'File index hash mismatch: {path}')
        for path in ['docs/03_engineering/ADVENTURE_RULES_REFERENCE.md','docs/03_engineering/AUTO_CHESS_RULES_REFERENCE.md','docs/03_engineering/TCG_RULES_REFERENCE.md','game_rules/adventure.py','game_rules/auto_chess.py','game_rules/tcg.py','tests/test_adventure.py','tests/test_auto_chess.py','tests/test_tcg.py']:
            if path not in indexed_paths: errors.append(f'File index entry missing: {path}')
        if len(indexed_paths)!=len(index['files']): errors.append('File index contains duplicate paths')
        disk_paths={path.relative_to(root).as_posix() for path in root.rglob('*') if path.is_file() and path.name!='FILE_INDEX.json' and not {'__pycache__', '.git', '.vite'}.intersection(path.parts) and path.relative_to(root).parts[:2] not in {('client','node_modules'), ('client','dist'), ('server','bin'), ('server','obj')}}
        for path in sorted(disk_paths-indexed_paths): errors.append(f'File is not indexed: {path}')
        info['indexed_files']=len(indexed_paths)
    except Exception as e: errors.append('File index: '+str(e))
    try:
        vm=json.loads((root/'references/visuals/VISUAL_MANIFEST.json').read_text(encoding='utf8'))
        info['crop_count']=len(vm)
        for e in vm:
            if not (root/e['file']).is_file(): errors.append(f"Missing crop {e['file']}")
        for c in ['character','environment','ui','combat','vfx']:
            if not (root/f'references/visuals/full/{c}_sheet.png').exists():errors.append(f'Missing full sheet: {c}')
    except Exception as e: errors.append('Visual manifest: '+str(e))
    try:
        cat=json.loads((root/'examples/cards/cards.catalog.json').read_text(encoding='utf8'))
        deck=json.loads((root/'examples/cards/starter_deck.json').read_text(encoding='utf8'))
        ids={x['card_id'] for x in cat['cards']}
        assert len(ids)==len(cat['cards']),'duplicate card IDs'
        assert sum(c['count'] for c in deck['cards'])==36,'deck !=36 cards'
        assert all(c['card_id'] in ids and c['count']<=2 for c in deck['cards']), 'invalid cards/copy limit'
        info['tcg_cards']=len(ids)
    except Exception as e:errors.append('TCG demo: '+str(e))
    try:
        odds=json.loads((root/'examples/auto_chess/shop_odds.json').read_text(encoding='utf8'))
        for lvl,arr in odds['probabilities_percent'].items():
            if sum(arr)!=100: errors.append(f'Shop level {lvl} odds not 100%')
        info['shop_levels']=len(odds['probabilities_percent'])
    except Exception as e:errors.append('Auto Chess odds: '+str(e))
    try:
        ability=json.loads((root/'examples/adventure/bunbo_ability.json').read_text(encoding='utf8'))
        fixture=ability['sample_damage_fixture']
        base=max(1,fixture['atk']*ability['coefficient_bp']//10000)
        damage=max(1,base*100//(100+fixture['def']))
        if damage!=fixture['expected_damage']: errors.append('Adventure damage fixture does not match formula')
        info['adventure_abilities']=1
    except Exception as e:errors.append('Adventure ability fixture: '+str(e))
    return {'package':'Soul_of_Meal_COMPLETE_SPEC_v3','ok':not errors,'errors':errors,'counts':info}

if __name__=='__main__':
    root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('.')
    report=validate(root);print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(0 if report['ok'] else 1)
