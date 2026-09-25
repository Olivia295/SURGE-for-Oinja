"""Original seamless harbor surface textures, no external images or dependencies."""
import math,struct,zlib,random,pathlib
OUT=pathlib.Path(__file__).resolve().parents[2]/'public/assets/environment'
N=512

def png(name,pixel):
    raw=bytearray()
    for y in range(N):
        raw.append(0)
        for x in range(N):
            v=max(0,min(255,int(pixel(x,y))))
            raw.extend((v,v,v))
    def chunk(t,data):
        return struct.pack('>I',len(data))+t+data+struct.pack('>I',zlib.crc32(t+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',N,N,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    (OUT/(name+'.png')).write_bytes(data)

def noise(x,y):return ((x*1836311903^y*2971215073^(x*y*17))&255)/255

def brick(x,y):
    row=y//32;xx=(x+(row%2)*32)%64;yy=y%32
    mortar=xx<2 or yy<2
    if mortar:return 155+noise(x,y)*9
    edge=min(xx,64-xx,yy,32-yy)
    return 202+noise(x,y)*28+(math.sin((x//64+row)*15.3)*12)-(7 if edge<4 else 0)

def concrete(x,y):
    waves=math.sin(x*math.pi/128)*math.cos(y*math.pi/256)+math.sin(y*math.pi/64)*.3
    return 226+waves*8+(noise(x,y)-.5)*14

def asphalt(x,y):return 204+(noise(x,y)-.5)*33+(17 if noise(y+31,x+11)>.97 else 0)

def rust(x,y):return 205+math.sin(x*math.pi/64+math.sin(y*math.pi/128))*14+math.cos(y*math.pi/32)*7+(noise(x,y)-.5)*23

def wood(x,y):return 218+math.sin(y*math.pi/8+math.sin(x*math.pi/256))*15+(noise(x,y)-.5)*13

OUT.mkdir(parents=True,exist_ok=True)
for name,pixel in [('brick',brick),('concrete',concrete),('asphalt',asphalt),('rust',rust),('wood',wood)]:png(name,pixel)
print('Generated five original 512px seamless surface textures.')
