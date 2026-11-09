#!/usr/bin/env python3
"""Create preview GIF from transparent PNG frames (review-only, never ship as runtime sprite)."""
import argparse
from pathlib import Path
from PIL import Image

def preview(frames_dir:Path,out:Path,fps=12,scale=1):
    files=sorted(frames_dir.glob('*.png'))
    if not files: raise ValueError('No frames')
    im=[Image.open(p).convert('RGBA') for p in files]
    if scale!=1: im=[f.resize((max(1,int(f.width*scale)),max(1,int(f.height*scale))),Image.Resampling.NEAREST) for f in im]
    # composite on checker grey for review; GIF transparency is limited
    frames=[]
    for f in im:
        bg=Image.new('RGBA',f.size,(235,230,222,255));bg.alpha_composite(f);frames.append(bg.convert('P',palette=Image.Palette.ADAPTIVE))
    out.parent.mkdir(parents=True,exist_ok=True)
    frames[0].save(out,save_all=True,append_images=frames[1:],loop=0,duration=round(1000/fps),optimize=False,disposal=2)
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--frames-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--fps',type=int,default=12);p.add_argument('--scale',type=float,default=1.0);a=p.parse_args()
    if a.fps<=0 or a.scale<=0:p.error('FPS and scale must be positive')
    print(preview(a.frames_dir,a.output,a.fps,a.scale))
if __name__=='__main__':main()
