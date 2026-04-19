from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
import hashlib
import sqlite3
from datetime import datetime
from google.cloud import firestore

app = Flask(__name__)
CORS(app)

# Firebase / Firestore configuration
FIRESTORE_PROJECT_ID = os.environ.get('FIRESTORE_PROJECT_ID', '').strip()
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS',
    os.path.join(os.path.dirname(__file__), 'credentials.json')
)

USE_FIRESTORE = False
try:
    if FIRESTORE_PROJECT_ID and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = GOOGLE_APPLICATION_CREDENTIALS
        db = firestore.Client(project=FIRESTORE_PROJECT_ID)
        USE_FIRESTORE = True
    else:
        db = None
except Exception as e:
    print(f'Could not initialize Firestore: {e}')
    db = None
    USE_FIRESTORE = False

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'decisions.db')


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE,
            createdAt TEXT NOT NULL
        )
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            option1Name TEXT NOT NULL,
            option2Name TEXT NOT NULL,
            pros1 TEXT NOT NULL,
            cons1 TEXT NOT NULL,
            pros2 TEXT NOT NULL,
            cons2 TEXT NOT NULL,
            share_code TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()


def generate_share_code():
    return str(uuid.uuid4())[:8].upper()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'time': datetime.utcnow().isoformat() + 'Z'
    })


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


@app.route('/')
def serve_index():
    return send_from_directory(ROOT_DIR, 'index.html')


@app.route('/share.html')
def serve_share():
    return send_from_directory(ROOT_DIR, 'share.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(ROOT_DIR, path)


@app.route('/api/decisions', methods=['POST'])
def create_decision():
    data = request.get_json()

    created_at = datetime.utcnow().isoformat() + 'Z'
    share_code = generate_share_code()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''
        INSERT INTO decisions (option1Name, option2Name, pros1, cons1, pros2, cons2, share_code, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            data['option1Name'],
            data['option2Name'],
            json.dumps(data['pros1']),
            json.dumps(data['cons1']),
            json.dumps(data['pros2']),
            json.dumps(data['cons2']),
            share_code,
            created_at
        )
    )
    conn.commit()
    decision_id = cursor.lastrowid
    conn.close()

    host_url = request.host_url.rstrip('/')

    return jsonify({
        'id': decision_id,
        'share_code': share_code,
        'share_url': f'{host_url}/share.html?code={share_code}',
        'createdAt': created_at
    }), 201


@app.route('/api/decisions/<decision_id>', methods=['GET'])
def get_decision(decision_id):
    conn = get_db_connection()
    decision = conn.execute(
        'SELECT * FROM decisions WHERE id = ?', (decision_id,)
    ).fetchone()
    conn.close()

    if decision is None:
        return jsonify({'error': 'Decision not found'}), 404

    return jsonify({
        'id': decision['id'],
        'option1Name': decision['option1Name'],
        'option2Name': decision['option2Name'],
        'pros1': json.loads(decision['pros1']),
        'cons1': json.loads(decision['cons1']),
        'pros2': json.loads(decision['pros2']),
        'cons2': json.loads(decision['cons2']),
        'createdAt': decision['createdAt']
    })


# 🔥 MOST IMPORTANT PART (FIXED FOR RENDER)
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)