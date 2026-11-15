"""Prepare deterministic briefs for individual generated illustrations; no AI API calls."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS = json.loads((ROOT / 'client/src/modes/metaCatalog.json').read_text())['characters']
CARDS = json.loads((ROOT / 'examples/cards/cards.catalog.json').read_text())['cards']
SCENES = {
 'card_demo_01': 'Scarlet-haired chef-warrior sweeping a flaming curved blade inside a grand Vietnamese kitchen, brass broth cauldron, star anise, cinnamon and red-gold steam.',
 'card_demo_02': 'Silver-blue-haired water mage conducting luminous noodle-like water ribbons across a moonlit Vietnamese harbor, lotus lanterns and glowing broth steam.',
 'card_demo_03': 'Green-haired leaf-fan fairy opening a spiral garden of mint, basil, coriander and translucent rice-paper magic, luminous vines framing a sunlit spice greenhouse.',
 'card_demo_04': 'Joyful round white bun mascot with chef hat and wooden spoon conjuring a golden protective steam dome at a village dumpling stall, bamboo steamers glowing behind.',
 'card_demo_05': 'Plum-black-haired coffee assassin wielding the reference twin curved daggers in a midnight Vietnamese coffee courtyard, copper phin filters and dark aromatic ribbons.',
 'card_demo_06': 'The small red pepper boxer from the identity reference springing from a volcanic spice oven, seed sparks and flaming pepper leaves, mischievous determined face.',
 'card_demo_07': 'Original small aqua water spirit with translucent flowing blue hair, turquoise eyes, white and aqua robes, floating inside a luminous spring grotto, lotus and bubble magic.',
 'card_demo_08': 'The happy green mushroom mascot from the identity reference exploring enormous bioluminescent mushrooms and ancient forest roots, jade motes and teal scarf in motion.',
 'card_demo_09': 'Brown-haired village herbalist Lilia in her green-and-cream apron preparing enchanted soup inside a welcoming Vietnamese woodland restaurant, herbs and golden lanterns.',
 'card_demo_10': 'A scarlet-gold culinary flame blade slashing a bright crescent through a dark volcanic kitchen, red spice petals and a sharp glowing impact trail. Focus on the blade and motion.',
 'card_demo_11': 'A turquoise wave shaped like a water spear surging through a moonlit harbor gate, vapor ribbons and suspended glowing droplets, dynamic diagonal thrust.',
 'card_demo_12': 'Green basil and mint leaves whirling around a translucent rice-paper spiral in a wind-swept spice forest, magical jade gust cutting a path through mist.',
 'card_demo_13': 'A warm golden cooking lantern illuminating an otherwise dark ancient spice forest, rays revealing a safe path and tiny glowing culinary spirits.',
 'card_demo_14': 'A hidden enchanted bronze frying pan trap snapping upward from a carved kitchen floor, a golden reversal vortex redirecting a red magical projectile.',
 'card_demo_15': 'A violet culinary sealing sigil clamping around a hostile spell above a midnight ritual bowl, shattered dark glyph shapes without actual letters.',
 'card_demo_16': 'A deceptive veil of glowing red ash and ember silhouettes obscuring paths through a ruined spice kitchen, ominous beautiful curling smoke.',
 'card_demo_17': 'A concentrated bright ember exploding from a single red chili seed over a charcoal brazier, close-up dramatic fire burst and flying star anise.',
 'card_demo_18': 'One luminous dew drop suspended above a blue lotus leaf, reflecting an enchanted Vietnamese harbor and scattering soothing turquoise light.',
 'card_fire_guard': 'The scarlet chef-warrior bracing a fire blade across a bronze kitchen gate, protective red-gold flame wall behind her, distinct defensive pose.',
 'card_tide_mage': 'The silver-blue-haired mage performing a circular mist ritual on a narrow moonlit bridge, blue lotus staff raised, layered tide ribbons and glowing water beads.',
 'card_wood_scout': 'The green leaf-fan fairy scouting ahead along a giant tree-root trail, sunbeams and fresh herbs marking the route, adventurous three-quarter pose.',
 'card_shadow_duelist': 'The plum-haired coffee assassin lunging with twin curved daggers across a lantern-lit cafe rooftop, copper coffee particles and purple shadow duplicates.',
 'card_spirit_renewal': 'An enchanted bowl of herbal broth restoring a withered garden, luminous green healing rings, new basil shoots and softly glowing leaves.',
 'card_spirit_ward': 'A brilliant golden-white steam shield emerging from a bamboo bun steamer, translucent protective dome and soft pearl motes around a village hearth.',
 'card_spirit_rally': 'A line of enchanted cooking blades rising above a burning red battle banner at a volcano fortress kitchen, exhilarating forward momentum and gold sparks.',
 'card_hearth_pepper': 'The red pepper boxer balancing on a charcoal brazier in a dark kiln, warm ember-lit fists and tiny coal sparks, cheeky ready-to-fight pose.',
 'card_jade_mushroom': 'The green mushroom mascot sheltering among massive ancient jade roots, broad glowing cap and moss-covered guardian stones, reassuring ancient-forest mood.',
 'card_rain_keeper': 'The silver-blue water mage kneeling to restore a clear spring, staff touching the water, lotus reflections and protective rain curtains in a forest glade.',
 'card_lantern_guard': 'Herbalist Lilia holding a golden cooking lantern against a violet curse at the village entrance, green apron and flowing brown hair, courageous guardian pose.',
 'card_shadow_hunter': 'The plum-haired coffee assassin stalking across a misty ruined cafe balcony, twin daggers reflecting a crescent moon, deep espresso shadows and aromatic ribbons.',
 'card_trap_mirror': 'An enchanted circular water mirror hovering above a porcelain soup bowl, catching and reflecting a red fire projectile back through a blue ripple portal.',
 'card_trap_roots': 'Thick luminous basil roots and jade vines erupting from beneath a carved stone threshold, a hidden leaf snare closing with green sparks.',
 'card_trap_embers': 'A concealed chili-seed ember mine igniting beneath a volcanic kitchen walkway, fiery ambush blooming from subtle red fissures and ash.',
 'card_trap_rally': 'A jade serving tray opening into a radiant shield formation over a banquet table, pearl dumplings glowing like guardian stars, protective warm light.',
 'card_trap_recall': 'A shattered violet spirit silhouette reforming above a dark coffee cup and copper phin filter, moonlit aromatic ribbons weaving a return path.',
 'card_trap_reserve': 'An old wooden spice chest springing open in a forest storeroom, enchanted herbs and emerald ingredient crystals rising in a luminous reserve spiral.',
 'card_ultimate_fire': 'The scarlet chef-warrior unleashing a spectacular multi-arc fire-blade dance inside a volcano grand kitchen, massive broth steam dragon shape and crimson spice flowers.',
 'card_ultimate_water': 'The silver-blue mage raising a colossal turquoise tide above a fantasy harbor, lotus staff conducting cascading water ribbons and luminous broth steam.',
 'card_ultimate_wood': 'The green-haired fairy opening a great rice-paper and herb lotus in a ruined spice garden, restorative green light and vines returning life to fallen leaves.',
 'card_ultimate_light': 'The round white bun mascot joyfully lifting its wooden spoon to create a monumental golden steam sanctuary above a bamboo-steamer village kitchen.',
 'card_ultimate_shadow': 'The plum-haired coffee assassin splitting a moonlit shadow with crossed twin daggers, espresso-black and violet energy slicing through a ruined cafe hall.',
 'card_tcg_disarm': 'A radiant jade-and-gold culinary seal cracking a hidden violet trap sigil over an ancient kitchen altar, beautiful fragments and cleansing light.',
 'card_tcg_scout': 'A floating clear-water lens revealing glowing hidden trap patterns on a misty stone pathway, blue droplets and a small lotus bowl in foreground.',
 'card_tcg_refute': 'A violet mirror-like culinary counterspell folding a hostile golden magic stream back into a dark porcelain bowl, elegant crossing ribbons of light and shadow.',
 'card_tcg_resupply': 'An abundant Vietnamese spice pantry opening into a magical emerald landscape, neatly arranged cinnamon, star anise, mint and fresh ingredients floating toward the viewer.',
 'card_tcg_tonic': 'A golden herbal tonic in a delicate porcelain bowl radiating soothing white-gold energy, ginseng, lotus seeds and soft healing steam inside a sunlit kitchen.',
 'card_ember_runner': 'The small pepper boxer charging across a blazing royal kitchen hearth, athletic forward leap, chili-shaped fire trails and red-gold spice sparks.',
 'card_mist_keeper': 'The silver-blue water mage standing on a foggy wooden harbor pier at dawn, lotus staff lowered, luminous tide swirling beneath her and fishing lanterns in the mist.',
 'card_sprout_guard': 'The green-haired leaf-fan fairy shielding a tiny glowing jade seedling beneath giant spice leaves, protective translucent rice-paper ribbons and warm forest light.',
 'card_jade_watch': 'The round white bun mascot standing guard at an ornate jade kitchen doorway, wooden spoon held like a staff, bamboo steam clouds forming a luminous shield.',
 'card_night_reaper': 'The plum-haired coffee assassin harvesting glowing moonlit coffee blossoms with twin curved daggers, purple aromatic spirits rising over a terraced night garden.',
 'card_ember_break': 'A concentrated red-gold flame strike shattering a heavy crystalline shield above a volcanic cooking anvil, explosive fragments frozen at the moment of impact.',
 'card_mist_recall': 'A retreating turquoise tide curling through a lantern harbor and carrying a translucent spirit safely home, flowing water arch and cool serene lighting.',
 'card_mist_dampen': 'Cool blue-white mist gently extinguishing a fierce red magical hearth, glowing water droplets suspended around cinnamon embers, strong warm-to-cool contrast.',
 'card_leaf_reclaim': 'An emerald sprout growing from a fallen leaf and cracked jade bowl in an ancient garden, circular living roots reclaiming lost magical energy.',
 'card_jade_encore': 'A luminous jade spoon and golden shield reforming above a bamboo steamer, radiant comeback energy sweeping across a royal kitchen floor.',
 'card_night_feast': 'An extravagant midnight Vietnamese culinary banquet with glowing coffee, lotus sweets and purple aromatic magic, elegant shadow ribbons circling golden plates.',
 'card_trap_mist': 'A concealed trap of dense luminous blue fog folding around a stone harbor passage, frost droplets and softly glowing lotus petals concealing the path.',
 'card_trap_jade': 'An ornate square jade guardian seal anchored in a kitchen threshold, golden-white protective wings of steam holding back a red magical strike.',
 'card_trap_night': 'A hidden violet coffee-aroma curse lingering inside an abandoned lantern cafe, crescent echoes and purple vapor curling from a copper phin filter.',
}

STYLE = ('Use case: stylized-concept. Asset: one finished individual portrait 2:3 full-art illustration for original Soul of Meal Vietnamese culinary fantasy TCG. '
 'Premium detailed anime chibi fantasy, expressive faces, clean intricate linework, painterly cinematic light, rich foreground/midground/background depth. '
 'The first reference, if present, locks the subject identity: preserve face, hair, costume, colors, weapon and food motifs; create a NEW pose and coherent scene, never paste a cutout. '
 'A second reference is finish/style guidance only; do not copy its character into this scene. '
 'Make a readable central focal subject occupying roughly 60-70% of canvas, elegant dynamic composition, full bleed with a quieter lower edge for software UI. '
 'The collectible narrative richness can evoke premium fantasy trading-card illustrations, but retain original Soul of Meal characters. '
 'NO text, numbers, typography, borders, logos, watermark, Pokemon creatures, pokeballs, collage or multiple panels. ')

SCENE_STYLE = ('Use case: stylized-concept. One individual portrait 2:3 full-bleed SPELL OR TRAP illustration for the original Soul of Meal culinary fantasy TCG. '
 'Paint only the magical object, spell effect and environment described below. This is an object/environment illustration, NOT a character card. '
 'Premium detailed hand-painted anime fantasy, luminous culinary elemental magic, cinematic depth, intricate foreground and atmospheric background, crisp material details and elegant powerful composition. '
 'ABSOLUTELY NO people, humans, humanoids, faces, girls, boys, mascots, hands, character portraits or figures anywhere. '
 'NO text, numbers, lettering, UI, card borders, logos, watermark, Pokemon imagery, collage or multiple panels. ')

def main():
    by_id = {c['id']: c for c in CHARACTERS}
    jobs = []
    for card in CARDS:
        identity = card.get('character_id') or card.get('requires_character') or {
          'card_demo_10':'chr_bunbo_holinh','card_demo_11':'chr_pho_lamvu',
          'card_demo_12':'chr_goicuon_diepnhi','card_demo_13':'chr_banhbao_bachngoc'}.get(card['card_id'])
        ref = f'client/assets/original/actors/{identity}.webp' if identity else None
        if ref and not (ROOT / ref).is_file(): ref = None
        jobs.append({'id': card['card_id'], 'kind': 'card', 'name': card['display_name'], 'character_id': card.get('character_id'),
          'reference': ref, 'destination': f"client/assets/splash/cards/{card['card_id']}.webp", 'prompt': (STYLE if card['type']=='unit' or identity else SCENE_STYLE) + 'Scene: ' + SCENES.get(card['card_id'],
          f"{card['display_name']}. {by_id.get(identity,{}).get('lore','')} Actively perform {by_id.get(identity,{}).get('ultimate','culinary magic')} in an atmospheric culinary fantasy location matching the element. Preserve the reference face, costume, weapon and food motifs.")
          + (' If this scene describes a spell, trap, object or scenery, make that subject the main focus; do not invent an unrelated person.' if card['type']!='unit' else ''), 'status': 'pending'})
    represented = {c.get('character_id') for c in CARDS}
    settings = {'fire':'a grand volcanic spice kitchen and red-gold culinary magic', 'water':'an enchanted ocean harbor with blue lotus and turquoise water magic',
      'wood':'a luminous forest spice garden with jade leaves and giant roots', 'light':'a sunlit Vietnamese fantasy village kitchen with golden lanterns and protective steam',
      'shadow':'a moonlit culinary ruin with violet aromatic magic and copper details'}
    for char in CHARACTERS:
        if char['id'] in represented: continue
        scene = f"{char['name']}: {char['lore']} Signature ability: {char['ultimate']} — {char['concept']}. Show this character actively using that culinary magic in {settings[char['element']]}. Preserve the reference identity, props and apparent age."
        jobs.append({'id':char['id'],'kind':'character','name':char['name'],'character_id':char['id'],
          'reference':f"client/assets/original/actors/{char['id']}.webp",'destination':f"client/assets/splash/characters/{char['id']}.webp",'prompt':STYLE+'Scene: '+scene,'status':'pending'})
    jobs.append({'id':'soul_of_meal_back','kind':'back','name':'Soul of Meal card back','reference':None,
      'destination':'client/assets/splash/card-back.webp','status':'pending','prompt':
      'One original premium fantasy trading card BACK design for Soul of Meal, portrait 2:3. Perfectly centered 180-degree rotationally symmetric ornamental design, deep jade and midnight teal enamel, intricate warm gold filigree, Vietnamese culinary motifs of lotus, star anise, rice grains, leaf scrolls and steam. Center a round radiant five-element culinary sigil around a stylized wooden spoon and bowl. Rich tactile collectible lacquer finish, elegant balanced border inset from all edges, no characters, no text, no numbers, no logos, no Pokemon or pokeball imagery. Full bleed, extremely crisp ornament and restrained magical glow.'})
    target = ROOT/'docs/02_art/SPLASH_ART_JOBS.json'
    if target.exists():
        old = {x['id']:x for x in json.loads(target.read_text())['jobs']}
        merged=[]
        for job in jobs:
            prior=old.get(job['id'],{})
            if prior.get('status')=='generated':prior.setdefault('generation_prompt',prior['prompt'])
            saved={key:value for key,value in prior.items() if key not in ['prompt','reference','destination','name','kind','character_id']}
            merged.append({**job,**saved})
        jobs=merged
    target.write_text(json.dumps({'schema':1,'generator':'built-in image_gen','jobs':jobs},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cards':len(CARDS),'spirits':len(CHARACTERS),'individual_artworks':len(jobs)},ensure_ascii=False))

if __name__ == '__main__': main()
