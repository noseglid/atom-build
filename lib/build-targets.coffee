$ = require 'atom'
{spawn, exec} = require 'child_process'

{BuildTargets, registry} = require './build-targets-registry'

# require here all build tool coffee scripts
reg = require './cakefile'
reg = require './packages-json'
reg = require './makefile'

module.exports = registry
