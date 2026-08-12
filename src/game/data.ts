export const W = 960;
export const H = 540;
export const GROUND = 468;
export const GRAVITY = 2100;

export type Palette = {
  coat: string;
  coatDark: string;
  pants: string;
  skin: string;
  hat: string;
  hatDark: string;
  boots: string;
  beard: string;
  aura: string;
};

export type FighterDef = {
  id: string;
  name: string;
  title: string;
  bio: string;
  speed: number;
  power: number;
  defense: number;
  jump: number;
  hp: number;
  palette: Palette;
  special: string;
  build: number; // 0.9 slim .. 1.25 heavy
};

/** Игровой герой — «ТЫ» / Бомж Герой */
export const HERO: FighterDef = {
  id: 'ty',
  name: 'ТЫ',
  title: 'Бомж Герой',
  bio: 'Оранжевая шапка, оливковый пуховик, латанные штаны и борода двора. Идёшь в башню — вернёшься легендой подъезда.',
  speed: 1.08,
  power: 1.05,
  defense: 1.02,
  jump: 1.08,
  hp: 105,
  build: 1.02,
  special: 'БУТЫЛКА ДВОРА',
  palette: {
    coat: '#5a7a50',
    coatDark: '#3f5a44',
    pants: '#2a2d36',
    skin: '#c9926a',
    hat: '#e67e22',
    hatDark: '#b85a12',
    boots: '#3a2f28',
    beard: '#5c4030',
    aura: '#f0a040',
  },
};

/** Доп. бойцы для выбора в свободном бою (тот же герой + скрытые альты не нужны — один герой) */
export const FIGHTERS: FighterDef[] = [HERO];

export type OpponentDef = FighterDef & { aggro: number; react: number; skill: number };

/** Башня Двора — 10 ступеней (9–10 после Короля) */
export const OPPONENTS: OpponentDef[] = [
  {
    id: 'valera',
    name: 'ВАЛЕРА КАРТОН',
    title: 'Коробочка у ларька',
    bio: 'Синий худи, серая шапка, картонный щит души.',
    speed: 0.94,
    power: 0.88,
    defense: 0.96,
    jump: 1.0,
    hp: 92,
    build: 0.98,
    special: 'КАРТОННЫЙ УДАР',
    aggro: 0.4,
    react: 0.36,
    skill: 0.28,
    palette: {
      coat: '#3a6ea5',
      coatDark: '#254a72',
      pants: '#5a5e66',
      skin: '#c08e66',
      hat: '#8a9199',
      hatDark: '#5a6168',
      boots: '#2a2622',
      beard: '#6a5a4a',
      aura: '#7eb6e8',
    },
  },
  {
    id: 'vova',
    name: 'ДЯДЯ ВОВА',
    title: 'Сторож гаражей',
    bio: 'Ключи от всех боксов и кулак от всех обид.',
    speed: 0.9,
    power: 1.0,
    defense: 1.08,
    jump: 0.92,
    hp: 100,
    build: 1.1,
    special: 'ГАРАЖНЫЙ КЛЮЧ',
    aggro: 0.48,
    react: 0.3,
    skill: 0.38,
    palette: {
      coat: '#5c5340',
      coatDark: '#3b3529',
      pants: '#3a3a3a',
      skin: '#c08e66',
      hat: '#6d6350',
      hatDark: '#443d30',
      boots: '#221f1c',
      beard: '#9a9186',
      aura: '#ffd479',
    },
  },
  {
    id: 'krys',
    name: 'КРЫС',
    title: 'Подвал без окон',
    bio: 'Худой, злой, кусается словами и коленями.',
    speed: 1.18,
    power: 0.92,
    defense: 0.9,
    jump: 1.15,
    hp: 96,
    build: 0.9,
    special: 'НОРКА',
    aggro: 0.62,
    react: 0.22,
    skill: 0.5,
    palette: {
      coat: '#4a4540',
      coatDark: '#2e2b28',
      pants: '#2c2824',
      skin: '#b88860',
      hat: '#3a3530',
      hatDark: '#1f1c19',
      boots: '#1a1714',
      beard: '#2a2420',
      aura: '#a8a090',
    },
  },
  {
    id: 'zina',
    name: 'БАБКА ЗИНА',
    title: 'Пункт приёма стекла',
    bio: 'Авоська с кирпичом. Характер — с девятого этажа.',
    speed: 1.02,
    power: 1.1,
    defense: 0.95,
    jump: 0.9,
    hp: 102,
    build: 1.08,
    special: 'АВОСЬКА С КИРПИЧОМ',
    aggro: 0.55,
    react: 0.26,
    skill: 0.48,
    palette: {
      coat: '#8a3a6a',
      coatDark: '#5a2244',
      pants: '#4a3550',
      skin: '#dfa887',
      hat: '#c8538b',
      hatDark: '#8a3358',
      boots: '#2a211f',
      beard: '#00000000',
      aura: '#ff9ec8',
    },
  },
  {
    id: 'sanka',
    name: 'САНЬКА ТЕЛЕЖКА',
    title: 'Колёса района',
    bio: 'Тащит тележку и судьбу. Тяжёлый разгон — тяжёлый удар.',
    speed: 0.88,
    power: 1.18,
    defense: 1.12,
    jump: 0.85,
    hp: 118,
    build: 1.2,
    special: 'РАЗГОН ТЕЛЕЖКИ',
    aggro: 0.58,
    react: 0.24,
    skill: 0.55,
    palette: {
      coat: '#4a5a6a',
      coatDark: '#2e3a46',
      pants: '#3a4248',
      skin: '#c49a72',
      hat: '#6a7a3a',
      hatDark: '#3e4a22',
      boots: '#2a2420',
      beard: '#5a4a38',
      aura: '#9ab8d0',
    },
  },
  {
    id: 'gosha',
    name: 'ГОША ГОЛУБЬ',
    title: 'Кормилец сквера',
    bio: 'Кормит птиц и бьёт крылом. Недооценивать — нельзя.',
    speed: 1.14,
    power: 1.0,
    defense: 0.98,
    jump: 1.2,
    hp: 108,
    build: 1.0,
    special: 'СТАЯ',
    aggro: 0.66,
    react: 0.2,
    skill: 0.64,
    palette: {
      coat: '#6a6e78',
      coatDark: '#3e424a',
      pants: '#4a4e56',
      skin: '#d0a07a',
      hat: '#c8ccd4',
      hatDark: '#8a8e96',
      boots: '#2a2826',
      beard: '#7a7568',
      aura: '#c0d0e8',
    },
  },
  {
    id: 'mitya',
    name: 'МИТЯ СКИПИДАР',
    title: 'Пахнет победой',
    bio: 'Бывший маляр. Удары жгучие, настроение — ядовитое.',
    speed: 1.1,
    power: 1.16,
    defense: 1.08,
    jump: 1.02,
    hp: 120,
    build: 1.06,
    special: 'СКИПИДАРНЫЙ ШЛЕЙФ',
    aggro: 0.72,
    react: 0.17,
    skill: 0.74,
    palette: {
      coat: '#3a6a4a',
      coatDark: '#224232',
      pants: '#2a3230',
      skin: '#b8825a',
      hat: '#8a9a2a',
      hatDark: '#5a6218',
      boots: '#1a1917',
      beard: '#3a3228',
      aura: '#b8e060',
    },
  },
  {
    id: 'king',
    name: 'КОРОЛЬ ПОДЪЕЗДА',
    title: 'Финал Башни',
    bio: 'Грязная корона, золотые зубы, трон из матрасов. Хозяин двора.',
    speed: 1.05,
    power: 1.28,
    defense: 1.22,
    jump: 0.95,
    hp: 145,
    build: 1.28,
    special: 'КОРОНА ПОДЪЕЗДА',
    aggro: 0.82,
    react: 0.14,
    skill: 0.88,
    palette: {
      coat: '#4a3223',
      coatDark: '#2c1d14',
      pants: '#2a221c',
      skin: '#b8825a',
      hat: '#d4a017',
      hatDark: '#8a6810',
      boots: '#1b1512',
      beard: '#6b4a30',
      aura: '#ffc94a',
    },
  },

  {
    id: 'fedya',
    name: 'ФЕДЯ ФОНАРЬ',
    title: 'Ночной двор',
    bio: 'Фонарь в руке — закон двора. Ослепит, схватит, добьёт.',
    speed: 1.0,
    power: 1.2,
    defense: 1.15,
    jump: 1.0,
    hp: 120,
    build: 1.12,
    special: 'ВСПЫШКА',
    aggro: 0.7,
    react: 0.16,
    skill: 0.8,
    palette: {
      coat: '#2a3548',
      coatDark: '#151c28',
      pants: '#1e2430',
      skin: '#b88860',
      hat: '#c9a227',
      hatDark: '#8a6e12',
      boots: '#1a1714',
      beard: '#3a3228',
      aura: '#ffe08a',
    },
  },
  {
    id: 'baron',
    name: 'БАРОН ЧЕРДАКА',
    title: 'Настоящий финал',
    bio: 'Трубы, бутылки и обвал. Кто прошёл Короля — ещё не король.',
    speed: 1.08,
    power: 1.32,
    defense: 1.25,
    jump: 1.05,
    hp: 155,
    build: 1.22,
    special: 'ОБВАЛ',
    aggro: 0.85,
    react: 0.12,
    skill: 0.92,
    palette: {
      coat: '#5a2030',
      coatDark: '#301018',
      pants: '#2a1c20',
      skin: '#c08e66',
      hat: '#8a6a40',
      hatDark: '#5a4020',
      boots: '#1b1512',
      beard: '#4a3020',
      aura: '#ffc94a',
    },
  },
];

export type MoveKind = 'jab' | 'straight' | 'roundhouse' | 'uppercut' | 'sweep' | 'airkick' | 'airpunch' | 'super';

export type MoveDef = {
  kind: MoveKind;
  label: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  reach: number;
  height: number;
  vsize: number;
  hitstun: number;
  knockback: number;
  launch: number;
  low: boolean;
  meter: number;
  shake: number;
  hitstop: number;
};

export const MOVES: Record<MoveKind, MoveDef> = {
  jab:        { kind: 'jab', label: 'ТЫК', startup: 0.06, active: 0.07, recovery: 0.12, damage: 5, reach: 62, height: -104, vsize: 40, hitstun: 0.22, knockback: 110, launch: 0, low: false, meter: 6, shake: 3, hitstop: 0.045 },
  straight:   { kind: 'straight', label: 'В ГЛАЗ', startup: 0.09, active: 0.08, recovery: 0.2, damage: 8, reach: 76, height: -108, vsize: 44, hitstun: 0.3, knockback: 190, launch: 0, low: false, meter: 8, shake: 5, hitstop: 0.06 },
  roundhouse: { kind: 'roundhouse', label: 'С НОГИ', startup: 0.13, active: 0.09, recovery: 0.28, damage: 12, reach: 92, height: -70, vsize: 42, hitstun: 0.36, knockback: 300, launch: -120, low: false, meter: 11, shake: 8, hitstop: 0.08 },
  uppercut:   { kind: 'uppercut', label: 'АПЕРКОТ', startup: 0.11, active: 0.1, recovery: 0.42, damage: 17, reach: 66, height: -100, vsize: 90, hitstun: 0.5, knockback: 200, launch: -720, low: false, meter: 16, shake: 14, hitstop: 0.11 },
  sweep:      { kind: 'sweep', label: 'ПОДСЕЧКА', startup: 0.1, active: 0.09, recovery: 0.34, damage: 10, reach: 92, height: -22, vsize: 30, hitstun: 0.45, knockback: 260, launch: -260, low: true, meter: 12, shake: 9, hitstop: 0.08 },
  airkick:    { kind: 'airkick', label: 'С РАЗБЕГА', startup: 0.05, active: 0.22, recovery: 0.1, damage: 11, reach: 80, height: -60, vsize: 44, hitstun: 0.34, knockback: 260, launch: -140, low: false, meter: 10, shake: 7, hitstop: 0.07 },
  airpunch:   { kind: 'airpunch', label: 'СВЕРХУ', startup: 0.05, active: 0.18, recovery: 0.1, damage: 8, reach: 66, height: -50, vsize: 40, hitstun: 0.3, knockback: 180, launch: -80, low: false, meter: 8, shake: 5, hitstop: 0.06 },
  super:      { kind: 'super', label: 'СУПЕР', startup: 0.16, active: 0.3, recovery: 0.3, damage: 26, reach: 110, height: -80, vsize: 100, hitstun: 0.7, knockback: 460, launch: -520, low: false, meter: 0, shake: 22, hitstop: 0.16 },
};

export const RU = {
  round: 'РАУНД',
  fight: 'ДЕРИСЬ!',
  ko: 'НОКАУТ',
  finish: 'ДОБЕЙ!',
  fatality: 'ОТКЛЮЧКА',
  title: 'БОМЖ КОМБАТ',
  subtitle: 'Башня Двора',
};

export const TOWER_STAGES = OPPONENTS.length;

export type StageOutcome = { win: string; lose: string; scoreMul?: number; requireFatality?: boolean };

/** Баннеры win/lose по id босса (UI подхватывает) */
export const STAGE_OUTCOME: Record<string, StageOutcome> = {
  fedya: { win: 'СВЕТ ПОГАС', lose: 'СГОРЕЛ НА ДВОРЕ', scoreMul: 1.15 },
  baron: { win: 'ЧЕРДАК ТВОЙ!', lose: 'ВЫНЕСЛИ НА МУСОР', requireFatality: true },
};

export function outcomeForStage(stageIndex: number): StageOutcome | null {
  const id = OPPONENTS[stageIndex]?.id;
  return id ? STAGE_OUTCOME[id] ?? null : null;
}
