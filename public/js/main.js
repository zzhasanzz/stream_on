const APP_ID = "870cc2f1956a4dbf8161d9e3bcd4cd2d";
const TOKEN = "007eJxTYFBVe7kn+0xkebv6o2lnHM/dUu51aXPdwWR7V0rlvMzcXZ0KDBbmBsnJRmmGlqZmiSYpSWkWhmaGKZapxknJKSbJKUYpiVYpaQ2BjAxbf9swMTJAIIjPwpCbmJnHwAAAULEfpQ==";
const CHANNEL = "main";

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const videoPlayer = document.getElementById("video-player");
const notyf = new Notyf({ duration: 1500, position: { x: 'center', y: 'top' } });
let path, size;

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

let localTracks = [];
let remoteUsers = {};

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

function onChangeFile() {
  const fileInput = document.getElementById("file-id");
  const file = fileInput.files[0];

  if (file) {
    path = (window.URL || window.webkitURL).createObjectURL(file);
    size = file.size;
    videoPlayer.setAttribute("src", path);
    console.log(path, size);
  } else {
    console.log("No file selected.");
  }
}

videoPlayer.addEventListener('play', videoControlsHandler);
videoPlayer.addEventListener('pause', videoControlsHandler);

function videoControlsHandler(e) {
  if (e.type == 'play') {
    socket.emit("playerControl", { message: "play", context: videoPlayer.currentTime, roomCode: room });
  } else if (e.type == 'pause') {
    socket.emit("playerControl", { message: "pause", context: videoPlayer.currentTime, roomCode: room });
  }
}

console.log(username, room);

const socket = io.connect('http://localhost:3000');

socket.emit('joinRoom', { username, room });

socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

socket.on('message', message => {
  console.log(message);
  outputMessage(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('controlCommand', data => {
  if (data.message === 'play') {
    videoPlayer.play();
    videoPlayer.currentTime = data.context;
  } else if (data.message === 'pause') {
    videoPlayer.pause();
    videoPlayer.currentTime = data.context;
  }
});

chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const msg = e.target.elements.msg.value;
  socket.emit('chatMessage', msg);
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta">${message.username}<span>${message.time}</span></p>
  <p class="text">${message.text}</p>`;
  document.querySelector('.chat-messages').appendChild(div);
}

function outputRoomName(room) {
  roomName.innerText = room;
}

function outputUsers(users) {
  userList.innerHTML = `${users.map(user => `<li>${user.username}</li>`).join('')}`;
}

document.getElementById('room-name').addEventListener('click', () => {
  let text = roomName.innerHTML;
  navigator.clipboard.writeText(text).then(() => {
    notyf.success("Copied to clipboard");
  });
});

// Agora Video Chat Integration
let joinAndDisplayLocalStream = async () => {
    client.on('user-published', handleUserJoined);
    client.on('user-left', handleUserLeft);
    
    let UID = await client.join(APP_ID, CHANNEL, TOKEN, null);

    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();

    let player = `<div class="video-container" id="user-container-${UID}">
                        <div class="video-player" id="user-${UID}"></div>
                  </div>`;
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player);

    localTracks[1].play(`user-${UID}`);
    
    await client.publish([localTracks[0], localTracks[1]]);
}

let joinStream = async () => {
    await joinAndDisplayLocalStream();
    document.getElementById('join-btn').style.display = 'none';
    document.getElementById('stream-controls').style.display = 'flex';
}

let handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user 
    await client.subscribe(user, mediaType)

    if (mediaType === 'video'){
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player != null){
            player.remove()
        }

        player = `<div class="video-container" id="user-container-${user.uid}">
                        <div class="video-player" id="user-${user.uid}"></div> 
                 </div>`
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio'){
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()
}

let leaveAndRemoveLocalStream = async () => {
    for(let i = 0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()
    }

    await client.leave()
    document.getElementById('join-btn').style.display = 'block'
    document.getElementById('stream-controls').style.display = 'none'
    document.getElementById('video-streams').innerHTML = ''
}

let toggleMic = async (e) => {
    if (localTracks[0].muted){
        await localTracks[0].setMuted(false)
        e.target.innerText = 'Mic on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[0].setMuted(true)
        e.target.innerText = 'Mic off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

let toggleCamera = async (e) => {
    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)
        e.target.innerText = 'Camera on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[1].setMuted(true)
        e.target.innerText = 'Camera off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
