const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
var videoPlayer = document.getElementById("video-player")
const notyf = new Notyf({ duration: 1500, position: { x: 'center', y: 'top' } })
var path, size;

//Get username and room from URL
const { username, room } = Qs.parse(location.search, {
    ignoreQueryPrefix: true
});

function onChangeFile() {
    const fileInput = document.getElementById("file-id");
    const file = fileInput.files[0];

    // Check if a file is selected
    if (file) {
        // Create an object URL for the selected file
        path = (window.URL || window.webkitURL).createObjectURL(file);

        // Get the size of the selected file
        size = file.size;
        videoPlayer.setAttribute("src", path);
        console.log(path, size);
    } else {
        // Handle the case where no file is selected
        console.log("No file selected.");
    }
}
//Store videoSize and path in localStorage
videoPlayer.addEventListener('play', videoControlsHandler);
videoPlayer.addEventListener('pause', videoControlsHandler);

// Function to handle video player events
function videoControlsHandler(e) {
    if (e.type == 'play') {
        socket.emit("playerControl", { message: "play", context: videoPlayer.currentTime, roomCode: room });
    } else if (e.type == 'pause') {
        socket.emit("playerControl", { message: "pause", context: videoPlayer.currentTime, roomCode: room });
    }
}

console.log(username, room);

const socket = io.connect('http://localhost:3000');

//Join chatroom
socket.emit('joinRoom', { username, room} );

// Get room and users
socket.on('roomUsers', ({ room, users}) => {
    outputRoomName(room);
    outputUsers(users);
})

//Message from server
socket.on('message', (message) => {
    console.log(message);
    outputMessage(message);

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

//send control commands to the server
socket.on('controlCommand', (data) => {
    if (data.message === 'play') {
        videoPlayer.play();
        videoPlayer.currentTime = data.context; 
    } else if (data.message === 'pause') {
        videoPlayer.pause();
        videoPlayer.currentTime = data.context; 
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    //get message text 
    const msg = e.target.elements.msg.value;

    //emit message to server
    socket.emit('chatMessage', msg);

    //clear input
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
});

//output message to DOM
function outputMessage(message) { 
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta">${message.username}<span>${ message.time}</span></p>
    <p class="text">
        ${message.text}
    </p>`;
    document.querySelector('.chat-messages').appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
    roomName.innerText = room;
}

//Add users to DOM
function outputUsers(users) {
    userList.innerHTML = `
        ${users.map(user => `<li>${user.username}</li>`).join('')}
    `;
}

//Copy room name
document.getElementById('room-name').addEventListener('click', ()=>{
    let text = roomName.innerHTML
    navigator.clipboard.writeText(text).then(()=>{
        notyf.success("Copied to clipboard")
    })
})

