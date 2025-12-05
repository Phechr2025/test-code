
const ROOM_KEY = "phechr_ai_rooms_v1";

let rooms = [];
let currentRoomId = null;

function loadRooms() {
  const raw = localStorage.getItem(ROOM_KEY);
  if (!raw) {
    rooms = [
      { id: "room-1", name: "ห้องแรก", messages: [] }
    ];
    currentRoomId = "room-1";
    saveRooms();
    return;
  }
  rooms = JSON.parse(raw);
  if (!rooms.length) {
    rooms = [{ id: "room-1", name: "ห้องแรก", messages: [] }];
  }
  currentRoomId = rooms[0].id;
}

function saveRooms() {
  localStorage.setItem(ROOM_KEY, JSON.stringify(rooms));
}

function getCurrentRoom() {
  return rooms.find(r => r.id === currentRoomId);
}

function renderRoomList() {
  const listEl = document.getElementById("room-list");
  listEl.innerHTML = "";
  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item" + (room.id === currentRoomId ? " active" : "");
    div.dataset.id = room.id;

    const span = document.createElement("span");
    span.textContent = room.name;
    div.appendChild(span);

    div.onclick = () => {
      currentRoomId = room.id;
      saveRooms();
      updateUI();
    };

    listEl.appendChild(div);
  });
}

function renderChat() {
  const room = getCurrentRoom();
  const logEl = document.getElementById("chat-log");
  logEl.innerHTML = "";
  if (!room) return;

  document.getElementById("current-room-name").textContent = room.name;

  room.messages.forEach(msg => {
    const row = document.createElement("div");
    row.className = "chat-message";

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar " + (msg.role === "user" ? "user" : "bot");
    avatar.textContent = msg.role === "user" ? "U" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (msg.role === "user" ? "user" : "bot");
    bubble.textContent = msg.content;

    row.appendChild(avatar);
    row.appendChild(bubble);
    logEl.appendChild(row);
  });

  logEl.scrollTop = logEl.scrollHeight;
}

function updateUI() {
  renderRoomList();
  renderChat();
}

function createRoom() {
  const name = prompt("ตั้งชื่อห้องใหม่:", "ห้องใหม่");
  if (!name) return;
  const id = "room-" + Date.now();
  rooms.unshift({ id, name, messages: [] });
  currentRoomId = id;
  saveRooms();
  updateUI();
}

function deleteCurrentRoom() {
  if (!currentRoomId) return;
  if (!confirm("ลบห้องนี้และข้อความทั้งหมด?")) return;
  rooms = rooms.filter(r => r.id !== currentRoomId);
  if (!rooms.length) {
    rooms = [{ id: "room-1", name: "ห้องแรก", messages: [] }];
  }
  currentRoomId = rooms[0].id;
  saveRooms();
  updateUI();
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  let text = input.value.trim();
  if (!text) return;
  const room = getCurrentRoom();
  if (!room) return;

  room.messages.push({ role: "user", content: text });
  saveRooms();
  renderChat();
  input.value = "";

  const tempBot = { role: "assistant", content: "กำลังคิดคำตอบ..." };
  room.messages.push(tempBot);
  renderChat();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: room.messages.map(m => ({
          role: m.role === "assistant" ? "assistant" : m.role,
          content: m.content
        }))
      })
    });

    const data = await res.json();
    room.messages = room.messages.filter(m => m !== tempBot);

    if (data.reply) {
      room.messages.push({ role: "assistant", content: data.reply });
    } else if (data.error) {
      room.messages.push({ role: "assistant", content: "❌ " + data.error });
    }

    saveRooms();
    renderChat();
  } catch (err) {
    room.messages = room.messages.filter(m => m !== tempBot);
    room.messages.push({ role: "assistant", content: "❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" });
    saveRooms();
    renderChat();
  }
}

async function generateZip() {
  const instEl = document.getElementById("zip-instruction");
  const statusEl = document.getElementById("zip-status");
  const instruction = instEl.value.trim();
  if (!instruction) {
    statusEl.textContent = "กรุณาอธิบายโปรเจกต์ก่อน";
    return;
  }
  statusEl.textContent = "กำลังให้ AI สร้าง ZIP โปรดรอ...";

  try {
    const res = await fetch("/api/generate-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction })
    });

    if (!res.ok) {
      const err = await res.json();
      statusEl.textContent = "❌ " + (err.error || "สร้าง ZIP ไม่สำเร็จ");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ai_project.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    statusEl.textContent = "✅ ดาวน์โหลด ZIP สำเร็จ";
  } catch (err) {
    statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + err;
  }
}

async function generateImage() {
  const promptEl = document.getElementById("img-prompt");
  const statusEl = document.getElementById("img-status");
  const wrapper = document.getElementById("img-preview-wrapper");
  const img = document.getElementById("img-preview");
  const dl = document.getElementById("img-download");

  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = "กรุณาพิมพ์คำอธิบายรูปก่อน";
    return;
  }

  statusEl.textContent = "กำลังสร้างรูปจาก AI...";
  wrapper.style.display = "none";

  try {
    const res = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();

    if (data.error) {
      statusEl.textContent = "❌ " + data.error;
      return;
    }

    const dataUrl = data.imageDataUrl;
    img.src = dataUrl;
    dl.href = dataUrl;
    wrapper.style.display = "flex";
    statusEl.textContent = "✅ สร้างรูปสำเร็จ";
  } catch (err) {
    statusEl.textContent = "❌ เกิดข้อผิดพลาด: " + err;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadRooms();
  updateUI();

  document.getElementById("new-room-btn").onclick = createRoom;
  document.getElementById("delete-room-btn").onclick = deleteCurrentRoom;
  document.getElementById("send-btn").onclick = sendMessage;

  const chatInput = document.getElementById("chat-input");
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("zip-btn").onclick = generateZip;
  document.getElementById("img-btn").onclick = generateImage;
});
