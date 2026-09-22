const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'electron') {
    return {
      app: {
        getPath: () => '/mocked/path',
        getAppPath: () => '/mocked/app/path'
      },
      Notification: {
        isSupported: () => false
      },
      shell: {}
    };
  }
  return originalRequire.apply(this, arguments);
};
