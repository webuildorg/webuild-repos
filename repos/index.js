'use strict';

var fs = require('fs');
var jf = require('jsonfile');
var mess = require('mess');
var request = require('request');
var Promise = require('promise');
var GitHubApi = require('github');
var moment = require('moment-timezone');
var clc = require('cli-color');
var reposResult = {
  'meta': {},
  'repos': []
};
var reposToday = {
  'meta': {},
  'repos': []
};
var reposHour = {
  'meta': {},
  'repos': []
};

function authenticate(config, account) {
  if (config.githubParams.clientID && config.githubParams.clientSecret) {
    account.authenticate({
      type: 'oauth',
      key: config.githubParams.clientID,
      secret: config.githubParams.clientSecret
    });
  }
}

function fetch(method, args, limit, account) {
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
      });

      if (items.length >= limit || !account.hasNextPage(res)) {
        resolve(items);
      } else {
        account.getNextPage(res, recv);
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

function addPushedQueryDate() {
  return 'pushed:>' + moment().subtract(3, 'months').format('YYYY-MM-DD');
}

function searchUserOptions(config) {
  return {
    q: 'location:' + config.githubParams.location
  }
}

function searchReposOptions(config, users) {
  return {
    sort: 'updated',
    order: 'desc',
    q: [
      'stars:>=' + config.githubParams.starLimit,
      'fork:true',
      addPushedQueryDate()
    ].concat(
      users
      .filter(function(user) {
        return !/"/.test(user.login);
      })
      .map(function(user) {
        return 'user:"' + user.login + '"';
      })
    ).join('+')
  }
}

function searchContributorsOptions(repo) {
  return {
    repo: repo.name,
    user: repo.owner.login
  }
}

function getRepoObject(repo) {
  return {
    name: repo.name,
    html_url: repo.html_url,
    description: repo.description,
    pushed_at: repo.pushed_at,
    updated_at: repo.updated_at,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    size: repo.size,
    subscribers_count: repo.subscribers_count,
    owner: {
      login: repo.owner.login,
      avatar_url: repo.owner.avatar_url,
      html_url: repo.owner.html_url
    }
  }
}

function getMetaObject(config, repos) {
  return {
    generated_at: new Date().toISOString(),
    location: config.githubParams.location,
    total_repos: repos.length,
    api_version: 'v1',
    max_users: config.githubParams.maxUsers,
    max_repos: config.githubParams.maxRepos
  };
}

function hasValidLanguage(repo) {
  return repo.language;
}

function sortByPushedAt(a, b) {
  return a.pushed_at > b.pushed_at ? -1 : 1;
}

function addContributors(response) {
  var result = [];

  response.forEach(function(r) {
    result.push({
      login: r.login,
      html_url: r.html_url,
      contributions: r.contributions
    })
  })

  return result;
}

function addReposAndOwners(results, maxRepos) {
  var owners = {};

  return []
  .concat.apply([], results)
  .filter(hasValidLanguage)
  .map(getRepoObject)
  .sort(sortByPushedAt)
  .filter(function(repo) {
    owners[ repo.owner.login ] = 1 + (owners[ repo.owner.login ] || 0);
    return owners[ repo.owner.login ] === 1;
  })
  .slice(0, maxRepos)
}

function addContributorsToRepos(repos, reposResult, github, config) {
  var count = 0;
  var repoLength = repos.length;

  repos.forEach(function(repo) {
    github.repos.getContributors(searchContributorsOptions(repo), function(err, res) {
      if (res && res.length > 0) {
        repo.contributors = addContributors(res);
        count++;
      }

      if (count === repoLength) {
        console.log(clc.green('Success: Added ' + repos.length + ' GitHub repos'));

        reposResult.meta = getMetaObject(config, repos);
        reposResult.repos = repos;

        jf.writeFile(config.githubParams.outfile, reposResult);

        return reposResult;
      }
    })
  })
}

function addDayData() {
  reposToday.meta.generated_at = reposResult.meta.generated_at
  reposToday.meta.location = reposResult.meta.location
  reposToday.repos = getCurrentDayData(reposResult)
  reposToday.meta.total_repos = reposToday.repos.length
}

function addHourData() {
  reposHour.meta.generated_at = reposResult.meta.generated_at
  reposHour.meta.location = reposResult.meta.location
  reposHour.repos = getCurrentHourData(reposResult)
  reposHour.meta.total_repos = reposHour.repos.length
}

function getCurrentDayData(data) {
  return data.repos.filter(function(element) {
    return moment(data.meta.generated_at).diff(moment(element.pushed_at), 'days') === 0;
  })
}

function getCurrentHourData(data) {
  return data.repos.filter(function (element) {
    return moment(element.pushed_at).isAfter(moment().subtract(1, 'hour'))
  })
}

module.exports = function(config){
  var github = new GitHubApi({
    version: config.githubParams.version,
    debug: config.debug
  });

  authenticate(config, github)

  fs.exists(config.githubParams.outfile, function(exists) {
    if (exists) {
      jf.readFile(config.githubParams.outfile, function(err, savedResult) {
        if (!err) {
          reposResult.meta = savedResult.meta;
          reposResult.repos = savedResult.repos;

          addDayData()
          addHourData()

          console.log('Info: Loaded ' + savedResult.repos.length + ' repos from cache');
        }
      });
    }
  });

  function updateRepos() {
    console.log('Info: Updating the repos feed... this may take a while');

    return fetch(github.search.users, searchUserOptions(config), config.githubParams.maxUsers, github)
    .then(function(users) {
      console.log(clc.blue('Info: Found ' + users.length + ' github.com users'));

      var searches = chunk(mess(users), 20).map(function(users) {
        return fetch(github.search.repos, searchReposOptions(config, users), config.githubParams.maxRepos, github);
      });
      return Promise.all(searches);
    })
    .then(function(results) {
      return addReposAndOwners(results, config.githubParams.maxRepos)
    })
    .then(function(repos) {
      var reply = addContributorsToRepos(repos, reposResult, github, config)

      addDayData()
      addHourData()

      return reply
    })
    .catch(function(err) {
      console.error(err);
    });
  }

  return {
    feed: reposResult,
    update: updateRepos,
    day: reposToday,
    hour: reposHour,
    get: function(count) {
      var answer = {
        meta: {
          'generated_at': new Date().toISOString(),
          'location': config.city,
          'api_version': config.api_version,
          'total_repos': parseInt(count)
        },
        repos: reposResult.repos.slice(0, parseInt(count))
      }

      return answer
    },
  }
}
