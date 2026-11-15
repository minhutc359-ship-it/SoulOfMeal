"""Author proposed mode-specific entries for the existing shared spirit identities."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def write(path,value):(ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def main():
    characters=read('client/src/modes/metaCatalog.json')['characters']
    cards=read('examples/cards/cards.catalog.json')
    chess=read('examples/auto_chess/units.json')
    costs={'chr_banhbao_bachngoc':1,'chr_som_017':2,'chr_som_009':3,'chr_som_008':4,
      'chr_bunbo_holinh':4,'chr_caphe_davu':4,'chr_som_020':4}
    base_roles={
      'fighter':{'tcg':[400,400],'chess':[610,62,30]},
      'guardian':{'tcg':[200,700],'chess':[750,38,45]},
      'mage':{'tcg':[450,350],'chess':[480,80,22]},
      'ranged':{'tcg':[400,400],'chess':[510,72,24]},
      'support':{'tcg':[200,600],'chess':[570,50,30]},
      'healer':{'tcg':[150,650],'chess':[570,48,30]},
      'controller':{'tcg':[300,500],'chess':[510,72,26]},
      'assassin':{'tcg':[500,250],'chess':[450,84,18]},
    }
    policy={'status':'PROPOSED','version':'shared-roster-v1','roles':base_roles,'chess_cost_overrides':costs,
      'notes':'Fixed mode-specific values. Account levels, owned rarity and Adventure equipment never enter TCG or Chess stats.'}
    write('examples/shared_roster_balance.proposed.json',policy)
    present={c.get('character_id') for c in cards['cards']}
    for char in characters:
        if char['id'] in present:continue
        rarity_cost={'N':1,'R':2,'SR':3,'SSR':5}[char['rarity']]
        attack,defense=base_roles[char['role']]['tcg']
        scale=max(0,rarity_cost-2)*100
        card={'card_id':'card_'+char['id'],'display_name':char['name'],'type':'unit','element':char['element'],
          'cost':rarity_cost,'rarity':{'N':'R','R':'R','SR':'SR','SSR':'SSR'}[char['rarity']],
          'version':'shared-roster-v1-proposed','balance_status':'PROPOSED','atk':attack+scale,'max_def':defense+scale,
          'character_id':char['id'],'job':char['role'],'skill_name':char['ultimate'],
          'keywords':['guard'] if char['role']=='guardian' else []}
        if char['role'] in ['support','healer']:card['on_play']={'kind':'shield','value':100}
        if char['role']=='assassin':card['keywords']=['haste']
        cards['cards'].append(card)
    cards['shared_roster_version']='shared-roster-v1-proposed'
    write('examples/cards/cards.catalog.json',cards)
    existing={u['id']:u for u in chess['units']}
    for char in characters:
        cost=costs.get(char['id'],{'N':1,'R':2,'SR':3,'SSR':5}[char['rarity']])
        hp,attack,defense=base_roles[char['role']]['chess']
        strength=cost-1
        unit=existing.get(char['id'],{'id':char['id'],'display_name':char['name'],'element':char['element'],'stars':[1,2,3]})
        unit.update(cost=cost,job={'healer':'support','controller':'mage'}.get(char['role'],char['role']),
          baseStats=[hp+strength*75,attack+strength*10,defense+strength*3],
          skill_name=char['ultimate'],balance_status='PROPOSED')
        if char['id'] not in existing:chess['units'].append(unit)
    chess['catalog_version']='shared-roster-v1-proposed'
    write('examples/auto_chess/units.json',chess)
    print(json.dumps({'spirits':len(characters),'cards':len(cards['cards']),'chess_units':len(chess['units'])}))

if __name__=='__main__':main()
