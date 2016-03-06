/*jshint node:true*/

var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')(),
    packageJSON = require('./package.json');

/**
 * process all the js file
 */
gulp.task('js', function () {
    var config = {
        pkg: packageJSON,
        banner: '/*!\n' +
        ' * <%= pkg.name %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' * Version: <%= pkg.version %> - <%= timestamp %>\n' +
        ' * License: <%= pkg.license %>\n' +
        ' */\n\n\n'
    };

    return gulp.src('./src/*.js')
        /* 1. bundle js */
        .pipe(plugins.concat('core.js'))

        /* 2. add angular $inject */
        .pipe(plugins.ngAnnotate({
            add: true,
            single_quotes: true
        }))

        /* 2. add license header */
        .pipe(plugins.header(config.banner, {
            timestamp: (new Date()).toISOString(),
            pkg: config.pkg
        }))
        .pipe(gulp.dest('./dist'))
        .pipe(plugins.bytediff.start())

        /* 3. minify */
        .pipe(plugins.uglify({
            preserveComments: 'license'
        }))
        .pipe(plugins.bytediff.stop(byteDiffFormatter))
        .pipe(plugins.rename({extname: '.min.js'}))
        .pipe(gulp.dest('./dist'));
});

gulp.task('default', ['js']);

/**
 * Formatter for `bytediff` to display the size changes after processing
 * @param data {Object}
 * @returns {string}
 */
function byteDiffFormatter(data) {
    var difference = (data.savings > 0) ? ' smaller.' : ' larger.';

    return data.fileName + ' went from ' +
        (data.startSize / 1000).toFixed(2) + ' KB to ' + (data.endSize / 1000).toFixed(2) + ' KB' +
        ' and is ' + formatPercent(1 - data.percent, 2) + '%' + difference;
}

/**
 * Format a number as a percentage
 * @param num
 * @param precision
 * @returns {string}
 */
function formatPercent(num, precision) {
    return (num * 100).toFixed(precision);
}