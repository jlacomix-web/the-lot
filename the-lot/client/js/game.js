// THE LOT: Radio City Music Hall Edition (single-player client, step 1)
// Vehicle models are loaded from assets/models.json, then the game starts.
(async()=>{
const MD=await (await fetch('assets/models.json')).json();

let _s=7;const rnd=(a=0,b=1)=>{_s=(_s*16807)%2147483647;return a+(_s/2147483647)*(b-a)};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2244);scene.fog=new THREE.Fog(0x1b2244,120,420);
const cam=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,700);
const ren=new THREE.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(innerWidth,innerHeight);document.body.appendChild(ren.domElement);
scene.add(new THREE.HemisphereLight(0x8fa0ff,0x403a50,1));
const sun=new THREE.DirectionalLight(0xffc89a,.6);sun.position.set(-60,90,80);scene.add(sun);
const solids=[];
const M=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0});
function box(w,h,d,x,y,z,mat,solid){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);if(solid)solids.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});return m}
function plane(w,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m)}

// ---- streets: asphalt everywhere, sidewalk slabs per block ----
plane(700,700,0,0,0,M(0x2b2d33));
const STREETS=[80,0,-80,-160]; // z of cross streets (W 49th..52nd); 6th Ave runs along z at x=0
const ZB=[[-199,-169],[-151,-89],[-71,-9],[9,71],[89,119]];
const dashes=[];const dash=(x,z,sx,sz)=>dashes.push([x,z,sx,sz]);
for(let z=-199;z<119;z+=8){if(STREETS.some(s=>Math.abs(z-s)<12))continue;for(const x of[-7,0,7])dash(x,z,.3,3)}
for(const s of STREETS){for(let x=-135;x<135;x+=8){if(Math.abs(x)<16)continue;dash(x,s,3,.3)}
 for(let x=-12;x<=12;x+=1.6){dash(x,s-7.6,.7,2.4);dash(x,s+7.6,.7,2.4)}
 for(let z=-4.8;z<=4.8;z+=1.6){dash(-11,s+z,2.4,.7);dash(11,s+z,2.4,.7)}}
const dm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.02,1),new THREE.MeshBasicMaterial({color:0xd8d8d8}),dashes.length);
dashes.forEach((d,i)=>dm.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(d[0],.03,d[1]),new THREE.Quaternion(),new THREE.Vector3(d[2],1,d[3]))));scene.add(dm);

// ---- building textures ----
function winTex(wall){const S=256,c=document.createElement('canvas'),e=document.createElement('canvas');c.width=c.height=e.width=e.height=S;
 const g=c.getContext('2d'),h=e.getContext('2d');g.fillStyle=wall;g.fillRect(0,0,S,S);h.fillStyle='#000';h.fillRect(0,0,S,S);
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){g.fillStyle='#1c2436';g.fillRect(i*32+6,j*32+8,20,16);if(rnd()<.45){h.fillStyle=rnd()<.8?'#ffd890':'#9fc8ff';h.fillRect(i*32+6,j*32+8,20,16)}}
 const mk=cv=>{const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t};return[mk(c),mk(e)]}
const WT=['#6b6f7a','#7a6a5a','#555e70','#8a8478'].map(winTex);
const ROOF=M(0x3b3e4a,0x0c0d12);
function bld(x0,x1,z0,z1,h,vi){const w=x1-x0,[a,b]=WT[vi%4],A=a.clone(),B=b.clone();A.needsUpdate=B.needsUpdate=true;A.repeat.set(w/9,h/9);B.repeat.copy(A.repeat);
 box(w,h,z1-z0,(x0+x1)/2,h/2,(z0+z1)/2,(m=>[m,m,ROOF,ROOF,m,m])(new THREE.MeshLambertMaterial({map:A,emissiveMap:B,emissive:0xffffff})),true)}

// ---- hall (Radio City) : group, front faces west onto 6th Ave ----
const HS=.75,HX=34.5,HZ=-40;
const hall=new THREE.Group();hall.position.set(HX,0,HZ);hall.rotation.y=-Math.PI/2;hall.scale.setScalar(HS);scene.add(hall);
function hb(w,h,d,lx,y,lz,mat,solid){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(lx,y,lz);hall.add(m);
 if(solid){const cx=HX-lz*HS,cz=HZ+lx*HS,hx=d/2*HS,hz=w/2*HS;solids.push({x0:cx-hx,x1:cx+hx,z0:cz-hz,z1:cz+hz})}return m}
const stone=M(0xc9b38c),dark=M(0x8a7455),glow=new THREE.MeshBasicMaterial({color:0xffe2a0,side:THREE.DoubleSide});
const ghostStone=new THREE.MeshLambertMaterial({color:0xc9b38c,transparent:true}),ghostDark=new THREE.MeshLambertMaterial({color:0x8a7455,transparent:true}),
 vaultMat=new THREE.MeshLambertMaterial({color:0x7a1c26,emissive:0x2a080c,side:THREE.DoubleSide,transparent:true}),ceilMat=new THREE.MeshLambertMaterial({color:0xb8893a,emissive:0x3a2608,transparent:true});
const ghost=[ghostStone,ghostDark,vaultMat,ceilMat];
const sl=(x0,x1,z0,z1,ya,yb)=>{const a=[HX-z0*HS,HX-z1*HS],b=[HZ+x0*HS,HZ+x1*HS];solids.push({x0:Math.min(...a),x1:Math.max(...a),z0:Math.min(...b),z1:Math.max(...b),ya,yb})};
// shell: front wall with 10-wide doorway, side wings, rear block walls, roofs
hb(30,34,1,-20,17,17.5,stone,true);hb(30,34,1,20,17,17.5,stone,true);hb(10,26,1,0,21,17.5,stone);
hb(9,34,13,30.5,17,10.5,stone,true);hb(9,34,13,-30.5,17,10.5,stone,true);hb(9,42,22,30.5,21,-7,stone,true);hb(9,42,22,-30.5,21,-7,stone,true);
hb(2,42,40,27,21,-38,stone,true);hb(2,42,40,-27,21,-38,stone,true);hb(56,42,2,0,21,-57,stone,true);hb(56,1,62,0,41.5,-27,ghostStone);hb(52,.5,13,0,34.25,10.5,ghostStone);hb(52,8,1,0,38,4,stone);
hb(48,6,28,0,45,-8,ghostStone);hb(32,6,20,0,51,-10,ghostStone);hb(18,5,12,0,56.5,-12,ghostDark);
for(let i=-34;i<=34;i+=2)if(Math.abs(i)>6)hb(.8,34,.8,i,17,18.4,dark);
for(let i=-27;i<=27;i+=2.4)hb(.7,10,.7,i,29,13.3,dark);
hb(16,10,.4,0,13,18.3,glow);
const arch=new THREE.Mesh(new THREE.CircleGeometry(8,32,0,Math.PI),glow);arch.position.set(0,18,18.3);hall.add(arch);
for(let a=0;a<9;a++){const r=new THREE.Mesh(new THREE.PlaneGeometry(.5,6),M(0xe8a838,0x553300)),ang=Math.PI*(a+.5)/9;
 r.position.set(Math.cos(ang)*11.5,18+Math.sin(ang)*11.5,18.35);r.rotation.z=ang-Math.PI/2;hall.add(r)}
hb(44,1.6,7,0,5.5,21.5,M(0x1a1a22));
for(let i=-21;i<=21;i+=1.5)for(const y of[5.2,6.1]){const b=new THREE.Mesh(new THREE.SphereGeometry(.3,6,6),glow);b.position.set(i,y,25.1);hall.add(b)}
function label(txt,w,h,fs,col,bg){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const g=c.getContext('2d');g.fillStyle=bg||'#14141c';g.fillRect(0,0,c.width,c.height);
 g.fillStyle=col;g.font='bold '+fs+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,c.width/2,c.height/2);return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide})}
const mq=new THREE.Mesh(new THREE.PlaneGeometry(40,3.2),label('RADIO CITY MUSIC HALL',40,3.2,62,'#ffd77a'));mq.position.set(0,5.5,25.02);hall.add(mq);
(function(){const c=document.createElement('canvas');c.width=128;c.height=1100;const g=c.getContext('2d');g.fillStyle='#b01c2a';g.fillRect(0,0,128,1100);
 g.fillStyle='#fff';g.font='bold 46px sans-serif';g.textAlign='center';g.textBaseline='middle';
 'RADIOCITYMUSICHALL'.split('').forEach((ch,i)=>g.fillText(ch,64,40+i*57+(i>=10?20:i>=5?10:0)));
 hb(3,30,1,36,19,19,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}),true)})();

// ---- hall interior: foyer, auditorium, stage, livestream screen ----
let gy=0,frame=0;
const clad=M(0x5a1620,0x120408),carpet=M(0x8a1c25,0x1a0508),gold=new THREE.MeshBasicMaterial({color:0xe8a838}),orange=new THREE.MeshBasicMaterial({color:0xf26b2a});
const addL=(c,i,d,x,y,z)=>{const l=new THREE.PointLight(c,i,d);l.position.set(x,y,z);hall.add(l)};
hb(.3,36,60,25.7,18,-26,clad);hb(.3,36,60,-25.7,18,-26,clad);hb(.3,34,13,25.7,17,10.5,clad);hb(.3,34,13,-25.7,17,10.5,clad);
hb(52,.5,13,0,0,10.5,carpet);hb(52,.5,74,0,0,-19.5,M(0x4a1a1e,0x100405));
hb(52,1,13,0,33.5,10.5,ceilMat);
// lobby: pillars, chandeliers

for(const x of[-14,0,14]){const s=new THREE.Mesh(new THREE.SphereGeometry(1.4,10,8),gold);s.position.set(x,27,10);hall.add(s);hb(.1,7,.1,x,30.5,10,dark)}
addL(0xffd9a0,.9,60,0,22,10);
// lobby / auditorium divider wall with wide opening
const dv=M(0x7a2a30,0x180608);hb(24,25,1,0,21.5,4,dv);hb(.5,34,1,25.75,17,4,dv);hb(.5,34,1,-25.75,17,4,dv);
// vaulted ceiling + ribs + proscenium arches
const vg=new THREE.CylinderGeometry(26,26,60,40,1,true,Math.PI/2,Math.PI);vg.rotateX(Math.PI/2);
const vm=new THREE.Mesh(vg,vaultMat);vm.scale.y=5/26;vm.position.set(0,36,-26);hall.add(vm);
for(let z=0;z>-56;z-=4){const r=new THREE.Mesh(new THREE.TorusGeometry(26,.35,6,40,Math.PI),gold);r.scale.y=5/26;r.position.set(0,36,z);hall.add(r)}

// ---- seating levels: orchestra + 3 raked mezzanines, walkable surfaces, lifts ----
const SURF=[];
function addSurf(lx0,lx1,lz0,lz1,yf){const xa=HX-lz1*HS,xb=HX-lz0*HS,za=HZ+lx0*HS,zb=HZ+lx1*HS;
 SURF.push({x0:Math.min(xa,xb),x1:Math.max(xa,xb),z0:Math.min(za,zb),z1:Math.max(za,zb),f:(x,z)=>(yf((HX-x)/HS)-.25)*HS})}
addSurf(-24,24,-56,-40,()=>1.8);
const K=.47,secs=[[-22,-8.5],[-4.5,4.5],[8.5,22]],gyOf=y=>(y-.25)*HS;
const LV=[{name:'Orchestra',edge:null,y0:.25,rows:20,start:-34.3},{name:'Mezzanine 1',edge:-15.2,y0:8,rows:10},{name:'Mezzanine 2',edge:-9.2,y0:17,rows:7},{name:'Mezzanine 3',edge:-4.2,y0:25.5,rows:4}];
const yAt=(L,lz)=>L.edge===null?.25:L.y0+(lz-L.edge)*K;
const SEATS=[];
LV.forEach((L,li)=>{L.R=[];for(let i=0;i<L.rows;i++){const lz=li?L.edge+1.2+i*1.7:L.start+i*1.7,yl=yAt(L,lz),arr=[];let n=1;
 for(const[a,b]of secs)for(let x=a+.5;x<b;x+=1){const s={li,i,lx:x,lz,yl,wx:HX-lz*HS,wz:HZ+x*HS,gy:gyOf(yl),num:n++,row:String.fromCharCode(65+i)};arr.push(s);SEATS.push(s)}
 L.R.push(arr);for(const[a,b]of secs)sl(a,b,lz-.5,lz+.6,gyOf(yl)-.8,gyOf(yl)+1.1)}});
const seatM=M(0xa0222c,0x200508),sb=new THREE.InstancedMesh(new THREE.BoxGeometry(.85,.5,.8),seatM,SEATS.length),sk=new THREE.InstancedMesh(new THREE.BoxGeometry(.85,.9,.18),seatM,SEATS.length),mt=new THREE.Matrix4();
SEATS.forEach((s,i)=>{sb.setMatrixAt(i,mt.makeTranslation(s.lx,s.yl+.3,s.lz));sk.setMatrixAt(i,mt.makeTranslation(s.lx,s.yl+.8,s.lz+.36))});hall.add(sb,sk);
// mezzanine terraces: sloped slabs, fascia, gold rails, rail collision, walkable surface
const slabM=M(0x3a1216,0x0a0204),railM=new THREE.MeshLambertMaterial({color:0xc9972e,emissive:0x2a1a04});
LV.forEach((L,li)=>{if(!li)return;const A=L.edge,B=3.4,len=B-A,rise=len*K,ang=Math.atan(K);
 const m=new THREE.Mesh(new THREE.BoxGeometry(52,1.2,len/Math.cos(ang)),slabM);m.rotation.x=-ang;m.position.set(0,L.y0+rise/2-.6*Math.cos(ang),(A+B)/2+.6*Math.sin(ang));hall.add(m);
 hb(52,2.4,.5,0,L.y0-.8,A,clad);hb(52,1.1,.25,0,L.y0+.55,A+.1,railM);
 addSurf(-25.5,25.5,A,B,lz=>L.y0+(lz-A)*K);
 sl(-26,26,A-.5,A+.2,gyOf(L.y0)-1,gyOf(L.y0)+1.6);
 addL(0xffcc88,.45,38,0,L.y0+7,-3)});
sl(-12,12,3.6,4.4,2,200);
// lifts (one each side, back corners) + glowing pads on every level
const pads=[],cabs=[];
for(const sd of[-1,1]){const px=sd*24.2,pz=1;
 LV.forEach((L,li)=>{const yl=yAt(L,pz),ring=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,.12,20),new THREE.MeshBasicMaterial({color:0xffd77a}));ring.position.set(px,yl+.08,pz);hall.add(ring);
  pads.push({li,side:sd<0?0:1,wx:HX-pz*HS,wz:HZ+px*HS,gy:gyOf(yl)})});
 const cab=new THREE.Mesh(new THREE.BoxGeometry(3.4,5.2,3.4),new THREE.MeshLambertMaterial({color:0x66ccee,transparent:true,opacity:.22,emissive:0x113344}));cab.position.set(px,2.85,pz);cab.visible=false;hall.add(cab);cabs.push(cab)}
// ---- lobby grand staircases (left + right): three lanes each, one per mezzanine ----
function addSurf2(lx0,lx1,lz0,lz1,f2){const xa=HX-lz1*HS,xb=HX-lz0*HS,za=HZ+lx0*HS,zb=HZ+lx1*HS;
 SURF.push({x0:Math.min(xa,xb),x1:Math.max(xa,xb),z0:Math.min(za,zb),z1:Math.max(za,zb),f:(x,z)=>(f2((z-HZ)/HS,(HX-x)/HS)-.25)*HS})}
const stepList=[],trim=[],DT=.6,SWD=2.2,S0=6.5,T3=(x,y,z)=>new THREE.Vector3(x,y,z);
const trimBox=(x,y,z,sx,sy,sz)=>trim.push(new THREE.Matrix4().compose(T3(x,y,z),new THREE.Quaternion(),T3(sx,sy,sz)));
function trimRail(A,B){const d=new THREE.Vector3().subVectors(B,A);trim.push(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(T3(1,0,0),d.clone().normalize()),T3(d.length(),.14,.14)))}
function doorLabel(txt,lx,y){const c=document.createElement('canvas');c.width=256;c.height=96;const g=c.getContext('2d');g.fillStyle='#2a0b10';g.fillRect(0,0,256,96);g.strokeStyle='#e8a838';g.lineWidth=6;g.strokeRect(4,4,248,88);
 g.fillStyle='#ffd77a';g.font='bold 44px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,128,50);
 const m=new THREE.Mesh(new THREE.PlaneGeometry(2.1,.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));m.position.set(lx,y,4.56);hall.add(m)}
for(const sd of[-1,1]){hb(6.9,34,1,sd*15.45,17,4,dv,true);
 for(const[i,li]of[[0,3],[1,2],[2,1]]){
  const c=1.1+SWD*i,xc=25.5-c,zc=17-c,H=yAt(LV[li],3.4),L1=xc-1.1-S0,L2=zc-1.1-4.6,k=(H-.25)/(L1+L2),Hc=.25+k*L1,xa=xc-1.1,xb=xc+1.1,
   rl=(a,b)=>sd>0?[a,b]:[-b,-a],f1=x=>.25+k*(Math.abs(x)-S0),f2=z=>Hc+k*((zc-1.1)-z);
  addSurf2(...rl(S0,xa),zc-1.1,zc+1.1,lx=>f1(lx));addSurf2(...rl(xa,xb),zc-1.1,zc+1.1,()=>Hc);
  addSurf2(...rl(xa,xb),4.6,zc-1.1,(lx,lz)=>f2(lz));addSurf2(...rl(xa,xb),3.3,4.7,()=>H);
  const n1=Math.ceil(L1/DT),d1=L1/n1;for(let j=0;j<n1;j++){const x=S0+(j+.5)*d1,t=f1(x)+.04;stepList.push([sd*x,zc,d1,SWD,t,j%2]);trimBox(sd*(x-d1/2+.05),t+.04,zc,.1,.08,SWD)}
  stepList.push([sd*xc,zc,SWD,SWD,Hc+.04,0]);
  const n2=Math.ceil(L2/DT),d2=L2/n2;for(let j=0;j<n2;j++){const z=zc-1.1-(j+.5)*d2,t=f2(z)+.04;stepList.push([sd*xc,z,SWD,d2,t,j%2]);trimBox(sd*xc,t+.04,z+d2/2-.05,SWD,.08,.1)}
  // stair bodies block anyone walking in from below
  for(let a=S0;a<xa;a+=3){const b=Math.min(a+3,xa),yb=gyOf(f1(a))-1.3;if(yb>.15)sl(...rl(a,b),zc-1.1,zc+1.1,-50,yb)}
  if(gyOf(Hc)-1.3>.15)sl(...rl(xa,xb),zc-1.1,zc+1.1,-50,gyOf(Hc)-1.3);
  for(let z1=zc-1.1;z1>4.6;z1-=3){const z0=Math.max(z1-3,4.6),yb=gyOf(f2(z1))-1.3;if(yb>.15)sl(...rl(xa,xb),z0,z1,-50,yb)}
  // handrail along the open inner edge of the lowest lane: posts + sloped rail
  if(i===2){const pts=[];for(let x=S0;x<xa;x+=1.2)pts.push([sd*x,f1(x),zc-1.25]);pts.push([sd*(xa-.1),Hc,zc-1.25]);
   for(let z=zc-1.25;z>4.8;z-=1.2)pts.push([sd*(xa-.1),f2(z),z]);
   pts.forEach((q,j)=>{trimBox(q[0],q[1]+.7,q[2],.14,1.4,.14);if(j){const o=pts[j-1];trimRail(T3(o[0],o[1]+1.4,o[2]),T3(q[0],q[1]+1.4,q[2]));
    const x0=Math.min(o[0],q[0]),x1=Math.max(o[0],q[0]),z0=Math.min(o[2],q[2]),z1=Math.max(o[2],q[2]);sl(x0-.25,x1+.25,z0-.25,z1+.25,gyOf(Math.min(o[1],q[1]))-2.5,gyOf(Math.max(o[1],q[1]))+1.8)}})}
  // doorway through the divider wall at this lane's level
  hb(SWD,H,1,sd*xc,H/2,4,dv);hb(SWD,34-(H+3.6),1,sd*xc,(34+H+3.6)/2,4,dv);
  sl(...rl(xa,xb),3.6,4.4,-50,gyOf(H)-.9);sl(...rl(xa,xb),3.6,4.4,gyOf(H)+1.6,200);
  doorLabel('MEZZ '+li,sd*xc,H+4.6)}}
const stepI=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),M(0xffffff,0x1a0507),stepList.length),m4=new THREE.Matrix4(),cA=new THREE.Color(0xc42a38),cB=new THREE.Color(0x8c1a26);
stepList.forEach((s,i)=>{const ht=s[4]-.25;m4.makeScale(s[2],ht,s[3]);m4.setPosition(s[0],.25+ht/2,s[1]);stepI.setMatrixAt(i,m4);stepI.setColorAt(i,s[5]?cA:cB)});
const trimI=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),railM,trim.length);trim.forEach((m,i)=>trimI.setMatrixAt(i,m));hall.add(stepI,trimI);
// seat numbering plates (numbers on seat backs, row letters at aisle ends)
const at=document.createElement('canvas');at.width=at.height=1024;const ag=at.getContext('2d');
function cell(c,txt,col){const x=(c%8)*128,y=Math.floor(c/8)*128;ag.fillStyle='#2a0b10';ag.fillRect(x,y,128,128);ag.strokeStyle='#e8a838';ag.lineWidth=8;ag.strokeRect(x+6,y+6,116,116);ag.fillStyle=col;ag.font='bold 76px sans-serif';ag.textAlign='center';ag.textBaseline='middle';ag.fillText(txt,x+64,y+68)}
for(let i=0;i<35;i++)cell(i,''+(i+1),'#fff');for(let r=0;r<20;r++)cell(39+r,String.fromCharCode(65+r),'#ffd77a');
const qp=[],qu=[],qi=[];
function quad(cx,cy,cz,rx,rz,w,h,c){const col=c%8,row=Math.floor(c/8),u0=col/8+.004,u1=(col+1)/8-.004,v1=1-row/8-.004,v0=1-(row+1)/8+.004,n=qp.length/3,hw=w/2,hh=h/2;
 qp.push(cx-rx*hw,cy-hh,cz-rz*hw,cx+rx*hw,cy-hh,cz+rz*hw,cx+rx*hw,cy+hh,cz+rz*hw,cx-rx*hw,cy+hh,cz-rz*hw);qu.push(u0,v0,u1,v0,u1,v1,u0,v1);qi.push(n,n+1,n+2,n,n+2,n+3)}
for(const s of SEATS)quad(s.lx,s.yl+1.05,s.lz+.47,1,0,.5,.3,s.num-1);
LV.forEach(L=>L.R.forEach((arr,i)=>{const s0=arr[0];for(const[a,b]of secs){quad(a-.03,s0.yl+.75,s0.lz,0,1,.5,.36,39+i);quad(b+.03,s0.yl+.75,s0.lz,0,-1,.5,.36,39+i)}}));
const qg=new THREE.BufferGeometry();qg.setAttribute('position',new THREE.Float32BufferAttribute(qp,3));qg.setAttribute('uv',new THREE.Float32BufferAttribute(qu,2));qg.setIndex(qi);
hall.add(new THREE.Mesh(qg,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(at),side:THREE.DoubleSide})));
// your ticket: Row H, Seat 18 (orchestra center) gets a floating gold marker
const TICKET=LV[0].R[7][17],beacon=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,4),new THREE.MeshBasicMaterial({color:0xffd77a}));beacon.rotation.x=Math.PI;beacon.position.set(TICKET.lx,3.4,TICKET.lz);hall.add(beacon);
let seated=null,sitT=0,ride=null;
const promptEl=document.getElementById('prompt');
function nearestSeat(){let b=null,bd=6.5;for(const s of SEATS){if(Math.abs(s.gy-gy)>1.4)continue;{const ow=seatOwner.get(sidOf(s));if(ow&&ow!==myId)continue}const d=(s.wx-P.x)**2+(s.wz-P.z)**2;if(d<bd){bd=d;b=s}}return b}
const padNear=()=>pads.find(p=>Math.hypot(p.wx-P.x,p.wz-P.z)<1.5&&Math.abs(p.gy-gy)<1.2);
function startRide(p){const nl=(p.li+1)%LV.length,t=pads.find(q=>q.side===p.side&&q.li===nl);ride={t:0,dur:2.4+Math.abs(t.gy-p.gy)*.1,from:gy,to:t.gy,px:p.wx,pz:p.wz,side:p.side}}
function toggleSit(){if(ride)return;
 if(seated){const c=[-23.8,-6.5,6.5,23.8];let b=c[0];for(const v of c)if(Math.abs(v-seated.lx)<Math.abs(b-seated.lx))b=v;P.x=HX-seated.lz*HS;P.z=HZ+b*HS;NET.send({type:'stand'});seated=null;return}
 const p=padNear();if(p){startRide(p);return}
 const n=nearestSeat();if(n){seated=n;seatBefore=null;P.yaw=-Math.PI/2;P.pitch=0;NET.send({type:'sit',seat:sidOf(n)})}}
function seatNav(k){const L=LV[seated.li],R=L.R[seated.i],j=R.indexOf(seated);let t=null;
 if(k==='a'||k==='arrowleft')t=R[j-1];else if(k==='d'||k==='arrowright')t=R[j+1];
 else if(k==='w'||k==='arrowup'||k==='s'||k==='arrowdown'){const Q=L.R[seated.i+((k==='w'||k==='arrowup')?-1:1)];if(Q){t=Q[0];for(const q of Q)if(Math.abs(q.lx-seated.lx)<Math.abs(t.lx-seated.lx))t=q}}
 if(t){const ow=seatOwner.get(sidOf(t));if(!ow||ow===myId){seatBefore=seated;seated=t;NET.send({type:'sit',seat:sidOf(t)})}}}
const lvName=s=>s.li?LV[s.li].name+' \u00b7 ':'';
function updPrompt(){let t='';
 if(started&&!ride){if(seated)t=lvName(seated)+'Row '+seated.row+' \u00b7 Seat '+seated.num+' &nbsp;\u2014&nbsp; A/D shift seat \u00b7 W/S change row \u00b7 E stand';
  else{const p=padNear();if(p)t='Press <kbd>E</kbd> &nbsp;\u2014&nbsp; lift to '+LV[(p.li+1)%LV.length].name;
   else{const n=nearestSeat();if(n)t='Press <kbd>E</kbd> to sit &nbsp;\u2014&nbsp; '+lvName(n)+'Row '+n.row+', Seat '+n.num+(n===TICKET?' (your seat)':'')}}}
 if(t!==promptEl._t){promptEl._t=t;promptEl.innerHTML=t;promptEl.style.display=t?'block':'none'}}
// stage, curtains, lighting truss
hb(48,1.8,16,0,.9,-48,M(0x6b4a2a,0x120c06));hb(48,.2,.3,0,1.9,-40,gold);


addL(0xff44aa,.8,45,0,14,-46);addL(0x88aaff,.7,50,0,14,-50);addL(0xffd0a0,.6,60,0,16,-20);
// livestream screen (simulated feed on a canvas texture)
const sc=document.createElement('canvas');sc.width=960;sc.height=735;const sg=sc.getContext('2d'),stex=new THREE.CanvasTexture(sc);
const chatPool=['shakedown!!','jerry lives','NYC in the house','tape this one','dark star > ?','anyone got a miracle','fire on the mountain','6th ave is alive'];let chatL=[],lastChat=0;
function drawScreen(t){const g=sg;g.setTransform(1.5,0,0,1.5,0,0);g.fillStyle='#000';g.fillRect(0,0,640,490);
 for(let i=0;i<6;i++){const x=320+Math.cos(t*.4+i*1.1)*220,y=245+Math.sin(t*.55+i*1.7)*160,r=200+80*Math.sin(t+i),gr=g.createRadialGradient(x,y,0,x,y,r);
  gr.addColorStop(0,`hsla(${(t*30+i*60)%360},95%,55%,.85)`);gr.addColorStop(1,'hsla(0,0%,0%,0)');g.fillStyle=gr;g.fillRect(0,0,640,490)}
 for(let i=0;i<32;i++){const hh=20+Math.abs(Math.sin(t*3+i*.7))*130*Math.abs(Math.sin(t*.9+i*.2));g.fillStyle='rgba(255,255,255,.55)';g.fillRect(24+i*18,470-hh,12,hh)}
 g.fillStyle='#e0202a';g.fillRect(16,14,70,26);g.fillStyle='#fff';g.font='bold 18px sans-serif';g.textAlign='left';g.fillText('\u25CF LIVE',22,33);g.fillText('THE LOT \u00B7 RADIO CITY \u00B7 NIGHT 3',98,34);
 g.textAlign='right';g.fillText('watching '+(48210+Math.floor(t*7)%900).toLocaleString(),624,34);
 const slot=Math.floor(t/1.2);if(slot!==lastChat){lastChat=slot;chatL.push(chatPool[(slot*7+3)%chatPool.length]);if(chatL.length>5)chatL.shift()}
 g.textAlign='left';g.font='16px sans-serif';chatL.forEach((c,i)=>{g.fillStyle='rgba(0,0,0,.55)';g.fillRect(430,300+i*24,200,22);g.fillStyle='#fff';g.fillText(c,436,317+i*24)});stex.needsUpdate=true}
drawScreen(0);
const sh=new THREE.Shape();sh.moveTo(-25.5,1.8);sh.lineTo(25.5,1.8);sh.lineTo(25.5,36);sh.absellipse(0,36,25.5,5,0,Math.PI,false);sh.lineTo(-25.5,1.8);
const sgeo=new THREE.ShapeGeometry(sh,32),suv=sgeo.attributes.uv,spp=sgeo.attributes.position;
for(let i=0;i<suv.count;i++)suv.setXY(i,(spp.getX(i)+25.5)/51,(spp.getY(i)-1.8)/39.2);
const scr=new THREE.Mesh(sgeo,new THREE.MeshBasicMaterial({map:stex,side:THREE.DoubleSide}));scr.position.set(0,0,-55.7);hall.add(scr);


// ---- city blocks ----
const SW=M(0x8d8f94);
ZB.forEach((zb,k)=>{const cz=(zb[0]+zb[1])/2,d=zb[1]-zb[0],z0=zb[0]+6,z1=zb[1]-6;
 for(const s of[1,-1]){
  box(121,.14,d,s*74.5,.07,cz,SW,false);
  const rng=(a,b)=>s>0?[a,b]:[-b,-a];
  if(s===1&&k===2){bld(...rng(80,130),z0,z1,70,0);continue}
  const plaza=s===-1&&(k===1||k===3);let x=plaza?38:21,i=0;
  if(plaza){const f=new THREE.Mesh(new THREE.CylinderGeometry(7,7.4,.6,24),M(0xb8b2a4));f.position.set(-29.5,.4,cz);scene.add(f);
   const w=new THREE.Mesh(new THREE.CylinderGeometry(6.2,6.2,.62,24),M(0x3a8fd8,0x103060));w.position.set(-29.5,.42,cz);scene.add(w);solids.push({x0:-37,x1:-22,z0:cz-7.4,z1:cz+7.4})}
  while(x<128){const w=Math.min(rnd(30,50),130-x);if(130-x-w<14)var ww=130-x;else ww=w;
   const h=(i===0?rnd(70,140):rnd(30,90))*(s===-1&&k===2&&i===0?1.1:1);
   bld(...rng(x,x+ww),z0,z1,h,k+i+(s>0?0:2));x+=ww;i++}
 }});

// ---- lamps ----
for(let z=-196;z<120;z+=32)for(const s of[-1,1]){const x=s*13.6;
 box(.25,8,.25,x,4,z,M(0x333333));box(1.8,.25,.5,x-s*.8,8,z,M(0xfff2c0,0xffe9a0))}

// ---- Shakedown Street banner over 6th Ave sidewalk ----
{
 }

// ---- vendors & crowd ----
const TD=[0xe74c3c,0x2ecc71,0x9b59b6,0xf39c12,0x3498db,0xe91e8c,0x1abc9c];
const TT=[0,1,2,3].map(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,4,64,64,90);
 [0,.25,.5,.75,1].forEach(s=>gr.addColorStop(s,`hsl(${rnd(0,360)},90%,55%)`));g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)});
function person(col,parent){const g=new THREE.Group();
 const l=new THREE.Mesh(new THREE.BoxGeometry(.38,.7,.22),M(0x2a2f45));l.position.y=.35;
 const b=new THREE.Mesh(new THREE.CylinderGeometry(.28,.3,.85,10),M(col));b.position.y=1.1;
 const h=new THREE.Mesh(new THREE.SphereGeometry(.2,10,10),M(0xe8c39e));h.position.y=1.72;g.add(l,b,h);(parent||scene).add(g);return g}
function stall(x,z,th){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=th;scene.add(g);
 const t=new THREE.Mesh(new THREE.BoxGeometry(2.4,.9,1),M(0x8b5a2b));t.position.y=.45;
 const tp=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.8),new THREE.MeshLambertMaterial({map:TT[Math.floor(rnd(0,4))],side:THREE.DoubleSide,emissive:0x333333}));tp.position.set(0,1.5,-1.2);
 const cn=new THREE.Mesh(new THREE.ConeGeometry(1.9,.6,8),M(TD[Math.floor(rnd(0,7))]));cn.position.set(0,2.8,-.3);g.add(t,tp,cn);
 for(const px of[-1.1,1.1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.5,6),M(0xcccccc));p.position.set(px,1.25,.45);g.add(p)}
 for(let i=-1;i<=1;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.4,.25,.3),M(TD[Math.floor(rnd(0,7))]));m.position.set(i*.7,1.03,.05);g.add(m)}
 const v=person(TD[Math.floor(rnd(0,7))],g);v.position.set(0,0,-.75);
 const e=Math.abs(Math.sin(th))>.5;solids.push({x0:x-(e?.6:1.25),x1:x+(e?.6:1.25),z0:z-(e?1.25:.6),z1:z+(e?1.25:.6)})}
[-62,-57.5,-47,-42,-37,-32,-22,-17.5].forEach(z=>stall(16.8,z,Math.PI/2));
[26,32,38,44,50,56,62,68,74].forEach(x=>stall(x,-10.2,Math.PI));
[26,32,38,44,50,56,62,68,74].forEach(x=>stall(x,-69.8,0));
const walkers=[];
function walkers_(n,axis,f0,f1,a,b,cols){for(let i=0;i<n;i++){const g=person(cols[Math.floor(rnd(0,cols.length))]);
 walkers.push({g,axis,f:rnd(f0,f1),a,b,p:rnd(a,b),dir:rnd()<.5?-1:1,sp:rnd(.6,1.5),ph:rnd(0,6)})}}
walkers_(24,'z',18.8,20.4,-64,-16,TD);walkers_(12,'x',-13.2,-12.4,24,76,TD);walkers_(12,'x',-67.6,-66.8,24,76,TD);
walkers_(16,'z',-20,-16,-60,60,[0x555a66,0x3d4a6b,0x6b3d3d,0x4a5a4a,0x777777]);

// ---- traffic (real models, embedded) ----
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const base={};
for(const k in MD){const m=MD[k],p=new Int16Array(b64(m.p).buffer),pos=new Float32Array(p.length);for(let i=0;i<p.length;i++)pos[i]=p[i]/32000*4;
 base[k]={pos,idx:new Uint16Array(b64(m.i).buffer),col:m.c?b64(m.c):null,uv:m.u?new Uint16Array(b64(m.u).buffer):null,tex:m.tex}}
const geoCache={};
function geo(k,tint){const key=k+tint;if(geoCache[key])return geoCache[key];const b=base[k],g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(b.pos,3));g.setIndex(new THREE.BufferAttribute(b.idx,1));
 if(b.col){const c=new Float32Array(b.col.length),t=new THREE.Color(tint);
  for(let i=0;i<c.length;i+=3){const r=b.col[i],gg=b.col[i+1],bb=b.col[i+2],w=tint==null?0:Math.max(0,1-Math.hypot(r-230,gg-60,bb-50)/80),sh=.55+.45*(r/255);
   c[i]=r/255*(1-w)+t.r*sh*w;c[i+1]=gg/255*(1-w)+t.g*sh*w;c[i+2]=bb/255*(1-w)+t.b*sh*w}
  g.setAttribute('color',new THREE.BufferAttribute(c,3))}
 if(b.uv){const u=new Float32Array(b.uv.length);for(let i=0;i<u.length;i++)u[i]=b.uv[i]/65535;g.setAttribute('uv',new THREE.BufferAttribute(u,2))}
 g.computeVertexNormals();return geoCache[key]=g}
let vanMat;
function mat(k){if(k==='van'){if(!vanMat){const t=new THREE.TextureLoader().load(base.van.tex);t.flipY=false;vanMat=new THREE.MeshLambertMaterial({map:t,side:THREE.DoubleSide,emissive:0x222222})}return vanMat}
 return new THREE.MeshLambertMaterial({vertexColors:true,emissive:0x1a1a1a})}
const SPEC={bus:{s:1,flip:0},beetle:{s:1,flip:0},car3:{s:1,flip:1},van:{s:1.35,flip:1}};
function veh(k,tint,taxi){const g=new THREE.Group(),sp=SPEC[k],m=new THREE.Mesh(geo(k,k==='van'?null:tint),mat(k));
 m.scale.setScalar(sp.s);m.rotation.y=sp.flip?Math.PI:0;g.add(m);
 if(taxi){const l=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,.3),M(0xffffaa,0xffee66));l.position.set(0,1.68,0);g.add(l)}
 scene.add(g);return g}
const cars=[],TINT=[0xf5c518,0x2c3e50,0xecf0f1,0xc0392b,0x27ae60,0x3498db];
const MIX=['beetle','beetle','car3','bus','van','beetle','bus','car3','beetle','van'];
let mi=0;function nextVeh(){const k=MIX[mi++%MIX.length],taxi=k==='beetle'&&rnd()<.6;
 const tint=k==='bus'?TD[Math.floor(rnd(0,7))]:taxi?0xf5c518:TINT[Math.floor(rnd(0,6))];return veh(k,tint,taxi)}
[-10.5,-3.5,3.5,10.5].forEach((lx,li)=>{const sp=7+li*1.7;for(let i=0;i<5;i++){
 cars.push({g:nextVeh(),axis:'z',f:lx,p:-199+i*63.6+rnd(-8,8),sp,a:-205,b:125,th:0})}});
STREETS.forEach((s,si)=>{const d=si%2?1:-1;for(let i=0;i<4;i++){
 cars.push({g:nextVeh(),axis:'x',f:s-d*4.5,p:-140+i*68+rnd(-6,6),sp:8*d,a:-142,b:142,th:d*Math.PI/2})}});
// parked tie-dye buses on the 50th St curb
[[30,0xe91e8c],[47,0x2ecc71],[64,0x9b59b6]].forEach(([x,c])=>{const g=veh('bus',c);g.position.set(x,0,-7);g.rotation.y=Math.PI/2;
 solids.push({x0:x-2.4,x1:x+2.4,z0:-8.1,z1:-5.9})});

// ---- giant skeletons flanking the hall (one in each cross street, hands on the roof) ----
const boneM=M(0xe9e4cf,0x3a382c),blk=new THREE.MeshBasicMaterial({color:0x111111}),V3=a=>new THREE.Vector3(a[0],a[1],a[2]);
function bone(a,b,r,p){const A=V3(a),B=V3(b),d=B.clone().sub(A),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.2,d.length(),8),boneM);m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());p.add(m)}
function jt(a,r,p){const s=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),boneM);s.position.copy(V3(a));p.add(s)}
function limb(pts,r,p){for(let i=0;i<pts.length-1;i++)bone(pts[i],pts[i+1],r,p);pts.forEach(q=>jt(q,r*1.5,p))}
function fingers(el,h,p){const A=V3(el),B=V3(h),d=B.clone().sub(A).normalize(),sd=d.clone().cross(new THREE.Vector3(.3,1,.2)).normalize();
 for(let i=-1.5;i<=1.5;i++)bone(B.clone().addScaledVector(d,.2).addScaledVector(sd,i*.13).toArray(),B.clone().addScaledVector(d,.75).addScaledVector(sd,i*.15).toArray(),.05,p)}
function hatTex(){const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.fillStyle='#1b3a8a';g.fillRect(0,0,256,50);g.fillStyle='#fff';
 for(let i=0;i<22;i++){g.beginPath();g.arc(8+(i%11)*23+(i>10?11:0),12+(i>10?24:0),3,0,7);g.fill()}
 for(let i=0;i<16;i++){g.fillStyle=i%2?'#fff':'#c8202c';g.fillRect(i*16,50,16,78)}return new THREE.CanvasTexture(c)}
function skeleton(v){const g=new THREE.Group(),pel=[0,4.8,0],neck=[1.2,8.3,.2];
 const sp=[];for(let i=0;i<=7;i++){const t=i/7;sp.push([1.2*t,4.8+3.5*t,.2*t-.35*Math.sin(Math.PI*t)])}limb(sp,.13,g);
 const pv=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),boneM);pv.scale.set(1.25,.7,.8);pv.position.set(0,4.7,0);g.add(pv);
 limb([[-.55,4.6,0],[-1,2.5,.5],[-1.2,.35,.3]],.2,g);bone([-1.2,.35,.3],[-1.2,.2,1],.16,g);
 limb([[.55,4.6,0],[.9,2.6,.2],[1.3,.35,-.1]],.2,g);bone([1.3,.35,-.1],[1.3,.2,.6],.16,g);
 if(v==='sam'){const sn=new THREE.Mesh(new THREE.BoxGeometry(.75,.4,1.5),M(0x2a6fd0,0x0a1a3a));sn.position.set(-1.2,.25,.65);const so=new THREE.Mesh(new THREE.BoxGeometry(.8,.12,1.55),M(0xffffff,0x444444));so.position.set(-1.2,.08,.65);g.add(sn,so)}
 const rc=new THREE.Group();rc.position.set(.75,7.1,-.1);rc.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),V3(neck).sub(V3(pel)).normalize());g.add(rc);
 for(let i=0;i<7;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(1.1-Math.abs(i-2.3)*.09,.055,6,20),boneM);r.rotation.x=Math.PI/2;r.scale.y=.75;r.position.y=-.9+i*.38;rc.add(r)}
 bone([0,-.9,.8],[0,1.1,.8],.1,rc);
 const shL=[.2,8.1,.1],shR=[2,7.9,.1];limb([shL,neck,shR],.12,g);bone(neck,[1.45,8.9,.3],.14,g);
 const elR=[3,6.8,.7],hR=[4.3,5.4,.3];limb([shR,elR,hR],.15,g);fingers(elR,hR,g);
 const elL=v==='sam'?[-1,9.1,.7]:[-.9,7,-.3],hL=v==='sam'?[1,9.5,1.1]:[-.4,5.4,.3];limb([shL,elL,hL],.15,g);fingers(elL,hL,g);
 const sk=new THREE.Group();sk.position.set(1.5,9.5,.35);g.add(sk);g.userData.sk=sk;
 const sc=new THREE.Mesh(new THREE.SphereGeometry(.62,12,10),boneM);sc.scale.set(1,1.02,1.1);sk.add(sc);
 for(const x of[-.25,.25]){const e=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),blk);e.position.set(x,.05,.52);sk.add(e)}
 const ns=new THREE.Mesh(new THREE.ConeGeometry(.09,.22,4),blk);ns.position.set(0,-.15,.66);ns.rotation.x=Math.PI;sk.add(ns);
 const jw=new THREE.Mesh(new THREE.BoxGeometry(.7,.28,.55),boneM);jw.position.set(0,-.55,.3);sk.add(jw);
 const th=new THREE.Mesh(new THREE.BoxGeometry(.56,.1,.1),M(0xffffff,0x555555));th.position.set(0,-.4,.6);sk.add(th);
 if(v==='sam'){const hm=new THREE.MeshLambertMaterial({map:hatTex(),emissive:0x333333}),hat=new THREE.Mesh(new THREE.CylinderGeometry(.5,.55,1.2,20),hm);hat.position.set(0,1.05,0);hat.rotation.z=.15;
  const br=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,.08,20),M(0xc8202c,0x300508));br.position.set(.05,.47,0);br.rotation.z=.15;sk.add(hat,br)}
 else{const cr=new THREE.Mesh(new THREE.TorusGeometry(.62,.09,6,20),M(0x2e7d32,0x0a2a0c));cr.rotation.x=Math.PI/2;cr.position.y=.42;sk.add(cr);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,r=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),M(i%3?0xd01a2a:0xff6b8a,0x400508));r.position.set(Math.cos(a)*.62,.5,Math.sin(a)*.62);sk.add(r);
   const lf=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),M(0x2e9d3a));lf.position.set(Math.cos(a+.3)*.66,.4,Math.sin(a+.3)*.66);sk.add(lf)}}
 return g}
const SK=[];
[['sam',-80,1],['rose',0,-1]].forEach(([v,z,m])=>{const g=skeleton(v);g.scale.set(4.8*m,4.8,4.8);g.rotation.y=-Math.PI/2;g.position.set(38,0,z);scene.add(g);g.updateMatrixWorld(true);SK.push(g);
 [[-1.2,.3],[1.3,-.1]].forEach(([fx,fz])=>{const w=g.localToWorld(new THREE.Vector3(fx,0,fz));solids.push({x0:w.x-1.8,x1:w.x+1.8,z0:w.z-1.8,z1:w.z+1.8})})});

// ---- player ----
const player=new THREE.Group();
let body=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,1.3,10),M(0x3a7bd5));body.position.y=.65;let hasAv=false;
const head=new THREE.Object3D();
const cone=new THREE.Mesh(new THREE.ConeGeometry(.6,1.6,8),new THREE.MeshBasicMaterial({color:0xff3344}));cone.position.y=4;cone.rotation.x=Math.PI;cone.visible=false;
player.add(body,head,cone);scene.add(player);
function setAvatar(cfg){if(!cfg||!window.TheLotAvatar)return;player.remove(body);body=TheLotAvatar.build(cfg);player.add(body);hasAv=true}
window.THELOT_SETAVATAR=setAvatar;if(window.THELOT_USER&&window.THELOT_USER.avatar)setAvatar(window.THELOT_USER.avatar);
const P={x:-18,z:-40,yaw:-Math.PI/2,pitch:0};

// ---- multiplayer: other players, shared seats, emotes, chat ----
const NET=window.TheLotNet,remotes=new Map(),seatOwner=new Map(),sidOf=s=>s.li+'-'+s.i+'-'+s.num;
let myId=0,clockOff=0,seatBefore=null,emoteSt=null,lastSend=0,chatOpen=false,netStatus='idle';
const syncT=()=>(Date.now()+clockOff)/1000;
const netEl=document.createElement('div');netEl.id='net';document.body.appendChild(netEl);
function updNet(){if(!started||netStatus==='idle'){netEl.style.display='none';return}
 const txt={connecting:'Connecting\u2026',online:'Online \u00b7 '+(remotes.size+1)+' in the hall',reconnecting:'Reconnecting\u2026',elsewhere:'Signed in on another device',banned:'Your account is suspended',kicked:'You were removed by a moderator',offline:'Offline (reload to retry)'}[netStatus]||netStatus;
 netEl.textContent=txt;netEl.style.display='block'}
function netStart(){NET.connect();netStatus='connecting';updNet();startStreamProbe()}
function nameTag(text){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.font='bold 30px sans-serif';g.textAlign='center';g.textBaseline='middle';
 const w=Math.min(240,g.measureText(text).width+24);g.fillStyle='rgba(10,12,24,.7)';g.fillRect(128-w/2,8,w,48);g.fillStyle='#fff';g.fillText(text,128,33,230);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(1.6,.4,1);s.position.y=2.15;return s}
function addRemote(p){if(p.id===myId||remotes.has(p.id))return;const g=new THREE.Group();let av;
 try{av=TheLotAvatar.build(p.avatar)}catch(e){av=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,1.4,8),M(0x888888));av.position.y=.7}
 g.add(av,nameTag(p.name));g.visible=false;scene.add(g);
 remotes.set(p.id,{g,av,x:0,y:0,z:0,yaw:0,tx:0,ty:0,tz:0,tyaw:0,mv:0,sit:0,seen:0,placed:false,emote:null})}
function removeRemote(id){const r=remotes.get(id);if(r){scene.remove(r.g);remotes.delete(id)}}
function updateRemotes(dt,ts){const k=1-Math.exp(-dt*12),now=performance.now(),ns=now/1000;
 for(const r of remotes.values()){if(!r.placed)continue;
  r.x+=(r.tx-r.x)*k;r.y+=(r.ty-r.y)*k;r.z+=(r.tz-r.z)*k;let d=r.tyaw-r.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));r.yaw+=d*k;
  r.g.position.set(r.x,r.y,r.z);r.g.rotation.y=r.yaw;r.av.scale.y=r.sit?.72:1;r.g.visible=now-r.seen<6000;
  if(r.emote&&(r.mv||ns-r.emote.t0>3.2))r.emote=null;
  if(r.emote)TheLotAvatar.emote(r.av,ns-r.emote.t0,r.emote.id,!!r.sit);else TheLotAvatar.animate(r.av,ts,r.mv,!!r.sit)}}
function netTick(t,spd){if(!started||!NET.ready()||t-lastSend<100)return;lastSend=t;
 NET.send({type:'state',x:+P.x.toFixed(2),y:+gy.toFixed(2),z:+P.z.toFixed(2),yaw:+P.yaw.toFixed(3),mv:spd,sit:seated?1:0})}
// chat box
const chatEl=document.createElement('div');chatEl.id='chat';document.body.appendChild(chatEl);
const chatIn=document.createElement('input');chatIn.id='chatin';chatIn.maxLength=140;chatIn.placeholder='Say something\u2026 (Enter to send, Esc to cancel)';document.body.appendChild(chatIn);
function addChat(name,text,sys){const m=document.createElement('div');m.className='m'+(sys?' sys':'');
 if(name){const b=document.createElement('b');b.textContent=name;let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))%360;b.style.color='hsl('+h+',75%,72%)';m.append(b,': ')}
 m.append(document.createTextNode(text));chatEl.append(m);while(chatEl.children.length>8)chatEl.firstChild.remove();
 setTimeout(()=>m.classList.add('old'),12000);setTimeout(()=>m.remove(),14000)}
function openChat(){chatOpen=true;for(const k in keys)keys[k]=false;if(document.exitPointerLock)document.exitPointerLock();chatIn.style.display='block';chatIn.value='';chatIn.focus()}
function closeChat(){chatOpen=false;chatIn.style.display='none';chatIn.blur();lock()}
chatIn.addEventListener('keydown',e=>{e.stopPropagation();
 if(e.key==='Escape'){closeChat();return}
 if(e.key!=='Enter')return;const text=chatIn.value.trim();closeChat();if(!text)return;
 if(text[0]==='/'){if(/^\/help\b/i.test(text))addChat(null,'Commands: /mute name, /unmute name, /report name reason. Moderators: /kick /timeout /untimeout /who /reports /resolve /announce. Admins: /ban /unban.',true);else NET.send({type:'cmd',line:text});return}
 NET.send({type:'chat',text})});
addEventListener('keydown',e=>{if(!started||chatOpen)return;
 if(e.key==='Enter'){e.preventDefault();openChat();return}
 const n='12345'.indexOf(e.key);if(n>=0&&e.key.length===1&&!e.ctrlKey&&!e.metaKey){emoteSt={id:n,t0:performance.now()/1000};NET.send({type:'emote',e:n})}});
// server messages
NET.on('status',st=>{netStatus=st;updNet()});
NET.on('welcome',m=>{myId=m.id;clockOff=m.time-Date.now();[...remotes.keys()].forEach(removeRemote);seatOwner.clear();
 (m.players||[]).forEach(addRemote);(m.seats||[]).forEach(([s,id])=>seatOwner.set(s,id));updNet();
 if(seated)NET.send({type:'sit',seat:sidOf(seated)})});
NET.on('join',m=>{addRemote(m);updNet()});
NET.on('leave',m=>{removeRemote(m.id);updNet()});
NET.on('snap',m=>{const now=performance.now();for(const a of m.p){const r=remotes.get(a[0]);if(!r)continue;
 r.tx=a[1];r.ty=a[2];r.tz=a[3];r.tyaw=a[4];r.mv=a[5];r.sit=a[6];r.seen=now;
 if(!r.placed){r.x=r.tx;r.y=r.ty;r.z=r.tz;r.yaw=r.tyaw;r.placed=true}}});
NET.on('seat',m=>{if(m.player)seatOwner.set(m.seat,m.player);else seatOwner.delete(m.seat);if(m.player===myId)seatBefore=null});
NET.on('seatDenied',m=>{if(seated&&sidOf(seated)===m.seat){seated=seatBefore;seatBefore=null;addChat(null,m.reason==='taken'?'That seat is taken.':'Too far from that seat.',true)}});
NET.on('emote',m=>{const r=remotes.get(m.id);if(r)r.emote={id:m.e,t0:performance.now()/1000}});
NET.on('chat',m=>addChat(m.name,m.text,false));
NET.on('sys',m=>addChat(null,m.text,true));

// ---- real livestream on the hall screen (HLS from the stream server); falls back to the generated animation ----
const STREAM_URL='/hls/live/index.m3u8';
const vid=document.createElement('video');vid.setAttribute('playsinline','');vid.style.display='none';vid.volume=.6;document.body.appendChild(vid);
const vtex=new THREE.VideoTexture(vid);vtex.minFilter=THREE.LinearFilter;vtex.magFilter=THREE.LinearFilter;vtex.generateMipmaps=false;
const vplane=new THREE.Mesh(new THREE.PlaneGeometry(51,28.7),new THREE.MeshBasicMaterial({map:vtex}));vplane.position.set(0,19.4,-55.6);vplane.visible=false;hall.add(vplane);
let hls=null,streamLive=false,probeTimer=0,lastCT=-1,stuck=0;
function stopStream(){const was=streamLive;streamLive=false;vplane.visible=false;if(hls){hls.destroy();hls=null}vid.removeAttribute('src');vid.load();if(was)addChat(null,'The live stream ended.',true)}
function playVideo(){vid.play().catch(()=>{vid.muted=true;vid.play().catch(()=>{})})}
function startStream(){if(hls||streamLive)return;
 const ok=()=>{streamLive=true;vplane.visible=true;stuck=0;playVideo();addChat(null,'The live stream is on the screen.',true)};
 if(window.Hls&&Hls.isSupported()){hls=new Hls({lowLatencyMode:true});hls.loadSource(STREAM_URL);hls.attachMedia(vid);
  hls.on(Hls.Events.MANIFEST_PARSED,ok);hls.on(Hls.Events.ERROR,(e,d)=>{if(d.fatal)stopStream()})}
 else if(vid.canPlayType('application/vnd.apple.mpegurl')){vid.src=STREAM_URL;vid.onloadedmetadata=ok;vid.onerror=stopStream}}
async function probe(){if(!started||streamLive||hls)return;try{const r=await fetch(STREAM_URL,{cache:'no-store',credentials:'same-origin'});if(r.ok)startStream()}catch(e){}}
function startStreamProbe(){if(probeTimer)return;probe();probeTimer=setInterval(probe,10000)}
vid.addEventListener('ended',stopStream);
setInterval(()=>{if(!streamLive){return}if(vid.currentTime===lastCT){if(++stuck>=3)stopStream()}else{stuck=0;lastCT=vid.currentTime}},5000);
addEventListener('keydown',e=>{if(!started||chatOpen)return;let msg=null;
 if(e.key==='['){vid.volume=Math.max(0,+(vid.volume-.1).toFixed(2));vid.muted=false;msg='Screen volume '+Math.round(vid.volume*100)+'%'}
 else if(e.key===']'){vid.volume=Math.min(1,+(vid.volume+.1).toFixed(2));vid.muted=false;msg='Screen volume '+Math.round(vid.volume*100)+'%'}
 else if(e.key==='b'||e.key==='B'){vid.muted=!vid.muted;msg=vid.muted?'Screen sound off':'Screen sound on'}
 if(msg)addChat(null,msg,true)});

// ---- input ----
const keys={};let view='fpv',aerial=false,started=false;
const modeEl=document.getElementById('mode'),start=document.getElementById('start');
function setMode(){modeEl.textContent=aerial?'AERIAL VIEW':view==='fpv'?'FIRST PERSON':'THIRD PERSON'}
addEventListener('keydown',e=>{if(!started||chatOpen)return;const k=e.key.toLowerCase();keys[k]=true;if(k==='e')toggleSit();if(seated)seatNav(k);
 if(k==='v'&&!aerial){view=view==='fpv'?'tpv':'fpv';setMode()}
 if(k==='m'){aerial=!aerial;setMode()}});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let locked=false,drag=false;
const lock=()=>{try{ren.domElement.requestPointerLock()}catch(_){}};
document.getElementById('go').addEventListener('click',()=>{started=true;netStart();start.style.display='none';document.getElementById('hud').style.display='block';modeEl.style.display='block';lock()});
ren.domElement.addEventListener('click',lock);
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===ren.domElement});
ren.domElement.addEventListener('mousedown',()=>drag=true);addEventListener('mouseup',()=>drag=false);
addEventListener('mousemove',e=>{if(locked||drag){P.yaw-=e.movementX*.0025;P.pitch=Math.max(-1.2,Math.min(1.2,P.pitch-e.movementY*.0025))}});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight)});
function blocked(x,z){const r=.5;for(const s of solids){if(s.ya!==undefined&&(gy<s.ya||gy>s.yb))continue;if(x>s.x0-r&&x<s.x1+r&&z>s.z0-r&&z<s.z1+r)return true}return false}

let last=performance.now();
function loop(t){requestAnimationFrame(loop);const dt=Math.min((t-last)/1000,.05);last=t;
 const sp=(seated||ride)?0:(keys.shift?11:5)*dt;let fx=0,fz=0;
 if(keys.w)fz-=1;if(keys.s)fz+=1;if(keys.a)fx-=1;if(keys.d)fx+=1;
 const l=Math.hypot(fx,fz)||1;fx/=l;fz/=l;
 const s=Math.sin(P.yaw),c=Math.cos(P.yaw),dx=(fx*c+fz*s)*sp,dz=(-fx*s+fz*c)*sp;
 if(!blocked(P.x+dx,P.z))P.x+=dx;if(!blocked(P.x,P.z+dz))P.z+=dz;
 if(seated){P.x+=(seated.wx-P.x)*Math.min(1,dt*8);P.z+=(seated.wz-P.z)*Math.min(1,dt*8)}sitT+=((seated?1:0)-sitT)*Math.min(1,dt*6);player.scale.y=1-.35*sitT;
 P.x=Math.max(-135,Math.min(135,P.x));P.z=Math.max(-195,Math.min(115,P.z));
 if(ride){ride.t+=dt;const k=Math.min(1,ride.t/ride.dur),e=k*k*(3-2*k);gy=ride.from+(ride.to-ride.from)*e;P.x+=(ride.px-P.x)*Math.min(1,dt*8);P.z+=(ride.pz-P.z)*Math.min(1,dt*8);if(k>=1)ride=null}
 else{let tgt=0;if(seated)tgt=seated.gy;else for(const s of SURF)if(P.x>s.x0&&P.x<s.x1&&P.z>s.z0&&P.z<s.z1){const hh=s.f(P.x,P.z);if(hh<=gy+1.1&&hh>tgt)tgt=hh}gy=Math.abs(tgt-gy)<1.6?tgt:gy+(tgt-gy)*Math.min(1,dt*10)}
 cabs.forEach((c,i)=>{c.visible=!!ride&&ride.side===i;c.position.y=gy/HS+.25+2.6});
 player.position.set(P.x,gy,P.z);player.rotation.y=P.yaw;ghost.forEach(m=>m.opacity=aerial?.18:1);if(frame++%3===0)drawScreen(syncT());
 // crowd + traffic
 const ts=t/1000;const mvKeys=(keys.w||keys.a||keys.s||keys.d)&&!seated&&!ride,spd=mvKeys?(keys.shift?1.5:1):0,nowS=performance.now()/1000;
 if(emoteSt&&(spd||nowS-emoteSt.t0>3.2))emoteSt=null;
 if(hasAv){if(emoteSt)TheLotAvatar.emote(body,nowS-emoteSt.t0,emoteSt.id,!!seated);else TheLotAvatar.animate(body,ts,spd,!!seated)}
 netTick(t,spd);updateRemotes(dt,ts);beacon.position.y=3.4+Math.sin(ts*2)*.25;beacon.rotation.y=ts*1.5;beacon.visible=seated!==TICKET;updPrompt();SK.forEach((g,i)=>{g.userData.sk.rotation.x=Math.sin(ts*1.3+i)*.07;g.userData.sk.rotation.y=Math.sin(ts*.6+i*2)*.15});
 for(const w of walkers){w.p+=w.dir*w.sp*dt;if(w.p>w.b||w.p<w.a)w.dir*=-1;
  if(w.axis==='z'){w.g.position.set(w.f,0,w.p);w.g.rotation.y=w.dir>0?0:Math.PI}else{w.g.position.set(w.p,0,w.f);w.g.rotation.y=w.dir>0?Math.PI/2:-Math.PI/2}
  w.g.position.y=Math.abs(Math.sin(ts*6+w.ph))*.05}
 for(const k of cars){k.p+=k.sp*dt;if(k.sp>0&&k.p>k.b)k.p=k.a;if(k.sp<0&&k.p<k.a)k.p=k.b;
  if(k.axis==='z')k.g.position.set(k.f,0,k.p);else{k.g.position.set(k.p,0,k.f);k.g.rotation.y=k.th}}
 cone.visible=aerial;cone.scale.setScalar(aerial?4:1);body.visible=head.visible=!(view==='fpv'&&!aerial);
 const fx_=aerial||!started;scene.fog.near=fx_?5000:120;scene.fog.far=fx_?9000:420;player.visible=started;
 if(!started){const a=ts*.08;cam.position.set(20+Math.cos(a)*170,250,-40+Math.sin(a)*170);cam.lookAt(20,0,-40)}
 else if(aerial){cam.position.set(15,270,50);cam.lookAt(15,0,-40)}
 else if(view==='fpv'){cam.position.set(P.x,gy+1.7-.25*sitT,P.z);cam.rotation.set(P.pitch,P.yaw,0,'YXZ')}
 else{const d=5,cp=Math.cos(P.pitch);cam.position.set(P.x+Math.sin(P.yaw)*d*cp,gy+2.2+Math.sin(P.pitch)*d,P.z+Math.cos(P.yaw)*d*cp);cam.lookAt(P.x,gy+1.4,P.z)}
 ren.render(scene,cam)}
requestAnimationFrame(loop);

})();
