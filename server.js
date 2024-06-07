const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');

//userJoin object => id, username, room
//getCurrentUser => function to find user according to username

const app = express();

const botName =  'streamON Bot';
//set static folder
app.use(express.static(path.join(__dirname, 'public')));

var server = app.listen(3000, function(){
    console.log('listening for requests on port 3000,');
});

var io = socketio(server);

//run when client connects
io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room );
        socket.join(user.room);

        //Welcome current user
        socket.emit('message', formatMessage(botName, 'Welcome to streamON!'));

        //Broadcast when a user connects
        socket.broadcast
        .to(user.room)
        .emit('message', formatMessage(botName, `${user.username} has joined the chat`));

        //Send users and room information
        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });
    });

    socket.on('playerControl', (data) => {
        io.to(data.roomCode).emit('controlCommand', { message: data.message, context: data.context });
    });

    socket.on('audioControl', (data) => {
        io.to(data.roomCode).emit('audioCommand', { message: data.message, context: data.context });
    });

    // console.log('made socket connection', socket.id);

    //Listen for chatMessage
    socket.on('chatMessage', (msg) => {
        const user = getCurrentUser(socket.id);
        io.to(user.room).emit('message', formatMessage(user.username, msg));
    });

    //Runs when client disconnects
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            io.to(user.room).emit('message',formatMessage(botName, `${user.username} has left the chat`));

            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        }
    });
}); 