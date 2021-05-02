'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const notify = require('gulp-notify');
const rename = require('gulp-rename');
const webpack = require('webpack-stream');

sass.compiler = require('node-sass');

gulp.task('sass', function () {
    return gulp
        .src('src/scss/**/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(sourcemaps.write())
        .pipe(rename(rename => rename.extname = '.min.css'))
        .pipe(gulp.dest('dist/css'))
        .pipe(notify({
            title: 'File Compiled',
            message: '<%= file.relative %>'
        }))
});

gulp.task('js', function () {
    return gulp
        .src('src/js/**/*.js')
        .pipe(sourcemaps.init())
        .pipe(
            webpack({
            })
        )
        .pipe(gulp.dest('dist/js'))
        .pipe(notify({
            title: 'File Compiled',
            message: '<%= file.relative %>'
        }))
});

gulp.task('sass:watch', function () {
    gulp.watch('src/scss/**/*.scss', gulp.series('sass'));
});

gulp.task('watch', function () {
    gulp.watch('src/js/**/*.js', gulp.series('js'));
    gulp.watch('src/scss/**/*.scss', gulp.series('sass'));
});