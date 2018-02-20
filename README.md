# Producify

*Produce Smartierly*

Producify is a command-line tool that includes, at once:

* A Javascript/CSS/HTML minifier
* A Javascript/CSS bundler
* A HTML include parsing tool
* A Markdown parser

It allows you to develop websites giving a way to include HTML files in other HTML files (the `<include>` tag) and write in Markdown. It distributes your website after bundling and minifying your Javascript/CSS assets.

During the development, producify works as a webserver, watching your project folder for changes and automatically applying the modifications once you change anything on it.

Producify can also work as a NodeJS library and be called programatically or used with task runners such as Grunt.

## How to Install

Command-line tool:

```
npm -g i producify
```

It will expose the "producify" command on your terminal. Run it to understand the possible arguments:

```
$ producify
Usage: producify [PATH] [OPTIONS] [FLAGS]
Options:
	--build [FOLDER]	Builds [PATH] onto [FOLDER]
	--serve			Serves [PATH] as a webserver and watches for changes

Optional modifiers:
	--port [PORT]				Opens HTTP server on the port [PORT] (default: random port)
	--concatjsfilename [FILENAME]		Sets bundle JS filename (default: bundle.min.js)
	--concatcssfilename [FILENAME]		Sets bundle CSS filename (default: bundle.min.css)
	--y					Answers "y" to any possible question input, such as overwrite files

Flags (prepend + or - to enable or disable them):
	H	Minify HTML (default: enabled)
	U	Minify Javascript (default: enabled)
	C	Minify CSS (default: enabled)
	J	Concatenate Javascript files (default: disabled)
	P	Concatenate CSS files (default: disabled)
	I	Parse <include href="" /> tag (default: enabled)

Examples:
	producify . --serve				Serves current dir at a random port
	producify . --serve -CP				Serves current dir at a random port without minifying or concatenating CSS
	producify public_html/ --build www/ --serve +JP	Builds public_html to the www folder concatenating CSS and Javascript and serve it
	producify public_html/ --build www/		Builds public_html to the www folder

Website: https://jesobreira.github.io/producify
```

## Developing with Producify

It's possible to start working with Producify at any time. Just navigate to your project folder and run Producify to serve the current folder:

```
$ cd path/to/project
$ producify . --serve
```

The first argument (`.`) tells Producify to work on the current folder. The second one (`--serve`, but could also be `--server`) tells Producify to serve your built project as a HTTP server.

By default, a random port will be selected, but it's possible to set a port to open the HTTP server:

```
$ producify . --serve --port 8080
```

By setting and unsetting flags, you can define how Producify must work. A plus sign (`+`) before one or more flags means that you want to enable them, whereas a minus sign (`-`) will disable the flags.

For example, if you only want the `<include>` feature, all you have to do is to disable the flags that are enabled by default, according to the command help above:

```
$ producify . --serve -HUC
```

### Includes

Producify allows you to include HTML files in other HTML files by simply doing:

```
<include href="other_page.html" />
```

The contents of the file "other_page.html" are statically copied to the including file and served already included (and not using Ajax or frames).

### Markdown

Producify will also parse Markdown contents and convert them to HTML if they are around the `<markdown>` tag:

```
<markdown>
Hello, **world**!
</markdown>
```

### CSS and Javascript

Producify will parse your HTML files and detect Javascript and CSS files normally included. If you want, Producify can minify (default: enabled) and bundle (default: disabled) many assets into a bundle file.

An important thing to note is that Producify will only bundle files that are inside the same folder. This is done to prevent errors on your application due to relative paths. This means that if you have several CSS files inside a folder, they will all be joined at the file "bundle.min.css" at the folder. However if your CSS files are in several locations, then each folder will have its own "bundle.min.css".

By default, the bundle file names are "bundle.min.css" for CSS and "bundle.min.js" for Javascript. You can change it by doing:

```
producify . --serve --concatjsfilename "oh_my_scripts.js" --concatcssfilename "oh_my_styles.css"
```

If assets concatenation is disabled (by default it is, but you can enable it with the flags `+JP`), and if minification is enabled (by default it is, but you can disable it with the flags `-UC`), then each file that does not end with ".min.css" or ".min.js" will be minified and the ".min" will be added to its name.

### Building

When you are ready to build, just replace `--serve` with `--build [OUTPUT FOLDER]`:

```
producify . --build ../output
```

The folder will be created with your production-ready website.

Flags and parameters can also be used when building:

```
producify . --build ../output --concatjsfilename "oh_my_scripts.js" --concatcssfilename "oh_my_styles.css" +JP -UC
```

It's also possible to develop using your production folder:

```
producify . --build ../output --serve
```

In this case, every change will be applied on the production folder, that will be kept served as HTTP server until you close Producify with <kbd>Ctrl</kbd> + <kbd>C</kbd>.

You can also set Producify to your `npm build` by editing your package.json:

```
"scripts": {
    "build": "producify . --build ../output"
}
```

# Programatical Usage

You can install Producify as a dependency of your project:

```
npm i producify
```

In order to require it, just do:

```
const producify = require('producify').build
```

This is how to build a folder programatically with Producify from your NodeJS project:

```
producify.build(origin_folder, target_folder, {
    minifyHtml: true,
    minifyJs: true,
    minifyCss: true,
    concatJs: true,
    concatCss: true,
    parseIncludes: true,
    overwrite: true
}).then(function() {
    console.log("Done!")
})
```

Advanced usage:

```
producify.build(origin_folder, target_folder, {
    minifyHtml: true,
    minifyJs: true,
    minifyCss: true,
    concatJs: true,
    concatCss: true,
    parseIncludes: true,
    overwrite: true
}).then(function() {
    console.log("Building complete!");
    // start a HTTP server on the port 8080
    var server = producify.startHTTP(target_folder, 8080);
}).then(function() {
    // watch the folder for changes
    producify.startWatcher(origin_folder, function(evt, changedFile) {
        console.log("File " + changedFile + " was modified (" + evt + "). Should I do something?");
    });
}).catch(function(e) {
    console.log("Error: " + e);
});
```

