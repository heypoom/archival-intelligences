from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import cv2

app = FastAPI()


@app.get("/stream")
async def stream_image():
    cap = cv2.VideoCapture(0)

    async def generate_frames():
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            ret, buffer = cv2.imencode(".jpg", frame)
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")

    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
