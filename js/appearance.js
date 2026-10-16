/* Commander Table appearance options; sprite atlases keep assets small and cohesive. */
(function () {
  'use strict';
  const BACKS = [
    {id:'classic-bronze',name:'Classic Bronze',col:0,row:0},
    {id:'flame-red',name:'Flame Red',col:1,row:0},
    {id:'arcane-blue',name:'Arcane Blue',col:2,row:0},
    {id:'forest-green',name:'Forest Green',col:3,row:0},
    {id:'radiant-gold',name:'Radiant Gold',col:0,row:1},
    {id:'bone-necromancer',name:'Bone Necromancer',col:1,row:1},
    {id:'spectrum',name:'Spectrum',col:2,row:1},
    {id:'dragon-scale',name:'Dragon Scale',col:3,row:1},
    {id:'knights-crest',name:"Knight's Crest",col:0,row:2},
    {id:'forest-leaves',name:'Forest Leaves',col:1,row:2},
    {id:'ocean-wave',name:'Ocean Wave',col:2,row:2},
    {id:'arcane-runes',name:'Arcane Runes',col:3,row:2},
    {id:'celestial',name:'Celestial',col:0,row:3},
    {id:'stone-metal',name:'Stone & Metal',col:1,row:3},
    {id:'shadow-energy',name:'Shadow Energy',col:2,row:3}
  ];
  const BACKGROUNDS = [
    {id:'dragons-lair',name:"Dragon's Lair",col:0,row:0},
    {id:'knights-vigil',name:"Knight's Vigil",col:1,row:0},
    {id:'nature-vista',name:'Nature Vista',col:2,row:0},
    {id:'arcane-mage',name:'Mage Casting Magic',col:3,row:0},
    {id:'mage-duel',name:'Two Mages Fighting',col:4,row:0},
    {id:'floating-islands',name:'Floating Islands',col:0,row:1},
    {id:'necromancers-dominion',name:"Necromancer's Dominion",col:1,row:1},
    {id:'enchanted-forest',name:'Enchanted Forest',col:2,row:1},
    {id:'mountain-peaks',name:'Mountain Peaks',col:3,row:1},
    {id:'arcane-library',name:'Arcane Library',col:4,row:1}
  ];
  const backMap=Object.fromEntries(BACKS.map(x=>[x.id,x]));
  const bgMap=Object.fromEntries(BACKGROUNDS.map(x=>[x.id,x]));
  const pct=(n,total)=>total<2?0:+(100*n/(total-1)).toFixed(4);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizePrefs(p){p=p&&typeof p==='object'?p:{};return{cardBack:backMap[p.cardBack]?p.cardBack:'classic-bronze',background:bgMap[p.background]?p.background:'nature-vista'};}
  function getPrefs(){try{return normalizePrefs(JSON.parse(localStorage.getItem('ct.appearance')||'{}'));}catch(_){return normalizePrefs(null);}}
  function savePrefs(p){const v=normalizePrefs(p);try{localStorage.setItem('ct.appearance',JSON.stringify(v));}catch(_){/* storage is optional */}return v;}
  function cardBackStyle(id){const x=backMap[id]||backMap['classic-bronze'];return "background-image:url('assets/card-backs-atlas.webp');background-size:400% 400%;background-position:"+pct(x.col,4)+"% "+pct(x.row,4)+"%;background-repeat:no-repeat;";}
  function backgroundPreviewStyle(id){const x=bgMap[id]||bgMap['nature-vista'];return "background-image:url('assets/backgrounds-atlas.webp');background-size:500% 200%;background-position:"+pct(x.col,5)+"% "+(x.row?'100%':'0%')+";background-repeat:no-repeat;";}
  function boardBackgroundStyle(id){const x=bgMap[id]||bgMap['nature-vista'];return "background-image:linear-gradient(rgba(7,10,15,.58),rgba(7,10,15,.68)),url('assets/backgrounds-atlas.webp');background-size:100% 100%,500% 200%;background-position:center,"+pct(x.col,5)+"% "+(x.row?'100%':'0%')+";background-repeat:no-repeat;";}
  function renderChoices(items,selected,styleFn,kind,extra){const map=kind==='cardBack'?backMap:bgMap,current=map[selected]?selected:(kind==='cardBack'?'classic-bronze':'nature-vista');return items.map(x=>'<button type="button" class="appearance-choice'+(x.id===current?' selected':'')+'" data-appearance-id="'+x.id+'" aria-pressed="'+(x.id===current)+'" title="'+esc(x.name)+'"><span class="appearance-thumb '+extra+'" style="'+esc(styleFn(x.id))+'"></span><span class="appearance-name">'+esc(x.name)+'</span></button>').join('');}
  function renderCardBacks(selected){return renderChoices(BACKS,selected,cardBackStyle,'cardBack','cardback-thumb');}
  function renderBackgrounds(selected){return renderChoices(BACKGROUNDS,selected,backgroundPreviewStyle,'background','background-thumb');}
  window.CTAppearance={backOptions:BACKS,backgroundOptions:BACKGROUNDS,normalizePrefs,getPrefs,savePrefs,cardBackStyle,backgroundPreviewStyle,boardBackgroundStyle,renderCardBacks,renderBackgrounds};
})();
