"use strict";
const inquirer = require("inquirer");
const fse = require("fs-extra");
const path = require("path");
const semver = require("semver");
const Command = require("@icya-cli-dev/command");
const Package = require("@icya-cli-dev/package");
const log = require("@icya-cli-dev/log");
const { spinnerStart, sleep, execAsync } = require("@icya-cli-dev/utils");
const ejs = require("ejs");
const glob = require("glob");

const TYPE_REACT = "TYPE_REACT";
const TYPE_VUE3 = "TYPE_VUE3";
const TYPE_KOA = "TYPE_KOA";

const templateConf = [
  {
    type: TYPE_REACT,
    npmName: "@icya/react-template",
  },
  {
    type: TYPE_VUE3,
    npmName: "@icya/vue3-template",
  },
  {
    type: TYPE_KOA,
    npmName: "@icya/koa-template",
  },
];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || "";
    this.force = !!this._cmd.force;
    log.verbose("projectName", this.projectName);
    log.verbose("force", this.force);
  }
  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare();
      if (projectInfo) {
        // 2. 下载模板
        log.verbose("projectInfo", projectInfo);
        this.projectInfo = projectInfo;
        Object.assign(this.projectInfo, {
          template: templateConf.find(
            (item) => item.type === this.projectInfo.type
          ).npmName,
        });
        await this.downloadTemplate();
        // 3. 安装模板
        this.installTemplate();
      }
    } catch (err) {
      log.error(err.message);
      if (process.env.LOG_LEVEL === "verbose") {
        console.log(err);
      }
    }
  }

  ejsRender({ ignore }) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    return new Promise((resolve, reject) => {
      glob(
        "**",
        {
          cwd: dir,
          ignore,
          nodir: true,
        },
        (err, files) => {
          if (err) {
            reject(err);
          }
          Promise.all(
            files.map((file) => {
              const filePath = path.join(dir, file);
              return new Promise((resolve1, reject1) => {
                ejs.renderFile(
                  filePath,
                  {
                    className: projectInfo.className,
                    version: projectInfo.projectVersion,
                  },
                  {},
                  (err, res) => {
                    if (err) {
                      reject1(err);
                    }
                    fse.writeFileSync(filePath, res);
                    resolve1(res);
                  }
                );
              });
            })
          )
            .then(() => {
              resolve();
            })
            .catch(reject);
        }
      );
    });
  }

  async installTemplate() {
    // 拷贝模板到当前目录
    let spinner = spinnerStart("正在安装模板..");
    await sleep();
    let installRes;
    try {
      const templatePath = path.join(
        this.templateNpm.cacheFilePath,
        "template"
      );
      const targetPath = process.cwd();
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
      spinner.stop(true);
      log.success("安装模板成功");
    } catch (e) {
      spinner.stop(true);
      log.error("安装模板失败");
      throw e;
    }
    // ejs渲染
    const ignore = ["node_modules/**", "src/views/**"];
    await this.ejsRender({ ignore });
    // 依赖安装
    installRes = await execAsync("npm", ["install"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    if (installRes !== 0) {
      throw new Error("依赖安装过程失败");
    }
  }

  async downloadTemplate() {
    // 1. 获取模板信息
    const targetPath = path.join(process.env.CLI_HOME_PATH, "template");
    const storeDir = path.join(targetPath, "node_modules");
    const { template } = this.projectInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: template,
      packageVersion: "latest",
    });
    if (!(await templateNpm.exists())) {
      let spinner;
      try {
        spinner = spinnerStart("正在下载模版..");
        await sleep();
        await templateNpm.install();
        this.templateNpm = templateNpm;
      } catch (e) {
        log.error("下载模版失败");
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success("下载模版成功");
        }
      }
    } else {
      let spinner;
      try {
        spinner = spinnerStart("正在更新模版..");
        await sleep();
        await templateNpm.update();
        this.templateNpm = templateNpm;
      } catch (e) {
        log.error("更新模板失败");
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success("更新模版成功");
        }
      }
    }
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
            type: "confirm",
            name: "ifContinue",
            default: false,
            message: "当前文件夹不为空，是否继续创建？",
          })
        ).ifContinue;
        if (!ifContinue) {
          return;
        }
      }

      if (ifContinue || this.force) {
        // 二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: "confirm",
          name: "confirmDelete",
          default: false,
          message: "是否确认清空当前目录下的文件？",
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
      type: "list",
      message: "请选择初始化类型",
      default: TYPE_REACT,
      name: "type",
      choices: [
        {
          name: "react ssr",
          value: TYPE_REACT,
        },
        {
          name: "vue3 ssr",
          value: TYPE_VUE3,
        },
        {
          name: "koa2 server",
          value: TYPE_KOA,
        },
      ],
    });
    log.verbose("type", type);

    // 2. 获取项目基本信息
    const project = await inquirer.prompt([
      {
        type: "input",
        message: "请输入项目名称",
        name: "projectName",
        default: "",
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
              done("请输入合法的项目名称");
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
        type: "input",
        name: "projectVersion",
        message: "请输入项目版本号",
        default: "1.0.0",
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            if (!!!semver.valid(v)) {
              done("请输入合法的项目名称");
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

    // 生成className
    if (projectInfo.projectName) {
      projectInfo.className = require("kebab-case")(
        projectInfo.projectName
      ).replace(/^-/, "");
    }
    return projectInfo;
  }

  isDirEmpty(localPath) {
    let fileList = fse.readdirSync(localPath);
    // 文件过滤
    fileList = fileList.filter(
      (file) => !file.startsWith(".") && ["node_modules"].indexOf(file) < 0
    );
    return !fileList || fileList.length <= 0;
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
