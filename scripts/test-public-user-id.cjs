const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require(process.env.ORDER_TEST_TYPESCRIPT || 'D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..'), cache = new Map();
function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(file, 'utf8');
    const mod = { exports: {} }; cache.set(file, mod.exports);
    assert.equal(ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    new Function('require', 'module', 'exports', code)(p => load(path.resolve(path.dirname(file), p)), mod, mod.exports);
    cache.set(file, mod.exports); return mod.exports;
}
const { parseTokenPayload } = load('common/jwt.uts');
const uuid = '12345678-1234-4234-8234-123456789abc';
const token = subject => 'header.' + Buffer.from(JSON.stringify({ sub: subject, username: '校园用户', roles: ['CUSTOMER'], exp: 1900000000 })).toString('base64url') + '.signature';
const parsed = parseTokenPayload(token(uuid));
assert.equal(parsed.userUuid, uuid);
assert.equal(parsed.username, '校园用户');
assert.ok(!Object.hasOwn(parsed, 'userId'));
assert.equal(parseTokenPayload(token('7')), null, 'legacy numeric token requires sign-in again');
assert.equal(parseTokenPayload(token(7)), null);
assert.equal(parseTokenPayload(token('12345678-1234-1234-8234-123456789abc')), null, 'time UUID must not slip through numeric conversion');
assert.equal(parseTokenPayload(token(null)), null);
const checkout = load('common/checkout.uts');
assert.equal(checkout.checkoutKey(uuid), 'order_pending_' + uuid);
assert.notEqual(checkout.checkoutKey(uuid), checkout.checkoutKey('87654321-1234-4234-8234-123456789abc'));
for (const directory of ['common', 'pages', 'store', 'api']) {
    for (const file of fs.readdirSync(path.join(root, directory), { recursive: true })) {
        if (!/\.(uts|uvue)$/.test(file)) continue;
        const source = fs.readFileSync(path.join(root, directory, file), 'utf8');
        assert.ok(!/\buserId\b/.test(source), directory + '/' + file + ': internal identity must not be part of customer contract');
    }
}
console.log('Public identity checks passed: UUID preserved as string, legacy/malformed subjects rejected, user caches isolated, no internal userId in frontend contracts.');
