"""Package a generated original as a full-resolution web asset and record provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def register(identity, source):
    path = ROOT/'docs/02_art/SPLASH_ART_JOBS.json'
    manifest = json.loads(path.read_text())
    job = next(j for j in manifest['jobs'] if j['id'] == identity)
    source = Path(source)
    image = Image.open(source)
    if image.width < 1000 or image.height < 1400: raise ValueError(f'Art is not portrait HD: {image.size}')
    target = ROOT/job['destination']
    target.parent.mkdir(parents=True,exist_ok=True)
    # Encoding only: retain the generated composition and native dimensions.
    image.convert('RGB').save(target,'WEBP',quality=94,method=6)
    preview_path = f'client/assets/splash/previews/{identity}.webp'
    preview = image.convert('RGB')
    preview.thumbnail((512,768),Image.Resampling.LANCZOS)
    (ROOT/preview_path).parent.mkdir(parents=True,exist_ok=True)
    preview.save(ROOT/preview_path,'WEBP',quality=82,method=6)
    job.update(status='generated',source_file=source.name,source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
      sha256=hashlib.sha256(target.read_bytes()).hexdigest(),width=image.width,height=image.height,bytes=target.stat().st_size,
      generator='built-in image_gen',generation_prompt=job['prompt'],review='generated; visual QA and final human art approval pending')
    job.update(preview=preview_path,preview_bytes=(ROOT/preview_path).stat().st_size,
      preview_sha256=hashlib.sha256((ROOT/preview_path).read_bytes()).hexdigest())
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    temporary.replace(path)
    print(json.dumps({'id':identity,'destination':job['destination'],'width':image.width,'height':image.height,'bytes':target.stat().st_size}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--id',required=True);parser.add_argument('--source',required=True)
    args=parser.parse_args();register(args.id,args.source)
