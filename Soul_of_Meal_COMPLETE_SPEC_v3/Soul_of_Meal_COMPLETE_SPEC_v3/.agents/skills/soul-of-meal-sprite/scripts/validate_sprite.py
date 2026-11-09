#!/usr/bin/env python3
"""Check sprite manifest references, frame transparency, size, safe border and file names.
Example: python validate_sprite.py --manifest /path/character.sprite.json --root /path/project --strict
"""
import argparse, json, re, hashlib
from pathlib import Path
from PIL import Image

def validate(manifest_path, root, strict=False):
    data=json.loads(manifest_path.read_text(encoding='utf8'))
    issues=[]; warnings=[]; seen_hash={}; checked=0
    cid=data.get('character_id','');skin=data.get('skin_id','')
    if not re.fullmatch(r'chr_[a-z0-9_]+',cid): issues.append('Invalid character ID')
    if not re.fullmatch(r'[a-z0-9_]+',skin): issues.append('Invalid skin ID')
    size=data.get('frame_size_px',[512,512]); expected=tuple(size)
    anims=data.get('animations',{})
    if not isinstance(anims,dict) or not anims: issues.append('No animations specified')
    for clip,clipdef in anims.items():
        if clipdef.get('fps',0)<=0: issues.append(f'{clip}: fps must be positive')
        for direction,dirdef in clipdef.get('directions',{}).items():
            files=dirdef.get('frames',[])
            if strict and not files: issues.append(f'{clip}/{direction}: empty frame list')
            for i,f in enumerate(files):
                path=root/f
                if not path.exists():issues.append(f'Missing: {f}');continue
                if path.suffix.lower()!='.png':issues.append(f'Not PNG: {f}');continue
                with Image.open(path) as im:
                    if im.mode!='RGBA': issues.append(f'Not RGBA: {f} (mode={im.mode})')
                    if im.size!=expected: issues.append(f'Wrong size: {f}: {im.size}, expected {expected}')
                    rgba=im.convert('RGBA');a=rgba.getchannel('A')
                    ext=a.getextrema()
                    if ext[0]==255: issues.append(f'Opaque background or no alpha: {f}')
                    if ext[1]==0:issues.append(f'Fully transparent frame: {f}')
                    nonzero=a.point(lambda x: 255 if x>8 else 0)
                    bbox=nonzero.getbbox()
                    if bbox:
                        if min(bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3])<8:
                            (issues if strict else warnings).append(f'Pose touches 8px safety border: {f}, bbox={bbox}')
                    digest=hashlib.sha256(path.read_bytes()).hexdigest()
                    if digest in seen_hash:
                        (issues if strict else warnings).append(f'Duplicate pixel frame: {f} same as {seen_hash[digest]}')
                    else: seen_hash[digest]=f
                checked+=1
    if data.get('rights_status') not in ('approved','licensed','original_verified'):
        warnings.append('License status not approved; do not ship to production')
    if data.get('identity_review')!='approved': warnings.append('Identity not yet human-approved')
    return {'character_id':cid,'checked_frames':checked,'errors':issues,'warnings':warnings,'pass':not issues}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--manifest',required=True,type=Path);p.add_argument('--root',type=Path,default=Path('.'))
    p.add_argument('--strict',action='store_true');p.add_argument('--report',type=Path)
    args=p.parse_args();report=validate(args.manifest,args.root,args.strict)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if args.report:args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    raise SystemExit(0 if report['pass'] else 1)
if __name__=='__main__': main()
