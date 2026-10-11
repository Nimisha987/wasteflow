(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), lerp=(a,b,t)=>a+(b-a)*t, sm=t=>t*t*(3-2*t);
const nf=(v,d=0)=>v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------------- DEMO DATA ---------------- */
const BASE=640; // t/day demo city total (synthetic, calibrated)
const CAP={bio:350,comp:260,truck:4,trips:2.5};
const WARDS=['Market Zone','Old Town','Station Area','Tech Park','Hospital Belt','College Road','Riverside','Lakeview','Industrial Edge','Housing Block A','Housing Block B','Bazaar Lane'];
const WSHARE=[.12,.09,.07,.11,.06,.08,.10,.05,.09,.07,.08,.08];
const WPOS=WARDS.map((_,i)=>{const a=i/12*Math.PI*2+.3, r=i%2?3.15:2.15;return [Math.cos(a)*r,Math.sin(a)*r]});

/* assumptions register: low / mid / high. disp = display multiplier */
const AS={
 wet:{l:'Organic share of waste',u:'%',d:100,low:.46,mid:.52,high:.58,t:'y',s:'Typical urban audit range',st:.01},
 dry:{l:'Dry recyclable share',u:'%',d:100,low:.20,mid:.25,high:.30,t:'y',s:'Typical urban audit range',st:.01},
 ew:{l:'E-waste share',u:'%',d:100,low:.01,mid:.02,high:.03,t:'y',s:'Typical urban audit range',st:.005},
 mixWet:{l:'Wet recovered from mixed waste',u:'%',d:100,low:.15,mid:.25,high:.35,t:'r',s:'MRF recovery assumption',st:.01},
 mixDry:{l:'Dry recovered from mixed waste',u:'%',d:100,low:.25,mid:.35,high:.45,t:'r',s:'MRF recovery assumption',st:.01},
 bioYield:{l:'Biogas yield',u:'m³ per t',d:1,low:60,mid:90,high:120,t:'r',s:'Literature range, varies with moisture',st:5},
 kwhM3:{l:'Electricity per m³ biogas',u:'kWh',d:1,low:1.6,mid:2.0,high:2.4,t:'y',s:'Typical gas-engine output',st:.1},
 cngM3:{l:'Bio-CNG per m³ biogas',u:'kg',d:1,low:.35,mid:.42,high:.50,t:'r',s:'Upgrading assumption',st:.01},
 dieselKmL:{l:'Diesel truck mileage',u:'km/L',d:1,low:3.0,mid:3.5,high:4.2,t:'y',s:'Replace with fleet logs',st:.1},
 cngKmKg:{l:'CNG truck mileage',u:'km/kg',d:1,low:3.0,mid:3.6,high:4.2,t:'r',s:'Replace with fleet logs',st:.1},
 evKwhKm:{l:'Electric truck use',u:'kWh/km',d:1,low:1.0,mid:1.3,high:1.7,t:'r',s:'Replace with fleet specs',st:.05},
 dieselEf:{l:'Diesel emission factor',u:'kg CO₂/L',d:1,low:2.60,mid:2.68,high:2.75,t:'g',s:'IPCC default range',st:.01},
 cngEf:{l:'CNG emission factor',u:'kg CO₂/kg',d:1,low:2.6,mid:2.75,high:2.9,t:'y',s:'Typical value',st:.05},
 gridEf:{l:'Grid emission factor',u:'kg CO₂/kWh',d:1,low:.68,mid:.71,high:.75,t:'y',s:'National baseline, check the year',st:.01},
 landfillEf:{l:'Landfill CO₂e avoided per t organic',u:'t/t',d:1,low:.30,mid:.50,high:.70,t:'r',s:'Methane model assumption',st:.05},
 recycleEf:{l:'CO₂e avoided per t recycled',u:'t/t',d:1,low:.5,mid:1.0,high:1.6,t:'r',s:'Mixed dry material estimate',st:.1},
 kmTrip:{l:'Distance per collection trip',u:'km',d:1,low:11,mid:14,high:17,t:'y',s:'Ward to facility and back',st:.5}
};
const TAGN={g:'Sourced',y:'Typical',r:'Assumed'};

/* route demo: real 2-opt on the 12 demo wards */
const DEPOT=[0,0];
const P=WPOS;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function tourLen(order){let L=0,prev=DEPOT;for(const i of order){L+=dist(prev,P[i]);prev=P[i]}return L+dist(prev,DEPOT)}
const BASE_ORDER=[0,2,1,3,5,4,6,8,7,9,11,10]; // legacy order: mostly sequential, a few out-of-order stops
function optimise(){
  let rem=P.map((_,i)=>i), cur=DEPOT, order=[];
  while(rem.length){let bi=0,bd=1e9;rem.forEach((k,j)=>{const d=dist(cur,P[k]);if(d<bd){bd=d;bi=j}});order.push(rem[bi]);cur=P[rem[bi]];rem.splice(bi,1)}
  let improved=true;
  while(improved){improved=false;
    for(let i=0;i<order.length-1;i++)for(let j=i+1;j<order.length;j++){
      const cand=order.slice(0,i).concat(order.slice(i,j+1).reverse(),order.slice(j+1));
      if(tourLen(cand)<tourLen(order)-1e-9){order=cand;improved=true}
    }}
  return order;
}
const OPT_ORDER=optimise();
const KM_PER_UNIT=1.05;
const BASE_KM=tourLen(BASE_ORDER)*KM_PER_UNIT, OPT_KM=tourLen(OPT_ORDER)*KM_PER_UNIT;
const ROUTE_RATIO=OPT_KM/BASE_KM;

/* ---------------- MODEL ---------------- */
function calc(p,ov){
  ov=ov||{};
  const g=k=>ov[k]!==undefined?ov[k]:AS[k].mid;
  const F=BASE*(1+p.uplift/100);
  const wet=F*g('wet'), dry=F*g('dry'), ew=F*g('ew'), res=F-wet-dry-ew;
  const s=p.seg/100;
  const wetRec=wet*(s+(1-s)*g('mixWet'));
  const dryRec=dry*(s*.9+(1-s)*g('mixDry'));
  const ewRec=ew*(s*.8+(1-s)*.2);
  const inf=dryRec*(p.informal/100);
  const bio=p.down?0:Math.min(wetRec*.6,CAP.bio);
  const comp=Math.min(wetRec-bio,CAP.comp);
  const wetUsed=bio+comp, wetLost=wet-wetUsed, mrf=dryRec-inf;
  const landfill=F-wetUsed-dryRec-ewRec;
  const load=F-inf, trips=Math.ceil(load/CAP.truck), trucks=Math.ceil(trips/CAP.trips);
  const kmOpt=trips*g('kmTrip'), kmBase=kmOpt/ROUTE_RATIO;
  const fleet=km=>p.fleet==='diesel'?km/g('dieselKmL')*g('dieselEf')/1000:p.fleet==='cng'?km/g('cngKmKg')*g('cngEf')/1000:km*g('evKwhKm')*g('gridEf')/1000;
  const co2Fleet=fleet(kmOpt), co2Legacy=kmBase/g('dieselKmL')*g('dieselEf')/1000;
  const m3=bio*g('bioYield'), kwh=m3*g('kwhM3'), cng=m3*g('cngM3');
  const loop=cng>0?(kmOpt/g('cngKmKg'))/cng:0;
  const co2=wetUsed*g('landfillEf')+(dryRec+ewRec)*g('recycleEf')+kwh*g('gridEf')/1000+(co2Legacy-co2Fleet);
  return {F,wet,dry,ew,res,wetRec,dryRec,ewRec,inf,bio,comp,mrf,landfill,wetLost,trips,trucks,kmOpt,kmBase,m3,kwh,mwh:kwh/1000,cng,loop,co2,div:(1-landfill/F)*100};
}
function tri(r,a,m,b){const u=r(),c=(m-a)/(b-a||1);return u<c?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m))}
function monteCarlo(p,n=240){
  const r=mulberry32(7),out={co2:[],mwh:[],div:[]};
  for(let i=0;i<n;i++){const ov={};for(const k in AS){const a=AS[k];ov[k]=tri(r,a.low,a.mid,a.high)}
    const x=calc(p,ov);out.co2.push(x.co2);out.mwh.push(x.mwh);out.div.push(x.div)}
  const q=a=>{a.sort((x,y)=>x-y);return [a[Math.floor(.1*n)],a[Math.floor(.9*n)]]};
  return {co2:q(out.co2),mwh:q(out.mwh),div:q(out.div)};
}
function tornado(p){
  return Object.keys(AS).map(k=>{const a=AS[k];
    const lo=calc(p,{[k]:a.low}).co2, hi=calc(p,{[k]:a.high}).co2;
    return {k,lo:Math.min(lo,hi),hi:Math.max(lo,hi),swing:Math.abs(hi-lo)}}).filter(x=>x.swing>1e-6).sort((a,b)=>b.swing-a.swing).slice(0,7);
}

/* ---------------- STATE + UI ---------------- */
let NIGHT=false,_lv=null,VIEW='dash',viewT=0,lastHs=null,lastSt=null;
const API_URL=''; // optional: set to your API Gateway URL; see adapter in render()
const DEF={uplift:0,seg:60,informal:20,fleet:'diesel',down:false};
const state={...DEF};
const PRESETS={normal:{uplift:0,seg:60,informal:20,down:false},diwali:{uplift:40,seg:60,informal:20,down:false},monsoon:{uplift:15,seg:60,informal:20,down:false},outage:{uplift:0,seg:60,informal:20,down:true}};

function tween(el,to,d){
  const from=el._v==null?0:el._v;el._v=to;
  if(RM){el.textContent=nf(to,d);return}
  cancelAnimationFrame(el._r);const t0=performance.now();
  const step=now=>{const k=Math.min(1,(now-t0)/450),e=1-Math.pow(1-k,3);el.textContent=nf(from+(to-from)*e,d);if(k<1)el._r=requestAnimationFrame(step)};
  el._r=requestAnimationFrame(step);
}
function delta(v,b,pts){
  if(pts){const d=v-b;return Math.abs(d)<.05?'Same as a normal day':(d>0?'+':'−')+nf(Math.abs(d),1)+' points vs a normal day'}
  if(!b)return '';const d=(v-b)/b*100;return Math.abs(d)<.5?'Same as a normal day':(d>0?'+':'−')+nf(Math.abs(d),0)+'% vs a normal day';
}
const kp=k=>$('.kpi[data-k="'+k+'"]');
function setK(k,val,dec,rng,dl){const el=kp(k);tween($('.n',el),val,dec);$('.rng',el).textContent=rng;$('.dl',el).textContent=dl}

let sceneApply=null, labelData=[];
let renderQueued=false;
function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render()})}

function render(){
  const r=calc(state), b=calc({...DEF,fleet:state.fleet}), mc=monteCarlo(state);
  // controls text
  $('#upliftO').textContent='+'+state.uplift+'%';$('#segO').textContent=state.seg+'%';$('#infO').textContent=state.informal+'%';
  [['uplift'],['seg'],['inf']].forEach(([id])=>{const e=$('#'+id);e.style.setProperty('--p',((e.value-e.min)/(e.max-e.min)*100)+'%')});
  $$('#presets .chip').forEach(c=>{const pr=PRESETS[c.dataset.preset];c.setAttribute('aria-pressed',String(pr.uplift===state.uplift&&pr.seg===state.seg&&pr.informal===state.informal&&pr.down===state.down))});
  $$('#fleet button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.fleet===state.fleet)));
  // KPIs
  const big=WARDS[WSHARE.indexOf(Math.max(...WSHARE))];
  // Backend scenario estimate overrides only the existing waste KPI.
  const apiWaste = window.wasteflowScenarioTonnes;
  setK('forecast', apiWaste == null ? r.F : apiWaste, 3,
    apiWaste == null ? 'Illustrative local simulation · synthetic assumptions' : 'Backend historical-model scenario estimate · not live data',
    apiWaste == null ? delta(r.F,b.F) : 'Backend estimate');


  setK('div',r.div,1,'Likely '+nf(mc.div[0],0)+' to '+nf(mc.div[1],0)+'%',delta(r.div,b.div,true));
  setK('energy',r.mwh,1,'Likely '+nf(mc.mwh[0],0)+' to '+nf(mc.mwh[1],0)+' MWh, or '+nf(r.cng/1000,1)+' t of bio-CNG',delta(r.mwh,b.mwh));
  setK('co2',r.co2,1,'Likely '+nf(mc.co2[0],0)+' to '+nf(mc.co2[1],0)+' t',delta(r.co2,b.co2));
  setK('km',r.kmOpt,0,'Fixed routes would need '+nf(r.kmBase)+' km',delta(r.kmOpt,b.kmOpt));
  setK('trucks',r.trucks,0,nf(r.trips)+' trips a day, '+CAP.truck+' t per truck',delta(r.trucks,b.trucks));
  // hero cards
  tween($('#hF'),r.F,0);tween($('#hDiv'),r.div,0);
  const mult=[1,1.04,.97,.99,1.03,1.09,.9];
  $$('#hBars i').forEach((el,i)=>{el.style.height=(16+mult[i]*r.F/Math.max(...mult)/(BASE*1.8)*100*.6)+'px'});
  const parts=[['bio',r.bio],['comp',r.comp],['mrf',r.mrf],['inf',r.inf],['ewf',r.ewRec]];
  $('#hStack').innerHTML=parts.map(([k,v])=>'<i style="width:'+(v/r.F*100)+'%;background:var(--c-'+k+')"></i>').join('');
  // loop
  const lp=r.loop*100;
  $('#loopBar').style.width=clamp(lp,0,100)+'%';$('#loopPct').textContent=state.down?'no bio-CNG made':nf(lp,0)+'% of bio-CNG output';
  $('#loopTxt').textContent=state.down?'The biogas plant is offline, so no bio-CNG is produced and organic waste goes to compost only.':(lp>=100?'Running the whole fleet on CNG would need more bio-CNG than the plant makes today.':'Running the whole collection fleet on CNG would use only '+nf(lp,0)+'% of the bio-CNG this plant makes. The rest is spare to sell or to fuel buses.');
  drawSankey(r);
  $('#bal').textContent='Mass balance: '+nf(r.bio+r.comp+r.mrf+r.inf+r.ewRec+r.landfill,1)+' t out = '+nf(r.F,1)+' t in';
  $('#rBaseKm').textContent=nf(r.kmBase)+' km';$('#rOptKm').textContent=nf(r.kmOpt)+' km, '+nf((1-ROUTE_RATIO)*100,0)+'% less';
  drawTornado();
  // labels
  labelData.forEach(L=>{L.val=L.get(r);L.el.querySelector('span').textContent=L.val});
  if(sceneApply)sceneApply(r);
  renderViews(r,b);
}

/* Sankey */
function drawSankey(r){
  const W=760,H=330,gap=14,nw=14,xl=132,xr=W-150-nw;
  const src=[['wet','Organic',r.wet,'--c-wet'],['dry','Dry recyclables',r.dry,'--c-dry'],['ew','E-waste',r.ew,'--c-ew'],['res','Residual',r.res,'--c-res']];
  const dst=[['bio','Biogas plant',r.bio],['comp','Compost',r.comp],['mrf','Recycling (MRF)',r.mrf],['inf','Waste pickers',r.inf],['ewf','E-waste facility',r.ewRec],['lf','Landfill',r.landfill]];
  const links=[['wet','bio',r.bio],['wet','comp',r.comp],['wet','lf',r.wetLost],['dry','mrf',r.mrf],['dry','inf',r.inf],['dry','lf',r.dry-r.dryRec],['ew','ewf',r.ewRec],['ew','lf',r.ew-r.ewRec],['res','lf',r.res]];
  const sc=(H-5*gap-6)/r.F;
  const place=(arr,vi)=>{const tot=arr.reduce((a,x)=>a+Math.max(2,x[vi]*sc),0)+gap*(arr.length-1);let y=(H-tot)/2;const o={};arr.forEach(x=>{const h=Math.max(2,x[vi]*sc);o[x[0]]={y,h,cur:0};y+=h+gap});return o};
  const S=place(src,2), D=place(dst,2);
  let out='';
  const order=dst.map(d=>d[0]);
  const sorted=links.filter(l=>l[2]>.01).sort((a,b)=>order.indexOf(a[1])-order.indexOf(b[1]));
  const colOf={};src.forEach(s=>colOf[s[0]]=s[3]);
  sorted.forEach(([a,bk,v])=>{
    const w=Math.max(1,v*sc),sa=S[a],db=D[bk];
    const y0=sa.y+sa.cur+w/2, y1=db.y+db.cur+w/2;sa.cur+=w;db.cur+=w;
    const x0=xl+nw,x1=xr,xm=(x0+x1)/2;
    out+='<path d="M'+x0+','+y0+' C'+xm+','+y0+' '+xm+','+y1+' '+x1+','+y1+'" fill="none" stroke-width="'+w+'" style="stroke:var('+colOf[a]+')" opacity=".5"/>';
  });
  src.forEach(s=>{const n=S[s[0]];out+='<rect x="'+xl+'" y="'+n.y+'" width="'+nw+'" height="'+n.h+'" rx="3" style="fill:var('+s[3]+')"/><text x="'+(xl-8)+'" y="'+(n.y+n.h/2+4)+'" text-anchor="end" font-size="12.5">'+s[1]+' <tspan font-weight="700">'+nf(s[2])+' t</tspan></text>'});
  dst.forEach(d=>{const n=D[d[0]];out+='<rect x="'+xr+'" y="'+n.y+'" width="'+nw+'" height="'+n.h+'" rx="3" style="fill:var(--c-'+d[0]+')"/><text x="'+(xr+nw+8)+'" y="'+(n.y+n.h/2+4)+'" font-size="12.5">'+d[1]+' <tspan font-weight="700">'+nf(d[2])+' t</tspan></text>'});
  $('#sankey').innerHTML=out;
}

/* Routes */
function drawRoute(id,order,color){
  const m=v=>[110+v[0]*24,110+v[1]*24];
  let d='M'+m(DEPOT).join(',');order.forEach(i=>d+=' L'+m(P[i]).join(','));d+=' Z';
  let s='<path pathLength="1" d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.4" stroke-linejoin="round"/>';
  P.forEach(p=>{const q=m(p);s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="4" style="fill:var(--ink)"/>'});
  const q=m(DEPOT);s+='<rect x="'+(q[0]-7)+'" y="'+(q[1]-7)+'" width="14" height="14" rx="3" fill="#ffb93b"/>';
  $(id).innerHTML=s;
}

/* Tornado + table */
function drawTornado(){
  const t=tornado(state),b=calc(state).co2;
  const min=Math.min(...t.map(x=>x.lo),b),max=Math.max(...t.map(x=>x.hi),b),span=max-min||1;
  $('#torn').innerHTML=t.map(x=>'<div class="row"><div>'+AS[x.k].l+'<small>'+nf(x.lo,1)+' to '+nf(x.hi,1)+' t</small></div><div class="tr"><i style="left:'+((x.lo-min)/span*100)+'%;width:'+Math.max(1.5,(x.hi-x.lo)/span*100)+'%"></i><u style="left:'+((b-min)/span*100)+'%" title="Current value"></u></div></div>').join('');
}
const dec=a=>a.d===100?(a.st<.01?1:0):(a.st>=1?0:(a.st<.1?2:1));
function buildTable(){
  $('#tbody').innerHTML=Object.keys(AS).map(k=>{const a=AS[k];
    return '<tr><td>'+a.l+'<br><span class="mut">'+a.u+'</span></td><td class="mut">'+nf(a.low*a.d,dec(a))+'</td><td><input type="number" aria-label="'+a.l+'" data-k="'+k+'" value="'+(+(a.mid*a.d).toFixed(3))+'" step="'+(+(a.st*a.d).toFixed(3))+'"></td><td class="mut">'+nf(a.high*a.d,dec(a))+'</td><td><span class="tag t-'+a.t+'">'+TAGN[a.t]+'</span></td><td class="mut">'+a.s+'</td></tr>'}).join('');
  $$('#tbody input').forEach(inp=>inp.addEventListener('input',()=>{
    const a=AS[inp.dataset.k],v=parseFloat(inp.value)/a.d;if(isNaN(v))return;
    a.mid=v;a.low=Math.min(a.low,v);a.high=Math.max(a.high,v);queueRender();
  }));
}

/* events */
function applyPreset(n){const p=PRESETS[n];state.uplift=p.uplift;state.seg=p.seg;state.informal=p.informal;state.down=p.down;syncInputs();queueRender()}
function syncInputs(){$('#uplift').value=state.uplift;$('#seg').value=state.seg;$('#inf').value=state.informal;$('#down').checked=state.down}
$('#uplift').addEventListener('input',e=>{state.uplift=+e.target.value;queueRender()});
$('#seg').addEventListener('input',e=>{state.seg=+e.target.value;queueRender()});
$('#inf').addEventListener('input',e=>{state.informal=+e.target.value;queueRender()});
$('#down').addEventListener('change',e=>{state.down=e.target.checked;queueRender()});
$$('#fleet button').forEach(b=>b.addEventListener('click',()=>{state.fleet=b.dataset.fleet;queueRender()}));
$$('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
$('#reset').addEventListener('click',()=>{Object.assign(state,DEF);syncInputs();queueRender()});
$('#themeBtn').addEventListener('click',()=>{const root=document.documentElement;root.dataset.theme=(root.dataset.theme||'light')==='light'?'dark':'light'});

/* hero bars */
$('#hBars').innerHTML=Array.from({length:7},(_,i)=>'<i'+(i===4?' class="on"':'')+'></i>').join('');

/* ---------------- 3D SCENE ---------------- */
function initScene(){
  const T=window.THREE;if(!T)throw new Error('no three');
  const canvas=$('#scene');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setClearColor(0x000000,0);
  renderer.outputEncoding=T.sRGBEncoding;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  const cam=new T.PerspectiveCamera(30,1,.1,200);cam.position.set(0,8,26);cam.lookAt(0,-.5,0);
  const hemi=new T.HemisphereLight(0xffffff,0x7fd48a,.95);scene.add(hemi);
  const sun=new T.DirectionalLight(0xfff1cf,1.2);sun.position.set(9,15,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  const sc=sun.shadow.camera;sc.left=-11;sc.right=11;sc.top=11;sc.bottom=-11;sc.near=1;sc.far=50;scene.add(sun);
  const rim=new T.DirectionalLight(0x9fdcff,.5);rim.position.set(-8,4,-10);scene.add(rim);

  const M=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.82,metalness:.04,flatShading:true},o||{}));
  const mesh=(geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m};
  const rnd=mulberry32(21);
  const isl=new T.Group();scene.add(isl);
  const body=new T.Group();isl.add(body);
  const R=7.4,TOP=.3;

  // island layers
  body.add(mesh(new T.CylinderGeometry(R,R,.6,10,1),M(0x58d14f)));
  body.add(mesh(new T.CylinderGeometry(R,R*.94,.9,10,1),M(0x8d5a34),0,-.75,0));
  const rockG=new T.CylinderGeometry(R*.94,.7,6.8,10,5);
  const pos=rockG.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(y<3.2){const h=v=>{const n=Math.sin(v*12.9898+y*78.233+(x+z)*37.719)*43758.5453;return n-Math.floor(n)-.5};
      pos.setX(i,x+h(x)*1.1);pos.setZ(i,z+h(z+3.1)*1.1);pos.setY(i,y+h(x*z)*.7)}}
  rockG.computeVertexNormals();
  body.add(mesh(rockG,M(0xa07f66),0,-4.65,0));
  [[2.4,-8,1.2],[-2,-8.4,-1.5],[.2,-9,.5]].forEach(([x,y,z],i)=>{const c=mesh(new T.ConeGeometry(.6-i*.1,1.6,5),M(0x8f7058),x,y,z);c.rotation.x=Math.PI;body.add(c)});

  // grass tufts
  const tuft=new T.InstancedMesh(new T.ConeGeometry(.07,.34,4),M(0x35b043),160);
  const dm=new T.Object3D();
  for(let i=0;i<160;i++){const a=rnd()*6.283,r=Math.sqrt(rnd())*6.8;dm.position.set(Math.cos(a)*r,TOP+.15,Math.sin(a)*r);dm.rotation.set(0,rnd()*3,0);dm.scale.setScalar(.7+rnd()*.8);dm.updateMatrix();tuft.setMatrixAt(i,dm.matrix)}
  body.add(tuft);

  // road
  const road=new T.Mesh(new T.RingGeometry(3.95,4.75,72),M(0x3b4b45,{flatShading:false}));road.rotation.x=-Math.PI/2;road.position.y=TOP+.01;road.receiveShadow=true;body.add(road);
  for(let i=0;i<44;i++){const a=i/44*6.283;const d=new T.Mesh(new T.BoxGeometry(.16,.01,.04),new T.MeshBasicMaterial({color:0xf3e8b5}));d.position.set(Math.cos(a)*4.35,TOP+.02,Math.sin(a)*4.35);d.rotation.y=-a-Math.PI/2;body.add(d)}
  const tanRot=a=>Math.atan2(-Math.cos(a),-Math.sin(a));
  const panelMat=M(0x1d4ed8,{metalness:.55,roughness:.3});
  const panels=(g,x,y,z,n)=>{for(let i=0;i<n;i++){const p=mesh(new T.BoxGeometry(.42,.03,.3),panelMat,x+i*.5,y,z);p.rotation.x=-.35;g.add(p)}};

  // depot
  const depot=new T.Group();depot.add(mesh(new T.BoxGeometry(1.7,.8,1.15),M(0xf2efe2),0,TOP+.4,0));
  depot.add(mesh(new T.BoxGeometry(1.9,.08,1.3),M(0xffb93b),0,TOP+.84,0));panels(depot,-.75,TOP+1.0,0,4);body.add(depot);
  depot.userData.rot=0;

  // facilities
  const FAC={};
  const addFac=(id,deg,build)=>{const a=deg*Math.PI/180,g=new T.Group();g.position.set(Math.cos(a)*5.6,0,Math.sin(a)*5.6);g.rotation.y=tanRot(a);build(g);
    const ring=new T.Mesh(new T.RingGeometry(1.15,1.3,40),new T.MeshBasicMaterial({color:0xc8f23a,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=TOP+.02;g.add(ring);
    g.userData.ring=ring;body.add(g);FAC[id]=g;return g};
  // biogas
  const bio=addFac('bio',35,g=>{
    g.add(mesh(new T.CylinderGeometry(.75,.75,.9,18),M(0xe8efe0,{flatShading:false}),0,TOP+.45,0));
    const dome=mesh(new T.SphereGeometry(.75,18,10,0,6.283,0,Math.PI/2),M(0x35e07a,{flatShading:false}),0,TOP+.9,0);g.add(dome);
    g.add(mesh(new T.CylinderGeometry(.08,.08,.9,8),M(0x888f88),.9,TOP+.45,.3));
  });
  const beam=new T.Mesh(new T.ConeGeometry(.75,3.4,28,1,true),new T.MeshBasicMaterial({color:0xc8f23a,transparent:true,opacity:.2,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));
  beam.rotation.x=Math.PI;beam.position.set(0,TOP+.95+1.7,0);bio.add(beam);
  const orb=new T.Mesh(new T.IcosahedronGeometry(.34,1),new T.MeshBasicMaterial({color:0xc8f23a,wireframe:true}));orb.position.set(0,TOP+.95+3.6,0);bio.add(orb);
  // compost
  addFac('comp',115,g=>{for(let i=-1;i<=1;i++){const w=mesh(new T.CylinderGeometry(.34,.4,1.7,9),M(0x7b4a24),0,TOP+.12,i*.62);w.rotation.z=Math.PI/2;g.add(w);
      g.add(mesh(new T.SphereGeometry(.12,6,5),M(0x6cd04a),i*.2,TOP+.5,i*.62))}});
  // MRF
  addFac('mrf',190,g=>{g.add(mesh(new T.BoxGeometry(2,.8,1.1),M(0x2f9bff),0,TOP+.4,0));
    g.add(mesh(new T.BoxGeometry(2.1,.07,1.2),M(0x1c6fd0),0,TOP+.84,0));panels(g,-.5,TOP+1.0,0,3);
    g.add(mesh(new T.CylinderGeometry(.1,.12,.8,8),M(0x777f78),.85,TOP+1.2,-.3));
    [0xffb93b,0x35e07a,0xf3f3ea].forEach((c,i)=>g.add(mesh(new T.BoxGeometry(.3,.3,.3),M(c),-.7+i*.4,TOP+.15,.85)))});
  const smoke=Array.from({length:6},()=>{const m=new T.Mesh(new T.SphereGeometry(1,10,8),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.4,depthWrite:false}));FAC.mrf.add(m);return m});
  // e-waste
  addFac('ewf',265,g=>{g.add(mesh(new T.BoxGeometry(1.1,.7,.9),M(0xa46bff),0,TOP+.35,0));g.add(mesh(new T.BoxGeometry(1.2,.07,1),M(0x7a42d8),0,TOP+.74,0));
    const x1=mesh(new T.BoxGeometry(.4,.08,.14),M(0xf3f3ea),0,TOP+.45,.47),x2=mesh(new T.BoxGeometry(.14,.08,.4),M(0xf3f3ea),0,TOP+.45,.47);g.add(x1,x2)});
  // landfill
  const lf=addFac('lf',325,g=>{const m=mesh(new T.ConeGeometry(1.1,.6,9),M(0x9aa59f),0,TOP+.3,0);m.name='mound';g.add(m);g.add(mesh(new T.CylinderGeometry(1.5,1.5,.04,16),M(0x5d5f58),0,TOP+.02,0))});
  FAC.lf.userData.ring.visible=false;

  // trees
  const facDeg=[35,75,115,190,265,325];
  const tree=(x,z,s)=>{const g=new T.Group();g.add(mesh(new T.CylinderGeometry(.07*s,.1*s,.5*s,6),M(0x6a4a2b),0,TOP+.25*s,0));
    g.add(mesh(new T.IcosahedronGeometry(.42*s,0),M(0x18a35a),0,TOP+.75*s,0));g.add(mesh(new T.IcosahedronGeometry(.3*s,0),M(0x4fd46a),.1*s,TOP+1.15*s,0));g.position.set(x,0,z);body.add(g)};
  for(let n=0,tries=0;n<14&&tries<200;tries++){const dg=rnd()*360;if(facDeg.some(f=>Math.abs(((dg-f+540)%360)-180)<22*1))continue;
    const a=dg*Math.PI/180,r=5.4+rnd()*1.2;tree(Math.cos(a)*r,Math.sin(a)*r,.9+rnd()*.7);n++}

  // ward towers
  const towers=WSHARE.map((w,i)=>{const geo=new T.BoxGeometry(.44,1,.44);geo.translate(0,.5,0);
    const m=mesh(geo,M(0xffb93b,{emissive:0x8a4a00,emissiveIntensity:.3}),WPOS[i][0],TOP,WPOS[i][1]);m.scale.y=.3;m.userData.h=.3;m.userData.t=.3;body.add(m);
    const cap=mesh(new T.BoxGeometry(.5,.07,.5),M(0xc8f23a),0,1,0);cap.userData.cap=true;m.add(cap);return m});

  // trucks
  const truckMats=[];
  const trucks=Array.from({length:12},(_,i)=>{const g=new T.Group();const bm=M(0xffb93b);truckMats.push(bm);
    g.add(mesh(new T.BoxGeometry(.62,.3,.3),bm,-.05,.28,0));g.add(mesh(new T.BoxGeometry(.2,.24,.28),M(0xf4f1e6),.36,.25,0));
    const wg=new T.CylinderGeometry(.08,.08,.06,10);wg.rotateX(Math.PI/2);[[-.22,.16],[-.22,-.16],[.3,.16],[.3,-.16]].forEach(([x,z])=>g.add(mesh(wg,M(0x222b25),x,.08,z)));
    g.position.y=TOP;g.userData={off:i/12*6.283,tgt:i/12*6.283,vis:0,want:0};body.add(g);return g});

  // particles
  const sprite=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');const gr=x.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'#fff');gr.addColorStop(.5,'rgba(255,255,255,.8)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,32,32);return new T.CanvasTexture(c)})();
  const N=110,pg=new T.BufferGeometry(),pp=new Float32Array(N*3),ps=[];
  for(let i=0;i<N;i++){const a=rnd()*6.283,r=3+rnd()*7;pp[i*3]=Math.cos(a)*r;pp[i*3+1]=-3+rnd()*11;pp[i*3+2]=Math.sin(a)*r;ps.push(.15+rnd()*.35)}
  pg.setAttribute('position',new T.BufferAttribute(pp,3));
  const pts=new T.Points(pg,new T.PointsMaterial({color:0xdcff6e,size:.2,map:sprite,transparent:true,opacity:.85,depthWrite:false,sizeAttenuation:true}));isl.add(pts);

  // clouds and rocks
  const clouds=[];
  [[-10,-2,-4],[11,3,-7],[-8,-7,5],[9,-8,3]].forEach(([x,y,z],k)=>{const g=new T.Group();
    [[0,0,0,1.1],[1,-.1,.2,.8],[-1,-.15,0,.75],[.3,.35,-.2,.7]].forEach(([a,b,c,s])=>{const pf=new T.Mesh(new T.IcosahedronGeometry(s,1),new T.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:.88,flatShading:true}));pf.position.set(a,b,c);g.add(pf)});
    g.position.set(x,y,z);g.userData.s=.1+k*.03;isl.add(g);clouds.push(g)});
  const chunks=[];[[8.8,-4,2,.5],[-9,-5.5,-1,.7],[7.5,-8,-3,.4]].forEach(([x,y,z,s],k)=>{const m=mesh(new T.IcosahedronGeometry(s,0),M(0x85705c),x,y,z);m.userData={a:Math.atan2(z,x),r:Math.hypot(x,z),y,s:.15+k*.07};isl.add(m);chunks.push(m)});
  // shadow
  const sh=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(10,30,15,.55)');g.addColorStop(1,'rgba(10,30,15,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
  const shadow=new T.Mesh(new T.PlaneGeometry(13,13),new T.MeshBasicMaterial({map:sh,transparent:true,depthWrite:false,opacity:.5}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-12;isl.add(shadow);


  // wind turbine
  const tb=new T.Group(),ta=75*Math.PI/180;tb.position.set(Math.cos(ta)*6.5,0,Math.sin(ta)*6.5);tb.rotation.y=-ta+Math.PI/2;
  tb.add(mesh(new T.CylinderGeometry(.06,.1,2.2,8),M(0xf4f6f2),0,TOP+1.1,0));
  const rotor=new T.Group();rotor.position.set(0,TOP+2.25,.12);
  for(let i=0;i<3;i++){const g=new T.Group();g.rotation.z=i*2.094;g.add(mesh(new T.BoxGeometry(.1,1.05,.03),M(0xffffff),0,.52,0));rotor.add(g)}
  rotor.add(mesh(new T.SphereGeometry(.11,8,6),M(0xdde3df)));tb.add(rotor);body.add(tb);
  // circular-economy orbit ring
  const orbit=new T.Group();orbit.rotation.x=1.32;orbit.rotation.z=-.12;isl.add(orbit);
  orbit.add(new T.Mesh(new T.TorusGeometry(8.7,.028,6,180),new T.MeshBasicMaterial({color:0x16b36a,transparent:true,opacity:.4})));
  const orbs=[0x16b36a,0xe08a33,0x3fa3ff,0xffb020,0xa97bff,0x8fa59b].map((c,i)=>{const m=new T.Mesh(new T.IcosahedronGeometry(.24,0),new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.45,flatShading:true}));m.userData.a=i/6*6.283;orbit.add(m);return m});
  // outage beacon
  const beacon=new T.Mesh(new T.SphereGeometry(.15,10,8),new T.MeshBasicMaterial({color:0xff3b30}));beacon.position.set(.95,TOP+1.5,.3);bio.add(beacon);
  // rain
  const RN=340,rg=new T.BufferGeometry(),rp=new Float32Array(RN*6);
  for(let i=0;i<RN;i++){const x=(rnd()-.5)*19,y=rnd()*13-2,z=(rnd()-.5)*19;rp.set([x,y,z,x,y-.55,z],i*6)}
  rg.setAttribute('position',new T.BufferAttribute(rp,3));
  const rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0x5b9cf0,transparent:true,opacity:0}));isl.add(rain);
  // fireworks
  const FW=[0xff7a00,0xff2d55,0xf2b705].map(col=>{const n=44,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
    const m=new T.PointsMaterial({color:col,size:.42,map:sprite,transparent:true,opacity:0,depthWrite:false});const p=new T.Points(g,m);p.frustumCulled=false;isl.add(p);
    const dirs=Array.from({length:n},()=>{const u=rnd()*6.283,v=Math.acos(2*rnd()-1);return [Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)]});return {g,m,dirs,n,c:[0,6,0],last:-1}});
  // drag to rotate
  let drag=0,vel=0,down=false,lx=0;
  [$('#heroSlot'),$('#stage')].forEach(el=>{el.addEventListener('pointerdown',e=>{down=true;lx=e.clientX;vel=0;try{el.setPointerCapture(e.pointerId)}catch(_){}});
    el.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-lx;lx=e.clientX;drag+=dx*.009;vel=dx*.009});
    ['pointerup','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{down=false}))});
  const sunBase=sun.intensity;

  // ---- more 3D: waste packets flowing from wards to facilities
  const pkCol=[0x16b36a,0xe08a33,0x3fa3ff,0xa97bff,0x8fa59b],pkIds=['bio','comp','mrf','ewf','lf'],PK=64;
  const pk=Array.from({length:PK},(_,i)=>{const m=mesh(new T.BoxGeometry(.17,.17,.17),new T.MeshStandardMaterial({color:0x16b36a,emissive:0x16b36a,emissiveIntensity:.35,flatShading:true}));m.castShadow=false;m.userData={w:i%12,d:0,off:(i*.618)%1,sp:.09+((i*7)%5)*.012};body.add(m);return m});
  let pkN=40;
  function pkAssign(r){const wts=[r.bio,r.comp,r.mrf+r.inf,Math.max(r.ewRec,r.F*.01),r.landfill],tot=wts.reduce((a,b)=>a+b,0);
    pk.forEach((m,i)=>{let x=(i+.5)/PK*tot,k=0;while(k<4&&x>wts[k]){x-=wts[k];k++}m.userData.d=k;m.material.color.setHex(pkCol[k]);m.material.emissive.setHex(pkCol[k])});pkN=clamp(Math.round(r.F/BASE*40),20,PK)}
  // night: street lamps, stars, sun and moon
  const lamps=[],halos=[];
  for(let i=0;i<22;i++){const a=i/22*6.283,x=Math.cos(a)*5.0,z=Math.sin(a)*5.0;
    body.add(mesh(new T.CylinderGeometry(.02,.02,.36,5),M(0x555f5a),x,TOP+.18,z));
    const l=new T.Mesh(new T.SphereGeometry(.08,8,6),new T.MeshBasicMaterial({color:0xffe9a0,transparent:true,opacity:0}));l.position.set(x,TOP+.38,z);body.add(l);lamps.push(l);
    const h=new T.Sprite(new T.SpriteMaterial({map:sprite,color:0xffd36b,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));h.scale.setScalar(.9);h.position.copy(l.position);body.add(h);halos.push(h)}
  const stg=new T.BufferGeometry(),sp3=new Float32Array(140*3);
  for(let i=0;i<140;i++){const u=rnd()*6.283,v=rnd()*1.2+.1,R=17;sp3.set([Math.cos(u)*Math.sin(v)*R*1.2,Math.cos(v)*R*.7+3,-Math.abs(Math.sin(u)*Math.sin(v))*R-2],i*3)}
  stg.setAttribute('position',new T.BufferAttribute(sp3,3));
  const stars=new T.Points(stg,new T.PointsMaterial({color:0xffffff,size:.16,map:sprite,transparent:true,opacity:0,depthWrite:false}));isl.add(stars);
  const sunD=new T.Mesh(new T.SphereGeometry(.9,18,14),new T.MeshBasicMaterial({color:0xffd24a,transparent:true}));sunD.position.set(11.5,9.5,-8);isl.add(sunD);
  const moonD=new T.Mesh(new T.SphereGeometry(.75,18,14),new T.MeshBasicMaterial({color:0xe8f0ff,transparent:true,opacity:0}));moonD.position.set(-11.5,9.5,-8);isl.add(moonD);
  let nightK=0;
  // scenario shockwave
  const shockM=new T.Mesh(new T.RingGeometry(.92,1,72),new T.MeshBasicMaterial({color:0x16b36a,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));shockM.rotation.x=-Math.PI/2;shockM.position.y=TOP+.03;body.add(shockM);
  let shock=0,lastKey=null;
  // hover and click on facilities
  const ray=new T.Raycaster(),mv=new T.Vector2();let hov=null,downX=0,downY=0;
  const facList=Object.values(FAC);
  function pickFac(e){mv.set(e.clientX/W*2-1,-(e.clientY/H)*2+1);ray.setFromCamera(mv,cam);const h=ray.intersectObjects(facList,true);if(!h.length)return null;let o=h[0].object;while(o&&facList.indexOf(o)<0)o=o.parent;return o?Object.keys(FAC).find(k=>FAC[k]===o):null}
  [$('#heroSlot'),$('#stage')].forEach(el=>{
    el.addEventListener('pointermove',e=>{if(down)return;hov=pickFac(e);el.style.cursor=hov?'pointer':''});
    el.addEventListener('pointerleave',()=>{hov=null;el.style.cursor=''});
    el.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY});
    el.addEventListener('pointerup',e=>{if(hov&&Math.hypot(e.clientX-downX,e.clientY-downY)<5)location.hash='#/map'})});
  // labels
  const LAB=$('#labels');
  const defs=[['bio','Bio-CNG plant','--c-bio',r=>nf(r.bio)+' t/day'],['comp','Compost','--c-comp',r=>nf(r.comp)+' t/day'],['mrf','Recycling (MRF)','--c-mrf',r=>nf(r.mrf+r.inf)+' t/day incl. pickers'],['ewf','E-waste centre','--c-ewf',r=>nf(r.ewRec,1)+' t/day'],['lf','Landfill','--c-lf',r=>nf(r.landfill)+' t/day']];
  const chips=defs.map(([id,name,col,get])=>{const el=document.createElement('div');el.className='flabel';el.style.setProperty('--dot','var('+col+')');el.innerHTML='<b>'+name+'</b><span></span>';LAB.appendChild(el);return {id,el,get,v:new T.Vector3()}});
  labelData=chips;

  // targets
  let tgt={F:BASE,fleet:'diesel',loopBeam:0,lf:.4,trucks:5};
  sceneApply=(r)=>{
    WSHARE.forEach((w,i)=>{towers[i].userData.t=Math.max(.22,r.F*w*.021)});
    tgt.trucks=clamp(Math.round(r.trucks/6),3,12);tgt.fleet=state.fleet;
    tgt.beam=state.down?0:clamp(r.bio/CAP.bio,0,1);pkAssign(r);{const key=[state.uplift,state.seg,state.informal,state.fleet,state.down].join('|');if(key!==lastKey){if(lastKey!==null)shock=1;lastKey=key}}tgt.lf=r.landfill/r.F;tgt.comp=r.comp/CAP.comp;tgt.mrf=clamp((r.mrf+r.inf)/220,0,1);
  };
  const fleetCol={diesel:0xffb93b,cng:0x2fd06b,ev:0x35b6ff};

  // layout + resize
  let W=0,H=0;
  function resize(){W=innerWidth;H=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix()}
  addEventListener('resize',resize);resize();

  const D=cam.position.length(), ppuOf=()=>H/(2*Math.tan(cam.fov*Math.PI/360)*D);
  const slotEl=$('#heroSlot'),stageEl=$('#stage'),heroEl=$('#top');
  const tmp=new T.Vector3(), cur={x:0,y:0,s:1,t:0};
  let mx=0,my=0,tmx=0,tmy=0;
  addEventListener('pointermove',e=>{tmx=e.clientX/W*2-1;tmy=e.clientY/H*2-1},{passive:true});
  const t0=performance.now();

  let lastNow=performance.now();
  function frame(now){
    const dt=Math.min(.1,Math.max(.001,(now-lastNow)/1000));lastNow=now;
    const time=(now-t0)/1000, intro=RM?1:1-Math.pow(1-clamp(time/1.8,0,1),3);
    const r1=slotEl.getBoundingClientRect(),r2=stageEl.getBoundingClientRect();if(r1.width>0)lastHs=r1;if(r2.width>0)lastSt=r2;const FB={left:0,top:0,width:W*.5,height:H*.6},hs=lastHs||FB,st=lastSt||FB;
    viewT+=((VIEW==='sim'?1:0)-viewT)*(1-Math.exp(-dt*4));const t=sm(clamp(viewT,0,1));
    const ppu=ppuOf();
    const fit=rc=>Math.min(rc.width*.98/(17.5*ppu),rc.height*1.0/(12.8*ppu));
    const tx=lerp(hs.left+hs.width/2,st.left+st.width/2,t), ty=lerp(hs.top+hs.height/2,st.top+st.height/2,t);
    const ts=lerp(fit(hs),fit(st),t)*(.6+.4*intro);
    cur.x+=(tx-cur.x)*(cur.t?(1-Math.exp(-dt*12)):1);cur.y+=(ty-cur.y)*(cur.t?(1-Math.exp(-dt*12)):1);cur.s+=(ts-cur.s)*(cur.t?(1-Math.exp(-dt*12)):1);cur.t=1;
    const sy=cur.y-(2.2*cur.s*ppu); // visual centre sits below the group origin
    tmp.set(cur.x/W*2-1,-(sy/H)*2+1,.5).unproject(cam).sub(cam.position).normalize();
    isl.position.copy(cam.position).addScaledVector(tmp,D);isl.scale.setScalar(Math.max(.05,cur.s));
    mx+=(tmx-mx)*.05;my+=(tmy-my)*.05;
    if(!down){drag+=vel;vel*=.94}body.rotation.y=-.55+(RM?0:Math.sin(time*.25)*.22)+mx*.35+drag;
    body.rotation.x=my*.06;
    body.position.y=RM?0:Math.sin(time*.9)*.18;

    // towers
    towers.forEach(m=>{m.userData.h+=(m.userData.t-m.userData.h)*.08;m.scale.y=m.userData.h;m.children[0].scale.y=1/m.userData.h;m.children[0].position.y=1});
    // trucks
    const sp=RM?.04:.22, n=tgt.trucks||5;
    trucks.forEach((g,i)=>{const u=g.userData;u.want=i<n?1:0;u.vis+=(u.want-u.vis)*.08;u.tgt=i/n*6.283;u.off+=(u.tgt-u.off)*.06;
      const a=time*sp+u.off;g.position.set(Math.cos(a)*4.35,TOP,Math.sin(a)*4.35);g.rotation.y=tanRot(a);g.scale.setScalar(Math.max(.001,u.vis));
      g.children[0].material.color.lerp(new T.Color(fleetCol[tgt.fleet||'diesel']),.15)});
    // facility feedback
    const b=tgt.beam==null?.6:tgt.beam;
    beam.material.opacity=.03+.22*b;beam.scale.set(.6+b*.6,.4+b*.6,.6+b*.6);beam.position.y=TOP+.95+1.7*(.4+b*.6);
    orb.visible=b>.02;orb.scale.setScalar(.5+b*.9);orb.position.y=TOP+.95+(.4+b*.6)*3.4+.2;orb.rotation.y=time;orb.rotation.x=time*.6;
    FAC.bio.userData.ring.material.opacity=.15+.35*b*(.6+.4*Math.sin(time*2));
    FAC.comp.userData.ring.material.opacity=.15+.3*(tgt.comp||.5)*(.6+.4*Math.sin(time*2+1));
    FAC.mrf.userData.ring.material.opacity=.15+.3*(tgt.mrf||.5)*(.6+.4*Math.sin(time*2+2));
    FAC.ewf.userData.ring.material.opacity=.3;
    const lfs=.5+(tgt.lf==null?.4:tgt.lf)*1.6;const mound=FAC.lf.getObjectByName('mound');mound.scale.set(lfs,lfs,lfs);mound.position.y=TOP+.3*lfs;
    // ambient
    const pa=pg.attributes.position;for(let i=0;i<N;i++){let y=pa.getY(i)+ps[i]*.012*(RM?0:1);if(y>9)y=-3;pa.setY(i,y);pa.setX(i,pa.getX(i)+Math.sin(time+i)*.0015*(RM?0:1))}pa.needsUpdate=true;
    clouds.forEach(c=>{c.position.x+=c.userData.s*.004*(RM?0:1);if(c.position.x>13)c.position.x=-13});
    chunks.forEach(c=>{c.userData.a+=c.userData.s*.003*(RM?0:1);c.position.set(Math.cos(c.userData.a)*c.userData.r,c.userData.y+Math.sin(time+c.userData.r)*.2,Math.sin(c.userData.a)*c.userData.r);c.rotation.x+=.004;c.rotation.y+=.006});


    // scenario FX + extras
    const fwOn=state.uplift>=30,rainOn=state.uplift>=10&&state.uplift<30;
    rotor.rotation.z-=RM?0:.015+(tgt.beam==null?.5:tgt.beam)*.04;
    orbs.forEach(o=>{o.userData.a+=RM?0:.006;o.position.set(Math.cos(o.userData.a)*8.7,Math.sin(o.userData.a)*8.7,0);o.rotation.x+=.02});
    beacon.visible=state.down;beacon.scale.setScalar(1+.5*Math.sin(time*9));
    rain.material.opacity+=((rainOn?.6:0)-rain.material.opacity)*.06;
    if(rain.material.opacity>.02){const a=rg.attributes.position;for(let i=0;i<RN;i++){const k=i*6;let y=a.array[k+1]-.32;if(y<-3){y+=14}a.array[k+1]=y;a.array[k+4]=y-.55}a.needsUpdate=true}
    FW.forEach((f,i)=>{const cyc=time*.5+i/3,k=Math.floor(cyc),age=cyc-k;
      if(k!==f.last){f.last=k;f.c=[(rnd()-.5)*11,5+rnd()*3.5,(rnd()-.5)*6]}
      const R=age*2.8,a=f.g.attributes.position;
      for(let j=0;j<f.n;j++){const d=f.dirs[j];a.array[j*3]=f.c[0]+d[0]*R;a.array[j*3+1]=f.c[1]+d[1]*R-age*age*1.6;a.array[j*3+2]=f.c[2]+d[2]*R}
      a.needsUpdate=true;const target=fwOn?(1-age)*Math.min(1,age*18):0;f.m.opacity+=(target-f.m.opacity)*.5});
    nightK+=((NIGHT?1:0)-nightK)*(1-Math.exp(-dt*3));sun.intensity+=((rainOn?sunBase*.55:fwOn?sunBase*.8:sunBase)*(1-.82*nightK)-sun.intensity)*.05;hemi.intensity=.95-.62*nightK;
    sun.color.lerp(new T.Color(nightK>.5?0x7f98ff:fwOn?0xffa866:0xfff1cf),.04);
    clouds.forEach(c=>c.children.forEach(m=>m.material.color.lerp(new T.Color(rainOn?0x8795a3:0xffffff),.04)));
    const fxEl=document.getElementById('fxTag');if(fxEl){const txt=fwOn?'Festival mode: fireworks and extra trucks':rainOn?'Monsoon mode: rain and wet-waste load':state.down?'Biogas plant offline':'';if(fxEl.textContent!==txt){fxEl.textContent=txt;fxEl.classList.toggle('on',!!txt)}}

    // packets, night, hover, shockwave
    pk.forEach((m,i)=>{const d=m.userData;m.visible=((i*29)%PK)<pkN;if(!m.visible)return;
      const u=(time*d.sp*2.2+d.off)%1,tw=towers[d.w],f=FAC[pkIds[d.d]].position,sy=TOP+tw.userData.h;
      m.position.set(lerp(WPOS[d.w][0],f.x,u),lerp(sy,TOP+.9,u)+Math.sin(u*Math.PI)*2.4,lerp(WPOS[d.w][1],f.z,u));
      m.scale.setScalar(.35+Math.sin(u*Math.PI)*.9);m.rotation.y=time*2+i});
    lamps.forEach(l=>l.material.opacity=nightK);halos.forEach(h=>h.material.opacity=nightK*.85);
    stars.material.opacity=nightK*.9;sunD.material.opacity=1-nightK;moonD.material.opacity=nightK;
    Object.keys(FAC).forEach(k=>{const g=FAC[k],t=hov===k?1.14:1;g.scale.setScalar(g.scale.x+(t-g.scale.x)*(1-Math.exp(-dt*12)))});
    chips.forEach(c=>c.el.classList.toggle('hi',c.id===hov));
    if(shock>0){shock=Math.max(0,shock-dt);shockM.scale.setScalar(2+(1-shock)*16);shockM.material.opacity=shock*.55}else shockM.material.opacity=0;
    smoke.forEach((m,i)=>{const ph=(time*.3+i/6)%1;m.position.set(.85+ph*.5,TOP+1.65+ph*1.6,-.3);m.scale.setScalar(.08+ph*.3);m.material.opacity=.45*(1-ph)});
    renderer.render(scene,cam);

    // HTML labels follow facilities
    const show=(VIEW==='sim'||VIEW==='dash')?clamp(intro*1.6-.6,0,1):0;
    chips.forEach(c=>{FAC[c.id].getWorldPosition(c.v);c.v.y+=1.1*cur.s;c.v.project(cam);
      const x=(c.v.x*.5+.5)*W,y=(-c.v.y*.5+.5)*H,dx=x-cur.x,dy=y-(cur.y-40),ln=Math.hypot(dx,dy)||1,x2=x+dx/ln*78,y2=y+dy/ln*46;c.el.style.transform='translate('+(x2-c.el.offsetWidth/2)+'px,'+(y2-c.el.offsetHeight/2)+'px)';c.el.style.opacity=show});
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}


/* ===== app shell + extra views ===== */
const TABS=[['dash','🏠','Dashboard'],['map','🗺️','Live Map'],['bins','🗑️','Bins'],['trucks','🚛','Trucks & Routes'],['ai','🤖','AI Recommendations'],['analytics','📊','Analytics'],['forecast','🔮','Forecasts'],['alerts','⚠️','Alerts'],['sim','⚙️','Simulation']];
const IC={dash:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',map:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',bins:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',trucks:'<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',ai:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',analytics:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',forecast:'<path d="M3 17l5-6 4 3 8-9"/><path d="M15 5h5v5"/>',alerts:'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',sim:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'};
const TITLES={dash:['Dashboard','City waste operations at a glance'],map:['Live Map','Wards, bins, facilities and trucks'],bins:['Bins','Estimated fill and pickup status'],trucks:['Trucks & Routes','Fleet groups and optimised loops'],ai:['AI Recommendations','What to change, and what it is worth'],analytics:['Analytics','This scenario against a normal day'],forecast:['Forecasts','Next 14 days and ward outlook'],alerts:['Alerts','Capacity, overflow and demand'],sim:['Simulation','Test festivals, outages and policy changes']};
$('#tabs').innerHTML=TABS.map(([k,e,l])=>'<a href="#/'+k+'" data-t="'+k+'" title="'+l+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[k]+'</svg><span class="t">'+l+'</span>'+(k==='alerts'?'<span class="bd" id="alBd"></span>':'')+'</a>').join('');
function route(){
  const m=location.hash.match(/^#\/(\w+)/);if(m&&TABS.some(t=>t[0]===m[1])&&m[1]!==VIEW){VIEW=m[1];scrollTo(0,0)}
  document.body.dataset.view=VIEW;
  if(VIEW!==_lv){_lv=VIEW;const t=$('#pgT');t.classList.remove('sw');void t.offsetWidth;t.classList.add('sw');$$('section[data-view="'+VIEW+'"]').forEach(e=>{e.classList.add('enter');setTimeout(()=>e.classList.remove('enter'),1900)})}
  $$('section[data-view]').forEach(e=>e.hidden=e.dataset.view!==VIEW);
  $$('#tabs a').forEach(a=>{if(a.dataset.t===VIEW)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  $('#pgT').textContent=TITLES[VIEW][0];$('#pgS').textContent=TITLES[VIEW][1];
}
addEventListener('hashchange',route);

const ZONE=['Market','Old town','Transit','Commercial','Institutional','Institutional','Residential','Residential','Industrial','Residential','Residential','Market'];
const brng=mulberry32(5), BINS=[];
WARDS.forEach((w,i)=>{for(let k=0;k<3;k++){const a=brng()*6.283,rr=.5+brng()*.55;BINS.push({id:'B'+String(i*3+k+1).padStart(2,'0'),w:i,type:['Wet','Dry','Mixed'][k],rate:.55+brng()*.6,h:6+brng()*24,x:WPOS[i][0]+Math.cos(a)*rr,y:WPOS[i][1]+Math.sin(a)*rr})}});
const binFill=(b,u)=>Math.min(130,b.rate*(1+u/100)*b.h/24*100);
const binSt=f=>f>=100?['Overflow','t-r','#ff6f4e']:f>=80?['Due','t-y','#ffb93b']:['OK','t-g','#1fbf6f'];
let binF='all',alF='all',lastR=null;
function chips(id,opts,cur,fn){$(id).innerHTML=opts.map(([k,l])=>'<button class="chip" data-k="'+k+'" aria-pressed="'+(k===cur)+'">'+l+'</button>').join('');$$(id+' .chip').forEach(b=>b.onclick=()=>fn(b.dataset.k))}

function buildAlerts(r,b){
  const A=[],f=BINS.map(x=>binFill(x,state.uplift)),over=f.filter(v=>v>=100).length,due=f.filter(v=>v>=80).length;
  const ws=[...new Set(BINS.filter((x,i)=>f[i]>=100).map(x=>WARDS[x.w]))].slice(0,3).join(', ');
  if(over)A.push({s:'crit',t:over+' bins likely to overflow',d:'Estimated fill above 100% in '+ws+'.',go:'bins'});
  if(state.down)A.push({s:'crit',t:'Biogas plant offline',d:'Organic waste goes to compost only, and '+nf(r.wetLost)+' t a day has no facility.',go:'sim'});
  else if(r.wetLost>1)A.push({s:'crit',t:nf(r.wetLost)+' t/day of organic waste has no facility',d:'Compost and biogas capacity are both full.',go:'sim'});
  if(!state.down&&r.bio/CAP.bio>.9)A.push({s:'warn',t:'Biogas plant near capacity',d:nf(r.bio)+' of '+CAP.bio+' t/day in use.',go:'sim'});
  if(r.comp/CAP.comp>.9)A.push({s:'warn',t:'Compost site near capacity',d:nf(r.comp)+' of '+CAP.comp+' t/day in use.',go:'sim'});
  if(r.landfill/r.F>.5)A.push({s:'warn',t:'More than half the waste still reaches landfill',d:'Raising sorting at source is the biggest lever.',go:'ai'});
  if(r.trucks>b.trucks*1.2)A.push({s:'warn',t:'Truck demand up '+nf((r.trucks/b.trucks-1)*100)+'%',d:r.trucks+' trucks needed against '+b.trucks+' on a normal day.',go:'trucks'});
  if(due>over)A.push({s:'warn',t:(due-over)+' more bins due for pickup',d:'Fill between 80% and 100%.',go:'bins'});
  if(state.uplift>=20)A.push({s:'info',t:'Festival window in the plan',d:'+'+state.uplift+'% waste is assumed for the festival days.',go:'forecast'});
  if(!A.length)A.push({s:'info',t:'All clear',d:'No capacity, overflow or truck-demand issues in this scenario.',go:'dash'});
  return A.sort((a,c)=>['crit','warn','info'].indexOf(a.s)-['crit','warn','info'].indexOf(c.s));
}
function renderViews(r,b){
  lastR=r;route();
  const A=buildAlerts(r,b),f=BINS.map(x=>binFill(x,state.uplift)),due=f.filter(v=>v>=80).length;
  const nb=A.filter(a=>a.s!=='info').length;$('#alBd').textContent=nb||'';
  const cc={crit:'#ff5a3c',warn:'#ffb93b',info:'#3fa3ff'};
  $('#miniAl').innerHTML=A.slice(0,4).map(a=>'<div class="mini"><i style="background:'+cc[a.s]+'"></i><div><b>'+a.t+'</b><small>'+a.d+'</small></div></div>').join('');
  const pn=Object.keys(PRESETS).find(k=>{const p=PRESETS[k];return p.uplift===state.uplift&&p.seg===state.seg&&p.informal===state.informal&&p.down===state.down});
  const pl=$('#scPill'),pt=pn?{normal:'Normal day',diwali:'Diwali week',monsoon:'Monsoon',outage:'Biogas plant down'}[pn]:'Custom scenario';if(pl.textContent!==pt){pl.textContent=pt;pl.classList.remove('bump');void pl.offsetWidth;pl.classList.add('bump')}
  $$('.twin-f .chip[data-preset]').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.preset===pn)));
  // glance
  const gl=(h,n,u,t)=>'<article class="kpi"><h3>'+h+'</h3><p class="big"><span>'+n+'</span><small>'+u+'</small></p><p class="dl">'+t+'</p></article>';
  $('#glanceG').innerHTML=gl('Bins needing pickup',due,'of '+BINS.length,'Estimated, no sensors')+gl('Estimated trucks needed',r.trucks,'trucks',nf(r.trips)+' trips, '+nf(r.kmOpt)+' km')+gl('Open alerts',nb,'alerts',A[0].t)+gl('CO₂ avoided',nf(r.co2,0),'t / day','Net, current scenario');
  // bins
  const cnt=k=>k==='all'?BINS.length:k==='due'?due:f.filter(v=>v>=100).length;
  chips('#binChips',[['all','All ('+cnt('all')+')'],['due','Due or overflow ('+cnt('due')+')'],['over','Overflow ('+cnt('over')+')']],binF,k=>{binF=k;renderViews(lastR,b)});
  $('#binBody').innerHTML=BINS.map((x,i)=>({x,v:f[i]})).filter(o=>binF==='all'||(binF==='due'&&o.v>=80)||(binF==='over'&&o.v>=100)).sort((a,c)=>c.v-a.v).map(({x,v})=>{const st=binSt(v);
    return '<tr><td><b>'+x.id+'</b></td><td>'+WARDS[x.w]+'</td><td>'+x.type+'</td><td style="min-width:140px"><div class="meter" style="height:10px"><i style="width:'+Math.min(100,v)+'%;background:'+st[2]+'"></i></div></td><td>'+nf(v)+'%</td><td class="mut">Group '+'ABCDEF'[x.w%6]+', '+(v>=100?'now':v>=80?'next round':'tomorrow')+'</td><td><span class="tag '+st[1]+'">'+st[0]+'</span></td></tr>'}).join('');
  // Trucks & Routes: illustrative scenario estimates, not live GPS data
  const load=r.F-r.inf,mp=v=>[70+v[0]*17,70+v[1]*17];
  $('#truckG').innerHTML='ABCDEF'.split('').map((L,k)=>{
    const ws=WARDS.map((_,i)=>i).filter(i=>i%6===k).sort((a,c)=>Math.atan2(P[a][1],P[a][0])-Math.atan2(P[c][1],P[c][0]));
    const t=ws.reduce((a,i)=>a+WSHARE[i],0)*load,trips=Math.ceil(t/CAP.truck),n=Math.ceil(trips/CAP.trips),km=trips*AS.kmTrip.mid;
    let d='M'+mp(DEPOT);ws.forEach(i=>d+=' L'+mp(P[i]));d+=' Z';
    const dots=ws.map(i=>'<circle cx="'+mp(P[i])[0]+'" cy="'+mp(P[i])[1]+'" r="5" fill="#ffb93b"/>').join('');
    return '<article class="kpi tc"><h3>Fleet group '+L+' ('+state.fleet.toUpperCase()+')</h3><p class="big"><span>'+n+'</span><small>estimated trucks</small></p><svg viewBox="0 0 140 140" role="img" aria-label="Route for group '+L+'"><path d="'+d+'" fill="none" stroke="#17b86a" stroke-width="2.4"/>'+dots+'<rect x="63" y="63" width="14" height="14" rx="3" fill="#0f6b46"/></svg><p class="rng">'+nf(t)+' t, '+trips+' trips, '+nf(km)+' km</p><p class="dl">'+ws.map(i=>WARDS[i]).join(' and ')+'</p></article>'}).join('');
  // AI
  const T=ch=>calc({...state,...ch}),L=[];
  if(state.seg<80){const x=T({seg:80});L.push({t:'Raise sorting at source to 80%',w:'Keeps '+nf(x.div-r.div,1)+' more points out of landfill and avoids '+nf(x.co2-r.co2,1)+' t CO₂e a day.',d:x.co2-r.co2,ch:{seg:80},g:'Needs awareness drives and door-to-door follow-up'})}
  if(state.informal<35){const x=T({informal:35});L.push({t:'Partner with waste pickers for more dry waste',w:'Takes '+nf(r.trucks-x.trucks)+' truck(s) and '+nf(r.kmOpt-x.kmOpt)+' km a day off the road, and gives pickers steady access.',d:x.co2-r.co2,ch:{informal:35},g:'Livelihood benefit, not counted in the numbers'})}
  if(state.fleet==='diesel'){const x=T({fleet:'ev'}),y=T({fleet:'cng'});L.push({t:'Move the fleet off diesel',w:'Electric avoids '+nf(x.co2-r.co2,1)+' t CO₂e a day, CNG '+nf(y.co2-r.co2,1)+' t. CNG can run on the plant\'s own bio-CNG.',d:x.co2-r.co2,ch:{fleet:'ev'},g:'Check charging and depot power first'})}
  if(state.down||r.wetLost>1){const x=T({down:false});L.push({t:state.down?'Restore the biogas plant, or find a second site':'Add organic capacity',w:nf(r.wetLost)+' t a day of organic waste has no facility.'+(state.down?' Restoring the plant adds '+nf(x.co2-r.co2,1)+' t CO₂e avoided a day.':' More compost or biogas capacity would take it.'),d:state.down?x.co2-r.co2:.02,ch:state.down?{down:false}:null,g:'Compost partner or a second plant'})}
  if(state.uplift>=15){const x=T({uplift:0});const top=WARDS.map((w,i)=>[w,WSHARE[i]]).sort((a,c)=>c[1]-a[1]).slice(0,3).map(a=>a[0]).join(', ');L.push({t:'Plan a festival surge',w:'Add '+(r.trucks-x.trucks)+' trucks and a second shift. Start with '+top+'.',d:0,ch:null,g:'Based on your uplift assumption'})}
  if(r.cng>0&&!state.down)L.push({t:'Use the bio-CNG surplus',w:'The plant makes '+nf(r.cng/1000,1)+' t of bio-CNG a day and a CNG fleet needs '+nf(r.cng*r.loop/1000,1)+' t. Sell the rest or fuel buses.',d:.01,ch:null,g:'Yield is an assumption, see the register'});
  L.sort((a,c)=>c.d-a.d);window.__ai=L;
  $('#aiG').innerHTML=L.map((o,i)=>'<article class="panel aic"><span class="tg">'+(o.d>.05?'Estimated gain: '+nf(o.d,1)+' t CO₂e a day':'Operational')+'</span><h3>'+o.t+'</h3><p>'+o.w+'</p><span class="tg">'+o.g+'</span>'+(o.ch?'<button class="btn" data-ai="'+i+'">Apply in simulation</button>':'')+'</article>').join('')||'<p>No changes suggested for this scenario.</p>';
  $$('[data-ai]').forEach(bt=>bt.onclick=()=>{Object.assign(state,window.__ai[+bt.dataset.ai].ch);syncInputs();location.hash='#/sim';queueRender()});
  // analytics
  const bar=(l,v,mx,u,c)=>'<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>'+l+'</span><b>'+u(v)+'</b></div><div class="meter"><i style="width:'+(v/mx*100)+'%;background:'+c+'"></i></div></div>';
  const card=(t,a,c0,u)=>{const mx=Math.max(a,c0,1e-9)*1.08;return '<div class="panel flat"><h3>'+t+'</h3>'+bar('Normal day',c0,mx,u,'var(--c-res)')+bar('This scenario',a,mx,u,'var(--leaf)')+'</div>'};
  $('#anaG').innerHTML=card('Kept out of landfill',r.div,b.div,v=>nf(v,1)+'%')+card('CO₂ avoided',r.co2,b.co2,v=>nf(v,0)+' t')+card('Distance driven',r.kmOpt,b.kmOpt,v=>nf(v)+' km')+card('Electricity from biogas',r.mwh,b.mwh,v=>nf(v,1)+' MWh');
  // Keep demo forecast only until historical API data has loaded.
  if (!window.wasteflowHistoricalForecastConnected) {
  const M=[.92,1.03,.98,.97,1.01,1.08,1.0],Wd=760,Hd=270,x0=44,x1=Wd-34,y0=18,y1=Hd-40,days=[];
  for(let i=0;i<14;i++){const d=new Date(Date.now()+i*864e5),fest=state.uplift>0&&i>=7&&i<=9;days.push({d,fest,v:BASE*M[d.getDay()]*(fest?1+state.uplift/100:1)})}
  const ymax=Math.ceil(Math.max(...days.map(x=>x.v))*1.1/100)*100,X=i=>x0+i*(x1-x0)/13,Y=v=>y1-v/ymax*(y1-y0);
  let sv='';for(let g=0;g<=4;g++){const v=ymax/4*g;sv+='<line x1="'+x0+'" x2="'+x1+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="currentColor" opacity=".12"/><text x="'+(x0-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11">'+nf(v)+'</text>'}
  if(state.uplift>0)sv+='<rect x="'+(X(7)-14)+'" y="'+y0+'" width="'+(X(9)-X(7)+28)+'" height="'+(y1-y0)+'" fill="#ffb93b" opacity=".22" rx="8"/><text x="'+X(8)+'" y="'+(y0+14)+'" text-anchor="middle" font-size="11" font-weight="700">Festival window</text>';
  sv+='<polygon points="'+days.map((o,i)=>X(i)+','+Y(o.v*1.08)).join(' ')+' '+days.map((o,i)=>X(13-i)+','+Y(days[13-i].v*.92)).join(' ')+'" fill="#1fbf6f" opacity=".22"/><polyline points="'+days.map((o,i)=>X(i)+','+Y(o.v)).join(' ')+'" pathLength="1" fill="none" stroke="#12a566" stroke-width="3" stroke-linejoin="round"/>';
  days.forEach((o,i)=>{sv+='<circle cx="'+X(i)+'" cy="'+Y(o.v)+'" r="4" fill="'+(o.fest?'#ff9f1c':'#12a566')+'"><title>'+nf(o.v)+' t</title></circle><text x="'+X(i)+'" y="'+(Hd-18)+'" text-anchor="middle" font-size="10">'+o.d.toLocaleDateString('en-IN',{weekday:'short'})+' '+o.d.getDate()+'</text>'});
  $('#fcSvg').innerHTML=sv;
  const tm=new Date(Date.now()+864e5).getDay();
  $('#fcBody').innerHTML=WARDS.map((w,i)=>{const t=BASE*WSHARE[i]*M[tm],w7=[...Array(7)].reduce((a,_,k)=>a+BASE*WSHARE[i]*M[(new Date().getDay()+k)%7],0);return '<tr><td><b>'+w+'</b></td><td class="mut">'+ZONE[i]+'</td><td>'+nf(t,1)+'</td><td class="mut">'+nf(t*.92,1)+' to '+nf(t*1.08,1)+'</td><td>'+nf(w7)+'</td></tr>'}).join('');
  }
  // alerts
  chips('#alChips',[['all','All ('+A.length+')'],['crit','Critical'],['warn','Warnings'],['info','Info']],alF,k=>{alF=k;renderViews(lastR,b)});
  const col={crit:'#ff5a3c',warn:'#ffb93b',info:'#2f9bff'};
  $('#alertL').innerHTML=A.filter(a=>alF==='all'||a.s===alF).map(a=>'<div class="al"><i style="background:'+col[a.s]+'"></i><div><b>'+a.t+'</b><small>'+a.d+'</small></div><a class="btn" href="#/'+a.go+'">Open</a></div>').join('')||'<p class="mut">Nothing in this category.</p>';
  drawMap(r,f);
}
/* live map */
const MC=v=>[400+v[0]*49,288+v[1]*49];
const RPTS=[DEPOT,...OPT_ORDER.map(i=>P[i]),DEPOT].map(MC);
const RLEN=[0];for(let i=1;i<RPTS.length;i++)RLEN.push(RLEN[i-1]+Math.hypot(RPTS[i][0]-RPTS[i-1][0],RPTS[i][1]-RPTS[i-1][1]));
let mapTrucks=3;
function drawMap(r,f){
  const svg=$('#mapSvg');let o='<g opacity=".25" fill="none" stroke="currentColor"><circle cx="400" cy="288" r="'+(4.35*49)+'"/><circle cx="400" cy="288" r="'+(6.4*49)+'" stroke-dasharray="4 6"/></g>';
  o+='<polyline class="flow" points="'+RPTS.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#1fbf6f" stroke-width="2.5" stroke-dasharray="7 6" opacity=".7"/>';
  o+='<g class="l-wards">'+WARDS.map((w,i)=>{const c=MC(P[i]),t=r.F*WSHARE[i];return '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+(12+t*.26)+'" fill="#f0922d" opacity=".32" stroke="#f0922d"><title>'+w+': '+nf(t)+' t/day</title></circle><text x="'+c[0]+'" y="'+(c[1]+4)+'" text-anchor="middle" opacity=".85">'+nf(t)+'</text>'}).join('')+'</g>';
  const apiRows = Array.isArray(window.wasteflowApiBins) ? window.wasteflowApiBins : null;
  const mapBins = apiRows && apiRows.length
    ? apiRows.map((x,i) => ({
        id: x.bin_id || ('Bin '+(i+1)),
        ward: x.ward_name || 'Ward',
        fill: Number(x.estimated_fill_pct) || 0,
        // API currently provides no geographic coordinates: use stable demo positions.
        pos: [Math.cos(i*2.399)* (1.2+(i%7)*.72), Math.sin(i*2.399)*(1.2+(i%7)*.72)]
      }))
    : BINS.map((x,i) => ({id:x.id,ward:WARDS[x.w]||'Ward',fill:Number(f[i])||0,pos:[x.x,x.y]}));
  o+='<g class="l-bins">'+mapBins.map(x=>{const c=MC(x.pos),fill=x.fill,st=fill>=100?['Overflow','#ff6f4e']:fill>=80?['Due','#ffb93b']:['OK','#1fbf6f'];return (fill>=100?'<circle class="pr" cx="'+c[0]+'" cy="'+c[1]+'" r="7" fill="none" stroke="#ff6f4e" stroke-width="2"/>':'')+'<circle cx="'+c[0]+'" cy="'+c[1]+'" r="5" fill="'+st[1]+'" stroke="#fff" stroke-width="1.5"><title>'+String(x.id).replace(/[&<>"]/g,'')+', '+String(x.ward).replace(/[&<>"]/g,'')+': '+nf(fill,1)+'% ('+st[0]+')</title></circle>'}).join('')+'</g>';
  const fac=[['Biogas',35,'#25d070',r.bio],['Compost',115,'#d9822b',r.comp],['MRF',190,'#2f9bff',r.mrf+r.inf],['E-waste',265,'#a46bff',r.ewRec],['Landfill',325,'#8fa59b',r.landfill]];
  o+='<g class="l-fac">'+fac.map(([n,d,c,v])=>{const a=d*Math.PI/180,p=MC([Math.cos(a)*5.6,Math.sin(a)*5.6]);return '<rect x="'+(p[0]-15)+'" y="'+(p[1]-15)+'" width="30" height="30" rx="8" fill="'+c+'"><title>'+n+': '+nf(v)+' t/day</title></rect><text x="'+p[0]+'" y="'+(p[1]+32)+'" text-anchor="middle">'+n+' '+nf(v)+' t</text>'}).join('')+'</g>';
  o+='<rect x="391" y="279" width="18" height="18" rx="4" fill="#0f6b46"/><text x="400" y="314" text-anchor="middle">Depot</text>';
  mapTrucks=clamp(Math.round(r.trucks/12),2,6);
  o+='<g class="l-trk">'+Array.from({length:6},(_,i)=>'<circle id="mt'+i+'" r="7" fill="#2f9bff" stroke="#fff" stroke-width="2" style="display:'+(i<mapTrucks?'':'none')+'"><title>Truck '+(i+1)+'</title></circle>').join('')+'</g>';
  svg.innerHTML=o;
}
$$('#mapTog input').forEach(c=>c.addEventListener('change',()=>$('#mapSvg').classList.toggle('hide-'+c.dataset.l,!c.checked)));
(function mapLoop(now){
  if(VIEW==='map'){const tot=RLEN[RLEN.length-1];for(let i=0;i<mapTrucks;i++){const el=document.getElementById('mt'+i);if(!el)continue;const d=(((RM?0:now)/14000+i/mapTrucks)%1)*tot;let k=1;while(k<RLEN.length-1&&RLEN[k]<d)k++;const u=(d-RLEN[k-1])/((RLEN[k]-RLEN[k-1])||1),a=RPTS[k-1],b2=RPTS[k];el.setAttribute('cx',a[0]+(b2[0]-a[0])*u);el.setAttribute('cy',a[1]+(b2[1]-a[1])*u)}}
  requestAnimationFrame(mapLoop)})(0);


document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const c=e.target.closest&&e.target.closest('.kpi,.aic');if(!c)return;
  const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  c.style.setProperty('--ry',((x-.5)*11).toFixed(2)+'deg');c.style.setProperty('--rx',((.5-y)*9).toFixed(2)+'deg');c.style.setProperty('--mx',(x*100).toFixed(1)+'%');c.style.setProperty('--my',(y*100).toFixed(1)+'%')});
document.addEventListener('pointerout',e=>{const c=e.target.closest&&e.target.closest('.kpi,.aic');if(c&&!c.contains(e.relatedTarget)){c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg')}});
$('#dnBtn').addEventListener('click',e=>{NIGHT=!NIGHT;e.currentTarget.setAttribute('aria-pressed',String(NIGHT));e.currentTarget.textContent=NIGHT?'Day mode':'Night mode';$('.twin').classList.toggle('night',NIGHT)});
/* ---------------- boot ---------------- */
buildTable();
drawRoute('#rBase',BASE_ORDER,'#ff6f4e');drawRoute('#rOpt',OPT_ORDER,'#17b86a');
try{initScene()}catch(e){document.body.classList.add('no-gl');console.warn('3D scene unavailable',e)}
render();

/* Optional backend adapter (AWS API Gateway):
   if API_URL is set, fetch(API_URL+'/scenario?uplift='+state.uplift+'&seg='+state.seg)
   and replace calc(state) with the returned JSON (same field names as calc()). */

/* WASTEFLOW_API_BINS_ADAPTER */
// /* API URL ko deployment ke browser-accessible proxy URL par set karna hoga. */
// const WASTEFLOW_BINS_API = 'https://wasteflow-4o45.onrender.com/bins';
// let wasteflowApiBins = null;
// let wasteflowApiError = '';

// function renderWasteflowApiBins() {
//   const body = document.querySelector('#binBody');
//   const chipBox = document.querySelector('#binChips');
//   if (!body || !chipBox || !wasteflowApiBins) return;

//   const rows = wasteflowApiBins;
//   const dueCount = rows.filter(x => Number(x.estimated_fill_pct) >= 80).length;
//   const overCount = rows.filter(x => Number(x.estimated_fill_pct) >= 100).length;
//   const counts = {all: rows.length, due: dueCount, over: overCount};

//   chipBox.innerHTML = [
//     ['all', 'All (' + counts.all + ')'],
//     ['due', 'Due or overflow (' + counts.due + ')'],
//     ['over', 'Overflow (' + counts.over + ')']
//   ].map(([key, label]) =>
//     '<button type="button" class="chip' +
//     ((window.wasteflowBinFilter || 'all') === key ? ' active' : '') +
//     '" data-api-bin-filter="' + key + '">' + label + '</button>'
//   ).join('');

//   chipBox.querySelectorAll('[data-api-bin-filter]').forEach(button => {
//     button.addEventListener('click', () => {
//       window.wasteflowBinFilter = button.dataset.apiBinFilter;
//       renderWasteflowApiBins();
//     });
//   });

//   const filter = window.wasteflowBinFilter || 'all';
//   const visible = rows.filter(x => {
//     const fill = Number(x.estimated_fill_pct) || 0;
//     return filter === 'all' ||
//       (filter === 'due' && fill >= 80) ||
//       (filter === 'over' && fill >= 100);
//   }).sort((a, b) => Number(b.estimated_fill_pct) - Number(a.estimated_fill_pct));

//   body.innerHTML = visible.map(x => {
//     const fill = Math.max(0, Number(x.estimated_fill_pct) || 0);
//     const status = fill >= 100
//       ? ['Overflow', 't-r', '#ff6f4e']
//       : fill >= 80
//         ? ['Due', 't-y', '#ffb93b']
//         : ['OK', 't-g', '#1fbf6f'];

//     const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
//       '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
//     }[c]));

//     return '<tr>' +
//       '<td><b>' + esc(x.bin_id) + '</b></td>' +
//       '<td>' + esc(x.ward_name) + '</td>' +
//       '<td>Mixed</td>' +
//       '<td style="min-width:140px"><div class="meter" style="height:10px">' +
//       '<i style="width:' + Math.min(100, fill) + '%;background:' + status[2] + '"></i>' +
//       '</div></td>' +
//       '<td>' + fill.toFixed(1) + '%</td>' +
//       '<td class="mut">Historical estimate · ' + esc(x.date) +
//       ' · ' + esc(x.capacity_liters) + ' L</td>' +
//       '<td><span class="tag ' + status[1] + '">' + status[0] + '</span></td>' +
//       '</tr>';
//   }).join('');

//   if (!visible.length) {
//     body.innerHTML = '<tr><td colspan="7">No bins match this filter.</td></tr>';
//   }
// }

// const wasteflowOriginalRenderViews = renderViews;
// renderViews = function(r, b) {
//   wasteflowOriginalRenderViews(r, b);
//   renderWasteflowApiBins();
// };

// fetch(WASTEFLOW_BINS_API)
//   .then(response => {
//     if (!response.ok) throw new Error('API HTTP ' + response.status);
//     return response.json();
//   })
//   .then(payload => {
//     if (!Array.isArray(payload.bins)) throw new Error('API response mein bins array nahi hai');
//     wasteflowApiBins = payload.bins;
//    window.wasteflowApiBins = payload.bins;
//     window.wasteflowBinFilter = 'all';
//     renderWasteflowApiBins();
//     console.info('WasteFlow API connected:', payload.count, 'bins; data status:', payload.data_status);
//   })
//   .catch(error => {
//     wasteflowApiError = error.message;
//     console.error('WasteFlow bins API connect nahi hua:', error.message);
//     const body = document.querySelector('#binBody');
//     if (body) body.innerHTML =
//       '<tr><td colspan="7">API data load nahi hua. Browser-accessible API URL aur proxy/CORS settings check karein.</td></tr>';
//   });

// })();
/* WASTEFLOW_API_BINS_ADAPTER */
const WASTEFLOW_BINS_API = 'https://wasteflow-4o45.onrender.com/bins';
let wasteflowApiBins = null;
let wasteflowApiError = '';

/* Dashboard: sirf "Bins needing pickup" card API se calculate hota hai.
   Baaki 3 cards demo model se aate hain, unpe label lagaya hai. */
function renderWasteflowApiGlance() {
  const box = document.querySelector('#glanceG');
  if (!box || !wasteflowApiBins) return;
  const cards = box.querySelectorAll('.kpi');
  if (!cards.length) return;

  const rows = wasteflowApiBins;
  const fillOf = x => Number(x.estimated_fill_pct) || 0;
  const due = rows.filter(x => fillOf(x) >= 80).length;
  const over = rows.filter(x => fillOf(x) >= 100).length;
  const dates = rows.map(x => String(x.date || '')).filter(Boolean).sort();
  const latest = dates.length ? dates[dates.length - 1] : 'date n/a';

  cards[0].outerHTML =
    '<article class="kpi"><h3>Bins needing pickup</h3>' +
    '<p class="big"><span>' + due + '</span><small>of ' + rows.length + '</small></p>' +
    '<p class="dl">Simulated historical estimate · ' + over + ' overflow · ' + latest + '</p></article>';

}

function renderWasteflowApiBins() {
  renderWasteflowApiGlance();

  const body = document.querySelector('#binBody');
  const chipBox = document.querySelector('#binChips');
  if (!body || !chipBox || !wasteflowApiBins) return;

  const rows = wasteflowApiBins;
  const dueCount = rows.filter(x => Number(x.estimated_fill_pct) >= 80).length;
  const overCount = rows.filter(x => Number(x.estimated_fill_pct) >= 100).length;
  const counts = {all: rows.length, due: dueCount, over: overCount};

  chipBox.innerHTML = [
    ['all', 'All (' + counts.all + ')'],
    ['due', 'Due or overflow (' + counts.due + ')'],
    ['over', 'Overflow (' + counts.over + ')']
  ].map(([key, label]) =>
    '<button type="button" class="chip' +
    ((window.wasteflowBinFilter || 'all') === key ? ' active' : '') +
    '" data-api-bin-filter="' + key + '">' + label + '</button>'
  ).join('');

  chipBox.querySelectorAll('[data-api-bin-filter]').forEach(button => {
    button.addEventListener('click', () => {
      window.wasteflowBinFilter = button.dataset.apiBinFilter;
      renderWasteflowApiBins();
    });
  });

  const filter = window.wasteflowBinFilter || 'all';
  const visible = rows.filter(x => {
    const fill = Number(x.estimated_fill_pct) || 0;
    return filter === 'all' ||
      (filter === 'due' && fill >= 80) ||
      (filter === 'over' && fill >= 100);
  }).sort((a, b) => Number(b.estimated_fill_pct) - Number(a.estimated_fill_pct));

  body.innerHTML = visible.map(x => {
    const fill = Math.max(0, Number(x.estimated_fill_pct) || 0);
    const status = fill >= 100
      ? ['Overflow', 't-r', '#ff6f4e']
      : fill >= 80
        ? ['Due', 't-y', '#ffb93b']
        : ['OK', 't-g', '#1fbf6f'];

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));

    return '<tr>' +
      '<td><b>' + esc(x.bin_id) + '</b></td>' +
      '<td>' + esc(x.ward_name) + '</td>' +
      '<td>Mixed</td>' +
      '<td style="min-width:140px"><div class="meter" style="height:10px">' +
      '<i style="width:' + Math.min(100, fill) + '%;background:' + status[2] + '"></i>' +
      '</div></td>' +
      '<td>' + fill.toFixed(1) + '%</td>' +
      '<td class="mut">Historical estimate · ' + esc(x.date) +
      ' · ' + esc(x.capacity_liters) + ' L</td>' +
      '<td><span class="tag ' + status[1] + '">' + status[0] + '</span></td>' +
      '</tr>';
  }).join('');

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="7">No bins match this filter.</td></tr>';
  }
}

const wasteflowOriginalRenderViews = renderViews;
renderViews = function(r, b) {
  wasteflowOriginalRenderViews(r, b);
  renderWasteflowApiBins();
};

fetch(WASTEFLOW_BINS_API)
  .then(response => {
    if (!response.ok) throw new Error('API HTTP ' + response.status);
    return response.json();
  })
  .then(payload => {
    if (!Array.isArray(payload.bins)) throw new Error('API response mein bins array nahi hai');
    wasteflowApiBins = payload.bins;
    window.wasteflowApiBins = payload.bins;
    queueRender();
    window.wasteflowBinFilter = 'all';
    renderWasteflowApiBins();
    console.info('WasteFlow API connected:', payload.count, 'bins; data status:', payload.data_status);
  })
  .catch(error => {
    wasteflowApiError = error.message;
    console.error('WasteFlow bins API connect nahi hua:', error.message);
    const body = document.querySelector('#binBody');
    if (body) body.innerHTML =
      '<tr><td colspan="7">API data load nahi hua. Browser-accessible API URL aur proxy/CORS settings check karein.</td></tr>';
  });

})();
/* WASTEFLOW_API_RECOMMENDATIONS_ADAPTER */
const WASTEFLOW_RECOMMENDATIONS_API = 'https://wasteflow-4o45.onrender.com/recommendations';
let wasteflowApiRecommendations = [];

function renderWasteflowApiRecommendations() {
  const box = document.querySelector('#aiG');
  if (!box) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));

  const topRecommendations = [...wasteflowApiRecommendations]
    .sort((a, b) => {
      const priority = {HIGH: 3, MEDIUM: 2, LOW: 1};
      return (priority[String(b.priority || 'LOW').toUpperCase()] || 0) -
        (priority[String(a.priority || 'LOW').toUpperCase()] || 0) ||
        (Number(b.estimated_fill_pct) || 0) - (Number(a.estimated_fill_pct) || 0);
    })
    .slice(0, 10);

  const cards = topRecommendations.map(item => {
    const priority = String(item.priority || 'LOW').toUpperCase();
    const color = priority === 'HIGH' ? '#ff5a3c' :
      priority === 'MEDIUM' ? '#ffb93b' : '#1fbf6f';

    return '<article class="panel aic">' +
      '<span class="tg" style="border-color:' + color + '">API priority: ' + esc(priority) + '</span>' +
      '<h3>' + esc(item.bin_id) + ' · ' + esc(item.ward_name) + '</h3>' +
      '<p>Estimated fill: <b>' + (Number(item.estimated_fill_pct) || 0).toFixed(1) +
      '%</b></p><p>Simulated collection date: ' + esc(item.estimated_collection_date) + '</p>' +
      '<p class="mut">' + esc(item.note) + '</p></article>';
  }).join('');

  if (cards) {
    box.insertAdjacentHTML('beforeend',
      '<article class="panel" style="grid-column:1/-1">' +
      '<h3>Top 10 Collection Recommendations</h3>' +
      '<p class="mut">Historical simulation only — not live sensor data.</p>' +
      '</article>' + cards);
  }
}

fetch(WASTEFLOW_RECOMMENDATIONS_API)
  .then(response => {
    if (!response.ok) throw new Error('API HTTP ' + response.status);
    return response.json();
  })
  .then(payload => {
    if (!Array.isArray(payload.recommendations)) {
      throw new Error('API response mein recommendations array nahi hai');
    }
    wasteflowApiRecommendations = payload.recommendations;
    const aiBox = document.querySelector('#aiG');
    if (aiBox) {
      aiBox.innerHTML = '';
      renderWasteflowApiRecommendations();
    }
    console.info('WasteFlow recommendations API connected:', payload.count);
  })
  .catch(error => {
    console.error('WasteFlow recommendations API connect nahi hua:', error.message);
  });


/* WASTEFLOW_HISTORICAL_FORECAST_ADAPTER */
(async function connectHistoricalForecast() {
  const svg = document.querySelector('#fcSvg');
  const body = document.querySelector('#fcBody');
  if (!svg || !body) return;

  try {
    const response = await fetch('https://wasteflow-4o45.onrender.com/forecast-data');
    if (!response.ok) throw new Error('Forecast API HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.daily) || !data.daily.length) {
      throw new Error('No daily prediction data returned');
    }

    const daily = data.daily;
    const W = 760, H = 270, left = 52, right = 726, top = 22, bottom = 218;
    const max = Math.max(...daily.map(d => Math.max(d.predicted_tonnes, d.actual_tonnes))) * 1.12;
    const x = i => left + i * (right - left) / Math.max(1, daily.length - 1);
    const y = v => bottom - v / max * (bottom - top);
    let out = '';

    for (let g = 0; g <= 4; g++) {
      const v = max * g / 4;
      out += '<line x1="' + left + '" x2="' + right + '" y1="' + y(v) +
        '" y2="' + y(v) + '" stroke="currentColor" opacity=".12"/>' +
        '<text x="' + (left - 7) + '" y="' + (y(v) + 4) +
        '" text-anchor="end" font-size="11">' + v.toFixed(1) + '</text>';
    }

    const line = key => daily.map((d, i) => x(i) + ',' + y(d[key])).join(' ');
    out += '<polyline points="' + line('actual_tonnes') +
      '" fill="none" stroke="#2f9bff" stroke-width="3" stroke-linejoin="round"/>';
    out += '<polyline points="' + line('predicted_tonnes') +
      '" fill="none" stroke="#12a566" stroke-width="3" stroke-linejoin="round"/>';

    daily.forEach((d, i) => {
      out += '<circle cx="' + x(i) + '" cy="' + y(d.predicted_tonnes) +
        '" r="3.5" fill="#12a566"><title>' + d.date +
        ' predicted: ' + d.predicted_tonnes + ' t</title></circle>';
      if (i % 2 === 0 || i === daily.length - 1) {
        out += '<text x="' + x(i) + '" y="244" text-anchor="middle" font-size="10">' +
          d.date.slice(5) + '</text>';
      }
    });

    out += '<text x="' + left + '" y="264" font-size="11" fill="#2f9bff">Actual (t)</text>' +
      '<text x="' + (left + 95) + '" y="264" font-size="11" fill="#12a566">Estimated waste (t)</text>';
    svg.innerHTML = out;
    svg.setAttribute('aria-label', 'Historical waste comparison for ' +
      data.daily[0].date + ' to ' + data.daily[daily.length - 1].date);

    const latest = daily[daily.length - 1];
    const wards = [...(data.wards || [])].sort((a, b) =>
      b.predicted_tonnes - a.predicted_tonnes);
    body.innerHTML = wards.map(w =>
      '<tr><td><b>' + w.ward_name + '</b></td><td>' +
      Number(w.predicted_tonnes).toFixed(3) + '</td></tr>'
    ).join('');

    const section = svg.closest('section');
    const description = section && section.querySelector('.sec-head p');
    if (description) {
      description.textContent = 'Historical synthetic test data: ' +
        data.daily[0].date + ' to ' + latest.date +
        '. Historical comparison only; this is not a future forecast.';
    }

    const heading = section && section.querySelector('table thead tr');
    if (heading) heading.innerHTML = '<th>Ward</th><th>Predicted waste (t), latest test day</th>';

    window.wasteflowHistoricalForecastConnected = true;
    console.info('WasteFlow historical forecast connected:', daily.length, 'days');
  } catch (error) {
    console.error('WasteFlow historical forecast API failed:', error);
  }
})();

/* WASTEFLOW_API_ALERTS_ADAPTER */
(async function connectWasteflowApiAlerts() {
  const box = document.querySelector('#alertL');
  if (!box) return;

  try {
    const response = await fetch('https://wasteflow-4o45.onrender.com/bins');
    if (!response.ok) throw new Error('API HTTP ' + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.bins)) throw new Error('Bins array missing');

    const bins = payload.bins;
    const high = bins.filter(b => Number(b.estimated_fill_pct) >= 80)
      .sort((a, b) => Number(b.estimated_fill_pct) - Number(a.estimated_fill_pct));

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));

    const heading = '<div class="al"><i style="background:#2f9bff"></i>' +
      '<div><b>Backend bin status · ' + esc(payload.data_status || 'historical data') +
      '</b><small>Reference date: ' + esc(bins[0]?.date || 'unknown') +
      ' · ' + bins.length + ' bins checked. Historical data, not live sensors.</small></div>' +
      '<a class="btn" href="#/bins">Open</a></div>';

    const cards = high.slice(0, 10).map(b =>
      '<div class="al"><i style="background:' +
      (Number(b.estimated_fill_pct) >= 100 ? '#ff5a3c' : '#ffb93b') +
      '"></i><div><b>' + esc(b.bin_id) + ' · ' + esc(b.ward_name) +
      '</b><small>Estimated fill: ' + Number(b.estimated_fill_pct).toFixed(1) +
      '% · ' + esc(b.date) + '</small></div><a class="btn" href="#/bins">Open</a></div>'
    ).join('');

    box.insertAdjacentHTML('afterbegin', heading +
      (cards || '<p class="mut">No bins at or above 80% fill in this dataset.</p>'));
    console.info('WasteFlow backend alerts connected:', high.length, 'high-fill bins');
  } catch (error) {
    console.error('WasteFlow backend alerts failed:', error.message);
  }
})();


/* WASTEFLOW_API_SCENARIO_KPI */
(function () {
  let request = 0;

  async function refreshWasteKPI() {
    const id = ++request;
    const uplift = Number(document.querySelector('#uplift')?.value ?? 0);
    const seg = Number(document.querySelector('#seg')?.value ?? 60);

    try {
      const response = await fetch(
        'https://wasteflow-4o45.onrender.com/scenario?uplift=' +
        encodeURIComponent(uplift) + '&seg=' + encodeURIComponent(seg)
      );
      if (!response.ok) throw new Error('API HTTP ' + response.status);

      const data = await response.json();
      if (id !== request) return;

      window.wasteflowScenarioTonnes = Number(data.scenario_estimated_tonnes);
      const card = document.querySelector('.kpi[data-k="forecast"]');
      if (card) {
        const number = card.querySelector('.n');
        const range = card.querySelector('.rng');
        const delta = card.querySelector('.dl');
        if (number) number.textContent = Number(data.scenario_estimated_tonnes).toFixed(3);
        if (range) range.textContent = 'Historical test period · ' + data.reference_date;
        if (delta) delta.textContent = 'Backend scenario estimate · not live data';
      }
      console.info('WasteFlow scenario updated:', data.uplift_pct,
                   '% uplift ->', data.scenario_estimated_tonnes, 't/day');
    } catch (error) {
      console.error('WasteFlow scenario API failed:', error.message);
    }
  }

  document.querySelectorAll('#uplift, #seg').forEach(el => {
    el.addEventListener('input', refreshWasteKPI);
    el.addEventListener('change', refreshWasteKPI);
  });

  document.querySelectorAll('#presets .chip').forEach(el => {
    el.addEventListener('click', () => setTimeout(refreshWasteKPI, 100));
  });

  refreshWasteKPI();
})();
