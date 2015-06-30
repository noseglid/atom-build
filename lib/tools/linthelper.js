'use strict'

var XRegExp = require('xregexp').XRegExp;
var Atom = require('atom');

module.exports = (function () {
    function LintHelper() {
        this.linter;
        this.output;
        this.messageColour = {
            error: "color:rgb(200, 0, 0)",
            warning: "color:rgb(0, 148, 255)"
        };
        // Rust-specific linting config.
        this.linterRustConfig = {
            grammarScopes: ['source.rs'],
            scope: 'project',
            lintOnFly: false
        };
        this.linterErrors = [];
    }
    LintHelper.prototype.setLinter = function(linter) {
        this.linter = linter;
    };
    LintHelper.prototype.updateLint = function (output, regex) {
        this.matches = [];
        this.linterErrors = [];
        this.output = output;
        this.regex = XRegExp(regex);
        this.matches = XRegExp.forEach(this.output, this.regex, function (match) {
          this.push(match);
        }, []);
        var that = this;
        this.matches.map(function(err) {
            var type = (err.error ? err.error : err.warning);
            // console.log("Rust error type: " + type);
            if (type != undefined) {
                var htmlTag =  "<span class=\"badge badge-flexible\" style=\"color:rgb(0, 148, 255)\"> RS </span> " + err.message;
                // var htmlTag =  "<span class=\"badge badge-flexible\" style=\"" + that.messageColour[type] + "\"> RS </span> " + err.message;
                var projectPaths = atom.project.getPaths();
                var projPath = projectPaths[0]; /// how to handle when more than one is returned?
                var errorOut = {
                    type: type,
                    text: err.message,
                    html: htmlTag,
                    filePath: projPath+"\\"+err.file,
                    range: new Atom.Range(new Atom.Point(parseInt(err.line-1), parseInt(err.col-1)), new Atom.Point(parseInt(err.endline-1), parseInt(err.endcol-1))),
                };
                this.push(errorOut);
            }
        }, this.linterErrors);
        this.linter.deleteProjectMessages(this.linterRustConfig);
        this.linter.setProjectMessages(this.linterRustConfig, this.linterErrors);
        this.linter.views.render();
    };
    LintHelper.prototype.clearLint = function() {
        this.linter.deleteProjectMessages(this.linterRustConfig);
        this.linter.views.render();
    };
    return LintHelper;
})();
