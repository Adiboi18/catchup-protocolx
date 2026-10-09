import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const script=await readFile(new URL('../whatsapp-helper/reader.js',import.meta.url),'utf8');
function installReader(group='Sample Group') {
  let listener;
  const textNode=(text,nested=false,quoted=false)=>({innerText:text,parentElement:{closest:()=>nested?{}:null},closest:()=>quoted?{}:null});
  const message={getAttribute:()=> '[10:08, 09/10/2026] Arun:',closest:()=>({getAttribute:()=> 'message-1'}),querySelectorAll:()=>[textNode('@Adyan please send slides by 2 PM today.'),textNode('duplicate nested link',true),textNode('old quoted message',false,true)]};
  const header={querySelectorAll:()=>[{getAttribute:()=>null,textContent:group}]};
  const main={querySelectorAll:()=>[message]};
  const document={querySelector:selector=>selector==='#main header'?header:selector==='#main'?main:selector==='#main [data-pre-plain-text]'?message:selector==='#pane-side'?{querySelectorAll:()=>[]}:null};
  const chrome={runtime:{id:'catchup-test',onMessage:{addListener:fn=>listener=fn}}};
  vm.runInNewContext(script,{document,chrome,setTimeout,Date});
  return listener;
}

test('helper adapter reads the confirmed chat, excludes quotes/nested duplicates and labels partial coverage',async()=>{
  const listener=installReader();
  const result=await new Promise(resolve=>listener({type:'catchup-read',name:'Sample Group'},{id:'catchup-test'},resolve));
  assert.equal(result.ok,true);
  assert.equal(result.partial,true);
  assert.equal(result.count,1);
  assert.ok(result.text.includes('send slides'));
  assert.ok(!result.text.includes('duplicate'));
  assert.ok(!result.text.includes('quoted'));
});

test('helper fails closed when the named chat cannot be confirmed',async()=>{
  const listener=installReader('Different Group');
  const result=await new Promise(resolve=>listener({type:'catchup-read',name:'Sample Group'},{id:'catchup-test'},resolve));
  assert.equal(result.ok,false);
  assert.ok(!result.text);
});

test('helper ignores messages from a different extension',()=>{
  const listener=installReader();
  let called=false;
  assert.equal(listener({type:'catchup-read',name:'Sample Group'},{id:'wrong-extension'},()=>called=true),undefined);
  assert.equal(called,false);
});
