// Drawer categories. houses are 0-based drawing numbers (집 1 = 0).
(function (root) {
  const CATS = [
    { id: 'small', name: '아담한 집', houses: [0, 1, 3, 4, 12, 15, 33, 42, 43, 49] },
    { id: 'tall', name: '2·3층 집', houses: [2, 8, 11, 20, 25, 31, 34, 39, 46] },
    { id: 'wide', name: '넓은 집', houses: [6, 9, 10, 16, 17, 18, 19, 21, 36, 48] },
    { id: 'modern', name: '모던 하우스', houses: [5, 26, 28, 32, 41, 47] },
    { id: 'country', name: '시골집', houses: [13, 14, 22, 24, 27, 29, 40] },
    { id: 'nature', name: '자연과 함께', houses: [7, 30, 35, 38, 45] },
    { id: 'landmark', name: '랜드마크', models: ['windmill', 'lighthouse', 'clockTower', 'ferrisWheel', 'waterwheel', 'observatory', 'station', 'treehouse', 'pavilion', 'church', 'balloon', 'gate'] },
    { id: 'special', name: '특별한 건물', houses: [23, 37, 44], models: ['tower', 'castle', 'cottage', 'tripleGable', 'greenhouse', 'storeBox'] },
    { id: 'shop', name: '마을 가게', models: ['bakery', 'flowerShop', 'cafe', 'bookstore', 'postOffice', 'iceCream', 'market', 'library'] },
    { id: 'park', name: '공원', models: ['fountain', 'pond', 'bridge', 'playground'], deco: ['bench', 'flowers'] },
    { id: 'farm', name: '숲과 농장', models: ['waterfall', 'field', 'hill'], deco: ['cherry', 'bamboo', 'fruitTree', 'sunflowers', 'beehive', 'rock'] },
    { id: 'rest', name: '쉼터', models: ['hammock', 'tent', 'footbath', 'clothesline'], deco: ['campfire', 'picnic', 'treeSwing', 'flowerArch', 'mailbox'] },
    { id: 'statue', name: '사진 동상', statues: true },
    { id: 'deco', name: '꾸미기', deco: ['road', 'water', 'rail', 'tree', 'roundTree', 'bush', 'lamp', 'fence', 'erase'] },
  ];
  const api = { CATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BV = root.BV || {}; root.BV.Cats = api; }
})(this);
