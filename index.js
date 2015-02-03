/**
 * Sandcrawler Logger Plugin
 * ==========================
 *
 * A simple log plugin providing a colorful output to a sandcrawler scraper
 * for debugging and monitoring purposes.
 */
var winston = require('winston'),
    util    = require('util'),
    chalk   = require('chalk')
    moment  = require('moment');

// Helpers
function rs(string, nb) {
  var s = string,
      l,
      i;

  if (nb <= 0)
    return '';

  for (i = 1, l = nb | 0; i < l; i++)
    s += string;
  return s;
}

function highlightUrl(url) {
  return chalk.gray.bold(url);
}

/**
 * Custom Transport
 */
var SandcrawlerLogger = winston.transports.SandcrawlerLogger = function (options) {

  // Name
  this.name = 'sandcrawler';

  // Level
  this.level = options.level || 'debug';
  this.scraperColor = options.scraperColor || 'magenta';
  this.scraperName = options.scraperName;

  // Colors
  this.colors = {
    debug: 'blue',
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
  };
};

util.inherits(SandcrawlerLogger, winston.Transport);

SandcrawlerLogger.prototype.log = function(level, msg, meta, callback) {

  // Writing text
  var txt = '';
  txt += chalk[this.scraperColor](this.scraperName);
  txt += '/' + chalk.bold[this.colors[level]](level);
  txt += '' + rs(' ', Math.abs(level.length - 8)) + msg;

  // Outputting
  console.log(txt);

  // All went well...
  callback(null, true);
};

/**
 * Custom Stopwatch. Can be upgraded with moments.js
 */
var Stopwatch = function() {
  var s = this;
  
  s.elapsed  = 0;
  s.starting = 0;
  s.expected = 0;
  s.delay    = 0;

  s.steps    = [];
  s.delays   = [];

  s.overall  = {};

  s.reset = function() {
    s.elapsed  = 0;
    s.starting = 0;
    s.expected = 0;
    s.delay    = 0;

    s.steps    = [];
    s.delays   = [];
  };

  s.start = function() {
    s.starting = new Date();
    if(s.delay)
      s.delays.push(s.starting - s.delay);
  }

  s.stop = function() {
    s.elapsed = (new Date()) - s.starting;
    s.steps.push(s.elapsed);
    s.delay = new Date();
  }

  // computate single start/stop avg
  s.overall.average = function() {
    return s.overall.delay() / (s.delays.length || 1) + s.overall.steps() / (s.steps.length || 1);
  }

  // sum total delay and total steps
  s.overall.delay = function() {
    var sum = 0;
    for(var i = 0; i < s.delays.length; i++)
      sum += s.delays[i];
    return sum;
  }

  s.overall.steps = function() {
    var sum = 0;
    for(var i = 0; i < s.steps.length; i++)
      sum += s.steps[i];
    return sum;
  }

  s.overall.elapsed = function() {
    s.overall.steps() + s.overall.delay();
  }

  s.remaining = function(remains) {
    return remains * average();
  }

  s.humanize = function(milliseconds) {
    var duration = moment.duration(milliseconds);
    return duration.humanize();
  }
}


/**
 * Plugin
 */
module.exports = function(opts) {
  opts = opts || {};

  // Bootstrap
  return function(scraper) {

    // Creating logger
    var log = new (winston.Logger)({
      transports: [
        new (winston.transports.SandcrawlerLogger)({
          level: opts.level,
          scraperColor: opts.color,
          scraperName: scraper.name
        })
      ]
    });

    // timer
    var stopwatch = new Stopwatch();

    // Assigning the logger to the scraper instance
    this.logger = log;
    console.log(scraper.index, scraper.settings.params)
    // Scraper level listeners
    scraper.once('scraper:start', function() {
      log.info('Starting...');
    });

    scraper.once('scraper:fail', function() {
      log.error('Scraper failed.');
    });

    scraper.once('scraper:success', function() {
      log.info('Scraper ended.');
    });

    // Page level listeners
    scraper.on('page:log', function(data, req) {
      log.debug('Page ' + chalk.gray.bold(req.url) +
                ' logging: ' + chalk.cyan(data.message));
    });

    scraper.on('page:error', function(data, req) {
      log.debug('Page ' + chalk.gray.bold(req.url) +
                ' error: ' + chalk.red(data.message));
    });

    // Job level listeners
    scraper.on('job:scrape', function(job) {
      stopwatch.start();
      log.info('Scraping ' + highlightUrl(job.req.url));
    });

    scraper.on('job:success', function(job) {
      stopwatch.stop();
      log.info('Job ' + highlightUrl(job.req.url) + chalk.green('successfully completed in', stopwatch.humanize(stopwatch.elapsed), '(', stopwatch.elapsed / 1000,'s )'));
      log.info('Job completion avg', chalk.yellow(stopwatch.humanize(stopwatch.overall.average()), '(',stopwatch.overall.average() / 1000,')'));
      // gimme remainings!
    });

    scraper.on('job:fail', function(err, job) {
      log.warn('Job ' + highlightUrl(job.req.url) +
               ' failed ' + chalk.red('[Error: ' + err.message + ']'));
    });

    scraper.on('job:added', function(job) {
      log.info('Job ' + highlightUrl(job.req.url) + chalk.blue(' added') +
               ' to the stack.');
    });

    scraper.on('job:retry', function(job) {
      var m = this.settings.maxRetries;

      log.verbose('Retrying job ' + highlightUrl(job.req.url) + ' (' +
                  job.req.retries + (m ? '/' + m : '') + ' retries)');
    });
  };
};
