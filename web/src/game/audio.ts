/* 精灵物语 · 程序化音频：Web Audio API 合成 BGM 与音效，零素材 / 零网络 / 零积分。
 * 设计要点：
 *  - 单实例 audio，首次用户交互时 unlock() 创建 AudioContext（遵守浏览器自动播放策略）
 *  - BGM 用调度器提前排音符，切场景做淡入淡出；SFX 用一次性振荡器 + 包络
 *  - 任何一步失败都静默降级（无 Web Audio / 被浏览器拦截），绝不影响游戏逻辑
 */

export type BgmScene = 'village' | 'grassland' | 'battle' | 'none';

export type SfxName =
  | 'step' | 'run' | 'throw' | 'encounter' | 'skill' | 'hit' | 'heal'
  | 'catch' | 'miss' | 'levelup' | 'evolve' | 'portal' | 'quest'
  | 'click' | 'select' | 'win' | 'fail';

const STORE_MUTE = 'jingling_audio_muted';
const STORE_VOL = 'jingling_audio_volume';

/** MIDI 音高 → 频率 */
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface BgmTrack {
  notes: number[];          // MIDI 音高，0 = 休止
  noteDur: number;          // 单音时长（秒）
  wave: OscillatorType;
  vol: number;
}

/** 三首原创循环：村庄温暖八音盒 / 草原轻快跳跃 / 战斗紧张低音 */
const BGM: Record<Exclude<BgmScene, 'none'>, BgmTrack> = {
  village: {
    notes: [60, 64, 67, 72, 67, 64, 62, 64, 59, 62, 67, 71, 67, 62, 60, 0],
    noteDur: 0.30, wave: 'triangle', vol: 0.11,
  },
  grassland: {
    notes: [67, 72, 76, 74, 72, 67, 64, 67, 69, 74, 77, 74, 72, 69, 67, 64],
    noteDur: 0.23, wave: 'triangle', vol: 0.10,
  },
  battle: {
    notes: [48, 48, 55, 48, 50, 50, 57, 50, 48, 48, 55, 58, 53, 53, 48, 0],
    noteDur: 0.17, wave: 'square', vol: 0.055,
  },
};

/** 音效谱：[音高, 相对延迟(秒), 时长(秒), 波形, 音量] */
type SfxSpec = [number, number, number, OscillatorType, number][];
const SFX: Record<SfxName, SfxSpec> = {
  step:      [[44, 0, 0.05, 'sine', 0.07]],
  run:       [[46, 0, 0.05, 'sine', 0.10]],
  throw:     [[60, 0, 0.08, 'triangle', 0.12], [64, 0.06, 0.08, 'triangle', 0.12], [67, 0.12, 0.12, 'triangle', 0.14]],
  encounter: [[52, 0, 0.18, 'sawtooth', 0.09], [49, 0.16, 0.22, 'sawtooth', 0.09]],
  skill:     [[64, 0, 0.06, 'square', 0.055], [69, 0.05, 0.06, 'square', 0.055], [74, 0.10, 0.10, 'square', 0.06]],
  hit:       [[40, 0, 0.12, 'square', 0.09], [36, 0.04, 0.16, 'sawtooth', 0.07]],
  heal:      [[64, 0, 0.12, 'sine', 0.09], [67, 0.10, 0.12, 'sine', 0.09], [72, 0.20, 0.20, 'sine', 0.11]],
  catch:     [[72, 0, 0.10, 'triangle', 0.12], [76, 0.10, 0.10, 'triangle', 0.12], [79, 0.20, 0.14, 'triangle', 0.13], [84, 0.32, 0.30, 'triangle', 0.13]],
  miss:      [[64, 0, 0.14, 'triangle', 0.09], [59, 0.14, 0.22, 'triangle', 0.09]],
  levelup:   [[60, 0, 0.10, 'triangle', 0.10], [64, 0.10, 0.10, 'triangle', 0.10], [67, 0.20, 0.10, 'triangle', 0.10], [72, 0.30, 0.24, 'triangle', 0.12]],
  evolve:    [[60, 0, 0.12, 'sine', 0.10], [64, 0.12, 0.12, 'sine', 0.10], [67, 0.24, 0.12, 'sine', 0.10], [72, 0.36, 0.12, 'sine', 0.11], [76, 0.48, 0.12, 'sine', 0.11], [79, 0.60, 0.36, 'sine', 0.13]],
  portal:    [[67, 0, 0.30, 'sine', 0.09], [72, 0.06, 0.30, 'sine', 0.09], [76, 0.12, 0.36, 'sine', 0.09]],
  quest:     [[76, 0, 0.10, 'triangle', 0.11], [81, 0.10, 0.20, 'triangle', 0.12]],
  click:     [[72, 0, 0.04, 'sine', 0.06]],
  select:    [[67, 0, 0.06, 'triangle', 0.08], [72, 0.05, 0.10, 'triangle', 0.09]],
  win:       [[60, 0, 0.12, 'triangle', 0.11], [64, 0.12, 0.12, 'triangle', 0.11], [67, 0.24, 0.12, 'triangle', 0.11], [72, 0.36, 0.36, 'triangle', 0.13]],
  fail:      [[55, 0, 0.18, 'triangle', 0.09], [51, 0.16, 0.26, 'triangle', 0.09]],
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private scene: BgmScene = 'none';
  private pendingScene: BgmScene = 'village';
  private noteIndex = 0;
  private nextNoteTime = 0;
  private timer: number | null = null;
  private lastStepAt = 0;
  private _muted = false;
  private _volume = 0.6;

  constructor() {
    try {
      this._muted = localStorage.getItem(STORE_MUTE) === '1';
      const rawVol = localStorage.getItem(STORE_VOL);
      if (rawVol !== null) {
        const v = Number(rawVol);
        if (Number.isFinite(v) && v >= 0 && v <= 1) this._volume = v;
      }
    } catch { /* localStorage 不可用（隐私模式）时用默认值 */ }
  }

  get muted() { return this._muted; }
  get volume() { return this._volume; }
  get ready() { return !!this.ctx; }

  /** 首次用户手势时调用：创建/恢复 AudioContext 并启动 BGM 调度 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.master.connect(ctx.destination);
      this.bgmBus = ctx.createGain();
      this.bgmBus.gain.value = 0.6;
      this.bgmBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.nextNoteTime = ctx.currentTime + 0.08;
      this.timer = window.setInterval(() => this.schedule(), 100);
      this.applyScene(this.pendingScene);
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* 无 Web Audio：静默降级 */ }
  }

  /** 单个振荡器 + ADSR 包络，所有音色由此组合 */
  private tone(midi: number, at: number, dur: number, wave: OscillatorType, vol: number, bus: GainNode) {
    const ctx = this.ctx;
    if (!ctx || vol <= 0) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(hz(midi), at);
      const peak = Math.max(0.0002, vol);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + Math.min(0.02, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    } catch { /* 单音失败不影响整体 */ }
  }

  /** 提前 0.35s 排 BGM 音符，避免 setInterval 抖动导致节奏不稳 */
  private schedule() {
    const ctx = this.ctx, bus = this.bgmBus;
    if (!ctx || !bus || this.scene === 'none' || this._muted) return;
    const track = BGM[this.scene as Exclude<BgmScene, 'none'>];
    if (!track) return;
    try {
      while (this.nextNoteTime < ctx.currentTime + 0.35) {
        const note = track.notes[this.noteIndex % track.notes.length];
        if (note > 0) this.tone(note, this.nextNoteTime, track.noteDur, track.wave, track.vol, bus);
        this.noteIndex++;
        this.nextNoteTime += track.noteDur;
      }
    } catch { /* 调度失败下次重试 */ }
  }

  private applyScene(next: BgmScene) {
    const ctx = this.ctx, bus = this.bgmBus;
    if (!ctx || !bus) return;
    if (next === this.scene) return;
    this.scene = next;
    this.noteIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.06;
    // 淡出旧曲、淡入新曲（none 时只淡出）
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
    bus.gain.linearRampToValueAtTime(next === 'none' ? 0.0001 : 0.6, t + 0.5);
  }

  /** 切换 BGM：未 unlock 时先记下，unlock 后自动应用 */
  setBgm(scene: BgmScene) {
    this.pendingScene = scene;
    this.applyScene(scene);
  }

  /** 播放音效；step/run 内部按时间节流，避免每帧触发 */
  play(name: SfxName) {
    if (this._muted || !this.ctx || !this.sfxBus) return;
    if (name === 'step' || name === 'run') {
      const now = performance.now();
      const gap = name === 'run' ? 150 : 240;
      if (now - this.lastStepAt < gap) return;
      this.lastStepAt = now;
    }
    const spec = SFX[name];
    if (!spec) return;
    const t = this.ctx.currentTime + 0.005;
    for (const [m, d, dur, wave, vol] of spec) this.tone(m, t + d, dur, wave, vol, this.sfxBus);
  }

  setMuted(v: boolean) {
    this._muted = v;
    try { localStorage.setItem(STORE_MUTE, v ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(v ? 0 : this._volume, t + 0.12);
    }
  }

  toggleMute() { this.setMuted(!this._muted); return this._muted; }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(STORE_VOL, String(this._volume)); } catch { /* ignore */ }
    if (this.master && this.ctx && !this._muted) this.master.gain.value = this._volume;
  }

  /** 供自动化测试读取状态 */
  debugState() {
    return { ready: !!this.ctx, muted: this._muted, volume: this._volume, scene: this.scene, contextState: this.ctx?.state || 'none' };
  }
}

export const audio = new AudioManager();
