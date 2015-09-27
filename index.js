'use strict';

var repos = [];
var providers = [];
var meta = {
	generated_at: new Date().toISOString(),
	total_repos: 0
}

module.exports = {
  init: function(config){

  	function isSame(repo1, repo2){
  		return repo1.name === repo2.name &&
  					 repo1.description === repo2.description &&
  					 repo1.language === repo2.language
  	}

  	function addToRepos(err, newRepos){
  		if (err){
  			console.error(err);
  			return;
  		}

  		if (!data || data.length === 0 ){
  			return;
  		}

  		newRepos.forEach(function(thisRepo){
  			if (thisRepo instanceof Repo && thisRepo.is_valid()){
  				var dup = repos.filter(function(repo1){
  					return isSame(repo1, thisRepo);
  				});
  				if(dup.length === 0){
  					repos.push(thisRepo);
  				}
  			}
  		});

  		meta.generated_at = new Date().toISOString();
  		meta.total_repos = repos.length;
  	}

  	// For each repo provider in the config
  	config.repoProviders.forEach(function(thisProvider) {
  		// Get the params
  		var params = config[thisProvider+'Params'];
  		// Init the provider
  		var provider = require('./repos/'+thisProvider).init(params);
  		// Start updating.
  		provider.update().then(addToRepos);
  		providers.push(provider);
  	});

    return {
      'providers': providers, //Array of RepoProvider 'Class'
      'repos': repos, // Array of Repo Objects
      'meta': meta,
      'update': function(){
      	providers.forEach(function(thisProvider){
      		thisProvider.update().then(addToRepos);
      	});
      }
    };
  }
};
