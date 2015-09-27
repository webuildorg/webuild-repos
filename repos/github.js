'use strict';

var fs = require('fs');
var jf = require('jsonfile');
var mess = require('mess');
var request = require('request');
var Promise = require('promise');
var GitHubApi = require('github');
var moment = require('moment-timezone');
var clc = require('cli-color');
var clone = require('clone')

var Repo = require('../Repo');

var reposResult = [];

module.exports = {

  init: function(config){


    var github = new GitHubApi({
      version: config.version,
      debug: config.debug
    });

    if (config.clientID && config.clientSecret) {
      github.authenticate({
        type: 'oauth',
        key: config.clientID,
        secret: config.clientSecret
      });
    }

    if (config.cache){
      fs.exists(config.outfile, function(exists) {
        if (!exists) {
          clc.green('Warning: Repo cache file not found for github');
          return;
        }
        var repoApiUrl = config.apiUrl + 'repos';
        jf.readFile(config.outfile, function(err, savedResult) {
          if (err){
            clc.red('Error: Error writing to github repo cache', err);
            return;
          }
          reposResult = savedResult;
          console.log('Info: Loaded ' + savedResult.repos.length + ' repos from cache');
        });
      });
    }

    var repoSearchArgs = {
      sort: 'updated',
      order: 'desc',
      q: [
      'stars:>=' + config.starLimit,
      'fork:true',
      'pushed:>' + moment().subtract(3, 'months').format('YYYY-MM-DD')
      ]
    }

    function fetch(method, args, limit) {
      return new Promise(function(resolve, reject) {
        var items = [];
        method(args, function recv(err, res) {
          if (err) {
            if (err.code === 403) {
              console.log(clc.yellow('Warn: Github rate limited. Will try again.'));
              setTimeout(function() {
                console.log(clc.blue('Info: Retrying github'));
                method(args, recv);
              }, 60000);
            } else {
              reject(err);
            }
            return;
          }
          res.items
          .slice(0, limit - items.length)
          .forEach(function(item) {
            items.push(item);
              // console.log(items.length, item);
            });
          if (items.length >= limit || !github.hasNextPage(res)) {
            resolve(items);
          } else {
            github.getNextPage(res, recv);
          }
        });
      });
    }

    function chunk(arr, size) {
      if (size < 0) {
        throw Error('Invalid size');
      }
      var chunks = [];
      while (arr.length) {
        chunks.push(arr.splice(0, size));
      }
      return chunks;
    }

    function fetchGithubUsers (){
      return fetch(github.search.users, {
          q: 'location:' + config.location
        }, config.maxUsers)
    }

    function fetchReposForUsers(users){
      console.log(clc.blue('Info: Found ' + users.length + ' github.com users'));
      var userGroups = chunk(mess(users), 20);
      var searchPromises = userGroups.map(function(thisGroup){
        var usersRepoSearchArgs = clone(repoSearchArgs);
        var userArray = thisGroup.filter(function(user) {
          return user.login;
        }).map(function(user) {
          return 'user:"' + user.login + '"';
        })
        usersRepoSearchArgs.q = repoSearchArgs.q.concat(userArray).join('+');
        return fetch(github.search.repos,usersRepoSearchArgs, config.maxRepos);
      });
      return Promise.all(searchPromises);
    }

    function filterRepoResults (repos) {
      var reposPerOwner = {};
      if (!repos || !Array.isArray(repos)){
        return [];
      }
      return repos.map(function(repo) {
        var newRepo = new Repo();
        newRepo.url = repo.html_url;
        newRepo.name = repo.name;
        newRepo.description = repo.description;
        newRepo.pushed_at = repo.pushed_at,
        newRepo.updated_at = repo.updated_at,
        newRepo.stars = repo.stargazers_count,
        newRepo.language = repo.language,
        newRepo.owner.uid = repo.owner.login,
        newRepo.owner.avatar_url = repo.owner.avatar_url,
        newRepo.owner.profile_url = repo.owner.html_url
        return repo;
      })
      .sort(function(a, b) {
        return a.pushed_at > b.pushed_at ? -1 : 1;
      })
      .filter(function(repo) {
        if (!reposPerOwner[repo.owner.login]) {
          reposPerOwner[repo.owner.login] = 1;
          return true;
        }
        reposPerOwner[repo.owner.login]++;
        return false;
      })
      .slice(0, config.maxRepos);
    }

    return {
      update: function(callback){
        return fetchGithubUsers().
        then(fetchReposForUsers).
        then(filterRepoResults)
        .then(function(reposResult) {
          console.log(clc.green('Success: Added ' + repos.length + ' GitHub repos'));
          if (config.cache){
            jf.writeFile(config.outfile, reposResult);
          }
          return reposResult;
        })
        .catch(function(err) {
          console.error(err);
        });
      },
      list : function(){
        return reposResult;
      }
    }
  }
}
