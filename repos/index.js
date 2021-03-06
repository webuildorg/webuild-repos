'use strict';

var fs = require('fs');
var jf = require('jsonfile');
var mess = require('mess');
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

function searchOrgOptions(config) {
  return {
    q: 'type:org+location:' + config.githubParams.location
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
    owner: repo.owner.login
  }
}

function getRepoObject(repo) {
  return {
    name: repo.name,
    html_url: repo.html_url,
    description: repo.description,
    pushed_at: repo.pushed_at,
    updated_at: repo.updated_at,
    formatted_time: moment(repo.pushed_at).endOf('hour').fromNow(),
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    size: repo.size,
    subscribers_count: repo.subscribers_count,
    type: repo.owner.type,
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

function addContributorsToRepos(repos, github) {
  var errorMessageOnContributorList = 'The history or contributor list is too large to list contributors for this repository via the API.'

  var repoPromises = repos.map(function(repo) {
    return new Promise(function(resolve) {
      github.repos.getContributors(searchContributorsOptions(repo), function(err, res) {
        if (err) {
          if (JSON.parse(err).message === errorMessageOnContributorList) {
            console.log(clc.yellow('Warn for ' + repo.html_url + ': ' + err));
            repo.contributors = 'Contributor list is too large'
          } else {
            console.error(clc.red('Error for ' + repo.html_url + ': ' + err));
          }
        }

        if (res && res.length > 0) {
          repo.contributors = addContributors(res);
        }else{
          repo.contributors = [];
        }

        resolve(repo);
      })
    });
  });

  return Promise.all(repoPromises);
}

function getCurrentDayData(data) {
  return data.repos.filter(function(element) {
    return moment(data.meta.generated_at).diff(moment(element.pushed_at), 'days') === 0;
  })
}

function addDayData() {
  reposToday.meta.generated_at = reposResult.meta.generated_at
  reposToday.meta.location = reposResult.meta.location
  reposToday.repos = getCurrentDayData(reposResult)
  reposToday.meta.total_repos = reposToday.repos.length
}

function getCurrentHourData(data) {
  return data.repos.filter(function (element) {
    return moment(element.pushed_at).isAfter(moment().subtract(1, 'hour'))
  })
}

function addHourData() {
  reposHour.meta.generated_at = reposResult.meta.generated_at
  reposHour.meta.location = reposResult.meta.location
  reposHour.repos = getCurrentHourData(reposResult)
  reposHour.meta.total_repos = reposHour.repos.length
}

module.exports = function(config)   {
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

      return fetch(github.search.users, searchOrgOptions(config), config.githubParams.maxUsers, github)
      .then(function(orgs) {
        console.log(clc.blue('Info: Found ' + orgs.length + ' github.com organisation'));

        var totalUsers = users.concat(orgs);
        console.log(clc.blue('Info: Found ' + totalUsers.length + ' github.com user and organisation'));

        var searches = chunk(mess(totalUsers), 20).map(function(totalUsers) {
          return fetch(github.search.repos, searchReposOptions(config, totalUsers), config.githubParams.maxRepos, github);
        });
        return Promise.all(searches);
      })
    })
    .then(function(results) {
      return addReposAndOwners(results, config.githubParams.maxRepos)
    })
    .then(function(repos) {
      return addContributorsToRepos(repos, github)
    })
    .then(function(repos) {
      console.log(clc.green('Success: Added ' + repos.length + ' GitHub repos'));

      reposResult.meta = getMetaObject(config, repos);
      reposResult.repos = repos;

      jf.writeFile(config.githubParams.outfile, reposResult);

      addDayData()
      addHourData()
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
    }
  }
}
