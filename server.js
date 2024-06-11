const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');

//userJoin object => id, username, room
//getCurrentUser => function to find user according to username

const app = express();

app.use(
    cors ({
        origin: '*',
    })
)

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

        socket.on('fileUpload', async (fileData) => {
            try {
                const formData = new FormData();
                const file = new File([fileData.data], fileData.name, { type: fileData.type });
                formData.append('file', file);
        
                const response = await fetch("https://file.io/?expires=1d", {
                    method: "POST",
                    body: formData
                });
        
                const data = await response.json();
                console.log(data);
        
                if (response.ok) {
                    io.to(user.room).emit('fileShared', { username: user.username, fileUrl: data.link, fileName: fileData.name });
                } else {
                    socket.emit('message', formatMessage(botName, 'File upload failed.'));
                }
            } catch (error) {
                console.error(error);
                socket.emit('message', formatMessage(botName, 'File upload failed.'));
            }
        });        
    });

    socket.on('playerControl', (data) => {
        io.to(data.roomCode).emit('controlCommand', { message: data.message, context: data.context });
    });

    socket.on('audioControl', (data) => {
        io.to(data.roomCode).emit('audioCommand', { message: data.message, context: data.context });
    });

    socket.on('pomodoroControl', data => {
        io.to(data.roomCode).emit('pomodoroCommand', { action: data.action, timeLeft: data.timeLeft });
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