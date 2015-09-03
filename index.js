'use strict';

var repos;

module.exports = {
  init: function(config){

    repos = require('./repos')(config);
    repos.update();

    return {
      'repos': repos,
    };
  }
};
