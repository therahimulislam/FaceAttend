import cv2
import numpy as np
from insightface.app import FaceAnalysis

app = FaceAnalysis(name="buffalo_sc", allowed_modules=["detection", "landmark_2d_106"], providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))
print("Model loaded")

# create dummy image
img = np.zeros((640, 640, 3), dtype=np.uint8)
faces = app.get(img)
print(faces)
