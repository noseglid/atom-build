'use babel';

class Linter {
  constructor() {
    this.messages = [];
  }
  dispose() {}
  setMessages(msg) {
    this.messages = this.messages.concat(msg);
  }
  deleteMessages() {
    this.messages = [];
  }
}

module.exports = {
  activate: () => {},
  provideIndie: () => ({
    register: (obj) => {
      this.registered = obj;
      this.linter = new Linter();
      return this.linter;
    }
  }),

  hasRegistered: () => {
    return this.registered !== undefined;
  },

  getLinter: () => {
    return this.linter;
  }
};
