/* Commander Table appearance options; each selection uses its own standalone SVG asset. */
(function () {
  'use strict';
  const BACKS = [
    {id:'classic-bronze',name:'Classic Bronze',src:'assets/card-backs/classic-bronze.svg'},
    {id:'flame-red',name:'Flame Red',src:'assets/card-backs/flame-red.svg'},
    {id:'arcane-blue',name:'Arcane Blue',src:'assets/card-backs/arcane-blue.svg'},
    {id:'forest-green',name:'Forest Green',src:'assets/card-backs/forest-green.svg'},
    {id:'radiant-gold',name:'Radiant Gold',src:'assets/card-backs/radiant-gold.svg'},
    {id:'bone-necromancer',name:'Bone Necromancer',src:'assets/card-backs/bone-necromancer.svg'},
    {id:'spectrum',name:'Spectrum',src:'assets/card-backs/spectrum.svg'},
    {id:'dragon-scale',name:'Dragon Scale',src:'assets/card-backs/dragon-scale.svg'},
    {id:'knights-crest',name:"Knight's Crest",src:'assets/card-backs/knights-crest.svg'},
    {id:'forest-leaves',name:'Forest Leaves',src:'assets/card-backs/forest-leaves.svg'},
    {id:'ocean-wave',name:'Ocean Wave',src:'assets/card-backs/ocean-wave.svg'},
    {id:'arcane-runes',name:'Arcane Runes',src:'assets/card-backs/arcane-runes.svg'},
    {id:'celestial',name:'Celestial',src:'assets/card-backs/celestial.svg'},
    {id:'stone-metal',name:'Stone & Metal',src:'assets/card-backs/stone-metal.svg'},
    {id:'shadow-energy',name:'Shadow Energy',src:'assets/card-backs/shadow-energy.svg'}
  ];
  const BACKGROUNDS = [
    {id:'dragons-lair',name:"Dragon's Lair",src:'assets/backgrounds/dragons-lair.svg'},
    {id:'knights-vigil',name:"Knight's Vigil",src:'assets/backgrounds/knights-vigil.svg'},
    {id:'nature-vista',name:'Nature Vista',src:'assets/backgrounds/nature-vista.svg'},
    {id:'arcane-mage',name:'Mage Casting Magic',src:'assets/backgrounds/arcane-mage.svg'},
    {id:'mage-duel',name:'Two Mages Fighting',src:'assets/backgrounds/mage-duel.svg'},
    {id:'floating-islands',name:'Floating Islands',src:'assets/backgrounds/floating-islands.svg'},
    {id:'necromancers-dominion',name:"Necromancer's Dominion",src:'assets/backgrounds/necromancers-dominion.svg'},
    {id:'enchanted-forest',name:'Enchanted Forest',src:'assets/backgrounds/enchanted-forest.svg'},
    {id:'mountain-peaks',name:'Mountain Peaks',src:'assets/backgrounds/mountain-peaks.svg'},
    {id:'arcane-library',name:'Arcane Library',src:'assets/backgrounds/arcane-library.svg'}
  ];
  const backMap=Object.fromEntries(BACKS.map(x=>[x.id,x]));
  const bgMap=Object.fromEntries(BACKGROUNDS.map(x=>[x.id,x]));
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizePrefs(p){p=p&&typeof p==='object'?p:{};return{cardBack:backMap[p.cardBack]?p.cardBack:'classic-bronze',background:bgMap[p.background]?p.background:'nature-vista'};}
  function getPrefs(){try{return normalizePrefs(JSON.parse(localStorage.getItem('ct.appearance')||'{}'));}catch(_){return normalizePrefs(null);}}
  function savePrefs(p){const v=normalizePrefs(p);try{localStorage.setItem('ct.appearance',JSON.stringify(v));}catch(_){/* storage is optional */}return v;}
  function cardBackStyle(id){const x=backMap[id]||backMap['classic-bronze'];return "background-image:url('"+x.src+"');background-size:100% 100%;background-position:center;background-repeat:no-repeat;";}
  function backgroundPreviewStyle(id){const x=bgMap[id]||bgMap['nature-vista'];return "background-image:url('"+x.src+"');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";}
  function boardBackgroundStyle(id){const x=bgMap[id]||bgMap['nature-vista'];return "background-image:linear-gradient(rgba(7,10,15,.58),rgba(7,10,15,.68)),url('"+x.src+"');background-size:100% 100%,cover;background-position:center;background-repeat:no-repeat;background-color:#0b1018;";}
  function renderChoices(items,selected,styleFn,kind,extra){const map=kind==='cardBack'?backMap:bgMap,current=map[selected]?selected:(kind==='cardBack'?'classic-bronze':'nature-vista');return items.map(x=>'<button type="button" class="appearance-choice'+(x.id===current?' selected':'')+'" data-appearance-id="'+x.id+'" aria-pressed="'+(x.id===current)+'" title="'+esc(x.name)+'"><span class="appearance-thumb '+extra+'" style="'+esc(styleFn(x.id))+'"></span><span class="appearance-name">'+esc(x.name)+'</span></button>').join('');}
  function renderCardBacks(selected){return renderChoices(BACKS,selected,cardBackStyle,'cardBack','cardback-thumb');}
  function renderBackgrounds(selected){return renderChoices(BACKGROUNDS,selected,backgroundPreviewStyle,'background','background-thumb');}
  window.CTAppearance={backOptions:BACKS,backgroundOptions:BACKGROUNDS,normalizePrefs,getPrefs,savePrefs,cardBackStyle,backgroundPreviewStyle,boardBackgroundStyle,renderCardBacks,renderBackgrounds};
})();
