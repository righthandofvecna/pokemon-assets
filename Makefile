
release:
	npx esbuild js/main.mjs --bundle --minify --outfile=pokemon-assets.js
	zip module.zip -r audio fonts img lang templates css/main.css pokemon-assets.js module.json
	rm pokemon-assets.js
	echo "import * as main from './js/main.mjs';" > pokemon-assets.js
