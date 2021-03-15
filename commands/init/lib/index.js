'use strict';

const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const Command = require('@icya-cli-dev/command');
const log = require('@icya-cli-dev/log');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._cmd.force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare();
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo);
        this.downloadTemplate();
        // 3. 安装模板
      }
    } catch (err) {
      log.error(err.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(err);
      }
    }
  }

  downloadTemplate() {
    // 1. 获取模板信息
  }

  async prepare() {
    // 1. 判断当前目录是否为空
    // 2. 能否自动强制更新
    const localPath = process.cwd();
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 询问是否继续创建
        ifContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'ifContinue',
            default: false,
            message: '当前文件夹不为空，是否继续创建？',
          })
        ).ifContinue;
        if (!ifContinue) {
          return;
        }
      }

      if (ifContinue || this.force) {
        // 二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });
        // 清空当前目录
        if (!confirmDelete) {
          return;
        }
        fse.emptyDirSync(localPath);
      }
    }
    return this.getProjectInfo();
  }

  async getProjectInfo() {
    let projectInfo = {};
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      name: 'type',
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT,
        },
        {
          name: '组件',
          value: TYPE_COMPONENT,
        },
      ],
    });
    log.verbose('type', type);
    if (type === TYPE_PROJECT) {
      // 2. 获取项目基本信息
      const project = await inquirer.prompt([
        {
          type: 'input',
          message: '请输入项目名称',
          name: 'projectName',
          default: '',
          validate: function (v) {
            // 1. 输入的首字符必须为英文字符
            // 2. 尾字符必须为英文或者数字
            // 3. 字符只允许"-_"
            const done = this.async();
            setTimeout(function () {
              if (
                !/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(
                  v
                )
              ) {
                done('请输入合法的项目名称');
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: function (v) {
            return v;
          },
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
          default: '1.0.0',
          validate: function (v) {
            const done = this.async();
            setTimeout(function () {
              if (!!!semver.valid(v)) {
                done('请输入合法的项目名称');
                return;
              }
              done(null, true);
            }, 0);
          },
          filter: function (v) {
            if (!!semver.valid(v)) {
              return semver.valid(v);
            } else {
              return v;
            }
          },
        },
      ]);
      projectInfo = {
        type,
        ...project,
      };
    } else if (type === TYPE_COMPONENT) {
    }
    return projectInfo;
  }

  isDirEmpty(localPath) {
    let fileList = fse.readdirSync(localPath);
    // 文件过滤
    fileList = fileList.filter(
      (file) => !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    );
    return !fileList || fileList.length <= 0;
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
