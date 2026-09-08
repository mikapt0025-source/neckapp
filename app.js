const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

const angleText = document.getElementById('angleText');
const weightText = document.getElementById('weightText');
const statusText = document.getElementById('statusText');
const switchCamBtn = document.getElementById('switchCamBtn');

let currentFacingMode = 'user'; // 'user'(インカメラ) または 'environment'(アウトカメラ)
let camera = null;

// 角度から首の負荷(kg)を決定する関数
function estimateNeckLoad(angle) {
    if (angle <= 5) return { weight: "4.5 〜 5", status: "正常（理想的な姿勢）", color: "#2ea44f" };
    if (angle <= 15) return { weight: "約 12", status: "軽度の負荷（少し前傾）", color: "#e3b341" };
    if (angle <= 30) return { weight: "約 18", status: "中等度の負荷（デスクワーク時など）", color: "#f85149" };
    if (angle <= 45) return { weight: "約 22", status: "重度の負荷（ストレートネック傾向）", color: "#da3633" };
    return { weight: "約 27", status: "危険（強い負荷がかかっています）", color: "#8b0000" };
}

// MediaPipe解析結果の描画ロジック
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // 左右のうち、カメラによく映っている側の「耳」と「肩」を自動選択
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

            // 垂直線に対する前傾角度を計算
            const dx = Math.abs(earX - shoulderX);
            const dy = shoulderY - earY;
            let angle = Math.round(Math.atan2(dx, dy) * (180 / Math.PI));

            const loadInfo = estimateNeckLoad(angle);

            // UIの更新
            angleText.innerText = angle;
            weightText.innerText = `約 ${loadInfo.weight} kg`;
            statusText.innerText = loadInfo.status;
            statusText.style.color = loadInfo.color;

            // 骨格と垂直基準線の描画
            canvasCtx.beginPath();
            canvasCtx.moveTo(shoulderX, shoulderY);
            canvasCtx.lineTo(earX, earY);
            canvasCtx.strokeStyle = loadInfo.color;
            canvasCtx.lineWidth = 5;
            canvasCtx.stroke();

            // 垂直線（点線）
            canvasCtx.beginPath();
            canvasCtx.moveTo(shoulderX, shoulderY);
            canvasCtx.lineTo(shoulderX, shoulderY - 120);
            canvasCtx.strokeStyle = "#007aff";
            canvasCtx.setLineDash([6, 6]);
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
            canvasCtx.setLineDash([]);
        } else {
            statusText.innerText = "耳と肩が映るよう真横を向いてください";
            statusText.style.color = "#666";
        }
    }
    canvasCtx.restore();
}

// AIモデル初期化
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
pose.onResults(onResults);

// カメラ起動処理
function startCamera(facingMode) {
    if (camera) { camera.stop(); }
    camera = new Camera(videoElement, {
        onFrame: async () => { await pose.send({image: videoElement}); },
        width: 480,
        height: 640,
        facingMode: facingMode
    });
    camera.start();
}

// カメラ切替ボタンのイベント
switchCamBtn.addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera(currentFacingMode);
});

// 初回起動
startCamera(currentFacingMode);
