const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
var audioPlayer = document.getElementById("audio-player");
const audioSource = document.getElementById("audioSrc");
const notyf = new Notyf({ duration: 1500, position: { x: 'center', y: 'top' } });
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file-btn');
var path, size;

// Get username and room from URL
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

        audioSource.src = path;
        audioPlayer.load();
        console.log(path, size);
    } else {
        // Handle the case where no file is selected
        console.log("No file selected.");
    }
}

audioPlayer.addEventListener('play', audioControlsHandler);
audioPlayer.addEventListener('pause', audioControlsHandler);

function audioControlsHandler(e) {
    if (e.type === 'play') {
        socket.emit("audioControl", { message: "play", context: audioPlayer.currentTime, roomCode: room });
    } else if (e.type === 'pause') {
        socket.emit("audioControl", { message: "pause", context: audioPlayer.currentTime, roomCode: room });
    }
}

console.log(username, room);

const socket = io.connect('http://localhost:3000');

// Join chatroom
socket.emit('joinRoom', { username, room });

// Get room and users
socket.on('roomUsers', ({ room, users }) => {
    outputRoomName(room);
    outputUsers(users);
});

// Message from server
socket.on('message', (message) => {
    console.log(message);
    outputMessage(message);

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Send control commands to the server
socket.on('audioCommand', (data) => {
    if (data.message === 'play') {
        audioPlayer.play();
        audioPlayer.currentTime = data.context;
    } else if (data.message === 'pause') {
        audioPlayer.pause();
        audioPlayer.currentTime = data.context;
    }
});

// File shared
socket.on('fileShared', ({ username, fileUrl, fileName }) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta">${username}</p>
    <p class="text"><a href="${fileUrl}" target="_blank">${fileName}</a></p>`;
    document.querySelector('.chat-messages').appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Get message text
    const msg = e.target.elements.msg.value;

    // Emit message to server
    socket.emit('chatMessage', msg);

    // Clear input
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
});

//send File button
sendFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        socket.emit('fileUpload', {
          data: e.target.result,
          name: file.name,
          type: file.type
        });
      };
      reader.readAsArrayBuffer(file);
      fileInput.value = ''; // Clear the file input
    }
  });

// Output message to DOM
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta">${message.username}<span>${message.time}</span></p>
    <p class="text">
        ${message.text}
    </p>`;
    document.querySelector('.chat-messages').appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
    roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
    userList.innerHTML = `
        ${users.map(user => `<li>${user.username}</li>`).join('')}
    `;
}

// Copy room name
document.getElementById('room-name').addEventListener('click', () => {
    let text = roomName.innerHTML;
    navigator.clipboard.writeText(text).then(() => {
        notyf.success("Copied to clipboard");
    });
});

// Pomodoro Timer
const timerDisplay = document.getElementById('pomodoro-timer');
const startButton = document.getElementById('start-pomodoro');
const pauseButton = document.getElementById('pause-pomodoro');
const resetButton = document.getElementById('reset-pomodoro');

let intervalId;
let timeLeft = 25* 60; // Initial time for work session
let workTime = 25* 60;
let shortBreak = 5 * 60;
let longBreak = 15 * 60;
let cycles = 0;
let isWorkTime = true;
let isPaused = false;

function startTimer(duration, display) {
    let timer = duration, minutes, seconds;

    clearInterval(intervalId); // Clear any existing interval
    intervalId = setInterval(() => {
        if (!isPaused) {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            display.textContent = minutes + ":" + seconds;

            if (--timer < 0) {
                clearInterval(intervalId);
                if (isWorkTime) {
                    cycles++;
                    if (cycles % 4 === 0) {
                        notyf.success("It's time for a long break!");
                        timeLeft = longBreak;
                    } else {
                        notyf.success("It's time for a short break!");
                        timeLeft = shortBreak;
                    }
                } else {
                    notyf.success("Break time is over, back to work!");
                    timeLeft = workTime;
                }
                isWorkTime = !isWorkTime;
                isPaused = true; // Pause the timer
                startButton.disabled = false;
                pauseButton.disabled = true;
                display.textContent = formatTime(timeLeft); // Display the next session's time
                return;
            }
            timeLeft = timer; // Update the remaining time
        }
    }, 1000);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes < 10 ? "0" + minutes : minutes}:${remainingSeconds < 10 ? "0" + remainingSeconds : remainingSeconds}`;
}



startButton.addEventListener('click', () => {
    if (!intervalId || isPaused) {
        isPaused = false;
        startTimer(timeLeft, timerDisplay);
        socket.emit('pomodoroControl', { action: 'start', timeLeft, roomCode: room });
    }
    startButton.disabled = true;
    pauseButton.disabled = false;
});

pauseButton.addEventListener('click', () => {
    isPaused = true;
    clearInterval(intervalId);
    intervalId = null;
    socket.emit('pomodoroControl', { action: 'pause', timeLeft, roomCode: room });
    startButton.disabled = false;
    pauseButton.disabled = true;
});

resetButton.addEventListener('click', () => {
    clearInterval(intervalId);
    intervalId = null;
    timeLeft = 25 * 60; // Reset to 25 minutes
    timerDisplay.textContent = formatTime(timeLeft);
    isWorkTime = true;
    cycles = 0;
    isPaused = false;
    socket.emit('pomodoroControl', { action: 'reset', roomCode: room });
    startButton.disabled = false;
    pauseButton.disabled = true;
});

socket.on('pomodoroCommand', data => {
    const { action, timeLeft: serverTimeLeft } = data;
    if (action === 'start') {
        isPaused = false;
        timeLeft = serverTimeLeft;
        startTimer(timeLeft, timerDisplay);
        startButton.disabled = true;
        pauseButton.disabled = false;
    } else if (action === 'pause') {
        isPaused = true;
        clearInterval(intervalId);
        intervalId = null;
        timeLeft = serverTimeLeft;
        startButton.disabled = false;
        pauseButton.disabled = true;
    } else if (action === 'reset') {
        clearInterval(intervalId);
        intervalId = null;
        timeLeft = 25 * 60; // Reset to 25 minutes
        timerDisplay.textContent = formatTime(timeLeft);
        isWorkTime = true;
        cycles = 0;
        isPaused = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
    }
});