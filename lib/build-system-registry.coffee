issubclass = (B, A) ->
  B.prototype instanceof A

BuildSystemProvider = require './build-system-provider'

class BuildSystemRegistry
  constructor: (@builder) ->
    @registry = []
    @buildsystems = []
    @containers = []

  register: (thing) ->
    if thing instanceof Array
      for x in thing
        @register x
    else if issubclass(thing, BuildSystemProvider) and  not (thing in @registry)
      @registry.push thing
      @containers.push new thing(@builder)
    else if thing instanceof BuildSystem
      @buildsystems.push thing if not (thing in @buildsystems)
    else
      @buildsystems.push new BuildSystem(thing)

  unregister: (thing) ->
    if not thing
      for x in @containers
        x.deactivate()
      @containers = []
      @registry = []
      @buildsystems = []
      return

    if thing in @buildsystems
      @buildsystems.remove thing
    else if thing in @registry
      idx = @registry.indexOf thing
      @registry.splice idx, 1
      @containers.splice idx, 1

  deactivate: ->
    for x in @containers
      x.deactivate()

  activate: ->
    for x in @containers
      x.activate()

  updateBuildSystems: ->
    @deactivate()
    @activate()

module.exports = {issubclass, BuildSystemRegistry}
