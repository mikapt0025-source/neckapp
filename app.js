const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

const angleText = document.getElementById('angleText');
const weightText = document.getElementById('weightText');
const statusText = document.getElementById('statusText');
const tiltText = document.getElementById('tiltText');
const switchCamBtn = document.getElementById('switchCamBtn');
const saveSnapBtn = document.getElementById('saveSnapBtn');
const toggleTiltBtn = document.getElementById('toggleTiltBtn');
const gridOverlay = document.getElementById('gridOverlay');

const previewModal = document.getElementById('previewModal');
const previewImage = document.getElementById('previewImage');
const closePreviewBtn = document.getElementById('closePreviewBtn');

let currentFacingMode = 'user'; 
let camera = null;
let currentAngle = 0;
let currentLoadInfo = null;

let useTiltCheck = true; // 傾きチェックを行うかのフラグ
let isDeviceVertical = true;
let currentPitch = null;

// iOS向けセンサーの起動・許可リクエスト
function requestSensorPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    } else if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

function handleOrientation(event) {
    if (event.beta !== null) {
        currentPitch = Math.round(Math.abs(event.beta));
        // 85度〜95度の時だけ垂直と判定
        isDeviceVertical = (currentPitch >= 85 && currentPitch <= 95);
    }
}

// 画面のどこかを初めてタップした時にセンサー許可をリクエスト
document.body.addEventListener('click', () => {
    requestSensorPermission();
}, { once: true });

// 傾き制限 ON / OFF の切り替えボタン処理
toggleTiltBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // ボディのクリックイベントと重複させない
    requestSensorPermission();
    
    useTiltCheck = !useTiltCheck;
    if (useTiltCheck) {
        toggleTiltBtn.innerText = "📐 傾き制限: ON";
        toggleTiltBtn.style.backgroundColor = "rgba(52, 199, 89, 0.9)";
    } else {
        toggleTiltBtn.innerText = "📐 傾き制限: OFF";
        toggleTiltBtn.style.backgroundColor = "rgba(142, 142, 147, 0.9)";
        gridOverlay.classList.remove('is-level');
    }
});

function estimateNeckLoad(angle) {
    if (angle <= 5) return { weight: "4.5 〜 5", status: "正常（理想的な姿勢）", color: "#2ea44f" };
    if (angle <= 15) return { weight: "約 12", status: "軽度の負荷（少し前傾）", color: "#e3b341" };
    if (angle <= 30) return { weight: "約 18", status: "中等度の負荷（デスクワーク時など）", color: "#f85149" };
    if (angle <= 45) return { weight: "約 22", status: "重度の負荷（ストレートネック傾向）", color: "#da3633" };
    return { weight: "約 27", status: "危険（強い負荷がかかっています）", color: "#8b0000" };
}

function onResults(results) {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    currentLoadInfo = null;
    currentAngle = 0;

    // 傾きの数値表示
    if (currentPitch !== null) {
        tiltText.innerText = `📱 スマホ傾き: ${currentPitch}° (目標: 90°)`;
    } else {
        tiltText.innerText = `📱 画面タップで傾き検知開始`;
    }

    // 傾きチェックがONかつ、垂直でない場合の処理
    if (useTiltCheck) {
        if (isDeviceVertical) {
            gridOverlay.classList.add('is-level');
        } else {
            gridOverlay.classList.remove('is-level');
            statusText.innerText = "📱 スマホをまっすぐ立ててください";
            statusText.style.color = "#f85149";
            weightText.innerText = "-- kg";
            angleText.innerText = "--";
            canvasCtx.restore();
            return;
        }
    }

    if (results.poseLandmarks) {
        const leftEar = results.poseLandmarks[7];
        const rightEar = results.poseLandmarks[8];
        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];

        let ear = leftEar.visibility > rightEar.visibility ? leftEar : rightEar;
        let shoulder = leftEar.visibility > rightEar.visibility ? leftShoulder : rightShoulder;

        if (ear.visibility > 0.5 && shoulder.visibility > 0.5) {
            const earX = ear.x * canvasElement.width;
            const earY = ear.y * canvasElement.height;
            const shoulderX = shoulder.x * canvasElement.width;
            const shoulderY = shoulder.y * canvasElement.height;

            const dx = Math.abs(earX - shoulderX);
            const dy = shoulderY - earY;
            currentAngle = Math.round(Math.atan2(dx, dy) * (180 / Math.PI));

            currentLoadInfo = estimateNeckLoad(currentAngle);

            angleText.innerText = currentAngle;
            weightText.innerText = `約 ${currentLoadInfo.weight} kg`;
            statusText.innerText = currentLoadInfo.status;
            statusText.style.color = currentLoadInfo.color;

            canvasCtx.beginPath();
            canvasCtx.moveTo(shoulderX, shoulderY);
            canvasCtx.lineTo(earX, earY);
            canvasCtx.strokeStyle = currentLoadInfo.color;
            canvasCtx.lineWidth = Math.max(6, canvasElement.width * 0.01);
            canvasCtx.stroke();

            canvasCtx.beginPath();
            canvasCtx.moveTo(shoulderX, shoulderY);
            canvasCtx.lineTo(shoulderX, shoulderY - (canvasElement.height * 0.25));
            canvasCtx.strokeStyle = "#007aff";
            canvasCtx.setLineDash([8, 8]);
            canvasCtx.lineWidth = Math.max(3, canvasElement.width * 0.005);
            canvasCtx.stroke();
            canvasCtx.setLineDash([]);
        } else {
            statusText.innerText = "耳と肩が映るよう真横を向いてください";
            statusText.style.color = "#666";
            weightText.innerText = "-- kg";
            angleText.innerText = "--";
        }
    }
    canvasCtx.restore();
}

const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({ 
    modelComplexity: 0, 
    smoothLandmarks: true, 
    minDetectionConfidence: 0.5, 
    minTrackingConfidence: 0.5 
});
pose.onResults(onResults);

function startCamera(facingMode) {
    if (camera) { camera.stop(); }
    camera = new Camera(videoElement, {
        onFrame: async () => { await pose.send({image: videoElement}); },
        facingMode: facingMode
    });
    camera.start();
}

switchCamBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    requestSensorPermission();
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera(currentFacingMode);
});

saveSnapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentLoadInfo) {
        alert("負荷が計測されていません。真横を向き、スマホを垂直にして撮影してください。");
        return;
    }

    const saveCanvas = document.createElement('canvas');
    saveCanvas.width = canvasElement.width;
    saveCanvas.height = canvasElement.height;
    const saveCtx = saveCanvas.getContext('2d');

    saveCtx.drawImage(canvasElement, 0, 0);

    const padding = saveCanvas.width * 0.05;
    const boxHeight = saveCanvas.height * 0.22;

    saveCtx.fillStyle = "rgba(0, 0, 0, 0.65)";
    saveCtx.fillRect(padding, padding, saveCanvas.width - (padding * 2), boxHeight);

    saveCtx.fillStyle = "#fff";
    saveCtx.font = `bold ${saveCanvas.width * 0.045}px sans-serif`;
    saveCtx.fillText("首への推定負荷", padding + 20, padding + (boxHeight * 0.25));

    saveCtx.fillStyle = currentLoadInfo.color;
    saveCtx.font = `bold ${saveCanvas.width * 0.12}px sans-serif`;
    saveCtx.fillText(`約 ${currentLoadInfo.weight} kg`, padding + 20, padding + (boxHeight * 0.6));

    saveCtx.fillStyle = "#fff";
    saveCtx.font = `${saveCanvas.width * 0.04}px sans-serif`;
    saveCtx.fillText(`前傾角度: ${currentAngle}°  |  ${currentLoadInfo.status}`, padding + 20, padding + (boxHeight * 0.85));

    previewImage.src = saveCanvas.toDataURL('image/png');
    previewModal.style.display = 'flex';
});

closePreviewBtn.addEventListener('click', () => {
    previewModal.style.display = 'none';
    previewImage.src = '';
});

startCamera(currentFacingMode);
