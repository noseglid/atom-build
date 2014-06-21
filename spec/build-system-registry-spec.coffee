{issubclass} = require '../lib/build-system-registry.coffee'

describe "issubclass", ->
  class A
    constructor: ->
      @x = 1

  class B extends A
    b: ->

  class C extends B
    c: ->

  class D extends A
    d: ->

  it "testifies, that B is subclass of A", ->
    expect(issubclass(B, A)).toBe true

  it "testifies, that C is subclass of A", ->
    expect(issubclass(C, A)).toBe true

  it "testifies, that D is no subclass of B", ->
    expect(issubclass(D, B)).toBe false
