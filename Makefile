
build:
	npx esbuild js/main.mjs --bundle --minify --outfile=pokemon-assets.js

release: build
	zip module.zip -r audio fonts img lang templates css/main.css pokemon-assets.js module.json

