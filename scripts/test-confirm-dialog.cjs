const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components/confirm-dialog/confirm-dialog.uvue'), 'utf8');
const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const props = { busy: false };
const events = [];
const code = ts.transpileModule(script + '\nreturn { submit, dismiss };', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const api = new Function('defineProps', 'defineEmits', code)(() => props, () => event => events.push(event));
api.submit(); api.dismiss();
assert.deepEqual(events, ['confirm', 'cancel']);
props.busy = true;
api.submit(); api.dismiss();
assert.deepEqual(events, ['confirm', 'cancel'], 'busy dialog blocks both actions');
for (const page of ['order/detail', 'mine/mine', 'search/search']) {
    const text = fs.readFileSync(path.join(root, 'pages', page + '.uvue'), 'utf8');
    assert.match(text, /<confirm-dialog\s/);
    assert.ok(!/uni\.showModal|class="(?:signout|history)-modal/.test(text), page + ': no separate confirmation style');
}
console.log('Shared confirmation checks passed: explicit actions, busy guards and all three integrations.');
