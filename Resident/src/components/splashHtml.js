// Auto-generated from gtrash-splash.html
export const SPLASH_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>G-TRASH Splash</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#F4FAEE;--bg2:#DDF0D2;--ink:#0B3D2A;--mute:#4F7060;--g:#1E8E3E;--lime:#8DC21F;--amber:#F29B1D;--red:#E5392B;--ring:rgba(30,142,62,.3);--city:rgba(30,142,62,.12);box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#052018;--bg2:#0B3D2A;--ink:#EAF6E4;--mute:#8FB5A0;--ring:rgba(141,194,31,.35);--city:rgba(141,194,31,.1)}}
:root[data-theme="dark"]{--bg:#052018;--bg2:#0B3D2A;--ink:#EAF6E4;--mute:#8FB5A0;--ring:rgba(141,194,31,.35);--city:rgba(141,194,31,.1)}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:radial-gradient(120% 90% at 50% 35%,var(--bg2),var(--bg) 70%);color:var(--ink);font-family:'Bricolage Grotesque',system-ui,sans-serif;overflow:hidden;position:relative}
.blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.45;animation:drift 12s ease-in-out infinite alternate}
.b1{width:320px;height:320px;background:var(--lime);top:-80px;left:-90px}
.b2{width:360px;height:360px;background:var(--g);bottom:-120px;right:-100px;animation-delay:-5s;opacity:.3}
@keyframes drift{to{transform:translate(50px,40px) scale(1.15)}}
.p{position:absolute;bottom:-30px;width:14px;height:14px;background:var(--lime);border-radius:0 100% 0 100%;opacity:0;animation:floatUp linear infinite}
@keyframes floatUp{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:.55}90%{opacity:.4}100%{transform:translateY(-105vh) translateX(var(--dx)) rotate(540deg);opacity:0}}
.city{position:absolute;left:0;right:0;bottom:46px;width:100%;height:90px;fill:var(--city)}
.road{position:absolute;left:0;right:0;bottom:0;height:46px;background:var(--g);opacity:.9}
.road:before{content:"";position:absolute;left:0;right:0;top:22px;border-top:3px dashed rgba(255,255,255,.55);animation:dash 1s linear infinite}
@keyframes dash{to{background-position:0 0;transform:translateX(-24px)}}
.truck{position:absolute;bottom:34px;left:0;width:110px;transform:translateX(-140px);animation:drive 7s linear 2.4s infinite}
@keyframes drive{to{transform:translateX(calc(100vw + 40px))}}
.wheel{transform-box:fill-box;transform-origin:center;animation:spin .5s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.stage{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px 24px 110px;text-align:center}
.mark{position:relative;width:280px;height:280px;display:grid;place-items:center}
.glow{position:absolute;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(141,194,31,.6),transparent 70%);opacity:0;transform:scale(.4)}
.go .glow{animation:glow 3.2s ease-out 1.4s forwards, breathe 3s ease-in-out 4.6s infinite}
@keyframes glow{40%{opacity:1;transform:scale(1.25)}100%{opacity:.55;transform:scale(1)}}
@keyframes breathe{50%{opacity:.8;transform:scale(1.08)}}
.ring{position:absolute;width:200px;height:200px;border-radius:50%;border:2px solid var(--lime);opacity:0}
.go .ring{animation:ping 2.6s ease-out 1.9s infinite}
.go .ring.b{animation-delay:3.2s}
@keyframes ping{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.5);opacity:0}}
.orbit{position:absolute;inset:0;border:1.5px dashed var(--ring);border-radius:50%;opacity:0;animation:none}
.go .orbit{animation:fade .8s ease 2.6s forwards,turn 14s linear 2.6s infinite}
@keyframes turn{to{transform:rotate(360deg)}}
.dot{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;border-radius:50%;transform:rotate(var(--a)) translateY(-140px)}
.dot i{display:block;width:100%;height:100%;border-radius:50%;box-shadow:0 0 14px currentColor;background:currentColor}
.logo{position:relative;width:210px;height:210px;overflow:visible}
.go .logo{animation:float 4s ease-in-out 3.4s infinite}
@keyframes float{50%{transform:translateY(-6px)}}
.arc{stroke-dasharray:1;stroke-dashoffset:1}
.go .arc{animation:draw 1.3s cubic-bezier(.6,.05,.2,1) .2s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.bar{transform-box:fill-box;transform-origin:left center;transform:scaleX(0)}
.go .bar{animation:grow .45s cubic-bezier(.3,1.4,.5,1) 1.3s forwards}
@keyframes grow{to{transform:scaleX(1)}}
.leafwrap{transform-origin:735px 935px;transform:scale(0) rotate(-35deg)}
.go .leafwrap{animation:unfurl 1s cubic-bezier(.3,1.5,.5,1) 1.55s forwards,breeze 3.6s ease-in-out 3s infinite}
@keyframes unfurl{to{transform:scale(1) rotate(0)}}
@keyframes breeze{0%,100%{transform:rotate(0)}50%{transform:rotate(4deg)}}
.vein{stroke-dasharray:1;stroke-dashoffset:1}
.go .vein{animation:draw .7s ease 2.3s forwards}
.name{display:flex;font-size:clamp(42px,13vw,60px);font-weight:800;letter-spacing:.03em;line-height:1;overflow:hidden;padding:6px 4px}
.name span{display:inline-block;transform:translateY(115%) rotate(8deg);opacity:0;filter:blur(6px)}
.name span:nth-child(2){color:var(--lime)}
.go .name span{animation:rise .7s cubic-bezier(.2,.9,.3,1.2) forwards;animation-delay:calc(2.3s + var(--i)*.08s)}
@keyframes rise{to{transform:none;opacity:1;filter:none}}
.tag{margin:0;font-size:15px;color:var(--mute);line-height:1.45;opacity:0;max-width:30ch}
.go .tag{animation:fade .8s ease 3.1s forwards}
@keyframes fade{to{opacity:1}}
.leds{display:flex;gap:10px;opacity:0}
.go .leds{animation:fade .4s ease 3.1s forwards}
.led{width:12px;height:12px;border-radius:50%;background:var(--mute);opacity:.3;transition:.25s}
.led.g.on{background:var(--g);box-shadow:0 0 12px var(--g);opacity:1}
.led.o.on{background:var(--amber);box-shadow:0 0 12px var(--amber);opacity:1}
.led.r.on{background:var(--red);box-shadow:0 0 12px var(--red);opacity:1}
.load{width:min(260px,70vw);display:flex;flex-direction:column;gap:9px;opacity:0}
.go .load{animation:fade .4s ease 3.2s forwards}
.track{height:6px;border-radius:6px;background:var(--ring);overflow:hidden}
.track i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--g),var(--lime));border-radius:6px}
.status{font-size:13px;color:var(--mute);min-height:1.2em}
.again{font:inherit;font-size:13px;color:var(--ink);background:none;border:1px solid var(--ring);border-radius:999px;padding:8px 18px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s,background .2s}
.again.show{opacity:1;pointer-events:auto}
.again:hover{background:var(--ring)}
.again:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
@media (max-height:640px){.mark{width:220px;height:220px}.logo{width:160px;height:160px}.dot{transform:rotate(var(--a)) translateY(-108px)}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important}}
</style></head>
<body>
<div class="blob b1"></div><div class="blob b2"></div>
<div id="ps"></div>
<svg class="city" viewBox="0 0 800 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="M0 90V55h40V35h30v20h25V20h35v35h30V45h40V25h28v30h32V40h45V15h30v40h35V50h40V30h32v25h40V42h45V22h35v33h30V48h40V28h30v27h30V90z"/></svg>
<div class="road"></div>
<svg class="truck" viewBox="0 0 110 52" aria-hidden="true">
  <rect x="0" y="6" width="70" height="30" rx="5" fill="#1E8E3E"/>
  <rect x="0" y="6" width="70" height="7" rx="3" fill="#0B6B2E"/>
  <path d="M72 36V16h20l14 11v9z" fill="#8DC21F"/>
  <path d="M77 20h12l8 7H77z" fill="#EAF6E4"/>
  <path d="M30 30c0-10 6-15 16-16 0 9-5 15-16 16z" fill="#fff" opacity=".9"/>
  <g class="wheel"><circle cx="20" cy="40" r="9" fill="#0B2A1E"/><circle cx="20" cy="40" r="3.5" fill="#cfe"/><path d="M20 33v14M13 40h14" stroke="#cfe" stroke-width="1.5"/></g>
  <g class="wheel"><circle cx="86" cy="40" r="9" fill="#0B2A1E"/><circle cx="86" cy="40" r="3.5" fill="#cfe"/><path d="M86 33v14M79 40h14" stroke="#cfe" stroke-width="1.5"/></g>
</svg>
<main class="stage" id="s">
  <div class="mark">
    <div class="glow"></div><div class="ring"></div><div class="ring b"></div>
    <div class="orbit">
      <div class="dot" style="--a:0deg;color:#8DC21F"><i></i></div>
      <div class="dot" style="--a:120deg;color:#1E8E3E"><i></i></div>
      <div class="dot" style="--a:240deg;color:#F29B1D"><i></i></div>
    </div>
    <svg class="logo" viewBox="280 250 730 710" role="img" aria-label="G-TRASH logo">
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54A540"/><stop offset="1" stop-color="#007F3D"/></linearGradient>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AC91E"/><stop offset="1" stop-color="#86BA1E"/></linearGradient>
      </defs>
      <path class="arc" pathLength="1" d="M810.9 418.4A258.5 258.5 0 1 0 691.9 847.7" fill="none" stroke="url(#gg)" stroke-width="137"/>
      <rect class="bar" x="605" y="565" width="160" height="128" fill="#25903F"/>
      <g class="leafwrap">
        <path d="M735 935C745 900 760 880 790 872C900 835 985 750 985 600C985 540 975 500 975 457C940 475 890 490 850 512C770 555 714 640 714 735C714 810 722 880 735 935Z" fill="url(#lg)" stroke="var(--bg)" stroke-width="16" paint-order="stroke" stroke-linejoin="round"/>
        <path class="vein" pathLength="1" d="M730 935C750 830 820 690 902 593" fill="none" stroke="#0E8A3E" stroke-width="15" stroke-linecap="round"/>
      </g>
    </svg>
  </div>
  <div class="name" aria-label="G-TRASH"><span style="--i:0">G</span><span style="--i:1">-</span><span style="--i:2">T</span><span style="--i:3">R</span><span style="--i:4">A</span><span style="--i:5">S</span><span style="--i:6">H</span></div>
  <p class="tag">Smart waste monitoring for a cleaner Cebu City</p>
  <div class="leds" aria-hidden="true"><i class="led g"></i><i class="led o"></i><i class="led r"></i></div>
  <div class="load">
    <div class="track"><i id="p"></i></div>
    <div class="status" id="t" aria-live="polite"></div>
  </div>
  <button class="again" id="b" type="button">Replay</button>
</main>
<script>
(function(){
var s=document.getElementById('s'),p=document.getElementById('p'),t=document.getElementById('t'),b=document.getElementById('b'),ps=document.getElementById('ps');
var leds=s.querySelectorAll('.led'),timers=[];
for(var i=0;i<16;i++){var e=document.createElement('i');e.className='p';var z=8+Math.random()*14;e.style.cssText='left:'+Math.random()*100+'%;width:'+z+'px;height:'+z+'px;animation-duration:'+(7+Math.random()*7)+'s;animation-delay:'+(Math.random()*8)+'s;--dx:'+(Math.random()*120-60)+'px;opacity:0';ps.appendChild(e)}
var steps=[[0,'Calibrating air-quality sensors'],[.3,'Syncing truck locations'],[.55,'Loading barangay reports'],[.8,'Connecting live updates'],[1,'Ready to collect']];
function led(i){leds.forEach(function(l,k){l.classList.toggle('on',k===i)})}
function run(){
  timers.forEach(clearTimeout);timers=[];
  s.classList.remove('go');void s.offsetWidth;s.classList.add('go');
  b.classList.remove('show');p.style.transition='none';p.style.width='0';t.textContent='';led(-1);
  var at=function(ms,f){timers.push(setTimeout(f,ms))};
  at(3300,function(){led(0)});at(3800,function(){led(1)});at(4300,function(){led(2)});at(4800,function(){led(0)});
  at(3300,function(){p.style.transition='width 2.8s cubic-bezier(.4,.1,.2,1)';p.style.width='100%'});
  steps.forEach(function(x){at(3300+x[0]*2800,function(){t.textContent=x[1]})});
  at(6300,function(){b.classList.add('show')});
}
b.addEventListener('click',run);run();
})();
</script>
</body></html>
`;
