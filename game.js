'use strict';
const LEVELS = [
  {name:'Учебный двор',goal:'Найди элемент питания и открой ворота.',color:0xc5dbcf,needed:1,spawn:[0,0,5],check:[0,0,-25],exit:[0,0,-48],platforms:[[0,4,12,14,0],[0,-10,10,10,0],[0,-24,12,12,0],[0,-40,12,22,0]],items:[[0,-41]],nodes:[],enemies:[[-2,-34,3]],walls:[[0,-29,11,0.7]],movers:[],hazards:[],bonuses:[[4,-24],[-4,-43]]},
  {name:'Промышленный переход',goal:'Активируй два переключателя. Найди подъемник.',color:0xc8d6cf,needed:2,spawn:[0,0,5],check:[0,0,-13],exit:[0,0,-49],platforms:[[0,3,12,15,0],[0,-13,24,14,0],[-8,-28,7,10,0],[8,-28,7,10,0],[0,-43,24,14,0]],items:[],nodes:[[-8,-29],[8,-29]],enemies:[[-8,-25,1.2],[8,-44,3]],walls:[],movers:[[-8,-21,5,3,0,1.5]],hazards:[[8,-21,6,2]],bonuses:[[-10,-44],[10,-44]]},
  {name:'Энергетическое ядро',goal:'Запусти три узла, затем центральный генератор.',color:0xbacfd0,needed:3,spawn:[0,0,7],check:[0,0,-8],exit:[0,0,-36],platforms:[[0,4,12,16,0],[0,-15,12,18,0],[-10,-19,8,10,0],[10,-19,8,10,0],[0,-32,12,12,0]],items:[],nodes:[[-10,-20],[10,-20],[0,-32]],enemies:[[0,-17,3]],walls:[[-6,-19,0.7,8]],movers:[],hazards:[[6,-19,2,8]],bonuses:[[-12,-16],[12,-16]]}
];
const elements = Object.fromEntries(['hud','menu','pause','complete','levelNumber','levelTitle','objective','health','progress','timer','checkpoint','prompt','toast','routeFill','completeTitle','completeTag','completeText','next','resume','status'].map(id=>[id,document.getElementById(id)]));
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('world').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43,innerWidth/innerHeight,0.1,180);
scene.add(new THREE.HemisphereLight(0xfff9e4,0x526b66,2.6));
const sunlight = new THREE.DirectionalLight(0xfff2d4,3.4);
sunlight.position.set(-18,32,15);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-35,right:35,top:35,bottom:-35,far:100});
sunlight.shadow.bias=-0.001;scene.add(sunlight);scene.add(sunlight.target);
let terrain = new THREE.Group();scene.add(terrain);
const materials = new Map();
function material(color,glow=false){const key=`${color}-${glow}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.8,emissive:glow?color:0,emissiveIntensity:glow?.5:0}));return materials.get(key);}
function box(width,height,depth,color,parent=terrain){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material(color));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function sphere(radius,color,parent){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),material(color));parent.add(mesh);mesh.castShadow=true;return mesh;}
const rhino = new THREE.Group();scene.add(rhino);
const torso=box(.95,1.18,.68,0x94aaa8,rhino);torso.position.y=1.1;
const chest=box(.65,.65,.12,0xdef096,rhino);chest.position.set(0,1.15,-.4);
const head=box(.95,.72,1.0,0xa3b9b4,rhino);head.position.set(0,1.95,-.17);
const snout=box(.8,.4,.6,0xb8c9bc,rhino);snout.position.set(0,1.7,-.7);
const horn=new THREE.Mesh(new THREE.ConeGeometry(.17,.64,7),material(0xf3ead0));horn.position.set(0,2.13,-.7);horn.rotation.x=-.3;rhino.add(horn);
for(const side of [-1,1]){const ear=box(.25,.4,.24,0x879e9c,rhino);ear.position.set(side*.43,2.4,.05);ear.rotation.z=-side*.3;const eye=sphere(.065,0x173d3c,rhino);eye.position.set(side*.47,2,-.45);}
const limbs=[];
for(const side of [-1,1]){const arm=box(.32,.82,.4,0x809a99,rhino);arm.position.set(side*.68,1.12,0);limbs.push(arm);const leg=box(.38,.65,.48,0x718c8b,rhino);leg.position.set(side*.28,.34,0);limbs.push(leg);}
const scarf=box(1.02,.17,.77,0xeab06d,rhino);scarf.position.y=1.58;
let levelIndex=0, mode='menu', elapsed=0, worldTime=0, deaths=0,bonusCount=0;
let player={x:0,y:0,z:5,vy:0,hp:3,invulnerable:0,grounded:false,platform:null,dash:0,cooldown:0,facingX:0,facingZ:-1};
let platforms=[],targets=[],walls=[],enemies=[],hazards=[],bonuses=[],checkpoint=null,exit=null,activeCheckpoint=false;
const keys=new Set();const pressed=new Set();const SAVE_KEY='rhino-energy-v1';
let audio=null,soundEnabled=false,toastTime=0;
function tone(frequency=440){if(!soundEnabled)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);oscillator.start();oscillator.stop(audio.currentTime+.2);}catch{}}
function notify(text){elements.toast.textContent=text;toastTime=3;elements.toast.style.opacity=1;}
function readSave(){try{const value=JSON.parse(localStorage.getItem(SAVE_KEY));if(value?.version!==1||!Number.isInteger(value.level)||value.level<0||value.level>2||!Array.isArray(value.activated)||!value.activated.every(index=>Number.isInteger(index)&&index>=0&&index<LEVELS[value.level].needed))return null;return value;}catch{return null;}}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,level:levelIndex,activated:targets.map((target,index)=>target.active?index:-1).filter(index=>index>=0),broken:walls.map(wall=>wall.broken),bonuses:bonuses.map(bonus=>bonus.active),checkpoint:activeCheckpoint,elapsed,bonusCount,deaths}));}catch{notify('Сохранение недоступно в этом браузере');}}
function clearTerrain(){terrain.traverse(object=>{if(object.geometry)object.geometry.dispose();});scene.remove(terrain);terrain=new THREE.Group();scene.add(terrain);}
function marker(x,z,color){const group=new THREE.Group();group.position.set(x,0,z);terrain.add(group);const base=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.3,.35,12),material(0x4e6f64));base.position.y=.18;base.receiveShadow=true;group.add(base);const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.58),material(color,true));crystal.position.y=1.55;group.add(crystal);const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.045,6,32),material(color,true));ring.rotation.x=Math.PI/2;ring.position.y=.5;group.add(ring);return {group,crystal,ring};}
function makePlatform(x,z,width,depth,top,moving=false,amplitude=0){const slab=box(width,1.25,depth,0x648d7b);slab.position.set(x,top-.625,z);const grass=box(width,.16,depth,levelIndex===1?0xb1b6a1:0xa4bc83);grass.position.set(x,top-.03,z);const edge=box(width*.8,1.8,depth*.78,0x476d66);edge.position.set(x,top-1.8,z);const group=[slab,grass,edge];platforms.push({x,z,width,depth,top,moving,originX:x,amplitude,previousX:x,group});}
function buildLevel(index,saved=null){clearTerrain();levelIndex=index;const level=LEVELS[index];scene.background=new THREE.Color(level.color);scene.fog=new THREE.Fog(level.color,45,125);platforms=[];targets=[];walls=[];enemies=[];hazards=[];bonuses=[];activeCheckpoint=Boolean(saved?.checkpoint);elapsed=Number.isFinite(saved?.elapsed)?saved.elapsed:0;bonusCount=Number.isFinite(saved?.bonusCount)?saved.bonusCount:0;deaths=Number.isFinite(saved?.deaths)?saved.deaths:0;
  level.platforms.forEach(values=>makePlatform(...values));level.movers.forEach(values=>makePlatform(...values.slice(0,5),true,values[5]));
  for(const [x,z] of level.items){const object=marker(x,z,0xeeb66b);targets.push({...object,x,z,type:'item',active:false});}
  for(const [x,z] of level.nodes){const object=marker(x,z,0xeeb66b);targets.push({...object,x,z,type:'node',active:false});}
  targets.forEach((target,index)=>{if(saved?.activated.includes(index))activate(target,false);});
  for(const [x,z,width,depth] of level.walls){const mesh=box(width,2.5,depth,0xc18e69);mesh.position.set(x,1.25,z);for(let stripe=-1;stripe<=1;stripe++){const patch=box(Math.min(width,.25),1.8,depth+.03,0xead3a0,mesh);patch.position.set(stripe*width/4,0,0);patch.rotation.z=.2;}const broken=Boolean(saved?.broken?.[walls.length]);walls.push({x,z,width,depth,mesh,broken});mesh.visible=!broken;}
  for(const [x,z,range] of level.enemies){const group=new THREE.Group();group.position.set(x,0,z);terrain.add(group);const body=box(.9,.7,.9,0x8e6657,group);body.position.y=.7;const visor=box(.7,.2,.12,0xffd38c,group);visor.position.set(0,.8,.48);enemies.push({x,z,originX:x,range,group,defeated:false});}
  for(const [x,z,width,depth] of level.hazards){const mesh=box(width,.14,depth,0xd99059);mesh.position.set(x,.08,z);hazards.push({x,z,width,depth,mesh,active:false});}
  for(const [x,z] of level.bonuses){const object=marker(x,z,0xf3e499);object.group.scale.setScalar(.5);const active=Boolean(saved?.bonuses?.[bonuses.length]);object.group.visible=!active;bonuses.push({...object,x,z,active});}
  checkpoint=marker(level.check[0],level.check[2],0x8bdfd2);exit=marker(level.exit[0],level.exit[2],0xd7f77b);exit.group.scale.set(1.5,1.5,1.5);
  for(let decoration=0;decoration<24;decoration++){const column=box(1.5+decoration%3,2+decoration%5,1.5,0x8ea69a);column.position.set((decoration%2?1:-1)*(17+decoration%7),-5-decoration%4,-decoration*3);column.rotation.y=decoration*.7;}
  const spawn=activeCheckpoint?level.check:level.spawn;Object.assign(player,{x:spawn[0],y:spawn[1],z:spawn[2],vy:0,hp:3,invulnerable:1,grounded:false,platform:null,dash:0,cooldown:0});
  camera.position.set(player.x+16,player.y+20,player.z+25);elements.levelNumber.textContent=`0${index+1} / 03`;elements.levelTitle.textContent=level.name;elements.objective.textContent=level.goal;elements.checkpoint.textContent=activeCheckpoint?'◈ Контрольная точка сохранена':'◈ Начало маршрута';updateHud();
}
function activate(target,feedback=true){target.active=true;target.crystal.material=material(0xcdf493,true);target.ring.material=material(0xcdf493,true);if(target.type==='item')target.group.visible=false;if(feedback){tone(680);notify(target.type==='item'?'Элемент питания найден. Двигайся к выходу!':'Узел активирован');save();}}
function updateHud(){const count=targets.filter(target=>target.active).length;elements.health.textContent='♥'.repeat(player.hp)+'♡'.repeat(3-player.hp);elements.progress.textContent=`Энергия ${count} / ${LEVELS[levelIndex].needed}`;elements.timer.textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;elements.routeFill.style.width=`${count/LEVELS[levelIndex].needed*100}%`;elements.status.textContent=`УРОВЕНЬ ${levelIndex+1} / 3 · БОНУСЫ ${bonusCount} · ВОЗВРАТЫ ${deaths}`;}
function respawn(){deaths++;const spawn=activeCheckpoint?LEVELS[levelIndex].check:LEVELS[levelIndex].spawn;Object.assign(player,{x:spawn[0],y:spawn[1]+.15,z:spawn[2],vy:0,hp:3,invulnerable:2,dash:0,platform:null,grounded:false});notify('Носорог вернулся. Активированные цели сохранены.');save();}
function hurt(){if(player.invulnerable>0)return;player.hp--;player.invulnerable=1.5;tone(140);if(player.hp<=0)respawn();else{player.vy=6;player.grounded=false;notify('Осторожно! Избегай охранников и активных ловушек.');}}
function finish(){mode='complete';keys.clear();save();elements.complete.hidden=false;elements.completeTag.textContent=`МАРШРУТ 0${levelIndex+1} ПРОЙДЕН`;elements.completeTitle.textContent=levelIndex===2?'Город снова сияет.':'Энергия найдена.';elements.completeText.textContent=`Время уровня: ${Math.floor(elapsed/60)} мин ${Math.floor(elapsed%60)} с. Бонусы: ${bonusCount}. Возвраты: ${deaths}. ${levelIndex===2?'Все три уровня завершены. Спасибо за путешествие!':'Следующий маршрут уже ждёт Носорога.'}`;elements.next.textContent=levelIndex===2?'Играть заново ↗':'Следующий уровень ↗';tone(880);}
function collideWall(wall,x,z){return !wall.broken&&Math.abs(x-wall.x)<wall.width/2+.42&&Math.abs(z-wall.z)<wall.depth/2+.42&&player.y<2.5;}
function tick(delta){worldTime+=delta;for(const target of [...targets,...bonuses]){target.crystal.rotation.y+=delta;target.crystal.position.y=1.55+Math.sin(worldTime*2+target.x)*.15;}exit.crystal.rotation.y+=delta*.8;
  if(mode!=='playing'){pressed.clear();return;}elapsed+=delta;player.invulnerable=Math.max(0,player.invulnerable-delta);player.cooldown=Math.max(0,player.cooldown-delta);player.dash=Math.max(0,player.dash-delta);
  for(const platform of platforms){if(!platform.moving)continue;platform.previousX=platform.x;platform.x=platform.originX+Math.sin(worldTime*1.3)*platform.amplitude;platform.group.forEach(mesh=>mesh.position.x=platform.x);if(player.platform===platform&&player.grounded)player.x+=platform.x-platform.previousX;}
  let inputX=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let inputZ=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));const length=Math.hypot(inputX,inputZ);if(length){inputX/=length;inputZ/=length;player.facingX=inputX;player.facingZ=inputZ;}
  if(pressed.has('Space')&&player.grounded){player.vy=10;player.grounded=false;tone(330);}
  if((pressed.has('ShiftLeft')||pressed.has('ShiftRight'))&&player.cooldown<=0){player.dash=.22;player.cooldown=.9;tone(220);}
  const speed=player.dash>0?17:6;const moveX=(player.dash>0?player.facingX:inputX)*speed*delta;const moveZ=(player.dash>0?player.facingZ:inputZ)*speed*delta;
  for(const wall of walls){if(player.dash>0&&collideWall(wall,player.x+moveX,player.z+moveZ)){wall.broken=true;wall.mesh.visible=false;notify('Преграда разрушена!');tone(100);}}
  if(!walls.some(wall=>collideWall(wall,player.x+moveX,player.z)))player.x+=moveX;
  if(!walls.some(wall=>collideWall(wall,player.x,player.z+moveZ)))player.z+=moveZ;
  const previousY=player.y;player.vy-=24*delta;player.y+=player.vy*delta;player.grounded=false;player.platform=null;
  const landing=platforms.filter(platform=>Math.abs(player.x-platform.x)<platform.width/2+.18&&Math.abs(player.z-platform.z)<platform.depth/2+.18&&previousY>=platform.top-.03&&player.y<=platform.top&&player.vy<=0).sort((first,second)=>second.top-first.top)[0];
  if(landing){player.y=landing.top;player.vy=0;player.grounded=true;player.platform=landing;}if(player.y< -10)respawn();
  for(const enemy of enemies){if(enemy.defeated)continue;enemy.x=enemy.originX+Math.sin(worldTime*1.7)*enemy.range;enemy.group.position.x=enemy.x;enemy.group.rotation.y=Math.cos(worldTime*1.7)>0?Math.PI/2:-Math.PI/2;if(Math.hypot(player.x-enemy.x,player.z-enemy.z)<1.15&&player.y<1.3){if(player.dash>0){enemy.defeated=true;enemy.group.visible=false;tone(170);}else hurt();}}
  for(const hazard of hazards){hazard.active=Math.sin(worldTime*2)>0;hazard.mesh.material=material(hazard.active?0xdc754a:0xe9cba2);if(hazard.active&&Math.abs(player.x-hazard.x)<hazard.width/2+.25&&Math.abs(player.z-hazard.z)<hazard.depth/2+.25&&player.y<.55)hurt();}
  let interaction=null;for(const target of targets){if(!target.active&&Math.hypot(player.x-target.x,player.z-target.z)<1.8&&player.y<2){if(target.type==='item')activate(target);else interaction=target;}}
  for(const bonus of bonuses){if(!bonus.active&&Math.hypot(player.x-bonus.x,player.z-bonus.z)<1&&player.y<2){bonus.active=true;bonus.group.visible=false;bonusCount++;tone(950);notify('Найден необязательный бонус');save();}}
  if(!activeCheckpoint&&Math.hypot(player.x-checkpoint.group.position.x,player.z-checkpoint.group.position.z)<1.7&&player.y<1){activeCheckpoint=true;elements.checkpoint.textContent='◈ Контрольная точка сохранена';save();notify('Контрольная точка. Прогресс сохранён.');tone(520);}
  const nearExit=Math.hypot(player.x-exit.group.position.x,player.z-exit.group.position.z)<2&&player.y<2;
  elements.prompt.hidden=!interaction&&!nearExit;
  elements.prompt.textContent=interaction?'E — активировать узел':targets.every(target=>target.active)?(levelIndex===2?'E — запустить генератор':'E — перейти на следующий уровень'):'Сначала собери всю энергию уровня';
  if(pressed.has('KeyE')){if(interaction)activate(interaction);else if(nearExit&&targets.every(target=>target.active))finish();}
  rhino.position.set(player.x,player.y,player.z);if(length||player.dash>0)rhino.rotation.y=Math.atan2(-player.facingX,-player.facingZ);limbs.forEach((limb,index)=>limb.rotation.x=length&&player.grounded?Math.sin(worldTime*12+index%2*Math.PI)*.35:0);rhino.visible=player.invulnerable<=0||Math.sin(worldTime*25)>-.3;
  const desired=new THREE.Vector3(player.x+15,player.y+20,player.z+24);camera.position.lerp(desired,1-Math.exp(-delta*4));camera.lookAt(player.x,player.y+.5,player.z-3);sunlight.position.set(player.x-18,32,player.z+15);sunlight.target.position.set(player.x,0,player.z);updateHud();pressed.clear();
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}window.addEventListener('resize',resize);resize();
function start(saved=null){elements.menu.hidden=true;elements.complete.hidden=true;elements.hud.hidden=false;buildLevel(saved?.level??0,saved);mode='playing';save();notify('Вперёд — W. Прыжок — Пробел. Разрушай преграды рывком!');}
document.getElementById('start').onclick=()=>start();elements.resume.hidden=!readSave();elements.resume.onclick=()=>start(readSave());
function togglePause(){if(!['playing','paused'].includes(mode))return;mode=mode==='playing'?'paused':'playing';elements.pause.hidden=mode!=='paused';keys.clear();pressed.clear();}
document.getElementById('continue').onclick=togglePause;document.getElementById('restart').onclick=()=>{buildLevel(levelIndex);mode='playing';elements.pause.hidden=true;save();};
elements.next.onclick=()=>{elements.complete.hidden=true;if(levelIndex===2){start();}else{buildLevel(levelIndex+1);mode='playing';save();}};
document.getElementById('sound').onclick=()=>{soundEnabled=!soundEnabled;document.getElementById('sound').textContent=`Звук: ${soundEnabled?'вкл.':'выкл.'}`;tone();};
window.addEventListener('keydown',event=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();if(event.code==='Escape'&&!event.repeat)togglePause();if(!keys.has(event.code))pressed.add(event.code);keys.add(event.code);});window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(mode==='playing')togglePause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')togglePause();});
for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.key);pressed.add(button.dataset.key);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(button.dataset.key));}
buildLevel(0);rhino.position.set(0,0,5);camera.position.set(18,17,25);camera.lookAt(0,0,-4);let last=performance.now();
function frame(now){const delta=Math.min((now-last)/1000,.025);last=now;tick(delta);if(toastTime>0){toastTime-=delta;if(toastTime<=0)elements.toast.style.opacity=0;}renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(mode==='playing')togglePause();notify('Графический контекст потерян. Перезагрузи страницу.');});
if(location.hash==='#test')window.rhinoTest={state:()=>({mode,level:levelIndex,player:{...player,platform:null},activated:targets.map(target=>target.active),checkpoint:activeCheckpoint,deaths,elapsed,broken:walls.map(wall=>wall.broken)}),place:(x,y,z)=>{Object.assign(player,{x,y,z,vy:0,invulnerable:0});},hurt,respawn,load:index=>{buildLevel(index);mode='playing';},save,levels:LEVELS};
