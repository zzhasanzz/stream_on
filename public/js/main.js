const appid = "3b63469d3fa6462b9776c30c94160706";
const token = null;
const rtcUid = Math.floor(Math.random() * 2032)
const rtmUid = String(Math.floor(Math.random() * 2032))

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const videoPlayer = document.getElementById("video-player");
const notyf = new Notyf({ duration: 1500, position: { x: 'center', y: 'top' } });
let path, size;

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

let roomId = room;


let localTracks = [];
let remoteUsers = {};

let micMuted = true

let rtcClient;
let rtmClient;
let channel;


function onChangeFile() {
  const fileInput = document.getElementById("file-id");
  const file = fileInput.files[0];
  //check if a file is selected 
  if (file) {
    //create an object url for the selected file 
    path = (window.URL || window.webkitURL).createObjectURL(file);
    //get the size of the selected file 
    size = file.size;
    videoPlayer.setAttribute("src", path);
    console.log(path, size);
  } else {
    //no file selected 
    console.log("No file selected.");
  }
}

videoPlayer.addEventListener('play', videoControlsHandler);
videoPlayer.addEventListener('pause', videoControlsHandler);

//function to handle video Player events
function videoControlsHandler(e) {
  if (e.type == 'play') {
    socket.emit("playerControl", { message: "play", context: videoPlayer.currentTime, roomCode: room });
  } else if (e.type == 'pause') {
    socket.emit("playerControl", { message: "pause", context: videoPlayer.currentTime, roomCode: room });
  }
}

console.log(username, room);

const socket = io.connect('http://localhost:3000');

//Join Chatroom
socket.emit('joinRoom', { username, room });

//get room and users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

//message from server
socket.on('message', message => {
  console.log(message);
  outputMessage(message);
  //scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

//send control commands to server
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
  div.innerHTML = `<p class="meta">${message.username}<span>${message.time}</span></p>
  <p class="text">${message.text}</p>`;
  document.querySelector('.chat-messages').appendChild(div);
}

//Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

//Add users to DOM
function outputUsers(users) {
  userList.innerHTML = `${users.map(user => `<li>${user.username}</li>`).join('')}`;
}

//Copy room name
document.getElementById('room-name').addEventListener('click', () => {
  let text = roomName.innerHTML;
  navigator.clipboard.writeText(text).then(() => {
    notyf.success("Copied to clipboard");
  });
});

const initRtm = async (name) => {

  rtmClient = AgoraRTM.createInstance(appid)
  await rtmClient.login({ 'uid': rtmUid, 'token': token })

  channel = rtmClient.createChannel(roomId)
  await channel.join()

  await rtmClient.addOrUpdateLocalUserAttributes({ 'name': name, 'userRtcUid': rtcUid.toString() });

  //getChannelMembers()

  window.addEventListener('beforeunload', leaveRtmChannel)

  channel.on('MemberJoined', handleMemberJoined)
  channel.on('MemberLeft', handleMemberLeft)
}



const initRtc = async () => {
  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  // Subscribe to user-published and user-left events
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-left", handleUserLeft);

  // Join the RTC channel
  await rtcClient.join(appid, roomId, token, rtcUid);

  // Create local audio and video tracks
  localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();

  // Add the local video player to the DOM
  let player = document.getElementById(`user-container-${rtcUid}`);
  if (!player) {
      player = document.createElement('div');
      player.id = `user-container-${rtcUid}`;
      player.className = 'video-container';
      player.innerHTML = `<div class="video-player" id="user-${rtcUid}"></div>`;
      document.getElementById('video-streams').appendChild(player);
  }

  // Play the local video track
  localTracks[1].play(`user-${rtcUid}`);
  console.log('Local video track played:', localTracks[1]);

  // Publish the local audio and video tracks
  await rtcClient.publish(localTracks);
  console.log('Local tracks published:', localTracks);

  // Update UI elements
  document.getElementById('join-btn').style.display = 'none';
  document.getElementById('stream-controls').style.display = 'flex';
};

let handleUserPublished = async (user, mediaType) => {
  remoteUsers[user.uid] = user;
  await rtcClient.subscribe(user, mediaType);
  console.log('Subscribed to user:', user);

  if (mediaType === 'video') {
      let player = document.getElementById(`user-container-${user.uid}`);
      if (!player) {
          player = document.createElement('div');
          player.id = `user-container-${user.uid}`;
          player.className = 'video-container';
          player.innerHTML = `<div class="video-player" id="user-${user.uid}"></div>`;
          document.getElementById('video-streams').appendChild(player);
      }
      user.videoTrack.play(`user-${user.uid}`);
      console.log('Remote video track played for user:', user.uid);
  }

  if (mediaType === 'audio') {
      user.audioTrack.play();
      console.log('Remote audio track played for user:', user.uid);
  }
};


let handleUserLeft = async (user) => {
  delete remoteUsers[user.uid]
}

let handleMemberJoined = async (MemberId) => {

  let { name, userRtcUid } = await rtmClient.getUserAttributesByKeys(MemberId, ['name', 'userRtcUid'])

  let newMember = `
  <div class="speaker user-rtc-${userRtcUid}" id="${MemberId}">
      <p>${name}</p>
  </div>`

  document.getElementById("members").insertAdjacentHTML('beforeend', newMember)
}

let handleMemberLeft = async (MemberId) => {
  document.getElementById(MemberId).remove()
}

let getChannelMembers = async () => {
  let members = await channel.getMembers()

  for (let i = 0; members.length > i; i++) {

    let { name, userRtcUid } = await rtmClient.getUserAttributesByKeys(members[i], ['name', 'userRtcUid'])

    let newMember = `
    <div class="speaker user-rtc-${userRtcUid}" id="${members[i]}">
        <p>${name}</p>
    </div>`

    document.getElementById("members").insertAdjacentHTML('beforeend', newMember)
  }
}


let toggleMic = async (e) => {
  if (localTracks[0].muted) {
    await localTracks[0].setMuted(false)
    e.target.innerText = 'Mic on'
    e.target.style.backgroundColor = 'cadetblue'
  } else {
    await localTracks[0].setMuted(true)
    e.target.innerText = 'Mic off'
    e.target.style.backgroundColor = '#EE4B2B'
  }
}

let toggleCamera = async (e) => {
  if (localTracks[1].muted) {
    await localTracks[1].setMuted(false)
    e.target.innerText = 'Camera on'
    e.target.style.backgroundColor = 'cadetblue'
  } else {
    await localTracks[1].setMuted(true)
    e.target.innerText = 'Camera off'
    e.target.style.backgroundColor = '#EE4B2B'
  }
}

const enterRoom = async () => {

  window.history.replaceState(null, null, `?room=${roomId}`);

  initRtc()

  let displayName = username;
  initRtm(displayName);
}

let leaveRtmChannel = async () => {
  await channel.leave()
  await rtmClient.logout()
  document.getElementById('join-btn').style.display = 'block'
  document.getElementById('stream-controls').style.display = 'none'
  document.getElementById('video-streams').innerHTML = ''
}

let leaveRoom = async () => {
  for(let i = 0; localTracks.length > i; i++){
    localTracks[i].stop()
    localTracks[i].close()
  }
  rtcClient.unpublish()
  rtcClient.leave()

  leaveRtmChannel()
}


document.getElementById('join-btn').addEventListener('click', enterRoom)
document.getElementById('leave-btn').addEventListener('click', leaveRoom)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
