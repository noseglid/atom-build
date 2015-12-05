'use babel';

export default function (legacyObject) {
  return class LegacyProvider {
    constructor(path) {
      this.path = path;
      this.ctx = {};
    }

    getNiceName() {
      return legacyObject.niceName;
    }

    isEligible() {
      return legacyObject.isEligable.apply(this.ctx, [ this.path ]);
    }

    settings() {
      return legacyObject.settings.apply(this.ctx, [ this.path ]);
    }

    on(event, cb) {
      if (!legacyObject.on) return null;
      return legacyObject.on.apply(this.ctx, [ event, cb ]);
    }

    removeAllListeners(event) {
      if (!legacyObject.off) return null;
      return legacyObject.off.apply(this.ctx, [ event ]);
    }
  };
}
