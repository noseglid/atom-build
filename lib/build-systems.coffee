{buildSystemRegistry} = require "atom-build-system"
Cake       = require "./build-commands-cake"
Make       = require "./build-commands-make"
{Apm, Npm} = require "./build-commands-packages-json"

buildSystemRegistry.register [ Cake, Make, Apm, Npm ]

module.exports = buildSystemRegistry
