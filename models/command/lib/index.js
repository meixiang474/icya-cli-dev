'use strict';

const semver = require('semver');
const colors = require('colors');
const log = require('@icya-cli-dev/log');

const LOWEST_NODE_VERSION = '12.0.0';
console.log('command');
class Command {
  constructor(argv) {
    log.verbose('Command constructor', argv);
    if (!argv) {
      throw new Error('参数不能为空！');
    }
    if (!Array.isArray(argv)) {
      throw new Error('参数必须为数组！');
    }
    if (argv.length < 1) {
      throw new Error('参数列表为空！');
    }
    this._argv = argv;
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());
      chain.catch((err) => {
        log.error(err.message);
        if (process.env.LOG_LEVEL === 'verbose') {
          console.log(err);
        }
      });
    });
  }

  initArgs() {
    this._cmd = this._argv[this._argv.length - 1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
  }

  checkNodeVersion() {
    // 获取当前node版本号
    const currentVersion = process.version;
    // 对比最低版本号
    const lowestVersion = LOWEST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowestVersion)) {
      throw new Error(
        colors.red(`icya-cli 需要安装${lowestVersion}以上版本的Node.js`)
      );
    }
  }

  init() {
    throw new Error('init必须实现');
  }
  exec() {
    throw new Error('exec必须实现');
  }
}

module.exports = Command;
