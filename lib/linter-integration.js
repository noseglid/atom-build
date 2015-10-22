'use babel';

export default class LinterIntegration {
  constructor(linterInstance) {
    this.linter = linterInstance;
    linterInstance.addLinter(this.provider);
  }

  get provider() {
    return {
      grammarScopes: [],
      scope: 'project',
      lintOnFly: false,
      lint: () => {}
    };
  }

  addErrorsFromMatcher(errorMatcher) {
    if (errorMatcher.currentMatch) {
      for (let match of errorMatcher.currentMatch) {
        const message = {
          type: 'Error',
          text: '',
          filePath: match.file,
          range: [[match.line - 1, 0], [match.line - 1, 0]]
        };
        this.linter.setProjectMessages(this.provider, message);
      }
    }
  }
}
