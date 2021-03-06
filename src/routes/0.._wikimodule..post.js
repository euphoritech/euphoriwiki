import bunyan from "bunyan"
import async from "async"
import Auth from "../libs/Authentication.js"
import WikiHandler from "../libs/WikiHandler.js"
import AccessManagement from "../libs/AccessManagement.js"
import Audit from "../libs/Audit.js"
import GetHTML from "../libs/GetHTML.js"
import FileHandler from "../libs/FileHandler.js"
import CodeRunner from "../libs/CodeRunner.js"
import config from "../config.js"

const log = bunyan.createLogger(config.logger.options())

module.exports = function(req,res) {
  var info = req.body;

  var A = new Auth({session:req.session});
  var Access = new AccessManagement({db:config.mongodb.db});
  var audit = new Audit({user:A.username, ip:req.ip, hostname:req.hostname, ua:req.headers['user-agent']});

  var username = A.username;
  var wiki = new WikiHandler({path:decodeURI(info.page || "")});

  switch(info.type) {
    case "getModule":
      var uid = info.id;
      var path = info.path;
      var fh = new FileHandler({db:config.mongodb.filedb});
      var gH = new GetHTML();

      //will be set in waterfall to be used in final callback because
      //we can't guarantee when the last callback in the waterfall
      //functions executes that module will be returned with it
      var moduleTemplate;

      async.waterfall([
        function(callback) {
          if (uid) {
            config.mongodb.db.collection("wiki_modules_instances").find({uid:uid}).toArray(function(e,instance) {
              callback(e,instance);
            });

          } else callback("Please provide a valid ID for the module.");
        },
        function(instance,callback) {
          if (instance.length) {
            instance = instance[0];
            config.mongodb.db.collection("wiki_modules").find({ key:instance.modulekey }).toArray(function(_e,module) {
              callback(_e,instance,module);
            });

          } else callback("We couldn't find the module instance provided. Please ensure your module ID is correct.");
        },
        function(instance,module,callback) {
          if (module.length) {
            module = module[0];
            moduleTemplate = module;

            try {
              //if the code in module.code does not call callback after 30 seconds, do it here.
              var noDataTimer = setTimeout(function() {
                try {
                  return callback(null,"No results were returned from the code.");
                } catch(e) {}
              },Number(module.timeout || 30)*1000);

              //execute module code
              const queryParams = req.headers.referer.split('?')[1];
              const oQueryParams = (typeof queryParams === 'string') ? unserialize(queryParams) : {};

              var params = Object.assign(instance.config || {}, { callback: callback, path: path, queryParams: oQueryParams })
              var codeResult = new CodeRunner({ code: module.code || "return ''", params: params }).eval();

              //if codeResult has a value other than undefined (i.e. the eval'ed code returned something)
              //go ahead and assume we need to call the callback with that result here.
              if (typeof codeResult !== "undefined" && codeResult != null) {
                clearTimeout(noDataTimer);
                if (codeResult instanceof Error) {
                  return callback(codeResult);
                }
                return callback(null,codeResult);
              }

            } catch(e) {
              return callback(e);
            }

          } else return callback("We couldn't find the module provided. Please make sure the module has not been deleted by contacting your wiki administrator.");
        },
        function(result,callback) {
          var module = moduleTemplate;

          if (module.template) {
            fh.getFile({filename:module.template, encoding:"utf8"},function(__e,fileContents) {
              callback(__e,result,fileContents);
            });
          } else callback("No template in module to use.");
        },
        function(result,fileContents,callback) {
          var module = moduleTemplate;

          var ext = gH.extension(module.template);
          gH[ext.substring(1)](fileContents,function(___e,viewHtml) {
            callback(___e,result,viewHtml,module.clientCode);
          });
        }
      ],
        function(err,result,viewHtml,clientCode) {
          if (err) {
            res.json({success:false, error:(typeof err==="string") ? err : "Something went wrong with this module. Please try again or contact your administrator."});
            log.error(err);
          } else {
            res.json({
              success: true,
              results: result,
              template: viewHtml,
              clientCode: clientCode || ""
            });
          }
        }
      );

      break;

    default:
      res.json({success:false, error:"We couldn't figure out what you are doing. Please try again."});
  }
}


function unserialize(string) {
  string=(/^\?/.test(string)) ? string.substring(1) : string;    //if first char is a question mark, remove it from the string

  var a=string.split("&");
  var obj={};
  for (var _i=0;_i<a.length;_i++) {
    var _a = a[_i].split("=");
    obj[ decodeURIComponent(_a[0]) ] = decodeURIComponent(_a[1]);
  }

  return obj;
}
