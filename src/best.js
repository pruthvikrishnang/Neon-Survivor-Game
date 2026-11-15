import { loadBest, saveBest, loadRemoteBest, saveRemoteBest } from './storage.js';

/** Keeps the local best in sync with the shared server-side all-time record. */
export class BestScore {
  /** @param {(best:number) => void} [onRemoteChange] */
  constructor(onRemoteChange) {
    this.value = loadBest();
    this.onChange = onRemoteChange;
  }

  /** Record a finished run locally. Returns true when it is a new local best. */
  record(score) {
    const value = Math.floor(Number(score));
    if (!Number.isFinite(value) || value <= this.value) return false;
    this.value = value;
    saveBest(value);
    return true;
  }

  _adopt(score) {
    const value = Math.floor(Number(score));
    if (!Number.isFinite(value) || value <= this.value) return false;
    this.value = value;
    saveBest(value);
    this.onChange?.(value);
    return true;
  }

  /** Merge the persisted all-time best into this browser and seed the server. */
  async sync() {
    const remote = await loadRemoteBest();
    if (remote !== null) this._adopt(remote);
    if (this.value > (remote ?? 0)) {
      const merged = await saveRemoteBest(this.value);
      if (merged !== null) this._adopt(merged);
    }
    return this.value;
  }

  /** Upload a finished run and adopt any higher all-time score from the server. */
  async submit(score) {
    this.record(score);
    const remote = await saveRemoteBest(this.value);
    if (remote !== null) this._adopt(remote);
    return this.value;
  }
}
