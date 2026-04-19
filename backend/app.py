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
    
    # Create users table if missing
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE,
            createdAt TEXT NOT NULL
        )
        '''
    )

    # Create decisions table if missing
    conn.execute(
        '''
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
        '''
    )

    # Migrate old SQLite table schema if needed
    existing_columns = [row[1] for row in conn.execute('PRAGMA table_info(decisions)').fetchall()]
    if 'share_code' not in existing_columns:
        try:
            conn.execute('ALTER TABLE decisions ADD COLUMN share_code TEXT')
        except sqlite3.OperationalError:
            pass
    if 'user_id' not in existing_columns:
        try:
            conn.execute('ALTER TABLE decisions ADD COLUMN user_id INTEGER')
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()


def generate_share_code():
    """Generate a unique share code for a decision"""
    return str(uuid.uuid4())[:8].upper()


def hash_password(password):
    """Hash password using SHA256"""
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
    required_fields = [
        'option1Name',
        'option2Name',
        'pros1',
        'cons1',
        'pros2',
        'cons2'
    ]

    if not data:
        return jsonify({'error': 'JSON body required'}), 400

    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return jsonify({'error': 'Missing fields', 'fields': missing_fields}), 400

    created_at = datetime.utcnow().isoformat() + 'Z'
    share_code = generate_share_code()

    if USE_FIRESTORE:
        decision_data = {
            'option1Name': data['option1Name'],
            'option2Name': data['option2Name'],
            'pros1': data['pros1'],
            'cons1': data['cons1'],
            'pros2': data['pros2'],
            'cons2': data['cons2'],
            'share_code': share_code,
            'createdAt': created_at,
            'user_id': None
        }
        doc_ref, _ = db.collection('decisions').add(decision_data)
        decision_id = doc_ref.id
    else:
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
        'option1Name': data['option1Name'],
        'option2Name': data['option2Name'],
        'pros1': data['pros1'],
        'cons1': data['cons1'],
        'pros2': data['pros2'],
        'cons2': data['cons2'],
        'createdAt': created_at
    }), 201


@app.route('/api/decisions/<decision_id>', methods=['GET'])
def get_decision(decision_id):
    if USE_FIRESTORE:
        doc_ref = db.collection('decisions').document(decision_id)
        doc = doc_ref.get()

        if not doc.exists:
            return jsonify({'error': 'Decision not found'}), 404

        data = doc.to_dict()
        return jsonify({
            'id': decision_id,
            'option1Name': data['option1Name'],
            'option2Name': data['option2Name'],
            'pros1': data['pros1'],
            'cons1': data['cons1'],
            'pros2': data['pros2'],
            'cons2': data['cons2'],
            'createdAt': data['createdAt']
        })
    else:
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


@app.route('/api/decisions', methods=['GET'])
def list_decisions():
    if USE_FIRESTORE:
        docs = db.collection('decisions').order_by('createdAt', direction=firestore.Query.DESCENDING).stream()

        results = []
        for doc in docs:
            data = doc.to_dict()
            results.append({
                'id': doc.id,
                'option1Name': data['option1Name'],
                'option2Name': data['option2Name'],
                'pros1': data['pros1'],
                'cons1': data['cons1'],
                'pros2': data['pros2'],
                'cons2': data['cons2'],
                'createdAt': data['createdAt']
            })

        return jsonify(results)
    else:
        conn = get_db_connection()
        rows = conn.execute('SELECT * FROM decisions ORDER BY id DESC').fetchall()
        conn.close()

        results = []
        for row in rows:
            results.append({
                'id': row['id'],
                'option1Name': row['option1Name'],
                'option2Name': row['option2Name'],
                'pros1': json.loads(row['pros1']),
                'cons1': json.loads(row['cons1']),
                'pros2': json.loads(row['pros2']),
                'cons2': json.loads(row['cons2']),
                'createdAt': row['createdAt']
            })

        return jsonify(results)


# ============ AUTHENTICATION ENDPOINTS ============

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    hashed_password = hash_password(password)

    if USE_FIRESTORE:
        users_ref = db.collection('users')
        existing_user = users_ref.where('username', '==', username).limit(1).get()
        if len(existing_user) > 0:
            return jsonify({'error': 'Username already exists'}), 400

        if email:
            existing_email = users_ref.where('email', '==', email).limit(1).get()
            if len(existing_email) > 0:
                return jsonify({'error': 'Email already exists'}), 400

        user_data = {
            'username': username,
            'password': hashed_password,
            'email': email,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }

        user_ref, _ = users_ref.add(user_data)
        user_id = user_ref.id
    else:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (username, password, email, createdAt) VALUES (?, ?, ?, ?)',
                (username, hashed_password, email, datetime.utcnow().isoformat() + 'Z')
            )
            conn.commit()
            user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 400
        conn.close()

    return jsonify({
        'id': user_id,
        'username': username,
        'email': email,
        'message': 'User created successfully'
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    hashed_password = hash_password(password)

    if USE_FIRESTORE:
        users_ref = db.collection('users')
        user_docs = users_ref.where('username', '==', username).where('password', '==', hashed_password).limit(1).get()

        if len(user_docs) == 0:
            return jsonify({'error': 'Invalid credentials'}), 401

        user_doc = user_docs[0]
        user_data = user_doc.to_dict()

        return jsonify({
            'id': user_doc.id,
            'username': user_data['username'],
            'email': user_data.get('email'),
            'message': 'Login successful'
        }), 200
    else:
        conn = get_db_connection()
        user = conn.execute(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            (username, hashed_password)
        ).fetchone()
        conn.close()

        if user is None:
            return jsonify({'error': 'Invalid credentials'}), 401

        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'message': 'Login successful'
        }), 200


# ============ SHARE ENDPOINTS ============

@app.route('/api/decisions/<decision_id>/share', methods=['POST'])
def share_decision(decision_id):
    if USE_FIRESTORE:
        doc_ref = db.collection('decisions').document(decision_id)
        doc = doc_ref.get()

        if not doc.exists:
            return jsonify({'error': 'Decision not found'}), 404

        share_code = generate_share_code()
        doc_ref.update({'share_code': share_code})
    else:
        conn = get_db_connection()
        decision = conn.execute(
            'SELECT * FROM decisions WHERE id = ?', (decision_id,)
        ).fetchone()
        if decision is None:
            conn.close()
            return jsonify({'error': 'Decision not found'}), 404

        share_code = generate_share_code()
        conn.execute(
            'UPDATE decisions SET share_code = ? WHERE id = ?',
            (share_code, decision_id)
        )
        conn.commit()
        conn.close()

    host_url = request.host_url.rstrip('/')
    return jsonify({
        'id': decision_id,
        'share_code': share_code,
        'share_url': f'{host_url}/share.html?code={share_code}'
    }), 200


@app.route('/api/decisions/share/<share_code>', methods=['GET'])
def get_shared_decision(share_code):
    if USE_FIRESTORE:
        docs = db.collection('decisions').where('share_code', '==', share_code).limit(1).get()

        if len(docs) == 0:
            return jsonify({'error': 'Shared decision not found'}), 404

        doc = docs[0]
        data = doc.to_dict()
    else:
        conn = get_db_connection()
        decision = conn.execute(
            'SELECT * FROM decisions WHERE share_code = ?',
            (share_code,)
        ).fetchone()
        conn.close()

        if decision is None:
            return jsonify({'error': 'Shared decision not found'}), 404

        data = {
            'option1Name': decision['option1Name'],
            'option2Name': decision['option2Name'],
            'pros1': json.loads(decision['pros1']),
            'cons1': json.loads(decision['cons1']),
            'pros2': json.loads(decision['pros2']),
            'cons2': json.loads(decision['cons2']),
            'createdAt': decision['createdAt'],
            'share_code': decision['share_code']
        }
        doc_id = decision['id']

    return jsonify({
        'id': doc_id,
        'option1Name': data['option1Name'],
        'option2Name': data['option2Name'],
        'pros1': data['pros1'],
        'cons1': data['cons1'],
        'pros2': data['pros2'],
        'cons2': data['cons2'],
        'createdAt': data['createdAt'],
        'share_code': data['share_code']
    }), 200


if __name__ == '__main__':
    if not USE_FIRESTORE:
        init_db()
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
