name 'ai-rental'
author 'TGIANN'
version '0.1.1' -- x-release-please-version
license 'GPL-3.0-only'
description 'Basic vehicle rental: panel-set rental points, fee and deposit, keys and fuel through ai-core'
repository 'https://github.com/aifivem/ai-rental'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/vehicles.json',
	'data/locations.json',
}
