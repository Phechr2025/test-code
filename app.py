
import os
import io
import zipfile

from flask import Flask, render_template, request, jsonify, send_file
import openai

app = Flask(__name__)

# ใช้ API KEY จาก Environment Variable (ต้องไปตั้งใน Render: OPENAI_API_KEY)
openai.api_key = os.getenv("OPENAI_API_KEY")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    messages = data.get("messages", [])
    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "messages ต้องเป็น list และห้ามว่าง"}), 400

    try:
        resp = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "คุณคือ AI ผู้ช่วยบนเว็บไซต์ส่วนตัวของผู้ใช้คนไทย "
                        "ตอบเป็นภาษาไทย น้ำเสียงเพื่อน ๆ แต่ชัดเจน และอธิบายเข้าใจง่าย "
                        "ห้ามเขียนโค้ดที่เป็นอันตราย หรือเกี่ยวกับการแฮ็ก / มัลแวร์"
                    ),
                },
                *messages,
            ],
        )
        reply = resp["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": f"เกิดข้อผิดพลาดในการเรียก AI: {e}"}), 500


@app.route("/api/generate-zip", methods=["POST"])
def api_generate_zip():
    data = request.get_json(force=True)
    instruction = data.get("instruction", "").strip()
    if not instruction:
        return jsonify({"error": "กรุณาพิมพ์คำอธิบายก่อน"}), 400

    system_prompt = (
        "คุณคือผู้ช่วยสร้างโปรเจกต์โค้ด ให้ตอบเป็น JSON เท่านั้น "
        "รูปแบบ:\n"
        "{\n"
        '  "files": [\n'
        '    {"path": "app.py", "content": "...โค้ดไฟล์นี้..."},\n'
        '    {"path": "requirements.txt", "content": "..."}\n'
        "  ]\n"
        "}\n"
        "ห้ามเพิ่มข้อความอื่นนอกจาก JSON (ไม่มีคำอธิบาย ไม่มี markdown)"
    )

    try:
        resp = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction},
            ],
            temperature=0.2,
        )
        raw = resp["choices"][0]["message"]["content"]
    except Exception as e:
        return jsonify({"error": f"เรียก AI ไม่สำเร็จ: {e}"}), 500

    import json
    try:
        data_json = json.loads(raw)
        files = data_json.get("files", [])
        if not isinstance(files, list) or not files:
            raise ValueError("ไม่พบ key 'files'")
    except Exception as e:
        return jsonify({
            "error": f"AI ตอบ JSON ไม่ถูกต้อง: {e}",
            "raw": raw,
        }), 500

    mem = io.BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            path = f.get("path", "file.txt")
            content = f.get("content", "")
            zf.writestr(path, content)

    mem.seek(0)
    return send_file(
        mem,
        mimetype="application/zip",
        as_attachment=True,
        download_name="ai_project.zip",
    )


@app.route("/api/generate-image", methods=["POST"])
def api_generate_image():
    data = request.get_json(force=True)
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "กรุณาพิมพ์คำอธิบายรูปก่อน"}), 400

    try:
        img_resp = openai.Image.create(
            model="gpt-image-1",
            prompt=prompt,
            size="1024x1024",
            response_format="b64_json",
        )
        b64 = img_resp["data"][0]["b64_json"]
        data_url = f"data:image/png;base64,{b64}"
        return jsonify({"imageDataUrl": data_url})

    except Exception as e:
        return jsonify({"error": f"สร้างรูปไม่สำเร็จ: {e}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
