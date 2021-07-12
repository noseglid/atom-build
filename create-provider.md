# Creating a build provider

## Service API

Another package may provide build information to the `build`-package by implementing its service API.
The package should integrate via the service API. This is typically done in `package.json`:

```javascript
{
  "providedServices": {
    "builder": {
      "description": "Description of the build configurations this package gives",
      "versions": {
        "2.0.0": "providingFunction"
      }
    }
  }
},
```

The `build`-package will then call `providingFunction` when activated and expects an
ES6 class or an array of classes in return. The next section describes in detail how that class is
expected to operate.

## The provider implementation
```javascript
class MyBuildProvider {

  constructor(cwd) {
    // OPTIONAL: setup here
    // cwd is the project root this provider will operate in, so store `cwd` in `this`.
  }

  destructor() {
    // OPTIONAL: tear down here.
    // destructor is not part of ES6. This is called by `build` like any
    // other method before deactivating.
    return 'void';
  }

  getNiceName() {
    // REQUIRED: return a nice readable name of this provider.
    return 'string';
  }

  isEligible() {
    // REQUIRED: Perform operations to determine if this build provider can
    // build the project in `cwd` (which was specified in `constructor`).
    return 'boolean';
  }

  settings() {
    // REQUIRED: Return an array of objects which each define a build description.
    return 'array of objects'; // [ { ... }, { ... }, ]
  }

  on(event, cb) {
    // OPTIONAL: The build provider can let `build` know when it is time to
    // refresh targets.
    return 'void';
  }

  removeAllListeners(event) {
    // OPTIONAL: (required if `on` is defined) removes all listeners registered in `on`
    return 'void';
  }
}
```

`constructor` _[optional]_ - is used in ES6 classes to initialize the class. The path
where this instance of the build provider will operate is provided.
Please note that the build provider will be instanced once per project folder.

---

`destructor` _[optional]_ - will be called before `build` is deactivated and gives you a chance
to release any resources claimed.

---

`getNiceName` - aesthetic only and should be a `string` which is a human readable
description of the build configuration is provided.

---

`isEligible` - should be a function which must return synchronously.
It should return `true` or `false` indicating if it can build the folder specified
in the constructor into something sensible. Typically look for the existence of a
build file such as `gulpfile.js` or `Makefile`.

---

`settings` - can return a Promise or an array of objects.
It can provide anything which is allowed by the [custom build configuration](README.md#custom-build-config).
This includes the command, `cmd`, to execute, any arguments, `args`, and so on.

---

`on` _[optional]_ - will be called with a string which is the name of an event the build tool provider can emit. The build
tool provider should call the `callback` when the specified event occurs.
The easiest way to use this is to extends [NodeJS's event emitter](https://nodejs.org/api/events.html#events_class_events_eventemitter) and simply issue `this.emit(event)`.
Events `build` may ask for include:
  * `refresh` - call the callback if you want `build` to refresh all targets.
    this is common after the build file has been altered.

Note: If you extend `EventEmitter` you don't need to implement this method.

---

`removeAllListeners` _[optional]_ - will be called when `build` is no longer interested in that event. It may be because
`build` is being deactivated, or refreshing its state. `build` will never call `removeAllListeners` for an event unless it has
previously registered a listener via `on` first.

Note: If you extend `EventEmitter` you don't need to implement this method.

## Operations

Before `settings` is called, the build provider will always be given a chance to
let `build` know if it can do anything with the project folder by returning `true` or `false`
from the `isEligible` method. Checks for eligibility should always be performed here as
the content of the project folder may have changed between two calls.

`build` will refresh targets for a variety of events:
  * Atom is started, `build` will instance one build provider for every project root
    folder in Atom and ask for build targets.
  * A project root folder is added, `build` will instance a new build provider for this
    folder and ask for build targets.
  * Any build provider emits the `refresh`, in which case all providers in that folder
    will be asked for targets.
  * The user (or any other package) issues `build:refresh-targets` (e.g. via the command palette).

## Publication

If you want to share your provider (please do, if you needed it, chances are others will as well)
go to the [AtomBuild project for the homepage](https://github.com/AtomBuild/atombuild.github.io)
and follow the instructions there. Your tool will then be visisble on [https://atombuild.github.io](https://atombuild.github.io). This is also a great source to look
for existing build providers

---

Happy coding!
