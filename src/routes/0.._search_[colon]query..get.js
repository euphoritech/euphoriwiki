import Auth from "../libs/Authentication.js"
import WikiHandler from "../libs/WikiHandler.js"
import AccessManagement from "../libs/AccessManagement.js"
import Audit from "../libs/Audit.js"
import config from "../config.js"

module.exports = function(req,res) {
  var query = req.params.query;
  var wiki = new WikiHandler();
  var A = new Auth({session:req.session});
  var Access = new AccessManagement({db:config.mongodb.db});

  var username = A.username;

  var audit = new Audit({user:username, ip:req.ip, hostname:req.hostname, ua:req.headers['user-agent']});

  wiki.searchPages(query,function(e,pages) {
    if (e) res.send(e);
    else {
      Access.onlyViewablePaths({session:req.session, username:username, paths:pages},function(err,filteredPages) {
        if (err) res.send(err);
        else res.render("search",config.view.send(req,{obj:{pages:filteredPages}}));
      });

      audit.log({type:"Wiki Search", additional:{query:query}});
    }
  });
}
