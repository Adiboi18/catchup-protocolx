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

test('helper allows the exact production origin and rejects other or lookalike origins', async () => {
  const [backgroundScript, bridgeScript, manifestText] = await Promise.all([
    readFile(new URL('../whatsapp-helper/background.js', import.meta.url), 'utf8'),
    readFile(new URL('../whatsapp-helper/bridge.js', import.meta.url), 'utf8'),
    readFile(new URL('../whatsapp-helper/manifest.json', import.meta.url), 'utf8'),
  ]);
  const background = {
    URL,
    chrome: { runtime: { onMessage: { addListener() {} } } },
  };
  vm.runInNewContext(backgroundScript, background);
  const bridgeAccepts = (raw) => {
    const dataset = {};
    vm.runInNewContext(bridgeScript, {
      location: new URL(raw),
      document: { documentElement: { dataset }, addEventListener() {} },
    });
    return dataset.catchupWhatsApp === 'ready';
  };
  const allowed = [
    'https://catchup-protocolx.vercel.app/',
    'https://catchup-protocolx.vercel.app/index.html',
    'http://127.0.0.1:4173/',
    'https://adiboi18.github.io/catchup-protocolx/',
  ];
  const rejected = [
    'https://another-project.vercel.app/',
    'https://catchup-protocolx-preview.vercel.app/',
    'https://catchup-protocolx.vercel.app.evil.example/',
    'https://catchup-protocolx.vercel.app@evil.example/',
    'http://catchup-protocolx.vercel.app/',
    'https://catchup-protocolx.vercel.app:444/',
    'https://adiboi18.github.io/another-project/',
    'http://127.0.0.1:4174/',
  ];
  for (const raw of allowed) {
    assert.equal(background.allowedApp(raw), true, `background should allow ${raw}`);
    assert.equal(bridgeAccepts(raw), true, `bridge should allow ${raw}`);
  }
  for (const raw of rejected) {
    assert.equal(background.allowedApp(raw), false, `background should reject ${raw}`);
    assert.equal(bridgeAccepts(raw), false, `bridge should reject ${raw}`);
  }
  assert.equal(background.allowedApp('not a URL'), false);
  const bridgeMatches = JSON.parse(manifestText).content_scripts.find((entry) =>
    entry.js.includes('bridge.js'),
  ).matches;
  assert.ok(bridgeMatches.includes('https://catchup-protocolx.vercel.app/*'));
  assert.ok(bridgeMatches.every((match) => !match.includes('*.vercel.app')));
});
