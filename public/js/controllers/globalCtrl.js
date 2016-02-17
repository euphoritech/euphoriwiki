function globalCtrl($scope,$http) {
  window.EuphoriwikiSocket=window.EuphoriwikiSocket || io(LOCAL_DATA.wshost);    //io(LOCAL_DATA.wshost+":"+LOCAL_DATA.port+LOCAL_DATA.namespace);
  
  $scope.global = {};
  $scope.functions= {
    initialize: function() {
      $.autocompleteselect();
      
      $scope.socketHandler=new Core.SocketHandler({
        $scope: $scope,
        socket: EuphoriwikiSocket,
        wshost: LOCAL_DATA.wshost,
        namespace: LOCAL_DATA.namespace,
        events: LOCAL_DATA.socketEvents
      });
      
      $scope.socketHandler.initialize();
      this.setSearchQuery();
      
      if (!(window.File && window.FileReader)) {
        $scope.global.error = "There are some components your browser doesn't support that we use to validate tickets. Please use another browser.";
      }
      
      //go get all pages to be used in the quick search
      $http.post('/global',{type:"init"})
      .success(function(ret) {
        if (!ret.success) {
          $scope.allPages=[];
          console.log(ret);
        } else {
          $scope.allPages = ret.allpages;
          angular.element( 'select.allpages' ).autocompleteselect({
            placeholder: "Quick Page Search (3 character minimum)",
            inputclasses: "form-control input-xs"
          });
        }
      })
      .error(function(data,err) {
        console.log(data,err);
        //angular.element( '#loader' ).remove();
      });
    },
    
    setSearchQuery: function() {
      $scope.query = (location.pathname.indexOf("/search/")==0) ? decodeURI(location.pathname.replace("/search/","").replace("/","")) : "";
    }
  };
  
  $scope.handlers= {
    quickSearchSelect: function(path) {
      new Core.Modals().alertPopup({loading:true});
      location.href = path.path;
    },
    
    search: function(query) {
      query = query || "";
      if (query.length) {
        location.href = "/search/" + query;
      } else {
        $scope.searchError = "Please include some text to search the wiki for.";
      }
    }
  }
  
  $scope.functions.initialize();
}