import io
import cv2
import numpy as np
import requests

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from insightface.app import FaceAnalysis

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load InsightFace model
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=-1, det_size=(640, 640))


def get_embedding(image_bytes):
    image = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image, cv2.IMREAD_COLOR)

    if image is None:
        print("Image decode failed")
        return None

    print("Image Shape:", image.shape)

    faces = face_app.get(image)

    print("Faces Found:", len(faces))

    if len(faces) == 0:
        # RGB try
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        faces = face_app.get(rgb)
        print("Faces Found (RGB):", len(faces))

    if len(faces) == 0:
        return None

    faces = sorted(
        faces,
        key=lambda x: (x.bbox[2]-x.bbox[0])*(x.bbox[3]-x.bbox[1]),
        reverse=True
    )

    return faces[0].embedding

@app.post("/verify-face")
async def verify_face(
    voter_id: str = Form(...),
    photo_url: str = Form(...),
    file: UploadFile = File(...)
):
    print("\n========== VERIFY ==========")
    print("Voter:", voter_id)

    response = requests.get(photo_url)
    print("Final URL:", response.url)
    print("Response Text:")
    print(response.text[:500])

    # DEBUG PRINTS
    print("Photo URL:", photo_url)
    print("Status Code:", response.status_code)
    print("Content Type:", response.headers.get("content-type"))
    print("Image Size:", len(response.content))

    if response.status_code != 200:
        return {
            "success": False,
            "message": "Reference image download failed."
        }

    ref_embedding = get_embedding(response.content)

    if ref_embedding is None:
        return {
            "success": False,
            "message": "Reference photo mein face detect nahi hua."
        }

    live_bytes = await file.read()

    live_embedding = get_embedding(live_bytes)

    if live_embedding is None:
        return {
            "success": False,
            "message": "Live image mein face detect nahi hua."
        }

    similarity = np.dot(ref_embedding, live_embedding) / (
        np.linalg.norm(ref_embedding)
        * np.linalg.norm(live_embedding)
    )

    print("Similarity:", similarity)

    if similarity >= 0.55:
        return {
            "success": True,
            "message": "Face verified successfully!",
            "similarity": float(similarity)
        }

    return {
        "success": False,
        "message": "Face does not match.",
        "similarity": float(similarity)
    }


@app.get("/")
def home():
    return {
        "message": "Backend is running"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )