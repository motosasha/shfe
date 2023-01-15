/* global exports process __dirname Buffer require */
/* eslint-disable no-console */
'use strict';

// Пакеты, использующиеся при обработке
const { series, parallel, src, dest, watch, lastRun } = require('gulp');
const atImport = require("postcss-import");
const autoprefixer = require("autoprefixer");
const browserSync = require('browser-sync').create();
const cheerio = require("gulp-cheerio");
const cpy = require('cpy');
const csso = require('gulp-csso');
const debug = require('gulp-debug');
const del = require('del');
const fs = require('fs');
const getClassesFromHtml = require('get-classes-from-html');
const ghPages = require('gh-pages');
const jsonConcat = require("gulp-json-concat");
const mqPacker = require("css-mqpacker");
const path = require("path");
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const prettyHtml = require('gulp-pretty-html');
const pug = require('gulp-pug');
const rename = require('gulp-rename');
const sass = require('gulp-sass')(require('sass'));
const svgMin = require('gulp-svgmin');
const svgStore = require('gulp-svgstore');
const through2 = require('through2');
const uglify = require('gulp-uglify-es').default;
const webpackStream = require('webpack-stream');

// Глобальные настройки этого запуска
const mode = process.env.MODE || 'development';
const nth = {};
nth.config = require('./config.js');
nth.blocksFromHtml = Object.create(nth.config.alwaysAddBlocks); // блоки из конфига сразу добавим в список блоков
nth.scssImportsList = []; // список импортов стилей
const dir = nth.config.dir;

// Сообщение для компилируемых файлов
let doNotEditMsg = '\n ВНИМАНИЕ! Этот файл генерируется автоматически.\n Любые изменения этого файла будут потеряны при следующей компиляции.\n Любое изменение проекта без возможности компиляции ДОЛЬШЕ И ДОРОЖЕ в 2-5 раз.\n\n';

// Настройки бьютификатора
let prettyOption = {
  indent_size: 2,
  indent_char: ' ',
  unformatted: ['code', 'em', 'strong', 'span', 'i', 'b', 'br', 'script'],
  content_unformatted: [],
};

// Список и настройки плагинов postCSS
let postCssPlugins = [
  autoprefixer({grid: true}),
  mqPacker({
    sort: true
  }),
  atImport()
];


function writePugMixinsFile(cb) {
  let allBlocksWithPugFiles = getDirectories('pug');
  let pugMixins = '//-' + doNotEditMsg.replace(/\n /gm,'\n  ');
  allBlocksWithPugFiles.forEach(function(blockName) {
    pugMixins += `include ${dir.blocks.replace(dir.src,'../')}${blockName}/${blockName}.pug\n`;
  });
  fs.writeFileSync(`${dir.src}pug/mixins.pug`, pugMixins);
  cb();
}
exports.writePugMixinsFile = writePugMixinsFile;


function compilePug() {
  const fileList = [
    `${dir.src}pages/**/*.pug`
  ];
  return src(fileList)
    .pipe(plumber({
      errorHandler: function (err) {
        console.log(err.message);
        this.emit('end');
      }
    }))
    .pipe(debug({title: 'Compiles '}))
    .pipe(pug({
      data: { repoUrl: "https://github.com/motosasha/shfe" },
      locals: JSON.parse(fs.readFileSync("./src/json/data.json", "utf8"))
    }))
    .pipe(prettyHtml(prettyOption))
    .pipe(through2.obj(getClassesToBlocksList, '', ''))
    .pipe(dest(dir.build));
}
exports.compilePug = compilePug;


function compilePugFast() {
  const fileList = [
    `${dir.src}pages/**/*.pug`
  ];
  return src(fileList, { since: lastRun(compilePugFast) })
    .pipe(plumber({
      errorHandler: function (err) {
        console.log(err.message);
        this.emit('end');
      }
    }))
    .pipe(debug({title: 'Compiles '}))
    .pipe(pug({
      data: { repoUrl: "https://github.com/motosasha/shfe" },
      locals: JSON.parse(fs.readFileSync("./src/json/data.json", "utf8"))
    }))
    .pipe(prettyHtml(prettyOption))
    .pipe(through2.obj(getClassesToBlocksList, '', ''))
    .pipe(dest(dir.build));
}
exports.compilePugFast = compilePugFast;


function copyAssets(cb) {
  let assetsPath = `${dir.src}assets/`;
  if(fileExist(assetsPath)) {
    return src(assetsPath + '**/*.*')
      .pipe(dest(`${dir.build}assets/`))
  }
  else {
    cb();
  }
}
exports.copyAssets = copyAssets;


function copyBlockImg(cb) {
  let copiedImages = [];
  nth.blocksFromHtml.forEach(function(block) {
    let src = `${dir.blocks}${block}/img`;
    if(fileExist(src)) copiedImages.push(`${src}/*.{png,jpg,jpeg,svg,gif}`);
  });
  nth.config.alwaysAddBlocks.forEach(function(block) {
    let src = `${dir.blocks}${block}/img`;
    if(fileExist(src)) copiedImages.push(`${src}/*.{png,jpg,jpeg,svg,gif}`);
  });
  console.log(copiedImages);
  if(copiedImages.length) {
    (async () => {
      await cpy(copiedImages, `${dir.build}img`);
      cb();
    })();
  }
  else {
    cb();
  }
}
exports.copyBlockImg = copyBlockImg;


function generateSvgSprite(cb) {
  let spriteSvgPath = `${dir.src}symbols/`;
  if (fileExist(spriteSvgPath)) {
    return src(spriteSvgPath + "*.svg")
      .pipe(plumber({
        errorHandler: function (err) {
          console.log(err.message);
          this.emit('end');
        }
      }))
      .pipe(svgMin(function() {
        return {
          plugins: [
            {
              cleanupIDs: { minify: true }
            },
            {
              name: "removeAttrs",
              params: {
                attrs: "(height|width)"
              }
            },
            {
              removeViewBox: false
            }
          ]
        };
      }))
      .pipe(svgStore({ inlineSvg: true }))
      .pipe(cheerio({
        run: function ($) {
          let addition = fs.readFileSync(dir.svgAsBg, "utf8");
          $('svg').append(addition);
        },
        parserOptions: { xmlMode: true }
      }))
      .pipe(rename("svgSprite.svg"))
      .pipe(dest(`${dir.build}img/`));
  } else {
    cb();
  }
}
exports.generateSvgSprite = generateSvgSprite;


function writeSassImportsFile(cb) {
  const newScssImportsList = [];
  nth.config.addStyleBefore.forEach(function(src) {
    newScssImportsList.push(src);
  });
  nth.config.alwaysAddBlocks.forEach(function(blockName) {
    if (fileExist(`${dir.blocks}${blockName}/${blockName}.scss`)) newScssImportsList.push(`${dir.blocks}${blockName}/${blockName}.scss`);
  });
  let allBlocksWithScssFiles = getDirectories('scss');
  allBlocksWithScssFiles.forEach(function(blockWithScssFile){
    let url = `${dir.blocks}${blockWithScssFile}/${blockWithScssFile}.scss`;
    if (nth.blocksFromHtml.indexOf(blockWithScssFile) === -1) return;
    if (newScssImportsList.indexOf(url) > -1) return;
    newScssImportsList.push(url);
  });
  nth.config.addStyleAfter.forEach(function(src) {
    newScssImportsList.push(src);
  });
  let diff = getArraysDiff(newScssImportsList, nth.scssImportsList);
  if (diff.length) {
    let msg = `\n/*!*${doNotEditMsg.replace(/\n /gm,'\n * ').replace(/\n\n$/,'\n */\n\n')}`;
    let styleImports = msg;
    newScssImportsList.forEach(function(src) {
      styleImports += `@import "${src}";\n`;
    });
    styleImports += msg;
    fs.writeFileSync(`${dir.src}scss/style.scss`, styleImports);
    console.log('---------- Write new style.scss');
    nth.scssImportsList = newScssImportsList;
  }
  cb();
}
exports.writeSassImportsFile = writeSassImportsFile;


function compileSass() {
  const fileList = [
    `${dir.src}scss/style.scss`,
  ];
  return src(fileList, { sourcemaps: true })
    .pipe(plumber({
      errorHandler: function (err) {
        console.log(err.message);
        this.emit('end');
      }
    }))
    .pipe(debug({title: 'Compiles:'}))
    .pipe(sass({includePaths: [__dirname+'/','node_modules']}))
    .pipe(postcss(postCssPlugins))
    .pipe(csso({
      restructure: false,
      comments: false
    }))
    .pipe(dest(`${dir.build}/css`, { sourcemaps: mode === 'development' ? '.' : false }))
    .pipe(browserSync.stream());
}
exports.compileSass = compileSass;


function writeJsRequiresFile(cb) {
  const jsRequiresList = [];
  nth.config.addJsBefore.forEach(function(src) {
    jsRequiresList.push(src);
  });
  const allBlocksWithJsFiles = getDirectories('js');
  allBlocksWithJsFiles.forEach(function(blockName){
    if (nth.config.alwaysAddBlocks.indexOf(blockName) === -1) return;
    jsRequiresList.push(`../blocks/${blockName}/${blockName}.js`)
  });
  allBlocksWithJsFiles.forEach(function(blockName){
    let src = `../blocks/${blockName}/${blockName}.js`
    if (nth.blocksFromHtml.indexOf(blockName) === -1) return;
    if (jsRequiresList.indexOf(src) > -1) return;
    jsRequiresList.push(src);
  });
  nth.config.addJsAfter.forEach(function(src) {
    jsRequiresList.push(src);
  });
  let msg = `\n/*!*${doNotEditMsg.replace(/\n /gm,'\n * ').replace(/\n\n$/,'\n */\n\n')}`;
  let jsRequires = msg + '/* global require */\n\n';
  jsRequiresList.forEach(function(src) {
    jsRequires += `require('${src}');\n`;
  });
  jsRequires += msg;
  fs.writeFileSync(`${dir.src}js/entry.js`, jsRequires);
  console.log('---------- Write new entry.js');
  cb();
}
exports.writeJsRequiresFile = writeJsRequiresFile;


function buildJs() {
  const entryList = {
    'bundle': `./${dir.src}js/entry.js`,
  };
  return src(`${dir.src}js/entry.js`)
    .pipe(plumber())
    .pipe(webpackStream({
      mode: mode,
      entry: entryList,
      devtool: mode === 'development' ? 'inline-source-map' : false,
      output: {
        filename: '[name].js',
      },
      resolve: {
        alias: {
          Utils: path.resolve(__dirname, 'src/js/utils/'),
        },
      },
      module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /(node_modules)/,
            loader: 'babel-loader',
            query: {
              presets: ['@babel/preset-env']
            }
          }
        ]
      },
      // externals: {
      //   jquery: 'jQuery'
      // }
    }))
    .pipe(uglify({
      output: {
        comments: false
      }
    }))
    .pipe(dest(`${dir.build}js`));
}
exports.buildJs = buildJs;


function buildJson(cb) {
  const jsonList = `${dir.data}**/*.json`;
  if (jsonList) {
    return src(jsonList)
      .pipe(plumber())
      .pipe(jsonConcat('data.json',function(data){
        return new Buffer.from(JSON.stringify(data));
      }))
      .pipe(dest(`${dir.src}json`));
  } else {
    cb();
  }
}
exports.buildJson = buildJson;


function copyAdditions(cb) {
  for (let item in nth.config.addAdditions) {
    let dest = `${dir.build}${nth.config.addAdditions[item]}`;
    cpy(item, dest);
  }
  cb();
}
exports.copyAdditions = copyAdditions;


function copyFonts(cb) {
  let fontsPath = `${dir.src}fonts/`;
  if(fileExist(fontsPath)) {
    return src(fontsPath + '**/*.*')
      .pipe(dest(`${dir.build}/fonts/`))
  }
  else {
    cb();
  }
}
exports.copyFonts = copyFonts;


function clearBuildDir() {
  return del([
    `${dir.build}**/*`,
    `!${dir.build}readme.md`,
  ]);
}
exports.clearBuildDir = clearBuildDir;


function reload(done) {
  browserSync.reload();
  done();
}

function deploy(cb) {
  ghPages.publish(path.join(process.cwd(), dir.build), "", cb).then();
}
exports.deploy = deploy;


function serve() {

  browserSync.init({
    server: dir.build,
    host: '192.168.1.39',
    logPrefix: "dev-server",
    port: 3000,
    startPath: 'index.html',
    open: false,
    notify: false,
  });

  // Страницы: изменение, добавление
  watch([`${dir.src}pages/**/*.pug`], { events: ['change', 'add'], delay: 100 }, series(
    compilePugFast,
    //parallel(writeSassImportsFile, writeJsRequiresFile),
    //parallel(compileSass, buildJs),
    reload
  ));

  // Страницы: удаление
  watch([`${dir.src}pages/**/*.pug`], { delay: 100 })
    .on('unlink', function(path) {
      let filePathInBuildDir = path.replace(`${dir.src}pages/`, dir.build).replace('.pug', '.html');
      fs.unlink(filePathInBuildDir, (err) => {
        if (err) throw err;
        console.log(`---------- Delete:  ${filePathInBuildDir}`);
      });
    });

  // Разметка Блоков: изменение
  watch([`${dir.blocks}**/*.pug`], { events: ['change'], delay: 100 }, series(
    compilePug,
    reload
  ));

  // Разметка Блоков: добавление
  watch([`${dir.blocks}**/*.pug`], { events: ['add'], delay: 100 }, series(
    writePugMixinsFile,
    compilePug,
    reload
  ));

  // Разметка Блоков: удаление
  watch([`${dir.blocks}**/*.pug`], { events: ['unlink'], delay: 100 }, writePugMixinsFile);

  // Шаблоны pug: все события
  watch([`${dir.src}pug/**/*.pug`, `!${dir.src}pug/mixins.pug`], { delay: 100 }, series(
    compilePug,
    parallel(writeSassImportsFile, writeJsRequiresFile),
    parallel(compileSass, buildJs),
    reload,
  ));

  // Стили Блоков: изменение
  watch([`${dir.blocks}**/*.scss`], { events: ['change'], delay: 100 }, series(
    compileSass,
  ));

  // Стили Блоков: добавление
  watch([`${dir.blocks}**/*.scss`], { events: ['add'], delay: 100 }, series(
    writeSassImportsFile,
    compileSass,
  ));

  // Стилевые глобальные файлы: все события
  watch([`${dir.src}scss/**/*.scss`, `!${dir.src}scss/style.scss`], { events: ['all'], delay: 100 }, series(
    compileSass,
  ));

  // Скриптовые глобальные файлы: все события
  watch([`${dir.src}js/**/*.js`, `!${dir.src}js/entry.js`, `${dir.blocks}**/*.js`], { events: ['all'], delay: 100 }, series(
    writeJsRequiresFile,
    buildJs,
    reload
  ));

  // Картинки: копирование из общей папки
  watch([`${dir.src}/img/**/*.{jpg,jpeg,png,gif,svg,webp}`, `${dir.src}/favicon/**/*.*"`], { events: ['all'], delay: 100 }, series(
    copyAdditions,
    reload
  ));

  // Картинки: копирование из блоков
  watch([`${dir.blocks}**/img/**/*.{jpg,jpeg,png,gif,svg,webp}`], { events: ["all"], delay: 100 }, series(
    copyBlockImg,
    reload
  ));

  // Картинки: копирование из assets
  watch([`${dir.src}assets/**/*.*`], { events: ['all'], delay: 100 }, series(
    copyAssets,
    reload,
  ));

  // Спрайт SVG
  watch([`${dir.src}symbols/*.svg`], { events: ['all'], delay: 100 }, series(
    generateSvgSprite,
    reload,
  ));

  // Копирование шрифтов
  watch([`${dir.src}fonts/`], { events: ['all'], delay: 100 }, series(
    copyFonts,
    reload,
  ));

  // Сборка json: изменение
  watch([`${dir.data}**/*.json`], { events: ['change'], delay: 100 }, series(
    buildJson,
    compilePug,
    reload
  ));

  // Сборка json: добавление
  watch([`${dir.data}**/*.json`], { events: ['add'], delay: 100 }, series(
    buildJson,
    compilePug,
    reload
  ));

  // Сборка json: все события
  watch([`${dir.data}**/*.json`], { events: ['all'], delay: 100 }, series(
    buildJson,
    compilePug,
    reload
  ));
}


exports.build = series(
  parallel(clearBuildDir, writePugMixinsFile),
  parallel(buildJson),
  parallel(compilePugFast, copyAssets, generateSvgSprite),
  parallel(copyAdditions, copyFonts, copyBlockImg, writeSassImportsFile, writeJsRequiresFile),
  parallel(compileSass, buildJs),
);


exports.default = series(
  parallel(clearBuildDir, writePugMixinsFile),
  parallel(buildJson),
  parallel(compilePugFast, copyAssets, generateSvgSprite),
  parallel(copyAdditions, copyFonts, copyBlockImg, writeSassImportsFile, writeJsRequiresFile),
  parallel(compileSass, buildJs),
  serve,
);





// Функции, не являющиеся задачами Gulp ----------------------------------------

/**
 * Получение списка классов из HTML и запись его в глоб. переменную nth.blocksFromHtml.
 * @param  {object}   file Обрабатываемый файл
 * @param  {string}   enc  Кодировка
 * @param  {Function} cb   Коллбэк
 */
function getClassesToBlocksList(file, enc, cb) {
  // Передана херь — выходим
  if (file.isNull()) {
    cb(null, file);
    return;
  }
  // Проверяем, не является ли обрабатываемый файл исключением
  let processThisFile = true;
  nth.config.notGetBlocks.forEach(function(item) {
    if (file.relative.trim() === item.trim()) processThisFile = false;
  });
  // Файл не исключён из обработки, погнали
  if (processThisFile) {
    const fileContent = file.contents.toString();
    let classesInFile = getClassesFromHtml(fileContent);
    // nth.blocksFromHtml = [];
    // Обойдём найденные классы
    for (let item of classesInFile) {
      // Не Блок или этот Блок уже присутствует?
      if ((item.indexOf('__') > -1) || (item.indexOf('--') > -1) || (nth.blocksFromHtml.indexOf(item) + 1)) continue;
      // Класс совпадает с классом-исключением из настроек?
      if (nth.config.ignoredBlocks.indexOf(item) + 1) continue;
      // У этого блока отсутствует папка?
      // if (!fileExist(dir.blocks + item)) continue;
      // Добавляем класс в список
      nth.blocksFromHtml.push(item);
    }
    console.log('---------- Used HTML blocks: ' + nth.blocksFromHtml.join(', '));
    file.contents = new Buffer.from(fileContent);
  }
  this.push(file);
  cb();
}


/**
 * Проверка существования файла или папки
 * @param  {string} filepath      Путь до файла или папки
 * @return {boolean}
 */
function fileExist(filepath){
  let flag = true;
  try{
    fs.accessSync(filepath, fs.F_OK);
  }catch(e){
    flag = false;
  }
  return flag;
}

/**
 * Получение всех названий поддиректорий, содержащих файл указанного расширения, совпадающий по имени с поддиректорией
 * @param  {string} ext    Расширение файлов, которое проверяется
 * @return {array}         Массив из имён блоков
 */
function getDirectories(ext) {
  let source = dir.blocks;
  return fs.readdirSync(source)
    .filter(item => fs.lstatSync(source + item).isDirectory())
    .filter(item => fileExist(source + item + '/' + item + '.' + ext));
}

/**
 * Получение разницы между двумя массивами.
 * @param  {array} a1 Первый массив
 * @param  {array} a2 Второй массив
 * @return {array}    Элементы, которые отличаются
 */
function getArraysDiff(a1, a2) {
  return a1.filter(i=>!a2.includes(i)).concat(a2.filter(i=>!a1.includes(i)))
}
