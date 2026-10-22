const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require(process.env.ORDER_TEST_TYPESCRIPT || 'D:/HBuilderX/plugins/compile-typescript/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..'), cache = new Map(), calls = [];
let token = 'old-token', uploadMode = 'success', saveMode = 'success', chooseMode = 'success';
const storage = { getAccessToken: () => token, getRefreshToken: () => 'refresh-token', saveTokens: a => { token = a; }, clearTokens() {} };
const envelope = data => JSON.stringify({ code: 'COMMON_000', data, message: '' });
const KEY = '0123456789abcdef0123456789abcdef';
global.uni = {
    uploadFile(options) {
        calls.push({ type: 'upload', options });
        assert.equal(options.name, 'file');
        assert.ok(!Object.keys(options.header).some(k => k.toLowerCase() === 'content-type'), 'multipart boundary is platform generated');
        if (uploadMode === 'network') { options.fail({}); return; }
        if (uploadMode === 'expired' && options.header.Authorization === 'Bearer old-token') { options.success({ statusCode: 401, data: '{"code":"COMMON_401"}' }); return; }
        options.success({ statusCode: 200, data: envelope({ fileKey: KEY, url: '/api/files/' + KEY + '/content' }) });
    },
    request(options) {
        calls.push({ type: 'request', options });
        if (options.url.endsWith('/auth/refresh')) { options.success({ statusCode: 200, data: envelope({ accessToken: 'new-token', refreshToken: 'new-refresh-token' }) }); return; }
        if (saveMode === 'fail') { options.success({ statusCode: 503, data: '{"code":"COMMON_503","message":"unavailable"}' }); return; }
        options.success({ statusCode: 200, data: envelope('/api/files/' + KEY + '/content') });
    },
    chooseImage(options) {
        calls.push({ type: 'choose' });
        if (chooseMode === 'cancel') options.fail({ errMsg: 'chooseImage:fail cancel' });
        else options.success({ tempFilePaths: ['blob:local-photo'], tempFiles: [{ size: chooseMode === 'large' ? 6 * 1024 * 1024 : 1024 }] });
    }
};
function load(file) {
    file = path.resolve(root, file);
    if (file.endsWith(path.normalize('common/storage.uts'))) return storage;
    if (file.endsWith(path.normalize('store/auth.uts'))) return { isLoggedIn: () => true };
    if (file.endsWith(path.normalize('common/config.uts'))) return { API_BASE_URL: 'https://gateway.example/api', API_TIMEOUT: 10000, SUCCESS_CODE: 'COMMON_000' };
    if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.uvue')) source = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
    assert.equal(ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0, file);
    const mod = { exports: {} }; cache.set(file, mod.exports);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    new Function('require', 'module', 'exports', code)(p => load(path.resolve(path.dirname(file), p)), mod, mod.exports);
    cache.set(file, mod.exports); return mod.exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    const files = load('api/files.uts'), images = load('common/images.uts'), picker = load('common/image-picker.uts');
    assert.equal(images.imageSource('', 'avatar'), '/static/images/defaults/avatar.png');
    assert.equal(images.imageSource('http://localhost:9090/api/files/' + KEY + '/content', 'avatar'), 'https://gateway.example/api/files/' + KEY + '/content');
    assert.equal(images.imageSource('/api/files/' + KEY + '/content', 'window'), 'https://gateway.example/api/files/' + KEY + '/content');
    assert.equal(images.imageSource('javascript:alert(1)', 'product'), '/static/images/defaults/product.jpg');
    const component = load('components/business-image/business-image.uvue').default;
    const vm = { ...component.data(), src: 'https://invalid/photo', kind: 'product' };
    component.methods.onImageError.call(vm);
    assert.equal(component.computed.resolvedSource.call(vm), images.defaultImage('product'));
    component.watch.src.call(vm, 'new-photo'); assert.equal(vm.failed, false);

    uploadMode = 'expired'; const uploaded = await files.uploadImage('blob:local-photo', 'USER_AVATAR', 0);
    assert.equal(uploaded.ok, true); assert.equal(token, 'new-token');
    assert.equal(calls.filter(c => c.type === 'upload').length, 2);
    assert.equal(calls.filter(c => c.type === 'request' && c.options.url.endsWith('/auth/refresh')).length, 1);
    const form = calls.find(c => c.type === 'upload').options.formData;
    assert.deepEqual(form, { bizType: 'USER_AVATAR' });
    calls.length = 0; uploadMode = 'network'; assert.equal((await files.uploadImage('blob:x', 'USER_AVATAR', 0)).ok, false);
    assert.equal(calls.length, 1, 'uncertain network upload does not auto retry');
    chooseMode = 'large'; assert.ok((await picker.chooseLocalImage()).error.length > 0);
    chooseMode = 'cancel'; assert.deepEqual(await picker.chooseLocalImage(), { path: '', error: '' });

    const profile = load('pages/account/profile.uvue').default;
    const user = { ...profile.data(), loading: false, userUuid: '12345678-1234-4234-8234-123456789abc', avatarUrl: 'old-avatar' };
    for (const [name, fn] of Object.entries(profile.methods)) user[name] = fn.bind(user);
    uploadMode = 'success'; saveMode = 'fail'; chooseMode = 'success'; calls.length = 0;
    user.openAvatarPreview();
    assert.equal(user.avatarPreviewVisible, true); assert.equal(calls.length, 0, 'preview never opens picker or starts upload');
    user.changeAvatar();
    assert.equal(user.avatarChoosing, true, 'opening picker is distinct from uploading');
    assert.equal(user.avatarUploading, false, 'no saving state before image chosen');
    await flush();
    assert.equal(user.avatarUrl, 'old-avatar', 'failed binding never displays an unsaved avatar');
    assert.equal(user.pendingAvatarKey, KEY); assert.equal(user.avatarUploading, false);
    const uploads = calls.filter(c => c.type === 'upload').length;
    saveMode = 'success'; user.retryAvatar(); await flush();
    assert.equal(user.avatarUrl, '/api/files/' + KEY + '/content'); assert.equal(user.pendingAvatarKey, '');
    assert.equal(calls.filter(c => c.type === 'upload').length, uploads, 'binding retries reuse uploaded file');
    user.closeAvatarPreview(); assert.equal(user.avatarPreviewVisible, false);
    profile.onLoad.call(user, { avatar: 'preview' }); assert.equal(user.avatarPreviewVisible, true, 'mine avatar deep link opens preview');
    chooseMode = 'cancel'; calls.length = 0; user.changeAvatar(); await flush();
    assert.equal(user.avatarChoosing, false); assert.equal(user.avatarUploading, false);
    assert.equal(calls.filter(c => c.type === 'upload').length, 0, 'cancelled picker does not upload');
    assert.equal(calls.filter(c => c.type === 'request').length, 0, 'cancelled picker does not save');
    const source = fs.readFileSync(path.join(root, 'pages/account/profile.uvue'), 'utf8');
    const template = source.split('<template>')[1].split('</template>')[0];
    assert.ok(!template.includes('class="avatar-change"') && !template.includes('正在保存头像'));
    assert.ok(template.indexOf('@click="changeAvatar"') > template.indexOf('v-if="avatarPreviewVisible"'), 'change option belongs to preview only');
    await files.saveCatalogImage('window', 2, KEY); assert.ok(calls.at(-1).options.url.endsWith('/products/admin/windows/2/image'));
    await files.saveCatalogImage('product', 3, KEY); assert.ok(calls.at(-1).options.url.endsWith('/products/admin/products/3/image'));
    const management = load('pages/manage/images.uvue').default;
    const state = management.data();
    const parsedWindows = management.methods.parseItems.call(state, { ok: true, data: { data: [{ windowId: 2, windowName: '窗口', imageUrl: '' }] } }, 'window');
    assert.deepEqual(parsedWindows, [{ id: 2, name: '窗口', imageUrl: '' }]);
    const parsedProducts = management.methods.parseItems.call(state, { ok: true, data: { data: [{ productId: 3, productName: '菜品', imageUrl: '' }] } }, 'product');
    assert.deepEqual(parsedProducts, [{ id: 3, name: '菜品', imageUrl: '' }]);
    assert.equal(management.methods.parseItems.call(state, { ok: true, data: { data: [null] } }, 'product'), null);
    for (const kind of ['avatar', 'window', 'product']) assert.ok(fs.statSync(path.join(root, images.defaultImage(kind))).size > 1000);
    console.log('Image integration checks passed: multipart/auth renewal, no network auto-retry, 5MB/cancel handling, ownership binding contract, failed-save recovery, gateway URL normalization, default and broken-image fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
