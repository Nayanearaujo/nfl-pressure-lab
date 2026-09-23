/* playback.js — controla a reprodução frame a frame.
 *
 * Usa EXCLUSIVAMENTE os frames reais do JSON (sem interpolação / sem frames
 * inventados). A cadência base é frameRateHz (10 Hz => 100 ms por frame em 1x).
 * Emite um callback onFrame(index, frame) a cada mudança de frame.
 */
(function (global) {
  "use strict";

  function PlaybackController(opts) {
    this.frames = [];
    this.frameRateHz = 10;
    this.index = 0;
    this.speed = 1;
    this.playing = false;
    this._raf = null;
    this._lastTs = 0;
    this._acc = 0;
    this.onFrame = opts.onFrame || function () {};
    this.onStateChange = opts.onStateChange || function () {};
  }

  PlaybackController.prototype.load = function (frames, frameRateHz) {
    this.pause();
    this.frames = frames || [];
    this.frameRateHz = frameRateHz || 10;
    this.index = 0;
    this._emit();
  };

  PlaybackController.prototype._emit = function () {
    const frame = this.frames[this.index] || null;
    this.onFrame(this.index, frame);
  };

  PlaybackController.prototype.frameCount = function () { return this.frames.length; };
  PlaybackController.prototype.currentFrame = function () { return this.frames[this.index] || null; };
  PlaybackController.prototype.currentIndex = function () { return this.index; };

  PlaybackController.prototype.seek = function (index) {
    if (!this.frames.length) return;
    this.index = Math.max(0, Math.min(this.frames.length - 1, index | 0));
    this._emit();
  };

  PlaybackController.prototype.step = function (delta) {
    this.pause();
    this.seek(this.index + delta);
  };

  PlaybackController.prototype.setSpeed = function (mult) {
    this.speed = mult > 0 ? mult : 1;
  };

  PlaybackController.prototype.play = function () {
    if (this.playing || !this.frames.length) return;
    // Reinicia se estiver no fim.
    if (this.index >= this.frames.length - 1) this.index = 0;
    this.playing = true;
    this.onStateChange(true);
    this._lastTs = 0;
    this._acc = 0;
    const self = this;
    const loop = function (ts) {
      if (!self.playing) return;
      if (!self._lastTs) self._lastTs = ts;
      const dt = ts - self._lastTs;
      self._lastTs = ts;
      self._acc += dt * self.speed;
      const frameMs = 1000 / self.frameRateHz;
      while (self._acc >= frameMs) {
        self._acc -= frameMs;
        if (self.index >= self.frames.length - 1) {
          self.pause();
          return;
        }
        self.index += 1;
        self._emit();
      }
      self._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  };

  PlaybackController.prototype.pause = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.playing) {
      this.playing = false;
      this.onStateChange(false);
    }
  };

  PlaybackController.prototype.toggle = function () {
    if (this.playing) this.pause(); else this.play();
  };

  global.PlaybackController = PlaybackController;
})(window);
