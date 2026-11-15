"""Build the runtime's ID-based illustration registry from completed assets."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def build():
    jobs=json.loads((ROOT/'docs/02_art/SPLASH_ART_JOBS.json').read_text())['jobs']
    cards=json.loads((ROOT/'examples/cards/cards.catalog.json').read_text())['cards']
    characters=json.loads((ROOT/'client/src/modes/metaCatalog.json').read_text())['characters']
    available={j['id']:j for j in jobs if j['status']=='generated'}
    def asset(job):
        return {'preview':'./'+job['preview'].removeprefix('client/'),
          'hd':'./'+job['destination'].removeprefix('client/'),'width':job['width'],'height':job['height']}
    card_art={c['card_id']:asset(available[c['card_id']]) for c in cards if c['card_id'] in available}
    spirit_art={}
    for spirit in characters:
        card=next((c for c in cards if c.get('character_id')==spirit['id'] and c['card_id'] in card_art),None)
        if card:spirit_art[spirit['id']]=card_art[card['card_id']]
    catalog={'schema':1,'cards':card_art,'characters':spirit_art,
      'back':asset(available['soul_of_meal_back']) if 'soul_of_meal_back' in available else None,
      'coverage':{'cards':len(card_art),'characters':len(spirit_art)},
      'hdFiles':[j['destination'] for j in available.values()]}
    value=json.dumps(catalog,ensure_ascii=False,indent=2)+'\n'
    for path in ['client/src/render/splashCatalog.json','client/assets/splash/manifest.json']:
        target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(value)
    print(json.dumps(catalog['coverage']))
if __name__=='__main__':build()
