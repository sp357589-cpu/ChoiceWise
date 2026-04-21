from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
import hashlib
import sqlite3
import tempfile
from datetime import datetime
from google.cloud import firestore

app = Flask(__name__)
CORS(app)

# Firebase / Firestore configuration
FIRESTORE_PROJECT_ID = os.environ.get('FIRESTORE_PROJECT_ID', '').strip()
FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()

def _maybe_write_service_account_json() -> str | None:
    """
    Render-friendly: allow providing service account JSON via env var.
    Writes it to a temp file and returns the path.
    """
    if not FIREBASE_SERVICE_ACCOUNT_JSON:
        return None
    try:
        json.loads(FIREBASE_SERVICE_ACCOUNT_JSON)
    except Exception:
        print('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
        return None

    path = os.path.join(tempfile.gettempdir(), 'firestore-service-account.json')
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(FIREBASE_SERVICE_ACCOUNT_JSON)
        return path
    except Exception as e:
        print(f'Could not write service account file: {e}')
        return None

if not os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
    maybe_path = _maybe_write_service_account_json()
    if maybe_path:
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = maybe_path

GOOGLE_APPLICATION_CREDENTIALS = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS',
    os.path.join(os.path.dirname(__file__), 'credentials.json')
)

USE_FIRESTORE = False
try:
    if FIRESTORE_PROJECT_ID and os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
        db = firestore.Client(project=FIRESTORE_PROJECT_ID)
        USE_FIRESTORE = True
    else:
        db = None
except Exception as e:
    print(f'Could not initialize Firestore: {e}')
    db = None
    USE_FIRESTORE = False

DEFAULT_SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'decisions.db')
# Allow overriding DB path for production (e.g., persistent disk mount)
DATABASE_PATH = os.environ.get('DATABASE_PATH', DEFAULT_SQLITE_PATH).strip() or DEFAULT_SQLITE_PATH


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

def ensure_db_initialized():
    # Idempotent and safe to call multiple times (CREATE TABLE IF NOT EXISTS)
    # Only applies to SQLite mode; Firestore is handled separately.
    if USE_FIRESTORE:
        return
    try:
        init_db()
    except Exception as e:
        print(f'Could not initialize SQLite DB: {e}')


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

    if USE_FIRESTORE and db is not None:
        doc_ref = db.collection('decisions').document()
        doc_ref.set({
            'option1Name': data['option1Name'],
            'option2Name': data['option2Name'],
            'pros1': data['pros1'],
            'cons1': data['cons1'],
            'pros2': data['pros2'],
            'cons2': data['cons2'],
            'share_code': share_code,
            'createdAt': created_at,
        })
        host_url = request.host_url.rstrip('/')
        return jsonify({
            'id': doc_ref.id,
            'share_code': share_code,
            'share_url': f'{host_url}/share.html?code={share_code}',
            'createdAt': created_at
        }), 201

    ensure_db_initialized()
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


@app.route('/api/decisions', methods=['GET'])
def list_decisions():
    if USE_FIRESTORE and db is not None:
        docs = (
            db.collection('decisions')
            .order_by('createdAt', direction=firestore.Query.DESCENDING)
            .stream()
        )
        out = []
        for d in docs:
            data = d.to_dict() or {}
            out.append({
                'id': d.id,
                'option1Name': data.get('option1Name'),
                'option2Name': data.get('option2Name'),
                'share_code': data.get('share_code'),
                'createdAt': data.get('createdAt'),
            })
        return jsonify(out)

    ensure_db_initialized()
    conn = get_db_connection()
    rows = conn.execute(
        'SELECT id, option1Name, option2Name, share_code, createdAt FROM decisions ORDER BY id DESC'
    ).fetchall()
    conn.close()
    return jsonify([
        {
            'id': row['id'],
            'option1Name': row['option1Name'],
            'option2Name': row['option2Name'],
            'share_code': row['share_code'],
            'createdAt': row['createdAt'],
        }
        for row in rows
    ])


@app.route('/api/decisions/<decision_id>', methods=['GET'])
def get_decision(decision_id):
    if USE_FIRESTORE and db is not None:
        snap = db.collection('decisions').document(decision_id).get()
        if not snap.exists:
            return jsonify({'error': 'Decision not found'}), 404
        data = snap.to_dict() or {}
        return jsonify({
            'id': snap.id,
            'option1Name': data.get('option1Name'),
            'option2Name': data.get('option2Name'),
            'pros1': data.get('pros1') or [],
            'cons1': data.get('cons1') or [],
            'pros2': data.get('pros2') or [],
            'cons2': data.get('cons2') or [],
            'share_code': data.get('share_code'),
            'createdAt': data.get('createdAt'),
        })

    ensure_db_initialized()
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
        'share_code': decision['share_code'],
        'createdAt': decision['createdAt']
    })


@app.route('/api/decisions/<decision_id>/share', methods=['POST'])
def share_decision(decision_id):
    if USE_FIRESTORE and db is not None:
        doc_ref = db.collection('decisions').document(decision_id)
        snap = doc_ref.get()
        if not snap.exists:
            return jsonify({'error': 'Decision not found'}), 404
        data = snap.to_dict() or {}
        share_code = data.get('share_code') or generate_share_code()
        if not data.get('share_code'):
            doc_ref.set({'share_code': share_code}, merge=True)
        host_url = request.host_url.rstrip('/')
        return jsonify({
            'id': decision_id,
            'share_code': share_code,
            'share_url': f'{host_url}/share.html?code={share_code}',
        })

    ensure_db_initialized()
    conn = get_db_connection()
    decision = conn.execute(
        'SELECT id, share_code FROM decisions WHERE id = ?', (decision_id,)
    ).fetchone()
    if decision is None:
        conn.close()
        return jsonify({'error': 'Decision not found'}), 404

    share_code = decision['share_code'] or generate_share_code()
    if not decision['share_code']:
        conn.execute('UPDATE decisions SET share_code = ? WHERE id = ?', (share_code, decision_id))
        conn.commit()
    conn.close()

    host_url = request.host_url.rstrip('/')
    return jsonify({
        'id': int(decision_id) if str(decision_id).isdigit() else decision_id,
        'share_code': share_code,
        'share_url': f'{host_url}/share.html?code={share_code}',
    })


@app.route('/api/decisions/share/<share_code>', methods=['GET'])
def get_shared_decision(share_code):
    if USE_FIRESTORE and db is not None:
        query = db.collection('decisions').where('share_code', '==', share_code).limit(1).stream()
        snap = next(query, None)
        if snap is None:
            return jsonify({'error': 'Shared decision not found'}), 404
        data = snap.to_dict() or {}
        return jsonify({
            'id': snap.id,
            'option1Name': data.get('option1Name'),
            'option2Name': data.get('option2Name'),
            'pros1': data.get('pros1') or [],
            'cons1': data.get('cons1') or [],
            'pros2': data.get('pros2') or [],
            'cons2': data.get('cons2') or [],
            'share_code': data.get('share_code'),
            'createdAt': data.get('createdAt'),
        })

    ensure_db_initialized()
    conn = get_db_connection()
    decision = conn.execute(
        'SELECT * FROM decisions WHERE share_code = ?', (share_code,)
    ).fetchone()
    conn.close()

    if decision is None:
        return jsonify({'error': 'Shared decision not found'}), 404

    return jsonify({
        'id': decision['id'],
        'option1Name': decision['option1Name'],
        'option2Name': decision['option2Name'],
        'pros1': json.loads(decision['pros1']),
        'cons1': json.loads(decision['cons1']),
        'pros2': json.loads(decision['pros2']),
        'cons2': json.loads(decision['cons2']),
        'share_code': decision['share_code'],
        'createdAt': decision['createdAt']
    })


@app.route('/api/auth/signup', methods=['POST'])
def signup():
    if USE_FIRESTORE and db is not None:
        data = request.get_json() or {}
        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()
        email = data.get('email')
        email = (email.strip() if isinstance(email, str) else None)

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        existing = list(db.collection('users').where('username', '==', username).limit(1).stream())
        if existing:
            return jsonify({'error': 'Username or email already exists'}), 409

        created_at = datetime.utcnow().isoformat() + 'Z'
        doc_ref = db.collection('users').document()
        doc_ref.set({
            'username': username,
            'password': hash_password(password),
            'email': email,
            'createdAt': created_at,
        })
        return jsonify({'id': doc_ref.id, 'username': username, 'email': email, 'createdAt': created_at}), 201

    ensure_db_initialized()
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    email = data.get('email')
    email = (email.strip() if isinstance(email, str) else None)

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    created_at = datetime.utcnow().isoformat() + 'Z'
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (username, password, email, createdAt) VALUES (?, ?, ?, ?)',
            (username, hash_password(password), email, created_at)
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 409
    finally:
        try:
            conn.close()
        except Exception:
            pass

    return jsonify({'id': user_id, 'username': username, 'email': email, 'createdAt': created_at}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    if USE_FIRESTORE and db is not None:
        data = request.get_json() or {}
        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        matches = list(db.collection('users').where('username', '==', username).limit(1).stream())
        if not matches:
            return jsonify({'error': 'Invalid username or password'}), 401

        snap = matches[0]
        user = snap.to_dict() or {}
        if user.get('password') != hash_password(password):
            return jsonify({'error': 'Invalid username or password'}), 401

        return jsonify({
            'id': snap.id,
            'username': user.get('username'),
            'email': user.get('email'),
            'createdAt': user.get('createdAt'),
        })

    ensure_db_initialized()
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db_connection()
    user = conn.execute(
        'SELECT id, username, email, password, createdAt FROM users WHERE username = ?',
        (username,)
    ).fetchone()
    conn.close()

    if user is None:
        return jsonify({'error': 'Invalid username or password'}), 401

    if user['password'] != hash_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'createdAt': user['createdAt'],
    })


# 🔥 MOST IMPORTANT PART (FIXED FOR RENDER)
if __name__ == '__main__':
    ensure_db_initialized()
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)

# Ensure DB exists when running under gunicorn as an import.
ensure_db_initialized()