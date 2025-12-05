import os
import io
import zipfile
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_file
from openai import OpenAI

# ------------- CONFIG ------------- #

app = Flask(__name__)

# ตั้งค่า API Key จากตัวแปรสภาพแวดล้อม
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("⚠️ WARNING: ไม่ได้ตั้งค่า OPENAI_API_KEY ใน Environment Variable")
    print("ระบบจะรันได้ แต่จะตอบจาก AI ไม่ได้ จนกว่าจะใส่ KEY ก่อน")

client = OpenAI(api_key=OPENAI_API_KEY)

# ------------- IN‑MEMORY STORE (DEMO) ------------- #
# ในโปรเจกต์จริงควรใช้ฐานข้อมูล เช่น SQLite / MySQL

rooms = {
    "default": {
        "id": "default",
        "name": "ห้องหลัก",
        "created_at": datetime.utcnow().isoformat(),
        "messages": []  # [{role, content, ts}]
    }
}


def get_room(room_id: str):
    return rooms.get(room_id) or rooms["default"]


# ------------- ROUTES ------------- #


@app.route("/")
def index():
    return render_template("index.html")


# ---- ห้องสนทนา ---- #

@app.route("/api/rooms", methods=["GET"])
def list_rooms():
    data = [
        {
            "id": r["id"],
            "name": r["name"],
            "created_at": r["created_at"],
            "message_count": len(r["messages"])
        }
        for r in rooms.values()
    ]
    return jsonify({"rooms": data})


@app.route("/api/rooms", methods=["POST"])
def create_room():
    body = request.get_json(force=True)
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "กรุณากรอกชื่อห้อง"}), 400

    room_id = f"room_{len(rooms) + 1}"
    rooms[room_id] = {
        "id": room_id,
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
        "messages": []
    }
    return jsonify({"room": rooms[room_id]})


# ---- คุยกับ AI ---- #

@app.route("/api/chat", methods=["POST"])
def chat():
    if not OPENAI_API_KEY:
        return jsonify({
            "error": "ยังไม่ได้ตั้งค่า OPENAI_API_KEY",
            "detail": "ให้ไปที่ Render → Environment → เพิ่มตัวแปร OPENAI_API_KEY แล้วกด Deploy ใหม่"
        }), 500

    body = request.get_json(force=True)
    room_id = body.get("room_id") or "default"
    message = (body.get("message") or "").strip()

    if not message:
        return jsonify({"error": "กรุณาพิมพ์ข้อความ"}), 400

    room = get_room(room_id)

    # เก็บข้อความของผู้ใช้
    room["messages"].append({
        "role": "user",
        "content": message,
        "ts": datetime.utcnow().isoformat()
    })

    # เตรียม history ส่งเข้า AI (จำกัดล่าสุด 20 ข้อความ)
    history = room["messages"][-20:]

    try:
        completion = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "คุณคือผู้ช่วย AI บนเว็บส่วนตัว หน้าตาเหมือน ChatGPT "
                        "ตอบเป็นภาษาไทย เข้าใจง่าย และสุภาพ สามารถเขียนโค้ด "
                        "สร้างไฟล์ และอธิบายทีละขั้นตอนได้"
                    )
                },
            ] + [
                {"role": m["role"], "content": m["content"]}
                for m in history
            ],
            temperature=0.7,
        )
        reply_text = completion.choices[0].message.content
    except Exception as e:
        print("Chat error:", e)
        return jsonify({"error": "เรียก OpenAI ไม่สำเร็จ", "detail": str(e)}), 500

    # เก็บคำตอบของ AI
    room["messages"].append({
        "role": "assistant",
        "content": reply_text,
        "ts": datetime.utcnow().isoformat()
    })

    return jsonify({"reply": reply_text})


# ---- สร้างรูปภาพ ---- #

@app.route("/api/image", methods=["POST"])
def generate_image():
    if not OPENAI_API_KEY:
        return jsonify({
            "error": "ยังไม่ได้ตั้งค่า OPENAI_API_KEY",
            "detail": "ให้ไปที่ Render → Environment → เพิ่มตัวแปร OPENAI_API_KEY แล้วกด Deploy ใหม่"
        }), 500

    body = request.get_json(force=True)
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "กรุณากรอกคำสั่งสร้างรูป"}), 400

    try:
        img_result = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="1024x1024"
        )
        image_base64 = img_result.data[0].b64_json
    except Exception as e:
        print("Image error:", e)
        return jsonify({"error": "สร้างรูปภาพไม่สำเร็จ", "detail": str(e)}), 500

    # ส่งเป็น base64 กลับไป แล้วให้ฝั่งหน้าเว็บแปลงเป็นภาพ / ปุ่มดาวน์โหลด
    return jsonify({"image_base64": image_base64})


# ---- ให้ AI สร้าง zip (ไฟล์โค้ด/ข้อความ) ---- #

@app.route("/api/create-zip", methods=["POST"])
def create_zip():
    """
    body:
    {
      "files": [
        {"filename": "main.py", "content": "print('hi')"},
        ...
      ]
    }
    """
    body = request.get_json(force=True)
    files = body.get("files") or []
    if not files:
        return jsonify({"error": "ไม่พบไฟล์ที่จะบีบอัด"}), 400

    mem = io.BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            name = f.get("filename") or "file.txt"
            content = f.get("content") or ""
            # ป้องกัน path แปลก ๆ
            safe_name = name.replace("..", "").lstrip("/\\")
            zf.writestr(safe_name, content)

    mem.seek(0)
    return send_file(
        mem,
        mimetype="application/zip",
        as_attachment=True,
        download_name="ai_generated_files.zip"
    )


# ------------- MAIN ------------- #

if __name__ == "__main__":
    # สำหรับรันบนเครื่องตัวเอง (dev)
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
