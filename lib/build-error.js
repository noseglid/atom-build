'use babel';

export default class BuildError extends Error {
  constructor(name, message) {
    super(message);
    this.name = name;
    this.message = message;
    Error.captureStackTrace(this, BuildError);
  }
}
