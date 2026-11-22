"""Frame-accurate launch film. Run from any directory with python render.py."""
import argparse
import math
import subprocess
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
OUTPUT = ROOT / 'output'
CACHE = ROOT / '.cache'
FPS, W, H, END = 30, 1080, 1920, 33
VOICE = [.12, 4.55, 10.38, 15.23, 23.35]
DEEP, GREEN, GOLD = '#14532D', '#15803D', '#FBBF24'
INK, PAPER, WHITE, MINT = '#17231C', '#F5F9F6', '#FFFFFF', '#DCFCE7'
BORDER, MUTED, GOLD_SOFT = '#DAE3DD', '#55655C', '#FEF3C7'
LOGO = Image.open(ASSETS/'icon-512.png').convert('RGBA')

def ease(t):
    return 1 - (1-min(1,max(0,t)))**3

def glide(t, start, span):
    return ease((t-start)/span)

@lru_cache(None)
def font(size, family, weight):
    path = CACHE / (family+'.ttf')
    if not path.exists():
        ft = TTFont(ASSETS / (family+'.woff2'))
        ft.flavor=None
        ft.save(path)
    f = ImageFont.truetype(str(path),size)
    axes=f.get_variation_axes()
    f.set_variation_by_axes([weight if ax['name']==b'Weight' else ax['default'] for ax in axes])
    return f

def label(im,x,y,s,size,color=INK,body=False,weight=600,anchor='lt'):
    f=font(round(size),'PlusJakartaSans' if body else 'Fredoka',weight)
    ImageDraw.Draw(im).text((round(x),round(y)),s,font=f,fill=color,anchor=anchor)

def box(im,x,y,w,h,fill,r=32,edge=None,width=3):
    ImageDraw.Draw(im).rounded_rectangle((int(x),int(y),int(x+w),int(y+h)),r,fill,outline=edge,width=width)

def panel(im,x,y,w,h):
    box(im,x,y+10,w,h,BORDER,38)
    box(im,x,y,w,h,WHITE,38,BORDER)

def logo(im,cx,cy,size):
    icon=LOGO.resize((int(size),int(size)),Image.Resampling.LANCZOS)
    im.paste(icon,(int(cx-size/2),int(cy-size/2)),icon)

def wordmark(im,x,y,size,light=True):
    label(im,x,y,'JAMB ',size,WHITE if light else INK)
    advance=font(size,'Fredoka',600).getlength('JAMB ')
    label(im,x+advance,y,'Prep',size,GOLD if light else GREEN)

def mark(im,light=True):
    logo(im,116,185,76)
    wordmark(im,175,161,52,light)

def tick(im,x,y,size,color):
    d=ImageDraw.Draw(im)
    d.line([(x-size*.45,y),(x-size*.12,y+size*.32),(x+size*.5,y-size*.4)],fill=color,width=max(3,int(size*.13)),joint='curve')

def tap(im,x,y,age):
    if 0<=age<.45:
        r=12+65*ease(age/.45)
        ImageDraw.Draw(im).ellipse((x-r,y-r,x+r,y+r),outline='#22C55E',width=max(1,int(9*(1-age/.45))))

def option(im,x,y,w,text,key,correct=False):
    fill=MINT if correct else WHITE
    edge=GREEN if correct else BORDER
    box(im,x,y+5,w,87,edge,24)
    box(im,x,y,w,87,fill,24,edge)
    box(im,x+15,y+14,59,59,GREEN if correct else '#E9EFEB',15)
    if correct:tick(im,x+44,y+44,31,WHITE)
    else:label(im,x+44,y+44,key,31,INK,anchor='mm')
    label(im,x+98,y+26,text,33,INK,True)

def backdrop(t,dark):
    im=Image.new('RGB',(W,H),DEEP if dark else PAPER)
    d=ImageDraw.Draw(im)
    # Cropped curves follow the arch on the lower half of the brand mark.
    for i in range(6):
        offset=round(22*math.sin(t*.43))
        d.arc((-560-i*82,1220-i*44+offset,1450+i*82,2360+i*44+offset),188,354,
              fill='#21653B' if dark else '#DCECE0',width=3)
    return im

def footer(im,t,dark):
    for j,(a,b) in enumerate(zip([0,4.45,10.1,15.1,23.2],[4.45,10.1,15.1,23.2,END])):
        x=83+j*175
        box(im,x,1680,155,7,'#39764F' if dark else BORDER,3)
        f=min(1,max(0,(t-a)/(b-a)))
        if f:box(im,x,1680,max(4,155*f),7,GOLD if dark else GREEN,3)

def chip(im,x,y,w,txt,fill,fg,size=33):
    box(im,x,y,w,67,fill,32)
    label(im,x+w/2,y+33,txt,size,fg,anchor='mm')

def hook(im,t):
    mark(im)
    shift=130*(1-glide(t,0,.48))
    label(im,82+shift,435,'Writing',93,MINT)
    label(im,75+shift,560,'JAMB',247,WHITE,weight=700)
    # Digits land separately, with their own slight overshoot.
    for j,n in enumerate('2027'):
        age=max(0,t-.12-j*.08)
        y=802+105*math.exp(-6*age)*math.cos(10*age)
        label(im,70+j*228,y,n,319,GOLD,weight=700)
    d=ImageDraw.Draw(im);ext=glide(t,.65,.65)
    d.line((86,1146,86+851*ext,1146),fill=GOLD,width=8)
    if t>2.55:
        y=1235+110*(1-glide(t,2.55,.36))
        label(im,85,y,'You need to',85,WHITE)
        label(im,85,y+100,'see this!',117,WHITE,weight=700)

def practice(im,t,start,short=False):
    local=t-start;mark(im,False)
    label(im,78,332,'Quick Five' if short else 'Thousands of',99,DEEP)
    label(im,78,448,'Practice round' if short else 'past questions.',79 if short else 104,GREEN)
    y=654+round(165*(1-glide(local,0,.45)))
    panel(im,68,y,920,848)
    chip(im,105,y+39,270 if short else 181,'Use of English' if short else 'Biology',MINT,GREEN,32)
    label(im,916,y+64,'3 / 5' if short else '1 / 5',31,MUTED,anchor='rt')
    box(im,111,y+136,822,15,'#E9EFEB',8)
    box(im,111,y+136,48+(445 if short else 118)*glide(local,.2,.5),15,'#22C55E',8)
    label(im,110,y+201,'Choose the nearest meaning.' if short else 'A deficiency of vitamin C',42 if short else 48,INK,True)
    label(im,110,y+270,'The manager was CANDID' if short else 'in the diet leads to',48,INK,True)
    if short:label(im,110,y+340,'about the losses.',48,INK,True)
    at=.62 if short else 2.1
    answers=['secretive','frank'] if short else ['Scurvy','Rickets','Beriberi','Pellagra']
    correct_index=int(short)
    for i,s in enumerate(answers):
        yy=y+(462 if short else 374)+i*104+26*(1-glide(local,.1+i*.05,.35))
        option(im,112,yy,820,s,'ABCD'[i],i==correct_index and local>=at)
    feedback_y=y+(584 if short else 391)
    tap(im,786,feedback_y+29,local-at)
    if local>at:
        chip(im,700,feedback_y,180,'+2 XP' if short else 'Correct!',GOLD_SOFT if short else GREEN,DEEP if short else WHITE,31)

def free_scene(im,t,start,last=False):
    a=t-start;mark(im)
    label(im,79,550,'The best part?' if last else 'Practise for',89,MINT)
    for i,ch in enumerate('FREE'):
        age=max(0,a-(1.92 if last else 0)-.045*i)
        if last and a<1.92:
            label(im,73,800,'Completely',139,WHITE)
            break
        y=776+(95*math.exp(-9*age)*math.cos(13*age))
        label(im,72+i*218,y,ch,310,GOLD,weight=700)
    if not last or a>2.15:
        box(im,84,1188,825*glide(a,2.12 if last else .15,.4)+4,12,GOLD,6)

def reveal(im,t):
    a=t-10.1
    size=round(120+255*ease(a/.55)+6*math.sin(a*3))
    rise=glide(a,1.7,.65)
    cy=785-335*rise
    logo(im,540,cy,size*(1-.34*rise))
    wordmark(im,284,cy+size*.55-50*rise,105)
    if a>1.7:
        y=865+240*(1-rise)
        box(im,69,y+12,916,674,'#0F4425',42)
        box(im,69,y,916,674,DEEP,42,'#45945E',4)
        label(im,118,y+64,'For JAMB UTME candidates',34,GOLD,True)
        label(im,115,y+150,'Level up for',92,WHITE)
        label(im,115,y+257,'your UTME',99,WHITE)
        label(im,120,y+400,'Quick rounds, instant explanations',36,MINT,True)
        label(im,120,y+454,'and full CBT mocks.',36,MINT,True)
        box(im,118,y+547,780,82,GOLD,24)
        label(im,508,y+588,'Start practising',40,INK,anchor='mm')

@lru_cache(None)
def subject_icon(i):
    name=['BookOpen','Calculator','Atom','FlaskConical','Leaf'][i]
    return Image.open(ASSETS/(name+'.png')).convert('RGBA')

def subjects(im,t):
    a=t-16.55;mark(im,False)
    label(im,80,365,'Pick a subject.',100,DEEP)
    y=640
    panel(im,66,y,925,852)
    label(im,112,y+52,'Subject Practice',66)
    label(im,112,y+155,'Subject',40,MUTED,True)
    entries=[('Use of English','#DBEAFE','#1D4ED8','Aa'),('Mathematics','#EDE9FE','#6D28D9','Â±'),('Physics','#FFEDD5','#C2410C','Î»'),('Chemistry','#FCE7F3','#BE185D','H'),('Biology',MINT,GREEN,'B')]
    for i,(name,soft,fg,glyph) in enumerate(entries):
        x=110+145*(1-glide(a,i*.055,.43));yy=y+230+i*112
        selected=i==1 and a>.7
        box(im,x,yy,831,95,MINT if selected else WHITE,23,GREEN if selected else BORDER)
        box(im,x+16,yy+13,70,69,soft,16)
        icon=subject_icon(i)
        im.paste(icon,(round(x+25),round(yy+21)),icon)
        label(im,x+106,yy+26,name,39)
        if selected:tick(im,x+765,yy+46,39,GREEN)
    tap(im,800,y+386,a-.7)

def games(im,t):
    a=t-18.65;mark(im,False)
    label(im,80,340,'Play Concord.',105,DEEP)
    label(im,82,490,'Drag a word into the gap.',42,MUTED,True)
    panel(im,68,665,920,608)
    label(im,112,732,'is or are?',62)
    d=ImageDraw.Draw(im)
    for i in range(15):box(im,114+i*53,854,43,14,'#22C55E' if i==0 and a>1 else BORDER,6)
    label(im,115,1010,'The book',56)
    box(im,383,979,158,100,'#E6F4EA',23,GREEN)
    label(im,562,1010,'on the table.',55)
    f=glide(a,.32,.72)
    x=140+243*f;y=1340-361*f
    box(im,584,1340,302,97,WHITE,24,BORDER)
    label(im,735,1388,'are',56,anchor='mm')
    box(im,x,y,301-143*f,98,GREEN if f==1 else WHITE,24,GREEN)
    label(im,x+(301-143*f)/2,y+49,'is',56,WHITE if f==1 else DEEP,anchor='mm')
    if f==1:chip(im,126,1160,197,'Correct!',MINT,GREEN)

def board(im,t):
    a=t-20.6;mark(im,False)
    label(im,79,340,'Climb the',89,DEEP);label(im,79,452,'leaderboard.',106,GREEN)
    panel(im,69,680,922,737)
    label(im,116,746,'Leaderboard',68)
    label(im,118,842,'Top students by XP.',36,MUTED,True)
    for i,s in enumerate(['This week','This month','All time']):
        box(im,115+i*281,938,264,74,MINT if i==0 else WHITE,22,GREEN if i==0 else BORDER)
        label(im,247+i*281,975,s,31,DEEP,anchor='mm')
    for i,(name,xp) in enumerate([('Ada',128),('Tomi',104),('You',86)]):
        y=1050+i*111+45*(1-glide(a,.08*i,.41))
        box(im,109,y,840,94,'#E6F4EA' if i==2 else WHITE,16)
        chip(im,121,y+14,70,str(i+1),[GOLD,BORDER,'#FFEDD5'][i],INK)
        label(im,214,y+25,name,41)
        chip(im,719,y+15,197,str(xp)+' XP',GOLD_SOFT,'#713F12',29)
    label(im,108,1476,'Weekly board preview',29,MUTED,True)

def endcard(im,t):
    a=t-26.7
    logo(im,540,500,225+round(16*math.exp(-max(0,a)*3)*math.sin(7*a)))
    wordmark(im,290,674,101)
    label(im,540,922,'Your JAMB preparation',75,WHITE,anchor='mt')
    label(im,540,1021,'just got easier.',88,WHITE,anchor='mt')
    y=1260+80*(1-glide(a,.22,.48))
    box(im,103,y+10,874,124,'#B78313',37)
    box(im,103,y,874,124,GOLD,37)
    label(im,540,y+61,'Start Practising for FREE',59,INK,anchor='mm')
    label(im,540,1462,'Website in caption',40,MINT,True,anchor='mt')

CUTS=[(0,True,hook),(4.45,False,lambda im,t:practice(im,t,4.45)),(8.76,True,lambda im,t:free_scene(im,t,8.76)),(10.1,True,reveal),(15.1,False,lambda im,t:practice(im,t,15.1,True)),(16.55,False,subjects),(18.65,False,games),(20.6,False,board),(23.2,True,lambda im,t:free_scene(im,t,23.2,True)),(26.7,True,endcard)]

def scene(i,t):
    start,dark,draw=CUTS[i]
    im=backdrop(t,dark);draw(im,t);footer(im,t,dark)
    return im

def frame(t):
    i=max(i for i,c in enumerate(CUTS) if t>=c[0])
    im=scene(i,t);age=t-CUTS[i][0]
    if i and age<.23:
        old=scene(i-1,CUTS[i][0]-.001)
        edge=int((H+300)*glide(age,0,.23))-150
        mask=Image.new('L',(W,H));d=ImageDraw.Draw(mask)
        d.polygon([(0,0),(W,0),(W,edge-110),(0,edge+100)],fill=255)
        im=Image.composite(im,old,mask)
    return im

def soundtrack():
    sr=48000
    voice=np.zeros((END*sr,2),dtype=np.float32)
    def load(path):
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(sr),'-ac','2','-'])
        return np.frombuffer(raw,'<f4').reshape(-1,2)
    def add(track,clip,sec,volume):
        begin=round(sec*sr);n=min(len(clip),len(track)-begin)
        track[begin:begin+n]+=clip[:n]*volume
    for i,start in enumerate(VOICE,1):
        add(voice,load(ASSETS/f's{i}_t.mp3'),start,1)
    def save(name,data):
        with wave.open(str(OUTPUT/name),'wb') as f:
            f.setparams((2,2,sr,0,'NONE','not compressed'))
            f.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
    save('Narration.wav',voice)
    mix=voice.copy();add(mix,load(ASSETS/'music.wav'),0,.16)
    for name,points,vol in [('pop',[.34,3.21,16.55,17.25,27.1],.15),('whoosh',[4.36,8.67,14.99,18.56,20.51,23.11,26.60],.11),('correct',[6.55,15.72,19.69],.17),('reveal',[10.32,25.64],.15)]:
        snd=load(ASSETS/f'sfx_{name}.wav')
        for point in points:add(mix,snd,point,vol)
    mix[-sr:]*=np.linspace(1,0,sr)[:,None]
    mix*=.91/max(.91,float(np.max(np.abs(mix))))
    save('mix.wav',mix)

def render(preview=False):
    OUTPUT.mkdir(exist_ok=True);CACHE.mkdir(exist_ok=True)
    soundtrack()
    if preview:
        times=[1.6,3.5,7.2,9.5,11.3,13.5,16.05,17.6,19.9,21.7,25.8,30.5]
        sheet=Image.new('RGB',(6*216,2*384))
        for i,t in enumerate(times):
            sheet.paste(frame(t).resize((216,384),Image.Resampling.LANCZOS),((i%6)*216,(i//6)*384))
        sheet.save(OUTPUT/'Storyboard.jpg',quality=94);return
    cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUTPUT/'mix.wav'),'-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-af','volume=5dB','-c:a','aac','-b:a','192k','-movflags','+faststart',str(OUTPUT/'JAMBPrep-2027-Launch.mp4')]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
        for n in range(END*FPS):proc.stdin.write(frame(n/FPS).tobytes())
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Video encoding failed')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',action='store_true')
    render(parser.parse_args().preview)
