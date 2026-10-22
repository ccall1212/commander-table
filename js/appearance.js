/* Commander Table appearance options; each selection uses its own WebP asset. */
(function () {
  'use strict';
  const BACKS = [
    {id:'ruby-sigil',name:'Ruby Sigil',src:'assets/card-backs/ruby-sigil.webp'},
    {id:'dragon-flame',name:'Dragon Flame',src:'assets/card-backs/dragon-flame.webp'},
    {id:'arcane-star',name:'Arcane Star',src:'assets/card-backs/arcane-star.webp'},
    {id:'astral-void',name:'Astral Void',src:'assets/card-backs/astral-void.webp'},
    {id:'ocean-depths',name:'Ocean Depths',src:'assets/card-backs/ocean-depths.webp'},
    {id:'frost-crystal',name:'Frost Crystal',src:'assets/card-backs/frost-crystal.webp'},
    {id:'tree-of-life',name:'Tree of Life',src:'assets/card-backs/tree-of-life.webp'},
    {id:'bone-necromancer',name:'Bone Necromancer',src:'assets/card-backs/bone-necromancer.webp'},
    {id:'mystic-skull',name:'Mystic Skull',src:'assets/card-backs/mystic-skull.webp'},
    {id:'shadow-black',name:'Shadow Black',src:'assets/card-backs/shadow-black.webp'},
    {id:'radiant-sun',name:'Radiant Sun',src:'assets/card-backs/radiant-sun.webp'},
    {id:'stained-glass',name:'Stained Glass',src:'assets/card-backs/stained-glass.webp'}
  ];
  const BACKGROUNDS = [
    {id:'dragons-lair',name:"Dragon's Lair",src:'assets/backgrounds/dragons-lair.webp',thumb:'assets/backgrounds/thumb-dragons-lair.webp'},
    {id:'knights-vigil',name:"Knight's Vigil",src:'assets/backgrounds/knights-vigil.webp',thumb:'assets/backgrounds/thumb-knights-vigil.webp'},
    {id:'into-nature',name:'Into Nature',src:'assets/backgrounds/into-nature.webp',thumb:'assets/backgrounds/thumb-into-nature.webp'},
    {id:'arcane-study',name:'Arcane Study',src:'assets/backgrounds/arcane-study.webp',thumb:'assets/backgrounds/thumb-arcane-study.webp'},
    {id:'mage-duel',name:'Mage Duel',src:'assets/backgrounds/mage-duel.webp',thumb:'assets/backgrounds/thumb-mage-duel.webp'},
    {id:'necromancers-dominion',name:"Necromancer's Dominion",src:'assets/backgrounds/necromancers-dominion.webp',thumb:'assets/backgrounds/thumb-necromancers-dominion.webp'},
    {id:'celestial-realm',name:'Celestial Realm',src:'assets/backgrounds/celestial-realm.webp',thumb:'assets/backgrounds/thumb-celestial-realm.webp'},
    {id:'haunted-ruins',name:'Haunted Ruins',src:'assets/backgrounds/haunted-ruins.webp',thumb:'assets/backgrounds/thumb-haunted-ruins.webp'},
    {id:'tranquil-shores',name:'Tranquil Shores',src:'assets/backgrounds/tranquil-shores.webp',thumb:'assets/backgrounds/thumb-tranquil-shores.webp'},
    {id:'eldritch-horizon',name:'Eldritch Horizon',src:'assets/backgrounds/eldritch-horizon.webp',thumb:'assets/backgrounds/thumb-eldritch-horizon.webp'}
  ];
  const backMap=Object.fromEntries(BACKS.map(x=>[x.id,x]));
  const bgMap=Object.fromEntries(BACKGROUNDS.map(x=>[x.id,x]));
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  const CUSTOM_KEY='ct.appearance.custom';
  function normalizePrefs(p){p=p&&typeof p==='object'?p:{};return{cardBack:backMap[p.cardBack]?p.cardBack:'ruby-sigil',background:bgMap[p.background]?p.background:'haunted-ruins'};}
  function getPrefs(){try{return normalizePrefs(JSON.parse(localStorage.getItem('ct.appearance')||'{}'));}catch(_){return normalizePrefs(null);}}
  function savePrefs(p){const v=normalizePrefs(p);try{localStorage.setItem('ct.appearance',JSON.stringify(v));}catch(_){/* storage is optional */}return v;}
  function validCustom(v){return typeof v==='string'&&v.length<=1600000&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(v);}
  function getCustom(){try{const p=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'{}'),cardBack=validCustom(p.cardBack)?p.cardBack:'',background=validCustom(p.background)?p.background:'';return{cardBack,background,cardBackActive:cardBack?(typeof p.cardBackActive==='boolean'?p.cardBackActive:true):false,backgroundActive:background?(typeof p.backgroundActive==='boolean'?p.backgroundActive:true):false};}catch(_){return{cardBack:'',background:'',cardBackActive:false,backgroundActive:false};}}
  function saveCustom(kind,data){if((kind!=='cardBack'&&kind!=='background')||!validCustom(data)||data.length>800000)return false;const all=getCustom();all[kind]=data;all[kind+'Active']=true;try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(all));return true;}catch(_){return false;}}
  function setCustomActive(kind,active){if(kind!=='cardBack'&&kind!=='background')return false;const all=getCustom();if(!all[kind])return false;all[kind+'Active']=!!active;try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(all));return true;}catch(_){return false;}}
  function clearCustom(kind){if(kind!=='cardBack'&&kind!=='background')return;const all=getCustom();all[kind]='';all[kind+'Active']=false;try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(all));}catch(_){/* storage is optional */}}
  function cardBackStyle(id){const custom=getCustom().cardBack;if(id==='custom-local'&&custom)return "background-image:url('"+custom+"');background-size:100% 100%;background-position:center;background-repeat:no-repeat;";const x=backMap[id]||backMap['ruby-sigil'];return "background-image:url('"+x.src+"');background-size:100% 100%;background-position:center;background-repeat:no-repeat;";}
  function backgroundPreviewStyle(id){const custom=getCustom().background;if(id==='custom-local'&&custom)return "background-image:url('"+custom+"');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";const x=bgMap[id]||bgMap['haunted-ruins'];return "background-image:url('"+(x.thumb||x.src)+"');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";}
  function boardBackgroundStyle(id){const custom=getCustom().background;if(id==='custom-local'&&custom)return "background-image:linear-gradient(rgba(7,10,15,.58),rgba(7,10,15,.68)),url('"+custom+"');background-size:100% 100%,cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";const x=bgMap[id]||bgMap['haunted-ruins'];return "background-image:linear-gradient(rgba(7,10,15,.58),rgba(7,10,15,.68)),url('"+x.src+"');background-size:100% 100%,cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";}
  function renderChoices(items,selected,styleFn,kind,extra){const map=kind==='cardBack'?backMap:bgMap,custom=getCustom(),hasCustom=!!custom[kind],current=selected==='custom-local'&&hasCustom?'custom-local':(map[selected]?selected:(kind==='cardBack'?'ruby-sigil':'haunted-ruins'));const preset=items.map(x=>'<button type="button" class="appearance-choice'+(x.id===current?' selected':'')+'" data-appearance-id="'+x.id+'" aria-pressed="'+(x.id===current)+'" title="'+esc(x.name)+'"><span class="appearance-thumb '+extra+'" style="'+esc(styleFn(x.id))+'"></span><span class="appearance-name">'+esc(x.name)+'</span></button>').join('');const customTile=hasCustom?'<div class="custom-appearance-saved"><button type="button" class="appearance-choice custom-upload-choice'+(current==='custom-local'?' selected':'')+'" data-appearance-id="custom-local" aria-pressed="'+(current==='custom-local')+'" title="Use your saved custom image"><span class="appearance-thumb '+extra+'" style="'+esc(styleFn('custom-local'))+'"></span><span class="appearance-name">Your upload</span><span class="custom-saved-label">Saved here</span></button><button type="button" class="appearance-remove-upload" data-remove-custom="'+kind+'" aria-label="Remove saved '+(kind==='cardBack'?'card-back image':'background image')+'">Remove</button></div>':'';return customTile+preset;}
  function renderCardBacks(selected){return renderChoices(BACKS,selected,cardBackStyle,'cardBack','cardback-thumb');}
  function renderBackgrounds(selected){return renderChoices(BACKGROUNDS,selected,backgroundPreviewStyle,'background','background-thumb');}
  window.CTAppearance={backOptions:BACKS,backgroundOptions:BACKGROUNDS,normalizePrefs,getPrefs,savePrefs,getCustom,saveCustom,setCustomActive,clearCustom,cardBackStyle,backgroundPreviewStyle,boardBackgroundStyle,renderCardBacks,renderBackgrounds};
})();
