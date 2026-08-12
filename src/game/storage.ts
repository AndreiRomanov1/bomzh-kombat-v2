import { OPPONENTS } from './data';
export type ScoreEntry = { name: string; score: number; stage: number; date: number; fighter: string };

const SCORE_KEY = 'bomzh-kombat-hiscores-v1';
const CAMPAIGN_KEY = 'bomzhKombatCampaign';
const NAME_KEY = 'bomzh-kombat-name';

export type CampaignSave = {
  stage: number;
  score: number;
  completed: boolean;
};

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveScore(e: ScoreEntry): ScoreEntry[] {
  const all = [...loadScores(), e].sort((a, b) => b.score - a.score).slice(0, 10);
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

export function isHighScore(score: number): boolean {
  const all = loadScores();
  return score > 0 && (all.length < 10 || score > all[all.length - 1].score);
}

export function loadName(): string {
  return localStorage.getItem(NAME_KEY) || '';
}
export function storeName(n: string) {
  try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
}

export function loadCampaign(): CampaignSave | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CampaignSave;
    if (typeof o.stage !== 'number' || typeof o.score !== 'number') return null;
    return {
      stage: Math.max(0, Math.min(OPPONENTS.length - 1, Math.floor(o.stage))),
      score: Math.max(0, Math.floor(o.score)),
      completed: !!o.completed,
    };
  } catch {
    return null;
  }
}

export function saveCampaign(s: CampaignSave) {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({
      stage: s.stage,
      score: s.score,
      completed: !!s.completed,
    }));
  } catch {
    /* ignore */
  }
}

export function clearCampaign() {
  try { localStorage.removeItem(CAMPAIGN_KEY); } catch { /* ignore */ }
}

export function hasCampaign(): boolean {
  const c = loadCampaign();
  return !!c && !c.completed && c.stage >= 0 && c.stage < OPPONENTS.length;
}
