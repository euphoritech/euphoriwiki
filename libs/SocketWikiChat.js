var Authentication = require("./Authentication.js");
var ChatMessageHandler = require("./ChatMessageHandler.js");

/*-----------------------------------------------------------------------------------------
|TITLE:    SocketWikiChat.js
|PURPOSE:  
|AUTHOR:  Lance Whatley
|CALLABLE TAGS:
|ASSUMES:  
|REVISION HISTORY:  
|      *LJW 2/28/2015 - created
-----------------------------------------------------------------------------------------*/
SocketWikiChat = function(app,socket) {
  this.app = app;
  this.socket = socket;
  
  this.handler = {
    subscribe: getMessages.bind(this),
    getmoremessages: getMessages.bind(this),
    usertyping: userTyping.bind(this),
    chatmessage: chatMessage.bind(this),
    subchatmessage: subChatMessage.bind(this)
  }
}

/*-----------------------------------------------------------------------------------------
|NAME:      userTyping (PUBLIC)
|DESCRIPTION:  User is typing event
|PARAMETERS:  1. io(REQ): instance of socket.io in the app we can access info for
|             2. socket(REQ): The socket we can emit to, if needed
|             3. data(REQ): the data being returned by the client emit. This is string of what user is typing
|                       {room:room, val:<string of current info>}
|             4. SocketHandler(REQ): instance of SocketHandler we can use to do something
|CALLED FROM:  Nothing
|SIDE EFFECTS: Nothing
|ASSUMES:      Nothing
|RETURNS:      Nothing
-----------------------------------------------------------------------------------------*/
function userTyping(io,socket,data) {
  if (data.val.length>0) {
    socket.broadcast.to(data.room).emit('chatCtrl_usertyping',{id:socket.id, typing:true});
  } else {
    socket.broadcast.to(data.room).emit('chatCtrl_usertyping',{id:socket.id, typing:false});
  }
}

/*-----------------------------------------------------------------------------------------
|NAME:      chatMessage (PUBLIC)
|DESCRIPTION:  User created a message
|PARAMETERS:  1. io(REQ): instance of socket.io in the app we can access info for
|             2. socket(REQ): The socket we can emit to, if needed
|             3. data(REQ): the data being returned by the client emit. This is string of what user is typing
|                       {room:room, val:<string of current info>}
|             4. SocketHandler(REQ): instance of SocketHandler we can use to do something
|CALLED FROM:  Nothing
|SIDE EFFECTS: Nothing
|ASSUMES:      Nothing
|RETURNS:      Nothing
-----------------------------------------------------------------------------------------*/
function chatMessage(io,socket,data,SocketHandler) {
  var messageData={
    user: socket.request.session.username,
    name: socket.request.session.firstname + " " + socket.request.session.lastname,
    content: data.msg
  };
  
  new ChatMessageHandler({ namespace: io.name, room: data.room })
    .insert(messageData,function(_err,message) {
      if (_err) return log.error(_err);
      
      var mesID = message[0]._id;
      var name = message[0].name || message[0].guestname;
      var cont = message[0].content;
      var d = message[0].creationdate;
      
      var messageToSend = messageInformation({id:mesID, name:name, content:cont, date:d});
      io.to(data.room).emit('chatCtrl_chatmessage',messageToSend);
    }
  );
}

/*-----------------------------------------------------------------------------------------
|NAME:      subChatMessage (PUBLIC)
|DESCRIPTION:  User created a message
|PARAMETERS:  1. io(REQ): instance of socket.io in the app we can access info for
|             2. socket(REQ): The socket we can emit to, if needed
|             3. data(REQ): the data being returned by the client emit. This is string of what user is typing
|                       {room:room, val:<string of current info>}
|             4. SocketHandler(REQ): instance of SocketHandler we can use to do something
|CALLED FROM:  Nothing
|SIDE EFFECTS: Nothing
|ASSUMES:      Nothing
|RETURNS:      Nothing
-----------------------------------------------------------------------------------------*/
function subChatMessage(io,socket,data,SocketHandler) {
  var submessageData= {
    guestname: socket.request.session.firstname,
    primaryMessage: data.messageID,
    content: data.content
  };
  
  new ChatMessageHandler({ namespace: io.name, room: data.room })
    .insertSubmessage(submessageData,function(_err,submessage) {
      if (_err) return log.error(_err);
      
      io.to(data.room).emit('chatCtrl_addsubmessage',submessageData);
    }
  );
}

/*-----------------------------------------------------------------------------------------
|NAME:      getMessages (PUBLIC)
|DESCRIPTION:  Get Messages
|PARAMETERS:  1. io(REQ): instance of socket.io in the app we can access info for
|             2. socket(REQ): The socket we can emit to, if needed
|             3. data(REQ): the data being returned by the client emit. This is string of what user is typing
|                       {room:room, val:<string of current info>}
|             4. SocketHandler(REQ): instance of SocketHandler we can use to do something
|CALLED FROM:  Nothing
|SIDE EFFECTS: Nothing
|ASSUMES:      Nothing
|RETURNS:      Nothing
-----------------------------------------------------------------------------------------*/
function getMessages(io,socket,data,SocketHandler) {
  new ChatMessageHandler({ namespace: io.name, room: data.room })
    .findAll(data.page || 0,function(_err,messages) {
      if (_err) return log.error(_err);
      
      var messagesToSend=[];
      for (var _i=0;_i<messages.length;_i++) {
        messagesToSend.push(messageInformation({
          id: messages[_i]._id,
          name: messages[_i].name || messages[_i].guestname,
          content: messages[_i].content,
          date: messages[_i].creationdate,
          links: messages[_i].links
        }))
      }
      
      socket.emit('chatCtrl_messages',messagesToSend);
    });
}

/*-----------------------------------------------------------------------------------------
|NAME:      messageInformation (PUBLIC)
|DESCRIPTION:  Format messages
|PARAMETERS:  1. opts(REQ): options about a message
|CALLED FROM:  Nothing
|SIDE EFFECTS: Nothing
|ASSUMES:      Nothing
|RETURNS:      <object>
-----------------------------------------------------------------------------------------*/
function messageInformation(opts) {
  return {
    id: opts.id,
    date: opts.date,
    name: opts.name,
    message: opts.content,
    links: opts.links,
    submessages: opts.submessages
  };
}

//-------------------------------------------------------
//NodeJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports=SocketWikiChat;
}
//-------------------------------------------------------