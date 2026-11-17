const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
const path=require('node:path');const root=path.resolve(__dirname,'..');
const map=new Map();function element(id){if(!map.has(id))map.set(id,{hidden:false,innerHTML:'',textContent:'',dataset:{},style:{},addEventListener(){},remove(){},close(){},querySelector(){return element('button')},querySelectorAll(){return []}});return map.get(id)}
let legacyRead=false,networkCalls=0;const blank={patients:[],appointments:[],areas:[],packages:[],receipts:[]};
const c=vm.createContext({console,navigator:{},window:{LUMINA_CONFIG:{},addEventListener(){}},document:{getElementById:element,querySelector:element,body:{setAttribute(){},removeAttribute(){}}},db:blank,localStorage:{getItem(){legacyRead=true}},sessionStorage:{getItem(){return null}},render(){},save(){},settingsView(){},photos(){},savePhoto(){},comparePhotos(){},removePhoto(){},restoreBackup(){},downloadICS(){},fetch(){networkCalls++;throw Error('Unconfigured service must never receive requests')},structuredClone,JSON,Intl,URL,Error,Map,Promise,setTimeout(){},clearTimeout(){}});
vm.runInContext(fs.readFileSync(path.join(root,'web/cloud.js'),'utf8'),c);
assert.equal(legacyRead,false);
assert.equal(networkCalls,0);
assert.match(element('accountGate').innerHTML,/No necesitas ChatGPT/);
assert.match(element('accountGate').innerHTML,/Falta conectar/);
assert.match(element('accountGate').innerHTML,/<button disabled>/);
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
assert.ok(html.includes('<body data-locked>'));
assert.ok(!html.includes("getItem('lumina-v1')"));
const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611180001_private_accounts.sql'),'utf8');
assert.ok(sql.includes('enable row level security'));
assert.ok(sql.includes('owner_id uuid := auth.uid()'));
assert.ok(!/p_user_id/.test(sql),'The save API must not accept an owner chosen by the client');
console.log('PASS: unconfigured access blocked, no legacy patient data loaded, independent account wording, owner comes from authenticated identity. Live database isolation remains to be tested.');
