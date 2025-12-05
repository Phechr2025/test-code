const state = {
  rooms: [],
  currentRoomId: "default",
  messages: {
    default: []
  }
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

async function loadRooms() {
  try {
    const data = await api("/api/rooms");
    state.rooms = data.rooms;
    if (!state.rooms.find(r => r.id === state.currentRoomId)) {
      state.currentRoomId = "default";
    }
    renderRooms();
  } catch (e) {
    console.error(e);
    alert("โหลดห้องสนทนาไม่สำเร็จ");
  }
}

function renderRooms() {
  const list = document.getElementById("room-list");
  list.innerHTML = "";
  state.rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item" + (room.id === state.currentRoomId ? " active" : "");
    div.onclick = () => {
      state.currentRoomId = room.id;
      document.getElementById("current-room-name").innerText = room.name;
      renderRooms();
      renderMessages();
    };
    const nameSpan = document.createElement("span");
    nameSpan.textContent = room.name;
    const countSpan = document.createElement("small");
    countSpan.textContent = room.message_count ? `${room.message_count} ข้อความ` : "";
    countSpan.style.color = "#6b7280";
    countSpan.style.marginLeft = "6px";
    div.appendChild(nameSpan);
    div.appendChild(countSpan);
    list.appendChild(div);
  });
}

function appendMessage(role, content) {
  if (!state.messages[state.currentRoomId]) {
    state.messages[state.currentRoomId] = [];
  }
  state.messages[state.currentRoomId].push({ role, content });
  renderMessages();
}

function renderMessages() {
  const msgs = state.messages[state.currentRoomId] || [];
  const box = document.getElementById("messages");
  box.innerHTML = "";
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg " + m.role;
    div.textContent = m.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      document.getElementById("tab-" + tabId).classList.add("active");
    });
  });
}

async function handleSendChat() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  appendMessage("user", text);

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        room_id: state.currentRoomId,
        message: text
      })
    });
    if (data.reply) {
      appendMessage("assistant", data.reply);
    }
  } catch (e) {
    console.error(e);
    appendMessage("assistant", "❌ เกิดข้อผิดพลาด: " + e.message);
  }
}

async function handleGenerateImage() {
  const promptEl = document.getElementById("image-prompt");
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  const container = document.getElementById("image-result");
  container.innerHTML = "กำลังสร้างรูปภาพจาก AI ...";

  try {
    const data = await api("/api/image", {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
    if (data.image_base64) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + data.image_base64;

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "primary-btn";
      downloadBtn.textContent = "บันทึกรูปภาพ";
      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = img.src;
        a.download = "ai_image.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      const wrap = document.createElement("div");
      wrap.appendChild(img);

      const act = document.createElement("div");
      act.className = "image-actions";
      act.appendChild(downloadBtn);
      wrap.appendChild(act);

      container.innerHTML = "";
      container.appendChild(wrap);
    } else {
      container.innerHTML = "ไม่สามารถสร้างรูปภาพได้";
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = "❌ เกิดข้อผิดพลาด: " + e.message;
  }
}

async function handleDownloadZip() {
  const textarea = document.getElementById("zip-files-json");
  let files;
  try {
    files = JSON.parse(textarea.value);
  } catch {
    alert("รูปแบบ JSON ไม่ถูกต้อง");
    return;
  }
  if (!Array.isArray(files) || !files.length) {
    alert("ต้องมีอย่างน้อย 1 ไฟล์");
    return;
  }

  try {
    const res = await fetch("/api/create-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "ดาวน์โหลดไม่สำเร็จ");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai_generated_files.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("❌ เกิดข้อผิดพลาด: " + e.message);
  }
}

async function handleNewRoom() {
  const name = prompt("ตั้งชื่อห้องใหม่:");
  if (!name) return;
  try {
    const data = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    state.currentRoomId = data.room.id;
    state.messages[data.room.id] = [];
    await loadRooms();
    document.getElementById("current-room-name").innerText = data.room.name;
  } catch (e) {
    console.error(e);
    alert("สร้างห้องใหม่ไม่สำเร็จ");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  document.getElementById("send-chat").addEventListener("click", handleSendChat);
  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  });
  document.getElementById("generate-image").addEventListener("click", handleGenerateImage);
  document.getElementById("download-zip").addEventListener("click", handleDownloadZip);
  document.getElementById("new-room-btn").addEventListener("click", handleNewRoom);

  await loadRooms();
  document.getElementById("current-room-name").innerText =
    (state.rooms.find(r => r.id === state.currentRoomId) || {}).name || "ห้องหลัก";
  renderMessages();
});
