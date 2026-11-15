// Who is who. height: how tall the character stands in metres, quills and ears included. model: a file in assets/vrm (without .vrm). Characters with no model of their own borrow one
// as a stand-in until a VRM is added; tint recolours a stand-in and is only used on models whose VRoid Hub
// licence allows modification (knuckles, tikal). voice: gender for picking a system voice, plus pitch and rate.
// color tints the caption the way the source videos colour each speaker.
export const CAST = [
  { id: 'sonic', name: 'Sonic', model: 'sonic', height: 1.65, color: '#4d8dff', voice: { gender: 'm', pitch: 1.15, rate: 1.12, prefer: ['Alex', 'Google US English', 'Microsoft Guy'] }, run: 1.4 },
  { id: 'amy', name: 'Amy', model: 'amy', height: 1.5, color: '#ff7fbf', voice: { gender: 'f', pitch: 1.3, rate: 1.08, prefer: ['Samantha', 'Google US English', 'Microsoft Aria'] } },
  // costume: worn instead of the base character on these sets (performances and sports) (voice, lines and captions stay the base character's)
  { id: 'amy-popstar', name: 'Amy', model: 'amy-popstar', height: 1.5, color: '#ff7fbf', costume: { of: 'amy', sets: ['stage', 'gym', 'field'] }, voice: { gender: 'f', pitch: 1.3, rate: 1.08 } },
  { id: 'knuckles', name: 'Knuckles', model: 'knuckles', height: 1.65, color: '#ff5a4f', voice: { gender: 'm', pitch: 0.8, rate: 1.0 } },
  { id: 'tikal', name: 'Tikal', model: 'tikal', height: 1.55, color: '#ff9f6b', voice: { gender: 'f', pitch: 1.1, rate: 0.95 } },
  { id: 'tails', name: 'Tails', model: 'tails', height: 1.35, standin: 'espio', tint: '#f2a23a', color: '#ffc341', voice: { gender: 'm', pitch: 1.55, rate: 1.1 } },
  { id: 'manic', name: 'Manic', model: 'manic', height: 1.6, standin: 'scourge', tint: '#2fb36a', color: '#4fd18a', voice: { gender: 'm', pitch: 1.05, rate: 1.15 } },
  { id: 'sonia', name: 'Sonia', model: 'sonia', height: 1.6, standin: 'silvia', tint: '#d63fa0', color: '#ff9bd0', voice: { gender: 'f', pitch: 1.2, rate: 1.05 } },
  { id: 'sally', name: 'Sally', model: 'sally', height: 1.6, standin: 'silvia', tint: '#b8733a', color: '#d9a066', voice: { gender: 'f', pitch: 1.1, rate: 1.02 } },
  { id: 'cream', name: 'Cream', model: 'cream', height: 1.15, standin: 'silvia', tint: '#f5dcb0', color: '#ffe0b0', voice: { gender: 'f', pitch: 1.6, rate: 1.0 } },
  { id: 'rouge', name: 'Rouge', model: 'rouge', height: 1.65, standin: 'silvia', tint: '#e9e9ef', color: '#d9d9ff', voice: { gender: 'f', pitch: 0.95, rate: 0.98 } },
  { id: 'blaze', name: 'Blaze', model: 'blaze', height: 1.6, standin: 'silvia', tint: '#9a6bd6', color: '#c49bff', voice: { gender: 'f', pitch: 1.0, rate: 1.0 } },
  { id: 'maria', name: 'Maria', model: 'maria', height: 1.55, standin: 'silvia', tint: '#f2d77a', color: '#ffe98f', voice: { gender: 'f', pitch: 1.25, rate: 0.98 } },
  { id: 'shadow', name: 'Shadow', model: 'shadow', height: 1.65, standin: 'scourge', tint: '#2b2b33', color: '#ff4a4a', voice: { gender: 'm', pitch: 0.75, rate: 0.95 } },
  { id: 'silver', name: 'Silver', model: 'silver', height: 1.65, standin: 'scourge', tint: '#c9ced8', color: '#9ff2ff', voice: { gender: 'm', pitch: 1.1, rate: 1.05 } },
  { id: 'espio', name: 'Espio', model: 'espio', height: 1.65, standin: 'scourge', tint: '#8e4fc4', color: '#c18bff', voice: { gender: 'm', pitch: 0.9, rate: 0.95 } },
  { id: 'vector', name: 'Vector', model: 'vector', noFoldArms: true, height: 2.0, standin: 'espio', tint: '#3fae4f', color: '#7be07f', voice: { gender: 'm', pitch: 0.65, rate: 1.0 } },
  { id: 'eggman', name: 'Dr. Eggman', model: 'eggman', noFoldArms: true, height: 2.0, standin: 'espio', tint: '#c0392b', color: '#ff8a3d', voice: { gender: 'm', pitch: 0.6, rate: 0.92 } },
  { id: 'scourge', name: 'Scourge', model: 'scourge', height: 1.65, standin: 'espio', tint: '#2f8a37', color: '#6fdc5a', voice: { gender: 'm', pitch: 0.92, rate: 1.12 } },
  { id: 'fiona', name: 'Fiona', model: 'fiona', height: 1.55, standin: 'silvia', tint: '#c8452f', color: '#ff8a6a', voice: { gender: 'f', pitch: 1.05, rate: 1.05 } },
  { id: 'cosmo', name: 'Cosmo', model: 'cosmo', height: 1.4, standin: 'silvia', tint: '#7fd36a', color: '#a8f08f', voice: { gender: 'f', pitch: 1.4, rate: 1.0 } },
  { id: 'bunnie', name: 'Bunnie', model: 'bunnie', height: 1.65, standin: 'silvia', tint: '#d9a273', color: '#f2c08f', voice: { gender: 'f', pitch: 1.15, rate: 0.95 } },
  { id: 'vanilla', name: 'Nurse Vanilla', model: 'vanilla', height: 1.75, standin: 'silvia', tint: '#f3dcb4', color: '#ffe9c4', voice: { gender: 'f', pitch: 1.0, rate: 0.92 } },
  { id: 'mom', name: "Amy's Mom", model: 'mom', height: 1.7, standin: 'silvia', tint: '#e58fb8', color: '#ffb3d6', voice: { gender: 'f', pitch: 0.95, rate: 0.95 } },
  { id: 'teacher', name: 'Teacher', model: 'teacher', height: 1.8, standin: 'espio', tint: '#8a7f73', color: '#d8cfc4', voice: { gender: 'm', pitch: 0.7, rate: 0.9 } },
  { id: 'robot', name: 'Metal Sonic', model: 'robot', height: 2.0, standin: 'scourge', tint: '#7d8794', color: '#bcc6d4', voice: { gender: 'm', pitch: 0.5, rate: 0.85, robot: true } },
  // background students (never speak; placed by src/extras.js)
  { id: 'extra1', name: 'Student', model: 'x-avatarsample-d', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra2', name: 'Student', model: 'x-avatarsample-e', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra3', name: 'Student', model: 'x-avatarsample-f', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra4', name: 'Student', model: 'x-avatarsample-g', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra5', name: 'Student', model: 'x-fumiriya', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra6', name: 'Student', model: 'x-shino-light', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra7', name: 'Student', model: 'x-yyc-b', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'extra8', name: 'Student', model: 'x-yyc-c', height: 1.72, extra: true, color: '#cccccc', voice: { gender: 'm' } },
  { id: 'crowd', name: 'Everyone', model: null, color: '#ffffff', voice: { gender: 'm', pitch: 1.0, rate: 1.1 } },
  { id: 'fangirls', name: 'Fangirls', model: null, color: '#ff9bd0', voice: { gender: 'f', pitch: 1.35, rate: 1.15 } },
  { id: 'narrator', name: '', model: null, color: '#ffffff', voice: { gender: 'm', pitch: 0.9, rate: 1.0 } },
];

// Models whose licence allows modification, so a tint is allowed on them.
// Models whose terms allow modification, so tints are allowed on them (Espio, Scourge, Silvia; Manic is CC BY).
export const TINTABLE = new Set(['espio', 'scourge', 'silvia', 'manic']);
export const DEFAULT_HEIGHT = 1.6;   // metres, top of quills or ears to the soles; set per character with height
