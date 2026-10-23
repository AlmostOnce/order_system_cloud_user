const fs = require('fs'), assert = require('assert/strict');
const { loadSetup } = require('./setup-harness.cjs');
const source = fs.readFileSync('pages/menu/menu.uvue', 'utf8');
const vm = loadSetup(source.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1], () => ({})).create();
const flush = () => new Promise(resolve => setImmediate(resolve));
const rectangles = [
 { id: 'menu-category-11', top: 200, height: 340 },
 { id: 'menu-category-22', top: 540, height: 360 },
 { id: 'menu-category-other', top: 900, height: 180 }
];
(async () => {
 vm.groups = [
  { categoryId: 11, categoryName: '招牌', products: [{ productId: 1 }] },
  { categoryId: 22, categoryName: '主食', products: [{ productId: 2 }] },
  { categoryId: -1, categoryName: '其他', products: [{ productId: 3 }] }
 ];
 vm.resetCategoryNavigation();
 assert.equal(vm.activeCategoryId, 11);
 vm.applyCategoryLayout(100, 300, 30, rectangles);
 assert.deepEqual(vm.categoryOffsets.map(r => r.top), [130, 470, 830]);
 assert.equal(vm.categoryTailHeight, 120, 'short final group can align at viewport top');
 vm.applyCategoryLayout(100, 300, 30, rectangles, 60);
 assert.equal(vm.categoryTailHeight, 60, 'existing bottom spacing is not counted twice');
 vm.onDishesScroll({ detail: { scrollTop: 475 } });
 assert.equal(vm.activeCategoryId, 22); assert.equal(vm.railAnchor, 'menu-rail-22');
 vm.onDishesScroll({ detail: { scrollTop: 835 } });
 assert.equal(vm.activeCategoryId, -1);
 vm.onDishesScroll({ detail: { scrollTop: 140 } });
 assert.equal(vm.activeCategoryId, 11, 'scrolling upward restores earlier category');
 vm.selectCategory(22); await flush();
 assert.equal(vm.dishesAnchor, 'menu-category-22'); assert.equal(vm.groups.length, 3, 'click never filters other groups');
 vm.selectCategory(22); assert.equal(vm.dishesAnchor, ''); await flush();
 assert.equal(vm.dishesAnchor, 'menu-category-22', 'repeat click can reposition the same category');
 vm.selectCategory(-1); await flush(); assert.equal(vm.dishesAnchor, 'menu-category-other');
 vm.selectCategory(999); await flush(); assert.equal(vm.activeCategoryId, -1, 'unknown category ignored');
 vm.applyCategoryLayout(100, 100, 30, rectangles);
 assert.equal(vm.categoryTailHeight, 0, 'tall final group requires no filler');
 vm.applyCategoryLayout(100, 300, 835, [
  { id: 'menu-category-11', top: -605, height: 340 },
  { id: 'menu-category-22', top: -265, height: 360 },
  { id: 'menu-category-other', top: 95, height: 180 }
 ]);
 assert.equal(vm.activeCategoryId, -1, 'remeasuring while scrolled preserves the current section');
 vm.groups = []; vm.resetCategoryNavigation();
 assert.equal(vm.activeCategoryId, 0); assert.equal(vm.railAnchor, ''); assert.equal(vm.categoryOffsets.length, 0);
 assert.ok(!source.includes('visibleGroups()') && !source.includes('selectCategory(0)'));
 assert.ok(source.includes('@scroll="onDishesScroll"') && source.includes(':id="categorySectionId(group.categoryId)"'));
 console.log('Menu linkage checks passed: full grouped menu, category anchors, repeat clicks, bidirectional highlighting, uncategorized items, short final section, remeasurement and empty refresh.');
})().catch(error => { console.error(error); process.exitCode = 1; });
