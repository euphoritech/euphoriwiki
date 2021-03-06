var async = require('async')
var MDB = require('./libs/MDB.js')

var self = (module.exports = {
  app: {
    name: process.env.APP_NAME || 'Euphoriwiki',
  },

  server: {
    PORT: process.env.PORT || 8000,
    CLUSTERING: process.env.CLUSTERING || false,
    CLUSTER_MAX_CPUS: process.env.CLUSTER_MAX_CPUS || 5,
    IS_PRODUCTION: process.env.IS_PRODUCTION || false,
    HOST: process.env.HOSTNAME || 'http://localhost',
  },

  newrelic: {
    key: process.env.NEWRELIC_KEY,
    level: process.env.NEWRELIC_LEVEL || 'info',
  },

  admin: {
    SETTINGS: [],
  },

  view: {
    NAVLINKS: [], //placeholder where all links will be stored once we retrieve them from our persistent store
    send: function(req, opts) {
      opts = opts || {}
      var obj = opts.obj || {}
      var iobj = opts.iobj || {}

      var routeInfo = opts.routeInfo || {}

      var protocol = req.secure ? 'https' : 'http'
      var host = ''
      var wshost = ''

      return {
        data: {
          external: {
            wshost: wshost,
            port: self.server.PORT,
            EXTRA: obj,
          },
          EXTRA: iobj,
          host: host,
          session: req.session,
          title: opts.title || null,
          nav: this.NAVLINKS,
          settings: self.admin.SETTINGS,
        },
      }
    },
  },

  socketio: {
    DEFAULTNAMESPACE: '/',
    DEFAULTROOM: '/',
    NUM_MESSAGES: process.env.NUM_MESSAGES || 25,
    CACHE: {},
  },

  session: {
    sessionSecret: process.env.SESSION_SECRET,
    sessionCookieKey: process.env.SESSION_COOKIE_KEY,
    storeOptions: function() {
      return {
        url: self.mongodb.connectionString(),
        ttl: 7 * 24 * 60 * 60, //expiration, 7 days
      }
    },
  },

  mongodb: {
    access: {
      FULL_URI: process.env.MONGODB_URI || null,
      PROTOCOL: 'mongodb',
      HOST: process.env.MONGODB_HOST || 'localhost',
      PORT: Number(process.env.MONGODB_PORT || 27017),
      USER: process.env.MONGODB_USER,
      PASSWORD: process.env.MONGODB_PW,
      TESTDB: process.env.MONGODB_DB_DEV,
      PRODDB: process.env.MONGODB_DB,
    },

    MDB: {}, //will be the instance of MDB we use to open a connection with the mongodb server
    db: {}, //the object we'll be using to create cursors and return/set data in mongoDB
    fileMDB: {},
    filedb: {},

    dbInfo: function() {
      var db = self.server.IS_PRODUCTION
        ? this.access.PRODDB
        : this.access.TESTDB

      return {
        full: this.access.FULL_URI,
        p: this.access.PROTOCOL,
        h: this.access.HOST,
        user: this.access.USER,
        pw: this.access.PASSWORD,
        port: this.access.PORT,
        db: db,
      }
    },

    connectionString: function(options) {
      options = options || {}
      var dbInfo = this.dbInfo() || {}

      var protocol = options.protocol || dbInfo.p
      var host = options.host || dbInfo.h
      var user = options.user || dbInfo.user
      var password = options.password || dbInfo.pw
      var port = options.port || dbInfo.port
      var db = options.db || dbInfo.db

      var auth = user && password ? user + ':' + password + '@' : ''

      return (
        options.full ||
        dbInfo.full ||
        protocol + '://' + auth + host + ':' + port + '/' + db
      )
    },

    initialize: function(cb) {
      var oSelf = this

      async.waterfall(
        [
          function(callback) {
            new MDB({
              config: self,
              callback: function(err, opts) {
                if (err) return callback(err)

                oSelf.db = opts.db
                oSelf.MDB = opts.self

                callback(null, opts)
              },
            })
          },
          function(opts, callback) {
            if (process.env.MONGODB_FILE_URI || process.env.MONGODB_FILE_HOST) {
              new MDB({
                config: self,
                connectionString: oSelf.connectionString({
                  full: process.env.MONGODB_FILE_URI,
                  host: process.env.MONGODB_FILE_HOST,
                  user: process.env.MONGODB_FILE_USER,
                  password: process.env.MONGODB_FILE_PW,
                  port: process.env.MONGODB_FILE_PORT,
                  db: process.env.MONGODB_FILE_DB,
                }),
                callback: function(err, opts2) {
                  if (err) return callback(err)

                  oSelf.filedb = opts2.db
                  oSelf.fileMDB = opts2.self

                  return callback(null, opts)
                },
              })
            } else {
              oSelf.filedb = opts.db
              oSelf.fileMDB = opts.self

              return callback(null, opts)
            }
          },
        ],
        function(err, opts) {
          if (typeof cb === 'function') return cb(err, opts)
        }
      )
    },

    REFERENCE: {
      //shouldn't probably be using these values, just for reference
      DEVFILES: 'data/wiki/dev', //relative to the mongodb folder
      PRODFILES: 'data/wiki/prod',
    },
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },

  smtp: {
    core: {
      pool: process.env.SMTP_POOL,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },

      tls: {
        ciphers: process.env.SMTP_TLSCIPHERS,
      },

      defaultEmail: process.env.SMTP_DEFAULTEMAIL,
      defaultName: process.env.SMTP_DEFAULTNAME,
    },

    nodemailerconfig: function() {
      if (this.core.host) {
        var o = {
          //pool: this.core.pool,
          host: this.core.host,
          port: Number(this.core.port || 587),
          secure: this.core.secure || false,
        }

        if (typeof this.core.auth === 'object' && this.core.auth.user) {
          o.auth = {
            user: this.core.auth.user,
            pass: this.core.auth.pass,
          }
        }

        if (this.core.tls.ciphers) o.tls = this.core.tls

        return o
      } else {
        return {
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      }
    },
  },

  authtypes: {
    local: 'true',
    facebook: 'false',
  },

  ldap: {
    protocol: process.env.LDAP_PROTOCOL,
    url: process.env.LDAP_URL,
    basedn: process.env.LDAP_BASEDN,
    username: process.env.LDAP_USERNAME,
    password: process.env.LDAP_PASSWORD,
    suffix: process.env.LDAP_SUFFIX,
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    loginCallbackUrl: function() {
      return self.server.HOST + '/login/facebook/callback'
    },
  },

  google: {
    appId: process.env.GOOGLE_APP_ID,
    appSecret: process.env.GOOGLE_APP_SECRET,
    loginCallbackUrl: function() {
      return self.server.HOST + '/login/google/callback'
    },
  },

  cryptography: {
    algorithm: 'aes-256-ctr',
    password: process.env.CRYPT_SECRET,
  },

  logger: {
    options: function(app) {
      return {
        name: app || 'euphoriwiki',
        level: process.env.LOGGING_LEVEL || 'info',
        stream: process.stdout,
        /*streams: [
          {
            level: process.env.LOGGING_LEVEL || "info",
            path: path.join(__dirname,"..","logs","wiki.log")
          }
        ]*/
      }
    },
  },
})
