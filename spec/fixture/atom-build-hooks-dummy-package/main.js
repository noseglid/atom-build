'use babel';

const hooks = {
  preBuild: () => {},
  postBuild: () => {}
};

class Builder {
  getNiceName() {
    return 'Build with hooks';
  }

  isEligible() {
    return true;
  }

  settings() {
    return [
      {
        exec: 'exit',
        args: ['0'],
        atomCommandName: 'build:hook-test:succeeding',
        preBuild: () => hooks.preBuild(),
        postBuild: (success) => hooks.postBuild(success)
      },
      {
        exec: 'exit',
        args: ['1'],
        atomCommandName: 'build:hook-test:failing',
        preBuild: () => hooks.preBuild(),
        postBuild: (success) => hooks.postBuild(success)
      }
    ];
  }
}

module.exports = {
  activate: () => {},
  provideBuilder: () => Builder,
  hooks: hooks
};
