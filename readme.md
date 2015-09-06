#webuild-repos

> Get a list of open source repositories in your city from Github.

##install

```sh
npm i webuild-repos
```

##usage

1. we will create the following folder structure:

	```
	.
	├── .env
	├── config.js
	├── node_modules
	│   ├── dotenv
	│   └── webuild-repos
	└── index.js
	```
- create a `.env` file to store all the environment variables:

	```sh
	NODE_ENV=staging # put development if you want debug info from Github
	LOCATION=Singapore # your city name
	MAX_USERS=1000 # query top number of github users from your city
	MAX_REPOS=50 # list out top number of repositories
	STAR_LIMIT=50 # each repo must have at least this number of stars

	# get from https://github.com/settings/applications/new, refer to https://developer.github.com/v3/oauth/
	GITHUB_CLIENT_ID=secret
	GITHUB_CLIENT_SECRET=secret
	```
- create a file `config.js` with the following contents:

	```js
	var city = 'Singapore';
	var country = 'Singapore';
	var locationSymbol = 'SG';

	module.exports = {
	  location: city,
	  city: city,
	  country: country,
	  symbol: locationSymbol,

	  api_version: 'v1',

	  debug: process.env.NODE_ENV === 'development',

	  githubParams: {
	    version: '3.0.0',
	    clientID: process.env.GITHUB_CLIENT_ID,
	    clientSecret: process.env.GITHUB_CLIENT_SECRET,
	    location: process.env.LOCATION || city,
	    maxUsers: process.env.MAX_USERS || 1000,
	    maxRepos: process.env.MAX_REPOS || 50,
	    starLimit: process.env.STAR_LIMIT || 50,
	    outfile: __dirname + '/cache.json'
	  }
	};
	```
- create `index.js`:

	```js
	require('dotenv').load();
	var config = require('./config');
	var repos = require('webuild-repos').init(config).repos;

	setTimeout(function() {
	  console.log('Found ' + repos.feed.repos.length + ' repos from Github:')
	  console.log('\nMeta info:')
	  console.log(repos.feed.meta)
	  console.log('\nFirst event info:')
	  console.log(repos.feed.repos[0])
	}, 60000);
	```
- install the relevant dependencies:

	```sh
	npm i webuild-repos
	npm i dotenv
	```
- run the file with `node index.js`

#contribute

Please see `CONTRIBUTING.md` for details.

#versioning

Following the [Semantic Versioning guidelines](http://semver.org/), run the `grunt bump`, `grunt bump:minor` or `grunt bump:major` commands to bump the version accordingly.

#license

webuild-repos is released under the [MIT License](http://opensource.org/licenses/MIT).
