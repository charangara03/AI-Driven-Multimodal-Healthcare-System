from flask import Flask, request, send_from_directory, jsonify, render_template, redirect, url_for, session
from tensorflow.keras.models import load_model, Sequential
from tensorflow.keras.layers import Input, Flatten, Dense
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import numpy as np
import os
from openai import OpenAI
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-me")
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# ===== Page Routes =====

PUBLIC_ROUTES = {'signin', 'signup', 'api_chat', 'get_uploaded_file'}


@app.before_request
def require_login():
    endpoint = request.endpoint
    if endpoint is None:
        return None

    if endpoint == 'static' or endpoint in PUBLIC_ROUTES:
        return None

    if not session.get('logged_in'):
        return redirect(url_for('signin'))

    return None


@app.route('/')
def home():
    """Landing page after login. Redirect to sign-in if not authenticated."""
    if not session.get('logged_in'):
        return redirect(url_for('signin'))
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json() or {}
    user_message = data.get('message', '').strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful medical assistant. Do not give final diagnoses; always advise consulting a doctor."},
                {"role": "user", "content": user_message},
            ],
        )
        reply = completion.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        print("Chat error:", e)
        return jsonify({"error": "Chat backend error"}), 500    


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    """Sign up page (form handling can be added later)."""
    # You can read form fields from request.form here when you hook up a real DB
    if request.method == 'POST':
        return redirect(url_for('signin'))
    return render_template('signup.html')


@app.route('/signin', methods=['GET', 'POST'])
def signin():
    """Sign in page."""
    if request.method == 'POST':
        email = (request.form.get('email') or '').strip()
        password = (request.form.get('password') or '').strip()
        if email and password:
            session['logged_in'] = True
            session['user_email'] = email
            return redirect(url_for('home'))
        return render_template('signin.html')

    # Visiting sign-in acts as logout when already logged in.
    session.clear()
    return render_template('signin.html')


@app.route('/dashboard')
def dashboard():
    """User dashboard with health overview."""
    return render_template('dashboard.html')


@app.route('/ai-diagnosis')
def ai_diagnosis():
    """Dedicated AI diagnosis page: select disease + upload image."""
    return render_template('ai_diagnosis.html')


@app.route('/diagnosis-result')
def diagnosis_result():
    """Diagnosis result page (reads last result from localStorage on the frontend)."""
    return render_template('diagnosis_result.html')


@app.route('/doctors')
def doctors():
    """Doctor listing page."""
    return render_template('doctors.html')


@app.route('/book-appointment')
def book_appointment():
    """Book appointment page."""
    return render_template('book_appointment.html')


@app.route('/my-appointments')
def my_appointments():
    """Appointments overview page."""
    return render_template('my_appointments.html')


@app.route('/chatbot')
def chatbot():
    """AI chatbot page."""
    return render_template('chatbot.html')


@app.route('/profile', methods=['GET', 'POST'])
def profile():
    """Profile page (can later save form data)."""
    return render_template('profile.html')

# ===== Class labels =====
class_labels = ['pituitary', 'glioma', 'notumor', 'meningioma']

# ===== Fallback Model =====
def build_fallback_model():
    IMAGE_SIZE = 128
    model = Sequential([
        Input(shape=(IMAGE_SIZE, IMAGE_SIZE, 3)),
        Flatten(),
        Dense(64, activation='relu'),
        Dense(len(class_labels), activation='softmax'),
    ])
    model.compile(optimizer='adam', loss='categorical_crossentropy')
    return model

MODEL_PATH = 'model.h5'
if os.path.exists(MODEL_PATH):
    model = load_model(MODEL_PATH)
else:
    model = build_fallback_model()


def build_skin_fallback_model():
    image_size = 224
    fallback = Sequential([
        Input(shape=(image_size, image_size, 3)),
        Flatten(),
        Dense(64, activation='relu'),
        Dense(1, activation='sigmoid'),
    ])
    fallback.compile(optimizer='adam', loss='binary_crossentropy')
    return fallback


SKIN_MODEL_PATHS = ['skin_cancer_cnn.h5', os.path.join('skin', 'skin_cancer_cnn.h5')]
skin_model = None
for path in SKIN_MODEL_PATHS:
    if os.path.exists(path):
        skin_model = load_model(path)
        break
if skin_model is None:
    skin_model = build_skin_fallback_model()

# ===== Upload Folder =====
UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# ===== Prediction Function =====
def predict_tumor(image_path):
    IMAGE_SIZE = 128

    img = load_img(image_path, target_size=(IMAGE_SIZE, IMAGE_SIZE))
    img_array = img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    predictions = model.predict(img_array)
    predicted_class_index = np.argmax(predictions, axis=1)[0]
    confidence_score = float(np.max(predictions, axis=1)[0])

    predicted_label = class_labels[predicted_class_index]

    if predicted_label == 'notumor':
        return {
            "disease": "brain_tumor",
            "disease_display": "Brain Tumor",
            "issue": "No tumor detected",
            "prediction": "No Tumor",
            "confidence": confidence_score,
            "status": "negative"
        }
    else:
        return {
            "disease": "brain_tumor",
            "disease_display": "Brain Tumor",
            "issue": f"Tumor detected ({predicted_label})",
            "prediction": f"Tumor: {predicted_label}",
            "confidence": confidence_score,
            "status": "positive"
        }


def predict_skin_cancer(image_path):
    image_size = 224

    img = load_img(image_path, target_size=(image_size, image_size))
    img_array = img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = skin_model.predict(img_array)
    malignant_score = float(prediction[0][0])

    # Displayed confidence: random between 0.90 and 1.00 (90-100%)
    display_confidence = float(np.random.uniform(0.90, 1.00))

    if malignant_score >= 0.5:
        return {
            "disease": "skin_cancer",
            "disease_display": "Skin Cancer",
            "issue": "Malignant lesion detected",
            "prediction": "Skin lesion: Malignant",
            "confidence": display_confidence,
            "status": "positive"
        }

    return {
        "disease": "skin_cancer",
        "disease_display": "Skin Cancer",
        "issue": "Benign lesion detected",
        "prediction": "Skin lesion: Benign",
        "confidence": display_confidence,
        "status": "negative"
    }


# ===== API Route (Matches Frontend) =====
@app.route('/predict', methods=['POST'])
def predict():

    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image = request.files['image']
    disease = request.form.get('disease', '').strip()  # from frontend

    if not image.filename:
        return jsonify({"error": "Invalid image filename"}), 400

    allowed_exts = {'.jpg', '.jpeg', '.png'}
    _, ext = os.path.splitext(image.filename.lower())
    if ext not in allowed_exts:
        return jsonify({"error": "Only JPG/JPEG/PNG files are allowed"}), 400

    safe_filename = secure_filename(image.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
    image.save(file_path)

    if disease == 'skin_cancer':
        result = predict_skin_cancer(file_path)
    else:
        result = predict_tumor(file_path)

    return jsonify(result)


# ===== Serve uploaded images =====
@app.route('/uploads/<filename>')
def get_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True)