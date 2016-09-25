'use strict';

var repos;

module.exports = {
  init: function(config){

    repos = require('./repos')(config);
    return {
      'repos': repos,
    };
  }
};
