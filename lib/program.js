var Q = require('q'),
    _ = require('lodash'),
    filesize = require('filesize'),
    fs = require('fs'),
    moment = require('moment'),
    program = require('commander'),
    utils = require('./utils');


program
  .version(utils.getVersion('..'))
  .option('--api-endpoint <url>', 'set the API endpoint')
  .option('-D, --debug', 'enable debug mode');


program
  .command('attach <server>')
  .description('attach (serial console) to a running server')
  .action(utils.notImplementedAction);


program
  .command('build <path>')
  .description('build an image from a file')
  .action(utils.notImplementedAction);


program
  .command('commit <server>')
  .description('create a new image from a server\'s changes')
  .action(utils.notImplementedAction);


program
  .command('cp <server:path> <path>')
  .description('copy files/folders from a server\'s filesystem to the host path')
  .action(utils.notImplementedAction);


program
  .command('create <image>')
  .description('create a new server but do not start it')
  .option('--name <name>', 'assign a name to the server', 'noname')
  .action(function(image, options) {
    var client = utils.newApi(options);

    var data = {
      image: image,
      organization: client.config.organization,
      name: options.name
    };

    client.post('/servers', data)
      .then(function (res) {
        console.log(res.body.server.id);
      })
      .catch(utils.panic);
  });


program
  .command('events')
  .description('get real time events from the API')
  .action(utils.notImplementedAction);


program
  .command('exec <server> <command> [args...]')
  .description('run a command in a running server')
  .option('-d, --detach', 'detached mode: run command in the background')
  .option('-i, --interactive', 'keep STDIN open even if not attached')
  .option('-t, --tty', 'allocate a pseudo-TTY')
  .action(function(server, command, args, options) {
    var client = utils.newApi(options);
    client.get('/servers/' + server)
      .then(function(res) {
        var ip = res.body.server.public_ip.address;

        var cmd = [command];
        cmd.push.apply(cmd, args);

        utils.sshExec(ip, cmd, {}, function(statusCode) {
          if (statusCode == 0) {
            console.log(server);
          }
          process.exit(statusCode);
        });
      })
      .catch(utils.panic);
  });


program
  .command('export <server>')
  .description('stream the contents of a server as a tar archive')
  .action(utils.notImplementedAction);


program
  .command('history <image>')
  .description('show the history of an image')
  .action(utils.notImplementedAction);


program
  .command('images')
  .description('list images')
  .option('-a, --all', 'show all images')
  .option('-f, --filter <filters>', 'provide filter values. no valid filters yet', utils.collect, [])
  .option('--no-trunc', 'don\'t truncate output')
  .option('-q, --quiet', 'only display numeric IDs')
  .action(function(options) {
    var client = utils.newApi(options);

    var query = '/images?';

    if (options.filter.length) {
      utils.panic("onlinelabs: Not implemented option");
    }

    if (!options.all)   query += 'public=true&';

    client.get(query)
      .then(function (res) {
        if (options.quiet) {
          _.forEach(res.body.images, function (image) {
            console.log(image.id);
          });
        } else {
          var table = utils.newTable({
            head: [
              'REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'VIRTUAL SIZE'
            ]
          });

          _.forEach(res.body.images, function(image) {
            var row = [
              utils.wordify(image.name),
              '',
              image.id,
              moment(image.creation_date).fromNow(),
              filesize(image.root_volume.size, {base: 10})
            ];
            if (options.trunc) {
              utils.truncateRow(row, [80, 25, 8, 25, 25]);
            }
            table.push(row);
          });
          console.log(table.toString());
        }
      })
      .catch(utils.panic);
  });


program
  .command('import')
  .description('create a new filesystem image from the contents of a tarball')
  .action(utils.notImplementedAction);


program
  .command('info')
  .description('display system-wide information')
  .action(function() {
    var rc = utils.rc();
    console.log('Organization: ' + rc.organization);
    console.log('Token: ' + utils.anonymizeUUID(rc.token));
    console.log('API Endpoint: ' + rc.api_endpoint);
    console.log('RC file: ' + rc.config);
    console.log('CLI path: ' + process.argv[1]);
    console.log('User: ' + process.env.USER);
  });


program
  .command('inspect <items...>')
  .description('return low-level information on a server or image')
  .option('-f, --format <format>', 'format the output using the given template')
  .action(function(items, options) {
    if (options.format) {
      utils.panic("onlinelabs: Not implemented option");
    }

    var client = utils.newApi({});  // FIXME: get options

    var once = function(item, cb) {
      return [
        client.get('/servers/' + item),
        client.get('/images/' + item),
        client.get('/volumes/' + item)
      ];
    };

    var promises = [];
    promises = promises.concat.apply(promises, items.map(once));

    Q.allSettled(promises).then(
      function(results) {
        console.log(
          JSON.stringify(
            _.filter(
              _.pluck(
                _.pluck(
                  results,
                  'value'
                ),
                'body'
              ),
              function(entry) {
                return entry !== undefined;
              }),
            null, 2
          )
        );
      }, utils.panic);
  });


program
  .command('kill <server>')
  .description('kill a running server')
  .option('-s, --signal <signal>', 'Signal to send to the server', 'KILL')
  .action(function(server, options) {
    if (options.signal != 'KILL') {
      utils.panic("onlinelabs: Not implemented option");
    }
    var client = utils.newApi(options);

    client.get('/servers/' + server)
      .then(function(res) {
        var ip = res.body.server.public_ip.address;

        utils.sshExec(ip, 'halt', {}, function(statusCode) {
          if (statusCode == 0) {
            console.log(server);
          }
          process.exit(statusCode);
        });
      })
      .catch(utils.panic);
  });


program
  .command('load')
  .description('load an image from a tar archive')
  .action(utils.notImplementedAction);


program
  .command('login')
  .description('login to the API')
  .option('--organization <uuid>', 'set the organization')
  .option('--token <token>', 'token')
  .action(function(options) {
    var client = utils.newApi(options);
    var newConfig = _.cloneDeep(client.config);
    delete newConfig._;
    delete newConfig.configs;
    delete newConfig.config;
    var filepath = utils.defaultConfigPath();
    fs.writeFile(
      filepath,
      JSON.stringify(newConfig, null, 2),
      function (err) {
        if (err) {
          utils.panic(err);
        }
        console.log('configuration written to ' + filepath);
      });
  });


program
  .command('logout')
  .description('log out from the API')
  .action(function() {
    var filepath = utils.defaultConfigPath();
    fs.unlink(
      filepath,
      function (err) {
        if (err) {
          utils.panic(err);
        }
        console.log('removed ' + filepath + ' configuration file');
      });
  });


program
  .command('logs <server>')
  .description('fetch the logs of a server')
  .action(utils.notImplementedAction);


program
  .command('port')
  .description('list port security for the server')
  .action(utils.notImplementedAction);


program
  .command('pause')
  .description('pause all processes within a server')
  .action(utils.notImplementedAction);


program
  .command('ps')
  .description('list servers')
  .option('-a, --all', 'show all servers. only running servers are shown by default')
  .option('--before <server>', 'show only server created before server, include non-running ones')
  .option('-f, --filter <filters>', 'provide filter values. valid filters: status=(starting|running|stopping|stopped)', utils.collect, [])
  .option('-l, --latest', 'show only the latest created server, include non-running ones')
  .option('-n <n>', 'show n last created servers, include non-running ones.', parseInt)
  .option('--no-trunc', 'don\'t truncate output')
  .option('-q, --quiet', 'only display numeric IDs')
  .option('-s, --size', 'display total file sizes')
  .option('--since <server>', 'show only servers created since server, include non-running ones')
  .action(function(options) {
    var client = utils.newApi(options);
    var query = '/servers?';

    if (options.before || options.filter.length || options.size ||
        options.since) {
      utils.panic("onlinelabs: Not implemented option");
    }

    if (!options.all)   query += 'state=running&';
    if (options.latest) query += 'per_page=1&';
    if (options.n)      query += 'per_page=' + options.n + '&';

    client.get(query)
      .then(function(res) {
        if (options.quiet) {
          _.forEach(res.body.servers, function(server) {
            console.log(server.id);
          });
        } else {
          var table = utils.newTable({
            head: [
              'SERVER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAME'
            ]
          });

          _.forEach(res.body.servers, function(server) {
            var row = [
              server.id,
              (server.image ? utils.wordify(server.image.root_volume.name) : ''),
              '',
              moment(server.creation_date).fromNow(),
              server.state,
              '',
              utils.wordify(server.name)
            ];
            if (options.trunc) {
              utils.truncateRow(row, [8, 25, 25, 25, 25, 25, -1]);
            }
            table.push(row);
          });
          console.log(table.toString());
        }
      })
      .catch(utils.panic);
  });


program
  .command('pull <image>')
  .description('pull an image or a repository')
  .action(utils.notImplementedAction);


program
  .command('push <image>')
  .description('push an image or a repository')
  .action(utils.notImplementedAction);


program
  .command('rename <server>')
  .description('rename an existing server')
  .action(utils.notImplementedAction);


program
  .command('restart <server>')
  .description('restart a running server')
  .action(function(server) {
    var client = utils.newApi({});  // FIXME: get options

    client.post('/servers/' + server + '/action', {
      action: 'reboot'
    })
      .then(function() {
        console.log(server);
      })
      .catch(function (err) {
        if (err.error.message != 'server is being stopped or rebooted') {
          utils.panic(err);
        }
      });
  });


program
  .command('rm <server>')
  .description('remove one or more servers')
  .action(utils.notImplementedAction);


program
  .command('rmi <image>')
  .description('remove one or more images')
  .action(utils.notImplementedAction);


program
  .command('run <image>')
  .description('run a command in a new server')
  .action(utils.notImplementedAction);


program
  .command('save <image>')
  .description('save an image to a tar archive')
  .action(utils.notImplementedAction);


program
  .command('search <keyword>')
  .description('search for an image on the Hub')
  .action(utils.notImplementedAction);


program
  .command('start <server>')
  .description('start a stopped server')
  .action(function(server) {
    var client = utils.newApi({});  // FIXME: get options

    client.post('/servers/' + server + '/action', {
      action: 'poweron'
    })
      .then(function() {
        console.log(server);
      })
      .catch(function (err) {
        if (err.error.message != 'server should be stopped') {
          utils.panic(err);
        }
      });
  });


program
  .command('stop <server>')
  .description('stop a running server')
  .action(function(server) {
    var client = utils.newApi({});  // FIXME: get options

    client.post('/servers/' + server + '/action', {
      action: 'poweroff'
    })
      .then(function() {
        console.log(server);
      })
      .catch(function (err) {
        if (!_.includes([
          'server is being stopped or rebooted',
          'server should be running'
        ], err.error.message)) {
          utils.panic(err);
        }
      });
  });


program
  .command('tag <image> <tag>')
  .description('tag an image into a repository')
  .action(utils.notImplementedAction);


program
  .command('top <server>')
  .description('lookup the running processes of a server')
  .action(utils.notImplementedAction);


program
  .command('unpause <server>')
  .description('unpause a paused server')
  .action(utils.notImplementedAction);


program._events.version = null;
program
  .command('version')
  .description('show the version information')
  .action(function() {
    console.log('Client version: ' + utils.getVersion('..'));
    console.log('Client API version: ' + utils.getVersion('onlinelabs'));
    console.log('Node.js version (client): ' + process.version);
    console.log('OS/Arch (client): ' + process.platform + '/' + process.arch);
    // FIXME: add information about server
  });



program
  .command('wait <server>')
  .description('block until a server stops')
  .action(utils.notImplementedAction);


module.exports = program;