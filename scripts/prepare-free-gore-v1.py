"""Download public CC0 HQ previews and prepare isolated demo audio assets.

This does not edit the game's active audio manifest, mixer or running server.
Requires Python and FFmpeg; no accounts, tokens or paid providers.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
import array
import base64
import hashlib
import html
import json
import math
import os
import re
import subprocess
import ssl
import wave

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.art-source/free-gore-v1'
OUTPUT = ROOT / 'assets/audio/free-gore-v1'
FFMPEG = Path('C:/Program Files/ImageMagick-7.1.0-Q16-HDRI/ffmpeg.exe')
RATE = 44100
LICENSE = 'https://creativecommons.org/publicdomain/zero/1.0/'
SOUNDS = [
    {'key':'roach-swarm','id':380769,'author':'szczur_banshee','title':'BS _Swarm of roaches.wav','count':2,'seconds':1.25,'highpass':180,'use':['vermin-swarm-warning','vermin-swarm'],'description':'Real cockroaches recorded in a box near a microphone.'},
    {'key':'roach-scrabble','id':767054,'author':'ThabzMalik','title':'Cockroaches scurrying and scratching within a cage','count':3,'seconds':.72,'highpass':180,'use':['vermin-crawl','vermin-pickup'],'description':'Real indoor cockroach tapping, scratching and rustling.'},
    {'key':'rat-chew','id':154477,'author':'lucaslara','title':'Rat Nibbling_1-2.aif','count':3,'seconds':.75,'highpass':90,'use':['vermin-bite','vermin-infest'],'description':'Real rat nibbling and breathing near a microphone; not a recorded attack.'},
    {'key':'rat-squeak','id':536753,'author':'egomassive','title':'Rat.ogg','count':1,'seconds':1.1,'highpass':80,'use':['vermin-pickup','vermin-bite'],'description':'Processed rodent squeak derived from Shyguy014 Mouse Squeaks, also identified as CC0 by the uploader. Not an independently recorded rat vocalization.'},
    {'key':'flesh-squish','id':269482,'author':'editor_adp','title':'Gooey Squish','count':1,'seconds':.9,'highpass':45,'use':['brutal-contact','brutal-extract','vermin-infest'],'description':'Recorded wet squishing foley; Zoom H4n built-in microphones.'},
    {'key':'blood-spit','id':237386,'author':'squareal','title':'Spitting Blood 01.wav','count':3,'seconds':.65,'highpass':55,'use':['bite-start','bite-damage','bite-release','vermin-infest'],'description':'Liquid spitting foley recorded using Sennheiser 416 and Sound Devices 552.'},
    {'key':'bone-crunch','id':765085,'author':'getwecked','title':'macaroni crunch','count':1,'seconds':.8,'highpass':65,'use':['brutal-contact','bite-terminal'],'description':'Dry macaroni compressed between rocks, recorded using Samson C01UPRO; bone/crush foley rather than actual injury.'},
    {'key':'gut-gurgle','id':784955,'author':'newlocknew','title':'LIQMisc_Gurgling And Squelching Sounds.A Puddle In The Forest 1_EM','count':3,'seconds':1.1,'highpass':45,'use':['brutal-extract','brutal-release','vermin-infest'],'description':'Recorded mud/puddle squelching, post-processed by uploader; a design layer for viscera rather than literal organ audio.'},
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fetch(url, max_bytes=20_000_000):
    request = Request(url, headers={'User-Agent':'TheLastDead-CC0-Demo-Assets/1.0'})
    try:
        with urlopen(request, timeout=25) as response:
            data=response.read(max_bytes+1)
            if len(data)>max_bytes:
                raise RuntimeError('Download exceeds bounded asset size')
            return data, response.headers.get('Content-Type','')
    except URLError as error:
        if os.name!='nt' or not isinstance(error.reason,ssl.SSLCertVerificationError):
            raise
        # The bundled Python CA store is stale on this host. Use Windows'
        # verified HTTPS stack; never disable TLS certificate verification.
        environment=os.environ.copy();environment['THELASTDEAD_ASSET_URL']=url
        command="$ErrorActionPreference='Stop'; $response=Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 -Uri $env:THELASTDEAD_ASSET_URL; $bytes=$response.RawContentStream.ToArray(); if($bytes.Length -gt 20000000){throw 'Asset size limit'}; @{mime=[string]$response.Headers['Content-Type'];data=[Convert]::ToBase64String($bytes)} | ConvertTo-Json -Compress"
        response=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],env=environment,capture_output=True,check=True,timeout=35)
        parsed=json.loads(response.stdout.decode('utf-8-sig'));data=base64.b64decode(parsed['data'])
        if len(data)>max_bytes:
            raise RuntimeError('Download exceeds bounded asset size')
        return data,parsed['mime']

def decode(path, highpass=0):
    filters = f'highpass=f={highpass},lowpass=f=12000' if highpass else 'anull'
    result=subprocess.run([str(FFMPEG),'-v','error','-i',str(path),'-af',filters,'-ac','1','-ar',str(RATE),'-f','f32le','pipe:1'],capture_output=True,check=True)
    samples=array.array('f');samples.frombytes(result.stdout)
    if not samples or not all(math.isfinite(x) for x in samples):
        raise RuntimeError(f'Invalid decoded source: {path.name}')
    return samples

def windows(samples, duration, count):
    size=min(len(samples),round(duration*RATE))
    hop=round(.08*RATE)
    energy=[(sum(x*x for x in samples[i:i+size:32]),i) for i in range(0,max(1,len(samples)-size+1),hop)]
    energy.sort(reverse=True)
    selected=[]
    for power,start in energy:
        if all(abs(start-old)>=size*.90 for old in selected):
            selected.append(start)
            if len(selected)==count:
                break
    if len(selected)<count:
        raise RuntimeError(f'Insufficient distinct source intervals: requested {count}, got {len(selected)}')
    return [(start,size) for start in sorted(selected)]

def write_clip(path, source, start, size):
    samples=list(source[start:start+size])
    # Add short seam fades and bounded gain; retain recorded dynamics.
    fade=min(round(.008*RATE),len(samples)//4)
    for i in range(fade):
        gain=math.sin((i+1)/(fade+1)*math.pi/2)**2
        samples[i]*=gain;samples[-1-i]*=gain
    peak=max(abs(x) for x in samples)
    if peak<1e-5:
        raise RuntimeError('Selected audio is silent')
    gain=min(10**(6/20),10**(-4/20)/peak)
    pcm=array.array('h',[round(max(-1,min(1,x*gain))*32767) for x in samples])
    with wave.open(str(path),'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(RATE);file.writeframes(pcm.tobytes())
    peak=max(abs(x) for x in pcm)/32768
    return {'file':path.name,'durationSeconds':len(pcm)/RATE,'sampleRate':RATE,'channels':1,'format':'PCM16 WAV',
        'sourceOffsetSeconds':start/RATE,'gainDb':20*math.log10(gain),'peak':peak,'peakDbFS':20*math.log10(peak),
        'rms':math.sqrt(sum((x/32768)**2 for x in pcm)/len(pcm)),'bytes':path.stat().st_size,'sha256':sha(path.read_bytes()),'loop':False}

def main():
    SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
    manifest={'id':'free-gore-v1','status':'DOWNLOADED_AND_PREPARED_NOT_WIRED','downloadDate':'2026-09-30','license':'CC0 1.0',
        'licenseUrl':LICENSE,'qualityBoundary':'Public high-quality MP3 previews, not the uploader original lossless WAV/AIFF. WAV derivatives preserve the decoded preview and do not recover original fidelity.',
        'costUSD':0,'runtimeIntegration':'Separate asset pack only. Active audio manifest/mixer and running game are unchanged.',
        'preparation':'Mono 44.1kHz PCM16; gentle high/low-pass; highest-energy non-overlapping source windows; 8ms fades; maximum +6dB gain and -4dBFS peak.',
        'sources':[],'pools':{},'verification':{'decoder':'FFmpeg 4.2.3','waveforms':'Non-silent, finite, bounded peaks; browser decode pending; human audition pending.'},
        'references':['C:/Users/wolfk/.codex/skills/threejs-audio-generator/SKILL.md','C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md']}
    for item in SOUNDS:
        page=f"https://freesound.org/people/{item['author']}/sounds/{item['id']}/"
        page_path=SOURCE/f"{item['id']}-license-page.html"
        if page_path.exists():
            page_data=page_path.read_bytes()
        else:
            page_data,_=fetch(page);page_path.write_bytes(page_data)
        text=page_data.decode('utf8')
        if not re.search(r'href="https?://creativecommons.org/publicdomain/zero/1\.0/"[^>]*>\s*Creative Commons 0',text):
            raise RuntimeError(f"Expected CC0 source license missing for {item['id']}")
        match=re.search(r'data-static-file-url="(https://cdn\.freesound\.org/previews/[^" ]+-hq\.mp3)"',text)
        if not match:
            raise RuntimeError(f"Public HQ preview not advertised for {item['id']}")
        preview=html.unescape(match.group(1));source_path=SOURCE/f"{item['id']}-{item['key']}-hq-preview.mp3"
        if not source_path.exists():
            data,mime=fetch(preview)
            if 'audio' not in mime and 'octet-stream' not in mime:
                raise RuntimeError(f'Unexpected download MIME {mime}')
            source_path.write_bytes(data)
        samples=decode(source_path,item['highpass']);clips=[]
        for index,(start,size) in enumerate(windows(samples,item['seconds'],item['count']),1):
            clips.append(write_clip(OUTPUT/f"{item['key']}-{index:02}.wav",samples,start,size))
        metadata={**item,'sourcePage':page,'license':'CC0 1.0','licenseUrl':LICENSE,'downloadUrl':preview,
            'downloadKind':'Public HQ MP3 preview','preservedSource':source_path.relative_to(ROOT).as_posix(),
            'sourceBytes':source_path.stat().st_size,'sourceSha256':sha(source_path.read_bytes()),'decodedSeconds':len(samples)/RATE,
            'pageSha256':sha(page_data),'clips':clips}
        manifest['sources'].append(metadata)
        manifest['pools'][f"free-{item['key']}"]=[f"./audio/free-gore-v1/{clip['file']}" for clip in clips]
        print(json.dumps({'source':item['key'],'license':'CC0','clips':len(clips),'duration':round(len(samples)/RATE,3)}),flush=True)
    manifest['runtimeFiles']=sum(len(s['clips']) for s in manifest['sources'])
    manifest['runtimeBytes']=sum(c['bytes'] for s in manifest['sources'] for c in s['clips'])
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    (SOURCE/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':manifest['status'],'sources':len(manifest['sources']),'runtimeFiles':manifest['runtimeFiles'],'runtimeBytes':manifest['runtimeBytes']}))

if __name__=='__main__':
    main()
