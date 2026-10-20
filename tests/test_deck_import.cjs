/* Node only, no packages. Provider requests are mocked; recorded public fixtures test conversion. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = vm.createContext({ console, URL, URLSearchParams, setTimeout, AbortSignal });
context.window = context;
for (const name of ['deck-import.js','deck.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',name),'utf8'),context);
const D = context.CTDeckImport;
const noPause = async () => {};
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/provider-decks.json'),'utf8'));
for (const [site,data] of [['archidekt',fixture.archidekt],['moxfield',fixture.moxfield]]) {
  const converted = D.text(data,{ site, url:'https://'+site+'.com/decks/test' });
  const expected = site === 'archidekt' ? 103 : 100; // Archidekt's search summary reports size:103
  assert.equal(converted.count,expected,site+' recorded public deck count');
  assert.equal(converted.commanders,1,site+' commander count');
  const parsed = context.Deck.parse(converted.text);
  assert.equal(parsed.commanders.length,1);
  assert.equal(parsed.main.reduce((n,r)=>n+r.qty,0),expected-1);
  assert.equal(parsed.warnings.length,0);
}
assert.equal(D.source('https://archidekt.com/decks/27632092/a_slug').id,'27632092');
assert.equal(D.source('https://www.moxfield.com/decks/pdJTEzRX-EGD3kigoGdm5Q').site,'moxfield');
for(const url of ['http://archidekt.com/decks/1','https://evil.test/decks/1','https://archidekt.com.evil.test/decks/1','https://x:y@archidekt.com/decks/1','https://archidekt.com/decks/1e3','https://archidekt.com:99/decks/1']) assert.throws(()=>D.source(url));
for(const value of [null,'',false,'Unknown','v3 draft',3.5]) assert.equal(D.bracket({edhBracket:value}),null);
assert.equal(D.bracket({edhBracket:3}),3);
assert.equal(D.bracket({bracket:{name:'Core'}}),2);
assert.equal(D.bracket({bracket:'Bracket 4'}),4);
assert.throws(()=>D.testRelay('https://commander-table-relay.chris-call1212.workers.dev','https://commander-table-relay.chris-call1212.workers.dev'));
assert.throws(()=>D.testRelay('https://evil.test/','https://live.workers.dev'));
const complete = bracket => ({deckFormat:3,edhBracket:bracket,categories:[],cards:[{quantity:1,categories:['Commander'],card:{name:'Atraxa, Praetors\' Voice'}},{quantity:99,categories:['Tokens'],card:{name:'Island'}}]});
async function main() {
  // Unknown detailed bracket must NEVER inherit the summary's claimed bracket.
  await assert.rejects(()=>D.random(3,async(site,action)=>action==='search'?{results:[{id:1,edhBracket:3}]}:complete(null),()=>{},noPause),/Unknown brackets are not matches/);
  let pages=[];
  const result=await D.random(2,async(site,action,id,page)=>{
    if(action==='search'){pages.push(page);return page===1?{results:[{id:1,edhBracket:3}],next:'untrusted-next-url'}:{results:[{id:2,edhBracket:2}]};}
    assert.equal(id,'2');return complete(2);
  },()=>{},noPause);
  assert.equal(result.count,100);assert.deepEqual(pages,[1,2]);
  assert.equal(result.info.url,'https://archidekt.com/decks/2');
  for(const changes of [{private:true},{unlisted:true},{deckFormat:1},{cards:complete(3).cards.slice(0,1)}])
    await assert.rejects(()=>D.random(3,async(s,a)=>a==='search'?{results:[{id:1,edhBracket:3}]}:Object.assign(complete(3),changes),()=>{},noPause));
  const api=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'relay/deck-api.js'),'utf8')).toString('base64'));
  let calls=0;
  const upstream=async(url,opts)=>{calls++;assert.equal(opts.redirect,'error');assert.match(url,/^https:\/\/(archidekt\.com|api\.moxfield\.com)\//);assert.match(opts.headers['User-Agent'],/^CommanderTable\//);return Response.json({name:'ok'});};
  const req=(query,origin='https://ccall1212.github.io',method='GET')=>new Request('https://test.workers.dev/deck-api?'+query,{method,headers:{Origin:origin}});
  for(const query of ['site=archidekt&action=deck&id=27632092','site=moxfield&action=deck&id=pdJTEzRX-EGD3kigoGdm5Q','site=archidekt&action=search&page=4']) {
    const response=await api.handleDeckApi(req(query),{},upstream,null);assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://ccall1212.github.io');
  }
  assert.equal((await api.handleDeckApi(req('site=archidekt&action=deck&id=1','null'),{},upstream,null)).status,200,'extract/open index.html origin supported');
  const before=calls;
  for(const query of ['site=archidekt&action=deck&id=abc','site=archidekt&action=deck&id=https://evil.test','site=archidekt&action=search&page=5','site=archidekt&action=search&page=1e0','site=archidekt&action=deck&id=1&url=https://evil.test','site=archidekt&site=moxfield&action=deck&id=1','site=other&action=deck&id=1']) assert.equal((await api.handleDeckApi(req(query),{},upstream,null)).status,400);
  assert.equal((await api.handleDeckApi(req('site=moxfield&action=search'),{},upstream,null)).status,501);
  assert.equal((await api.handleDeckApi(req('site=archidekt&action=deck&id=1','https://evil.test'),{},upstream,null)).status,403);
  assert.equal((await api.handleDeckApi(req('site=archidekt&action=deck&id=1','null','POST'),{},upstream,null)).status,405);
  assert.equal(calls,before,'rejected requests never contact any provider');
  for(const status of [401,403,429,500]) {
    let attempts=0;
    const response=await api.handleDeckApi(req('site=moxfield&action=deck&id=abc'),{},async()=>{attempts++;return new Response('blocked',{status});},null);
    assert.equal(response.status,502);assert.equal(attempts,1,'no protection bypass/fallback attempts');
  }
  for(const response of [new Response('<html/>',{headers:{'Content-Type':'text/html'}}),new Response('bad',{headers:{'Content-Type':'application/json'}}),new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(4*1024*1024+1)}}),new Response('x'.repeat(4*1024*1024+1),{headers:{'Content-Type':'application/json'}})]) {
    assert.equal((await api.handleDeckApi(req('site=archidekt&action=deck&id=1'),{},async()=>response,null)).status,502);
  }
  console.log('PASS deck import: recorded Archidekt (103 cards) and Moxfield (100 cards) conversion, printings, URL validation, strict brackets, pagination, completeness, origin/null support, fixed routes, refusals and bounded responses');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
