import numpy as np
import cv2
from insightface.app import FaceAnalysis
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
import urllib.request

app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))

urllib.request.urlretrieve("https://raw.githubusercontent.com/deepinsight/insightface/master/sample-images/t1.jpg", "test_face.jpg")
img = cv2.imread("test_face.jpg")

faces = app.get(img)
for face in faces:
    print("Landmarks 2d (from 2d106):", hasattr(face, "landmark_2d_106") and face.landmark_2d_106 is not None)
    print("kps shape:", face.kps.shape if hasattr(face, "kps") and face.kps is not None else None)
