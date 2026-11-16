// Set dressing from free (CC0) model kits by Kenney, kept in ~/Projects/heatsync/3d-assets. Each prop type names a
// file (pack/model), optional look-alike variants picked by position, and the real-world size it is fitted to:
// fit {h | w | d} scales uniformly to one dimension in metres, size [w, h, d] scales each axis (a number, or 'w' / 'd'
// to take the width or depth the set gives). parts stacks pieces: 'top' puts a piece on the one before it.
// tools/kit.mjs copies these into assets/kit (textures embedded); src/sets.js builds props from them.
export const KIT = {
  desk: { file: 'furniture-kit/desk', size: [1.0, 0.76, 0.62] },
  schooldesk: { file: 'furniture-kit/table', size: [0.95, 0.74, 0.6] },   // open legs, so a seated student's knees go under it
  chair: { file: 'furniture-kit/chair', fit: { h: 0.95 } },
  bed: { file: 'furniture-kit/bedSingle', size: [1.05, 0.55, 2.05] },
  shelf: { file: 'furniture-kit/bookcaseOpen', fit: { h: 1.85 } },
  couch: { file: 'furniture-kit/loungeSofa', fit: { w: 2.0 } },
  tv: { parts: [{ file: 'furniture-kit/cabinetTelevision', fit: { w: 1.4 } }, { file: 'furniture-kit/televisionModern', fit: { w: 1.15 }, y: 'top' }] },
  fridge: { file: 'furniture-kit/kitchenFridge', fit: { h: 1.85 } },
  counter: { file: 'furniture-kit/kitchenCabinet', fit: { h: 0.92 }, repeat: true },
  stove: { file: 'furniture-kit/kitchenStove', fit: { h: 0.92 } },
  sink: { parts: [{ file: 'furniture-kit/bathroomSink', fit: { h: 0.95 } }, { file: 'furniture-kit/bathroomMirror', fit: { h: 0.75 }, y: 1.25, z: -0.18 }] },
  toilet: { file: 'furniture-kit/toiletSquare', fit: { h: 0.8 } },
  table: { file: 'furniture-kit/table', size: ['w', 0.76, 'd'] },
  plant: { file: 'furniture-kit/pottedPlant', fit: { h: 0.9 } },
  floorlamp: { file: 'furniture-kit/lampRoundFloor', fit: { h: 1.7 } },
  rug: { file: 'furniture-kit/rugRectangle', size: ['w', 0.02, 'd'] },
  trash: { file: 'furniture-kit/trashcan', fit: { h: 0.75 } },
  stoolbar: { file: 'furniture-kit/stoolBar', fit: { h: 0.8 } },
  tree: { file: 'nature-kit/tree_default', fit: { h: 4.6 }, variants: ['nature-kit/tree_detailed', 'nature-kit/tree_oak'] },
  bush: { file: 'nature-kit/plant_bushDetailed', fit: { w: 1.4 } },
  flowers: { file: 'nature-kit/flower_redA', fit: { h: 0.4 }, variants: ['nature-kit/flower_yellowA', 'nature-kit/flower_purpleA'] },
  car: { file: 'car-kit/sedan', fit: { d: 4.4 }, variants: ['car-kit/hatchback-sports', 'car-kit/suv', 'car-kit/taxi'] },
  streetlamp: { file: 'retro-urban-kit/detail-light-single', fit: { h: 3.8 } },
  parkbench: { file: 'retro-urban-kit/detail-bench', fit: { w: 1.9 } },
  shop: { file: 'city-kit-commercial/building-c', fit: { w: 7 }, variants: ['city-kit-commercial/building-a', 'city-kit-commercial/building-d', 'city-kit-commercial/building-f'] },
  house: { file: 'city-kit-suburban/building-type-a', fit: { w: 9 }, variants: ['city-kit-suburban/building-type-c', 'city-kit-suburban/building-type-e'] },
  fence: { file: 'city-kit-suburban/fence-1x4', fit: { w: 4 } },
};

// Every file the kit uses (for the build).
export const KIT_FILES = [...new Set(Object.values(KIT).flatMap((k) => [k.file, ...(k.variants || []), ...(k.parts || []).map((p) => p.file)]).filter(Boolean))];
