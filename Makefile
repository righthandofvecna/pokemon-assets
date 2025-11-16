
ver:
	echo "export const VERSION = \""$$(jq -r ".version" module.json)"\";" > js/version.mjs

release: ver
	npx esbuild js/main.mjs --bundle --minify --outfile=pokemon-assets.js
	zip module.zip -r audio fonts img lang templates css/main.css pokemon-assets.js module.json
	rm pokemon-assets.js
	echo "import * as main from './js/main.mjs';" > pokemon-assets.js

nextver:
  # switch to main branch and pull latest changes
	git checkout main
	git pull
  # increment the version number in module.json
	jq '.version |= (split(".") | .[2] = ((.[2] | tonumber) + 1 | tostring) | join(".")) | .download = "https://github.com/righthandofvecna/pokemon-assets/releases/download/v\(.version)/module.zip"'  module.json > module.tmp.json && mv module.tmp.json module.json
	echo "export const VERSION = \""$$(jq -r ".version" module.json)"\";" > js/version.mjs
  # create new branch with version name
	git checkout -b v$$(jq -r ".version" module.json)-branch
