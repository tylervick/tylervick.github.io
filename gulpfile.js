const path = require('path');
const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const critical = require('critical').stream;
const rename = require('gulp-rename');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');

const cssPath = ['./css/*.css', '!css/*.min.css'];
const jsPath = ['./js/*.js', '!js/*.min.js'];

gulp.task('css', () => {
    return gulp.src(cssPath)
        .pipe(cleanCSS())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('./css'));
});

gulp.task('critical', () => {
   return gulp.src('./index.html')
       .pipe(critical({
           base: process.cwd(),
           inline: false,
           css: ['css/main.css', 'css/normalize.css', 'https://code.getmdl.io/1.3.0/material.indigo-pink.min.css'],
           minify: true,
       }))
       .pipe(rename('critical.min.css'))
       .pipe(gulp.dest('./css'));
});

gulp.task('js', () => {
    return gulp.src(jsPath)
        .pipe(babel({
            presets: ['env']
        }))
        .pipe(uglify())
        .pipe(rename(({ suffix: '.min' })))
        .pipe(gulp.dest('./js'));
});

gulp.task('default', () => {
    gulp.watch(cssPath, ['css']);
    gulp.watch(jsPath, ['js']);
});
