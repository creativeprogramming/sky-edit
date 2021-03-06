/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: true latedef: false browser: true */
/*global define: true port: true */
!define(function(require, exports) {

"use strict";

var data = require("self").data
var PageMod = require("addon-kit/page-mod").PageMod
var protocol = require("https://raw.github.com/Gozala/jetpack-protocol/v0.2.0/index.js")
var fs = require("https://raw.github.com/Gozala/jetpack-io/v0.2.1/fs.js")

const PROTOCOL = 'edit'
const editorURI = data.url('index.html')
const rootURI = editorURI.substr(0, editorURI.lastIndexOf('/') + 1)

function errorToJSON(error) {
  return error ? { message: error.message, stack: error.stack } : error
}

var mod  = PageMod({
  include: PROTOCOL + ':*',
  contentScript: 'unsafeWindow.port = self.port',
  contentScriptWhen: 'start',
  onAttach: function onAttach(worker) {
    worker.port.on('<=', function onMessage(message) {
      fs[message.method].apply(fs, message.params.concat([function(error) {
          worker.port.emit('=>', {
            '@': message['@'],
            params: [errorToJSON(error)].concat(Array.slice(arguments, 1))
          })
      }]))
    })
  }
})

function isAbsolute(uri) {  return ~uri.indexOf('edit:') }
function resolve(id, base) {
  var path, paths, last
  if (isAbsolute(id)) return id
  paths = id.split('/')
  base = base ? base.split('/') : [ '.' ]
  if (base.length > 1) base.pop()
  while ((path = paths.shift())) {
    if (path === '..') {
      if (base.length && base[base.length - 1] !== '..') {
        if (base.pop() === '.') base.push(path)
      } else base.push(path)
    } else if (path !== '.') {
      base.push(path)
    }
  }
  if (base[base.length - 1].substr(-1) === '.') base.push('')
  return base.join('/')
}

// Registers protocol handler for `edit:*` protocol.
var editProtocolHandler = protocol.protocol(PROTOCOL, {
  onResolve: function(uri, base) {
    if (base && !~base.indexOf('edit:///'))
      base = 'edit:///index.html'
    return resolve(uri, base)
  },
  // When browser is navigated to `edit:*` URI this function is called with an
  // absolute URI and returned content or content under returned URI will be
  // displayed to a user.
  onRequest: function(request, response) {
    try {
      // All the editor content is located under 'edit:///' so to get a path
      // we just strip that out.
      var path = request.uri.replace('edit:///', '')
      // If requested path was diff from 'edit:///...', then we load editor.
      path = ~path.indexOf('edit:') ? 'index.html' : path
      response.uri = data.url(path)
    } catch(error) {
      console.exception(error)
    }
  }
}).register()

// Make suer that protocol handler is removed, once add-on is uninstalled.
require("unload").when(function() {
  editProtocolHandler.unregister()
})

});
