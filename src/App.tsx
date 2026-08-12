import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FIGHTERS, OPPONENTS, HERO, FighterDef, TOWER_STAGES, outcomeForStage } from './game/data';
import { GameRunner } from './game/runner';
import type { HudState, InputState } from './game/engine';
import { drawFighter, preloadSprites } from './game/draw';
import TouchControls from './components/TouchControls';
import {
  loadScores, saveScore, isHighScore, loadName, storeName, ScoreEntry,
  loadCampaign, saveCampaign, clearCampaign, hasCampaign,
} from './game/storage';
import { SFX, unlockAudio, setMuted } from './game/audio';
import { ART, portraitFilter } from './assets/art';

type Screen = 'menu' | 'select' | 'howto' | 'scores' | 'tower' | 'free' | 'game';
type Mode = 'campaign' | 'free';

/* --------------------------- fighter portrait card ------------------------- */
/** Sprite body preview (same combat sprites as in-fight) */
function LimbPortrait({ def, size = 150 }: { def: FighterDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const g = ctx.createRadialGradient(size / 2, size * 0.5, 8, size / 2, size * 0.5, size * 0.7);
      g.addColorStop(0, 'rgba(242,181,68,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size * 0.94);
      const s = (size / 190) * 1.05;
      ctx.scale(s, s);
      drawFighter(ctx, {
        x: 0, y: 0, facing: 1, state: 'idle', stateT: t, moveKind: null, moveProgress: 0,
        crouch: false, blocking: false, onGround: true, vx: 0, vy: 0,
        palette: def.palette, build: def.build, flash: 0, hurt: 0, hasBottle: true, superGlow: 0,
        isPlayer: def.id === 'ty' || def.id === HERO.id,
        defId: def.id,
      }, t);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [def, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="block" />;
}

/** Our bitmap portraits (UI only — not in-fight bodies) */
function FaceArt({
  def, size = 72, hero = false, className = '',
}: { def: FighterDef; size?: number; hero?: boolean; className?: string }) {
  const src = hero ? ART.playerPortrait : ART.enemyPortrait;
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-amber-500/30 bg-black/50 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={def.name}
        draggable={false}
        className="h-full w-full object-cover object-top"
        style={{ filter: portraitFilter(def.palette.coat, hero) }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-color"
        style={{ background: def.palette.coat }}
      />
    </div>
  );
}

function PropImg({ src, className = '', alt = '' }: { src: string; className?: string; alt?: string }) {
  return <img src={src} alt={alt} draggable={false} className={`pointer-events-none select-none ${className}`} />;
}

/* --------------------------------- helpers -------------------------------- */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#05070a] p-3">
    <div
      className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-55"
      style={{ backgroundImage: `url(${ART.arenaYard})` }}
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-85"
      style={{
        background:
          'radial-gradient(circle at 50% 22%, rgba(209,58,42,0.28), transparent 55%), radial-gradient(circle at 80% 90%, rgba(110,163,201,0.18), transparent 50%), linear-gradient(180deg,rgba(8,11,17,0.72),rgba(2,4,10,0.92))',
      }}
    />
    <PropImg src={ART.propTrash} className="absolute bottom-2 left-2 w-16 opacity-70 sm:w-24" alt="" />
    <PropImg src={ART.propCart} className="absolute bottom-2 right-2 w-20 opacity-70 sm:w-28" alt="" />
    <PropImg src={ART.propPigeon} className="absolute top-6 right-10 w-10 opacity-80 sm:w-14" alt="" />
    <PropImg src={ART.propBottle} className="absolute top-1/3 left-3 w-8 opacity-60 sm:w-10" alt="" />
    <div className="scanlines relative z-10 max-h-full w-full max-w-4xl overflow-y-auto">{children}</div>
  </div>
);

const Stat = ({ label, v }: { label: string; v: number }) => (
  <div className="flex items-center gap-2">
    <span className="w-14 text-[10px] uppercase tracking-wider text-amber-200/70">{label}</span>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
        style={{ width: `${Math.min(100, ((v - 0.8) / 0.6) * 100)}%` }}
      />
    </div>
  </div>
);

export default function App() {
  // Preload combat bitmap sprites ASAP (bodies are sprites, not procedural limbs)
  useEffect(() => {
    void preloadSprites();
  }, []);

  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('campaign');
  const [charIdx] = useState(0);
  const [stage, setStage] = useState(0);
  const [scoreCarry, setScoreCarry] = useState(0);
  const [freeOpp, setFreeOpp] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<{ score: number; stage: number; win: boolean } | null>(null);
  const [victory, setVictory] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [name, setName] = useState(() => loadName());
  const [saved, setSaved] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [canContinue, setCanContinue] = useState(() => hasCampaign());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runnerRef = useRef<GameRunner | null>(null);
  const [portrait, setPortrait] = useState(false);
  const endedRef = useRef(false);

  useEffect(() => {
    const coarse = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    setTouchUI(!!coarse);
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  const pauseToggle = useCallback(() => {
    setPaused((p) => {
      const np = !p;
      runnerRef.current?.setPaused(np);
      return np;
    });
  }, []);

  const hero = FIGHTERS[charIdx] ?? HERO;

  // mount / unmount the game
  useEffect(() => {
    if (screen !== 'game' || !canvasRef.current) return;
    endedRef.current = false;
    const startStage = mode === 'free' ? freeOpp : stage;
    const runner = new GameRunner(
      canvasRef.current,
      hero,
      {
        onHud: (h) => setHud(h),
        onGameOver: (score, st, win) => {
          if (endedRef.current) return;
          endedRef.current = true;
          setOver({ score, stage: st, win });
          setSaved(false);
          if (mode === 'campaign') {
            if (win) {
              const next = st; // st is stage+1 (1-based cleared)
              const beatenId = OPPONENTS[Math.min(st - 1, OPPONENTS.length - 1)]?.id;
              if (next >= OPPONENTS.length) {
                saveCampaign({ stage: OPPONENTS.length - 1, score, completed: true });
                setVictory(true);
                setCanContinue(false);
                setShowTeaser(false);
              } else {
                saveCampaign({ stage: next, score, completed: false });
                setStage(next);
                setScoreCarry(score);
                setCanContinue(true);
                // Ложный финал Короля → тизер Барона
                setShowTeaser(beatenId === 'king');
              }
            }
          }
        },
        onPauseRequest: () => {
          setOver((o) => {
            if (!o) pauseToggle();
            return o;
          });
        },
      },
      {
        startStage,
        startScore: mode === 'campaign' ? scoreCarry : 0,
        pauseBetweenStages: true,
        singleFight: mode === 'free',
      },
    );
    runnerRef.current = runner;
    runner.start();
    return () => {
      runner.destroy();
      runnerRef.current = null;
    };
  }, [screen, charIdx, gameKey, pauseToggle, mode, stage, freeOpp, scoreCarry, hero]);

  useEffect(() => {
    if (over) runnerRef.current?.setPaused(false);
  }, [over]);

  const goTowerThenFight = (s: number, score: number) => {
    unlockAudio();
    SFX.ui();
    setMode('campaign');
    setStage(s);
    setScoreCarry(score);
    setOver(null);
    setVictory(false);
    setPaused(false);
    setHud(null);
    setScreen('tower');
  };

  const startNewCampaign = () => {
    clearCampaign();
    setCanContinue(false);
    goTowerThenFight(0, 0);
  };

  const continueCampaign = () => {
    const c = loadCampaign();
    if (!c || c.completed) {
      startNewCampaign();
      return;
    }
    goTowerThenFight(c.stage, c.score);
  };

  const enterFightFromTower = () => {
    SFX.ui();
    SFX.bell();
    setOver(null);
    setVictory(false);
    setPaused(false);
    setHud(null);
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  const startFree = (oppIdx: number) => {
    unlockAudio();
    SFX.ui();
    setMode('free');
    setFreeOpp(oppIdx);
    setOver(null);
    setVictory(false);
    setPaused(false);
    setHud(null);
    setScoreCarry(0);
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  const rematch = () => {
    SFX.ui();
    setOver(null);
    setVictory(false);
    setPaused(false);
    setHud(null);
    setGameKey((k) => k + 1);
  };

  const quitToMenu = () => {
    SFX.ui();
    setOver(null);
    setVictory(false);
    setShowTeaser(false);
    setPaused(false);
    setCanContinue(hasCampaign());
    setScreen('menu');
    setScores(loadScores());
  };

  const afterWinContinue = () => {
    SFX.ui();
    if (victory || (over && over.win && over.stage >= OPPONENTS.length)) {
      setScreen('menu');
      setCanContinue(false);
      setOver(null);
      setVictory(false);
      setShowTeaser(false);
      return;
    }
    // next tower rung (dismiss king→baron teaser)
    setShowTeaser(false);
    setOver(null);
    setPaused(false);
    setHud(null);
    setScreen('tower');
  };

  const submitScore = () => {
    if (!over || saved) return;
    const n = (name.trim() || 'БОМЖ').slice(0, 12).toUpperCase();
    storeName(n);
    setName(n);
    const list = saveScore({
      name: n, score: over.score, stage: over.stage, date: Date.now(), fighter: hero.name,
    });
    setScores(list);
    setSaved(true);
    SFX.bell();
  };

  const onTouchPress = useCallback((k: keyof InputState, down: boolean) => {
    runnerRef.current?.setTouch(k, down);
  }, []);

  const toggleMute = () => {
    setMutedState((m) => {
      setMuted(!m);
      return !m;
    });
  };

  const eligible = useMemo(() => (over ? isHighScore(over.score) : false), [over]);

  /* --------------------------------- screens -------------------------------- */

  if (screen === 'menu') {
    return (
      <Frame>
        <div className="rise flex flex-col items-center gap-5 py-6 text-center">
          <div className="relative flex w-full max-w-2xl items-end justify-center gap-2 px-2">
            <img src={ART.playerIdle} alt="" draggable={false} className="hidden h-36 object-contain opacity-90 sm:block" />
            <div className="flicker flex flex-col items-center">
              <img src={ART.logoBomzh} alt="БОМЖ КОМБАТ" draggable={false} className="mb-2 h-16 object-contain sm:h-20" />
              <h1 className="font-title title-glow text-5xl leading-none text-amber-100 sm:text-7xl">БОМЖ</h1>
              <h1 className="font-title title-glow -mt-1 text-5xl leading-none text-red-500 sm:text-7xl">КОМБАТ</h1>
              <p className="mt-2 text-xs tracking-[0.35em] text-amber-200/70 sm:text-sm">БАШНЯ ДВОРА</p>
            </div>
            <img src={ART.enemyIdle} alt="" draggable={false} className="hidden h-36 object-contain opacity-90 sm:block" style={{ filter: portraitFilter(OPPONENTS[0].palette.coat) }} />
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-400">
            <img src={ART.propCardboard} alt="" className="h-8 w-8 object-contain" />
            бойцы в драке — процедурные · портреты — наши ассеты
          </div>

          <div className="flex w-full max-w-md flex-col gap-3 px-4">
            <button className="bk-btn bk-btn-primary pulse-slow rounded px-8 py-4 text-xl" onClick={startNewCampaign}>
              НОВАЯ ИГРА
            </button>
            <button
              className="bk-btn rounded px-8 py-3 text-lg disabled:opacity-40"
              disabled={!canContinue}
              onClick={continueCampaign}
            >
              ПРОДОЛЖИТЬ
            </button>
            <button className="bk-btn rounded px-8 py-3 text-lg" onClick={() => { SFX.ui(); setScreen('free'); }}>
              СВОБОДНЫЙ БОЙ
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="bk-btn rounded px-4 py-3" onClick={() => { SFX.ui(); setScreen('howto'); }}>
                УПРАВЛЕНИЕ
              </button>
              <button className="bk-btn rounded px-4 py-3" onClick={() => { SFX.ui(); setScores(loadScores()); setScreen('scores'); }}>
                РЕКОРДЫ
              </button>
            </div>
            <button className="bk-btn rounded px-4 py-2 text-sm" onClick={toggleMute}>
              ЗВУК: {muted ? 'ВЫКЛ' : 'ВКЛ'}
            </button>
          </div>

          <p className="max-w-md px-6 text-xs leading-relaxed text-slate-400">
            Десять ступеней двора — от Валеры Картона до Барона Чердака. Король — ложный финал.
            Бей, блокируй, копи метр на суперудар, добивай «ОТКЛЮЧКОЙ» и попади на доску почёта.
          </p>
        </div>
      </Frame>
    );
  }

  if (screen === 'howto') {
    return (
      <Frame>
        <div className="rise bk-panel mx-auto my-4 max-w-2xl rounded-lg p-6">
          <h2 className="font-title mb-4 text-3xl text-amber-300">УПРАВЛЕНИЕ</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-title mb-2 text-sm tracking-widest text-red-400">КЛАВИАТУРА</h3>
              <ul className="space-y-1.5 text-sm text-slate-200">
                <li><b className="text-amber-200">A / D</b> — ходить</li>
                <li><b className="text-amber-200">W</b> — прыжок · <b className="text-amber-200">S</b> — присесть</li>
                <li><b className="text-amber-200">J</b> — удар рукой</li>
                <li><b className="text-amber-200">K</b> — удар ногой</li>
                <li><b className="text-amber-200">L</b> — блок (держать)</li>
                <li><b className="text-amber-200">U</b> — спец / добить</li>
                <li><b className="text-amber-200">ESC / P</b> — пауза</li>
              </ul>
            </div>
            <div>
              <h3 className="font-title mb-2 text-sm tracking-widest text-red-400">ПРИЁМЫ</h3>
              <ul className="space-y-1.5 text-sm text-slate-200">
                <li><b className="text-amber-200">S + J</b> — АПЕРКОТ</li>
                <li><b className="text-amber-200">S + K</b> — ПОДСЕЧКА</li>
                <li><b className="text-amber-200">W + K</b> — удар с прыжка</li>
                <li><b className="text-amber-200">J → J → K</b> — комбо-серия</li>
                <li><b className="text-amber-200">Спец (50%)</b> — бросок бутылки</li>
                <li><b className="text-amber-200">Спец (100%)</b> — ГОП-СТОП</li>
                <li>После нокаута: <b className="text-amber-200">ДОБЕЙ!</b> → спец = <b className="text-amber-200">ОТКЛЮЧКА</b></li>
              </ul>
            </div>
          </div>
          <button className="bk-btn mt-5 rounded px-6 py-3" onClick={() => { SFX.ui(); setScreen('menu'); }}>НАЗАД</button>
        </div>
      </Frame>
    );
  }

  if (screen === 'scores') {
    return (
      <Frame>
        <div className="rise bk-panel mx-auto my-4 max-w-xl rounded-lg p-6">
          <h2 className="font-title mb-1 text-3xl text-amber-300">ДОСКА ПОЧЁТА ДВОРА</h2>
          <p className="mb-4 text-xs tracking-widest text-slate-400">ЛУЧШИЕ БОЙЦЫ РАЙОНА</p>
          {scores.length === 0 ? (
            <p className="py-8 text-center text-slate-400">Пока пусто. Иди и наведи порядок во дворе.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-amber-200/60">
                  <th className="py-2">#</th><th>ИМЯ</th><th>БОЕЦ</th><th className="text-center">БОЙ</th><th className="text-right">ОЧКИ</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i} className={`border-t border-white/5 ${i === 0 ? 'text-amber-300' : 'text-slate-200'}`}>
                    <td className="py-1.5 font-title">{i + 1}</td>
                    <td className="font-title">{s.name}</td>
                    <td className="text-xs text-slate-400">{s.fighter}</td>
                    <td className="text-center text-xs">{s.stage}</td>
                    <td className="text-right font-title">{s.score.toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="bk-btn mt-6 rounded px-6 py-3" onClick={() => { SFX.ui(); setScreen('menu'); }}>НАЗАД</button>
        </div>
      </Frame>
    );
  }

  if (screen === 'free') {
    return (
      <Frame>
        <div className="rise py-4">
          <h2 className="font-title mb-1 text-center text-3xl text-amber-300">СВОБОДНЫЙ БОЙ</h2>
          <p className="mb-2 text-center text-xs tracking-widest text-slate-400">ТЫ против выбранного соперника</p>
          <div className="mb-4 flex justify-center"><div className="flex items-end gap-2"><FaceArt def={hero} size={100} hero /><LimbPortrait def={hero} size={100} /></div></div>
          <div className="grid gap-2 px-3 sm:grid-cols-2">
            {OPPONENTS.map((o, i) => (
              <button
                key={o.id}
                onClick={() => startFree(i)}
                onMouseEnter={() => SFX.ui()}
                className="bk-panel flex items-center gap-3 rounded-lg p-2 text-left transition hover:border-amber-400"
              >
                <FaceArt def={o} size={72} />
                <div className="min-w-0 flex-1">
                  <div className="font-title text-sm text-amber-200">{o.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-red-400/90">{o.title}</div>
                  <div className="mt-1 space-y-0.5">
                    <Stat label="СИЛА" v={o.power} />
                    <Stat label="СКОР." v={o.speed} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <button className="bk-btn rounded px-6 py-3" onClick={() => { SFX.ui(); setScreen('menu'); }}>НАЗАД</button>
          </div>
        </div>
      </Frame>
    );
  }

  if (screen === 'tower') {
    const youAt = stage;
    return (
      <Frame>
        <div className="rise bk-panel mx-auto my-3 max-w-lg rounded-lg p-5">
          <h2 className="font-title mb-0.5 text-center text-3xl text-amber-300">БАШНЯ ДВОРА</h2>
          <p className="mb-4 text-center text-xs tracking-widest text-slate-400">
            ОЧКИ: {scoreCarry.toLocaleString('ru-RU')} · СТУПЕНЬ {stage + 1}/{TOWER_STAGES}
          </p>
          <div className="relative mx-auto max-w-sm">
            <div className="absolute left-6 top-2 bottom-2 w-1 rounded bg-gradient-to-b from-amber-400/80 via-red-500/50 to-amber-900/40" />
            <ul className="relative flex flex-col-reverse gap-2">
              {OPPONENTS.map((o, i) => {
                const beaten = i < youAt;
                const next = i === youAt;
                const above = i > youAt;
                return (
                  <li
                    key={o.id}
                    className={`relative ml-3 flex items-center gap-3 rounded border px-3 py-2 ${
                      next
                        ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(242,181,68,0.25)]'
                        : beaten
                          ? 'border-white/10 bg-black/40 opacity-70'
                          : 'border-white/10 bg-black/30 opacity-85'
                    }`}
                  >
                    <div className={`absolute -left-[7px] h-3 w-3 rounded-full border-2 ${
                      next ? 'border-amber-300 bg-red-500' : beaten ? 'border-slate-500 bg-slate-700' : 'border-amber-700 bg-black'
                    }`} />
                    <FaceArt def={o} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="font-title text-sm text-amber-100 truncate">{o.name}</div>
                      <div className="text-[10px] text-slate-400">{o.title}</div>
                    </div>
                    <div className="font-title text-[10px] tracking-wider">
                      {beaten && <span className="text-slate-400">спит</span>}
                      {next && <span className="text-amber-300">СЛЕДУЮЩИЙ</span>}
                      {above && <span className="text-slate-600">···</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
              <FaceArt def={hero} size={44} hero />
              <div>
                <div className="font-title text-sm text-emerald-300">ТЫ</div>
                <div className="text-[10px] text-slate-400">{hero.title} · ждёшь у ступени {stage + 1}</div>
              </div>
              <div className="ml-auto font-title text-xs text-emerald-300">ТЫ</div>
            </div>
          </div>
          {(OPPONENTS[stage]?.id === 'fedya' || OPPONENTS[stage]?.id === 'baron') && (
            <div className="mb-3 flex justify-center gap-4">
              {OPPONENTS[stage]?.id === 'fedya' && (
                <img src={ART.propLantern} alt="" className="h-16 object-contain drop-shadow" />
              )}
              {OPPONENTS[stage]?.id === 'baron' && (
                <img src={ART.propAtticDebris} alt="" className="h-16 object-contain drop-shadow" />
              )}
            </div>
          )}
          <div className="mt-5 flex flex-col gap-3">
            <button className="bk-btn bk-btn-primary pulse-slow rounded px-6 py-4 text-xl" onClick={enterFightFromTower}>
              В БОЙ!
            </button>
            <button className="bk-btn rounded px-6 py-3" onClick={quitToMenu}>В МЕНЮ</button>
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------------------------------- game ---------------------------------- */
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute top-1/2 right-1 z-30 flex -translate-y-1/2 flex-col gap-2 opacity-70 transition hover:opacity-100">
        <button className="bk-btn rounded px-2.5 py-1.5 text-xs" onClick={toggleMute} aria-label="звук">{muted ? '🔇' : '🔊'}</button>
        <button className="bk-btn rounded px-2.5 py-1.5 text-xs" onClick={() => { if (!over) pauseToggle(); }} aria-label="пауза">❚❚</button>
      </div>

      {touchUI && !paused && !over && (
        <TouchControls onPress={onTouchPress} />
      )}

      {showTeaser && over?.win && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="rise relative w-[min(96vw,640px)] text-center">
            <img src={ART.teaserBaron} alt="" draggable={false} className="mx-auto max-h-[55vh] w-full object-contain" />
            <div className="absolute inset-x-0 bottom-6 px-4">
              <p className="font-title text-2xl text-amber-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-3xl">ЧЕРДАК ЖДЁТ</p>
              <p className="mt-1 text-xs tracking-widest text-slate-300">Барон Чердака · ступени 9–10</p>
              <button className="bk-btn bk-btn-primary mt-4 rounded px-6 py-3 text-lg" onClick={afterWinContinue}>
                ПРОДОЛЖИТЬ БАШНЮ
              </button>
            </div>
          </div>
        </div>
      )}


      {touchUI && portrait && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-6">
          <div className="bk-panel rounded px-4 py-2 text-center text-xs tracking-widest text-amber-200">
            ПОВЕРНИ ТЕЛЕФОН ГОРИЗОНТАЛЬНО 🔄
          </div>
        </div>
      )}

      {paused && !over && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="rise bk-panel w-[min(92vw,420px)] rounded-lg p-6 text-center">
            <h2 className="font-title mb-1 text-4xl text-amber-300">ПАУЗА</h2>
            <p className="mb-5 text-xs tracking-widest text-slate-400">
              ОЧКИ: {(hud?.score ?? scoreCarry).toLocaleString('ru-RU')} · БОЙ {(hud?.stage ?? stage) + 1}
            </p>
            <div className="flex flex-col gap-3">
              <button className="bk-btn bk-btn-primary rounded px-6 py-3 text-lg" onClick={pauseToggle}>ПРОДОЛЖИТЬ</button>
              <button className="bk-btn rounded px-6 py-3" onClick={rematch}>НАЧАТЬ ЗАНОВО</button>
              <button className="bk-btn rounded px-6 py-3" onClick={quitToMenu}>В МЕНЮ</button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="rise bk-panel relative w-[min(94vw,460px)] overflow-hidden rounded-lg p-6 text-center">
            <img src={ART.bannerFrame} alt="" draggable={false} className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-28 w-full object-contain opacity-90" />
            {(() => {
              const beaten = OPPONENTS[Math.min(Math.max(over.stage - 1, 0), OPPONENTS.length - 1)];
              const outcome = outcomeForStage(Math.max(over.stage - 1, 0));
              const winTitle = victory || over.stage >= OPPONENTS.length
                ? 'ДВОР ТВОЙ!'
                : (outcome?.win ?? (showTeaser ? 'КОРОЛЬ ПАЛ…' : 'ПОБЕДА!'));
              const loseTitle = outcome?.lose ?? 'НОКАУТ';
              const winSub = victory || over.stage >= OPPONENTS.length
                ? 'БАШНЯ ДВОРА ПРОЙДЕНА'
                : showTeaser
                  ? 'Но сверху слышен звон труб…'
                  : `Свергнут: ${beaten?.name ?? '—'}`;
              const loseSub = outcome?.lose ? 'ДВОР НЕ ПРОСТИЛ' : 'ДВОР ЗАПОМНИЛ ЭТОТ ПОЗОР';
              return over.win ? (
              <>
                <h2 className="font-title title-glow relative z-10 mb-1 mt-6 text-4xl text-amber-300">
                  {winTitle}
                </h2>
                <p className="relative z-10 mb-4 text-xs tracking-widest text-slate-400">
                  {winSub}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-title title-glow relative z-10 mb-1 mt-6 text-4xl text-red-500">{loseTitle}</h2>
                <p className="relative z-10 mb-4 text-xs tracking-widest text-slate-400">{loseSub}</p>
              </>
            );
            })()}

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded border border-amber-500/25 bg-black/50 p-3">
                <div className="text-[10px] tracking-widest text-amber-200/60">ОЧКИ</div>
                <div className="font-title text-2xl text-amber-200">{over.score.toLocaleString('ru-RU')}</div>
              </div>
              <div className="rounded border border-amber-500/25 bg-black/50 p-3">
                <div className="text-[10px] tracking-widest text-amber-200/60">БОЙ</div>
                <div className="font-title text-2xl text-amber-200">{over.stage}</div>
              </div>
            </div>

            {(eligible && (!over.win || victory || over.stage >= OPPONENTS.length || mode === 'free')) && !saved ? (
              <div className="mb-4 rounded border border-amber-400/40 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm text-amber-200">НОВЫЙ РЕКОРД! Впиши погоняло:</p>
                <div className="flex gap-2">
                  <input
                    value={name}
                    maxLength={12}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    placeholder="БОМЖ"
                    className="font-title w-full rounded border border-amber-400/40 bg-black/60 px-3 py-2 text-center text-lg tracking-widest text-amber-100 outline-none focus:border-amber-300"
                  />
                  <button className="bk-btn bk-btn-primary rounded px-4" onClick={submitScore}>OK</button>
                </div>
              </div>
            ) : saved ? (
              <p className="mb-4 text-sm text-emerald-300">Записан в доску почёта двора!</p>
            ) : null}

            <div className="flex flex-col gap-3">
              {over.win && mode === 'campaign' && !victory && over.stage < OPPONENTS.length && !showTeaser ? (
                <button className="bk-btn bk-btn-primary rounded px-6 py-4 text-xl" onClick={afterWinContinue}>
                  ДАЛЬШЕ ПО БАШНЕ
                </button>
              ) : null}
              {over.win && (victory || over.stage >= OPPONENTS.length) ? (
                <button className="bk-btn bk-btn-primary rounded px-6 py-4 text-xl" onClick={() => { submitScore(); quitToMenu(); }}>
                  НА ДОСКУ ПОЧЁТА
                </button>
              ) : null}
              {!over.win ? (
                <button className="bk-btn bk-btn-primary rounded px-6 py-4 text-xl" onClick={rematch}>ЕЩЁ РАЗ!</button>
              ) : null}
              {mode === 'free' && over.win ? (
                <button className="bk-btn bk-btn-primary rounded px-6 py-4 text-xl" onClick={() => { setOver(null); setScreen('free'); }}>
                  ВЫБРАТЬ СОПЕРНИКА
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button className="bk-btn rounded px-4 py-3" onClick={() => { setScores(loadScores()); setOver(null); setScreen('scores'); }}>РЕКОРДЫ</button>
                <button className="bk-btn rounded px-4 py-3" onClick={quitToMenu}>В МЕНЮ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
