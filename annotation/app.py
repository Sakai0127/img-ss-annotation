import base64
from io import BytesIO
import json
import os
import pickle
import xml.etree.ElementTree as ET

import cv2
from flask import Flask, jsonify, render_template, request, session, make_response, send_file
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import numpy as np
from PIL import Image
from oauth2client.contrib import flask_util
import requests

BASE_URL = 'https://safebooru.org/index.php?page=dapi&s=post&q=index'
SAVE_DIR_NAME ='SS-annotation'
with open('annotation/static/label-name.json', 'r') as f:
    LABEL_NAME = json.load(f)['labels']
try:
    with open('annotation/client_secret.json', 'rb') as f:
        secrets = json.load(f)
        os.environ['GOOGLE_OAUTH2_'+'client_id'.upper()] = secrets['web']['client_id']
        os.environ['GOOGLE_OAUTH2_'+'client_secret'.upper()] = secrets['web']['client_secret']
except FileNotFoundError:
    pass

app = Flask(__name__)

app.config['SECRET_KEY'] = os.urandom(24)
app.config['GOOGLE_OAUTH2_CLIENT_ID'] = os.environ.get('GOOGLE_OAUTH2_CLIENT_ID', None)
app.config['GOOGLE_OAUTH2_CLIENT_SECRET'] = os.environ.get('GOOGLE_OAUTH2_CLIENT_SECRET', None)

g_oauth = flask_util.UserOAuth2(app)

def get_savedata(post_data):
    data = {}
    data['mask'] = {}
    if post_data['safebooru']:
        img = requests.get(BASE_URL + '&id=' + post_data['name'])
        elem = ET.fromstring(img.text)
        src_url = elem[0].get('file_url')
        data['url'] = src_url
    masks = post_data['imgs']
    colors = post_data['colors']
    for (key, img) in masks.items():
        mask_img = Image.open(BytesIO(base64.b64decode(img.split(',')[-1]))).convert('RGB')
        mask_img = np.array(mask_img)
        mask_array = np.all(mask_img == colors['fg'], 2).astype(np.uint8)
        data['mask'][key] = mask_array
    return data

@app.route('/')
def index():
    return render_template('index.html', img_path='static/images/no-img.png', label_name=LABEL_NAME, img_id=3090260)

@app.route('/get-img', methods=['POST'])
def get_img():
    img_id = request.json['id']
    img = requests.get(BASE_URL + '&id=' + img_id)
    elem = ET.fromstring(img.text)
    src_url = elem[0].get('file_url')
    res = requests.get(src_url)
    byte_list = BytesIO(res.content)
    b64_encode = base64.b64encode(byte_list.getvalue()).decode().replace("'", "")
    result_data = dict(
        img='data:image/png;base64,'+b64_encode,
    )
    return jsonify(ResultSet=json.dumps(result_data))

@app.route('/grabcut', methods=['POST'])
def grabcut():
    data = request.json
    src_img = data['src_img']
    mask_img = data['mask_img']
    src_img = Image.open(BytesIO(base64.b64decode(src_img.split(',')[-1]))).convert('RGB')
    mask_img = Image.open(BytesIO(base64.b64decode(mask_img.split(',')[-1]))).convert('RGB')
    src_arr = np.array(src_img)
    mask_arr = np.array(mask_img)
    mask_arr_gc = np.full(mask_arr.shape[:2], cv2.GC_PR_FGD, dtype=np.uint8)
    for l in ['fg', 'bg', 'pfg', 'pbg']:
        color = data[l]
        idx = np.all(mask_arr == color, 2)
        mask_arr_gc[idx] = cv2.GC_FGD if l == 'fg' else cv2.GC_PR_FGD if l == 'pfg' else cv2.GC_BGD if l == 'bg' else cv2.GC_PR_BGD
    cv2.grabCut(src_arr, mask_arr_gc, None, np.zeros((1,65),np.float64), np.zeros((1,65),np.float64), 1, cv2.GC_INIT_WITH_MASK)
    mask_arr[mask_arr_gc == cv2.GC_FGD] = data['fg']
    mask_arr[mask_arr_gc == cv2.GC_PR_FGD] = data['pfg']
    mask_arr[mask_arr_gc == cv2.GC_BGD] = data['bg']
    mask_arr[mask_arr_gc == cv2.GC_PR_BGD] = data['pbg']
    mask_img = Image.fromarray(mask_arr)
    mask_img.save('test_mask.png')
    buffer = BytesIO()
    mask_img.save(buffer, format='PNG')
    b64_encode = base64.b64encode(buffer.getvalue()).decode().replace("'", "")
    result_data = dict(
        mask='data:image/png;base64,'+b64_encode,
    )
    return jsonify(ResultSet=json.dumps(result_data))

@app.route('/upload-google-drive', methods=['POST'])
@g_oauth.required(scopes=['https://www.googleapis.com/auth/drive.file'])
def upload():
    post_data = request.json
    drive = build('drive', 'v3', http=g_oauth.http())
    if 'save_dir_id' in session:
        dir_id = session['save_dir_id']
    else:
        folder = drive.files().list(q='name = \'%s\' and mimeType = \'application/vnd.google-apps.folder\''%(SAVE_DIR_NAME)).execute()
        folder = folder.get('files', [])
        if folder:
            folder = folder[0]
        else:
            file_metadata = {
                'name': SAVE_DIR_NAME,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = drive.files().create(body=file_metadata, fields='id').execute()
        dir_id = folder['id']
        session['save_dir_id'] = dir_id
    buffer = BytesIO()
    pickle.dump(get_savedata(post_data), buffer)
    up_file = MediaIoBaseUpload(buffer, mimetype='application/octet-stream', resumable=True)
    meta_data = {
        'name':post_data['name']+'.pkl',
        'parents':[dir_id],
    }
    res = drive.files().create(body=meta_data, media_body=up_file, fields='id').execute()
    return jsonify(result=json.dumps({'r':'success'}))

@app.route('/download', methods=['POST'])
def download():
    post_data = request.json
    buffer = BytesIO()
    pickle.dump(get_savedata(post_data), buffer)
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, attachment_filename=post_data['name']+'.pkl')

if __name__ == "__main__":
    app.run(debug=True)