#!/usr/bin/env python3
"""Pack sorted transparent PNG frames into stable-grid atlas pages + JSON.
Example: python build_atlas.py --frames-dir ./idle/E --output-prefix ./atlas/chr_bunbo_idle_e --fps 8 --loop
"""
import argparse, json, math
from pathlib import Path
from PIL import Image

def build(frames_dir: Path, output_prefix: Path, fps: int, loop: bool, anchor, max_size=2048, gutter=2):
    files=sorted(frames_dir.glob('*.png'))
    if not files: raise ValueError(f'No PNG frame found in {frames_dir}')
    ims=[Image.open(p).convert('RGBA') for p in files]
    sizes=set(im.size for im in ims)
    if len(sizes)!=1: raise ValueError(f'Frames must have same size: {sizes}')
    w,h=ims[0].size
    if w+2*gutter>max_size or h+2*gutter>max_size: raise ValueError('Frame exceeds atlas page')
    cols=max_size//(w+2*gutter); rows=max_size//(h+2*gutter); per=cols*rows
    if not per: raise ValueError('No space for frame')
    out=[]; output_prefix.parent.mkdir(parents=True,exist_ok=True)
    for pg in range(math.ceil(len(files)/per)):
        chunk=list(zip(files[pg*per:(pg+1)*per],ims[pg*per:(pg+1)*per]))
        used_cols=min(cols,len(chunk)); used_rows=math.ceil(len(chunk)/used_cols)
        page=Image.new('RGBA',(used_cols*(w+2*gutter),used_rows*(h+2*gutter)),(0,0,0,0))
        frame_meta={}
        for idx,(path,im) in enumerate(chunk):
            cx=idx%used_cols; cy=idx//used_cols
            x=cx*(w+2*gutter)+gutter; y=cy*(h+2*gutter)+gutter
            page.alpha_composite(im,(x,y))
            frame_meta[path.name]={"frame":{"x":x,"y":y,"w":w,"h":h},"sourceSize":{"w":w,"h":h},"anchor":anchor,"frameIndex":pg*per+idx}
        basename=f'{output_prefix.name}_a{pg:02d}'
        png=output_prefix.parent/(basename+'.png'); metadata=png.with_suffix('.json')
        page.save(png,optimize=True)
        metadata.write_text(json.dumps({"format":"som_sprite_atlas_v1","image":png.name,"texture_size":list(page.size),"frames":frame_meta,"animations":{"default":{"frames":[p.name for p,_ in chunk],"fps":fps,"loop":loop}},"gutter_px":gutter},ensure_ascii=False,indent=2),encoding='utf8')
        out.extend([str(png),str(metadata)])
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--frames-dir',required=True,type=Path);p.add_argument('--output-prefix',required=True,type=Path)
    p.add_argument('--fps',type=int,default=12);p.add_argument('--loop',action='store_true')
    p.add_argument('--anchor-x',type=float,default=0.5);p.add_argument('--anchor-y',type=float,default=0.9)
    p.add_argument('--max-size',type=int,default=2048);p.add_argument('--gutter',type=int,default=2)
    a=p.parse_args()
    if a.fps<=0 or a.max_size<=0: p.error('fps and max-size must be positive')
    paths=build(a.frames_dir,a.output_prefix,a.fps,a.loop,[a.anchor_x,a.anchor_y],a.max_size,a.gutter)
    print('\n'.join(paths))
if __name__=='__main__': main()
