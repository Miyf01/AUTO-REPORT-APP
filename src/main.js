const { invoke } = window.__TAURI__.core;

let formContainer;
let reportOutput;
let generateBtn;
let statusBadge;
let designerNameInput;

window.addEventListener("DOMContentLoaded", () => {
  formContainer = document.querySelector("#form-container");
  reportOutput = document.querySelector("#report-output");
  generateBtn = document.querySelector("#generate-btn");
  statusBadge = document.querySelector("#status-badge");
  designerNameInput = document.querySelector("#designer-name");

  generateBtn.addEventListener("click", generateLaporan);
  document.querySelector("#add-date-btn").addEventListener("click", () => {
    addDateBlock();
    saveToLocalStorage();
  });

  designerNameInput.addEventListener("input", () => {
    localStorage.setItem("laporan_desainer_name", designerNameInput.value);
  });
  designerNameInput.value = localStorage.getItem("laporan_desainer_name") || "";

  if (!loadFromLocalStorage()) {
    addDateBlock(); 
  }

  // --- LOGIKA METERAN SCROLLBAR ARTCRAFT ---
  buildRuler(); // Gambar garis-garis penggarisnya
  window.addEventListener("scroll", updateCustomScrollbar);
  window.addEventListener("resize", updateCustomScrollbar);
  updateCustomScrollbar(); 
});

// FUNGSI MENGGAMBAR GARIS METERAN (0 sampai 100)
function buildRuler() {
  const track = document.getElementById('scroll-track');
  if (!track) return;
  track.innerHTML = '';
  
  // Membuat 100 garis
  for (let i = 0; i <= 100; i++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    // Menempatkan garis tepat pada persentasenya
    tick.style.top = `calc(${i}% - 0.5px)`;

    // Setiap kelipatan 5, garisnya lebih panjang dan diberi angka
    if (i % 5 === 0) {
      tick.classList.add('large-tick');
      const num = document.createElement('span');
      num.className = 'ruler-num';
      num.textContent = i;
      tick.appendChild(num);
    }
    track.appendChild(tick);
  }
}

// FUNGSI MENGGERAKKAN GARIS BIRU 0-100%
function updateCustomScrollbar() {
  const scrollThumb = document.getElementById('scroll-thumb');
  const scrollPercentage = document.getElementById('scroll-percentage');
  
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

  let percent = 0;
  if (scrollHeight > 0) {
    percent = (scrollTop / scrollHeight);
  }

  // Format ke 3 digit (contoh: 031%)
  const percentText = Math.round(percent * 100).toString().padStart(3, '0') + '%';
  if (scrollPercentage) scrollPercentage.textContent = percentText;

  if (scrollThumb) {
    // Agar garis biru tidak bablas keluar layar di bagian bawah
    const maxTranslate = window.innerHeight - 2; 
    scrollThumb.style.transform = `translateY(${percent * maxTranslate}px)`;
  }
}

function generateDateOptions(selectedDate = "") {
  const months = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  let optionsHTML = "";
  const today = new Date();
  
  for (let i = -3; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const dateString = `${day} ${month} ${year}`; 
    
    const selected = (selectedDate && dateString === selectedDate) || (!selectedDate && i === 0) ? "selected" : "";
    
    let label = dateString;
    if (i === 0) label += " (Hari Ini)";
    else if (i === 1) label += " (Besok)";
    else if (i === -1) label += " (Kemarin)";
    
    optionsHTML += `<option value="${dateString}" ${selected}>${label}</option>`;
  }
  return optionsHTML;
}

function addDateBlock(savedDate = "", savedOrders = []) {
  const block = document.createElement("div");
  block.className = "date-block";
  block.innerHTML = `
    <div class="date-header">
      <select class="date-select">${generateDateOptions(savedDate)}</select>
      <button class="add-order-btn" title="Tambah Data di Tanggal Ini">+ DATA</button>
      <button class="del-btn" title="Hapus Tanggal">✕</button>
    </div>
    <div class="order-list"></div>
  `;
  
  const orderListContainer = block.querySelector(".order-list");

  block.querySelector(".add-order-btn").addEventListener("click", () => {
    addOrderRow(orderListContainer);
    saveToLocalStorage();
    updateCustomScrollbar();
  });
  
  block.querySelector(".del-btn").addEventListener("click", () => {
    block.remove();
    saveToLocalStorage();
    updateCustomScrollbar();
  });

  block.querySelector(".date-select").addEventListener("change", saveToLocalStorage);

  formContainer.appendChild(block);

  if (savedOrders && savedOrders.length > 0) {
    savedOrders.forEach(order => {
      addOrderRow(orderListContainer, order.name, order.code, order.num, order.status);
    });
  } else {
    addOrderRow(orderListContainer);
  }
  updateCustomScrollbar();
}

function addOrderRow(container, savedName = "", savedCode = "BR", savedNum = "", savedStatus = "preview") {
  const div = document.createElement("div");
  div.className = "order-row";
  div.innerHTML = `
    <input type="text" class="order-name" placeholder="Nama / Lokasi (Cth: deni pasir)" value="${savedName}">
    <select class="order-code">
      <option value="BR" ${savedCode === "BR" ? "selected" : ""}>BR</option>
      <option value="GR" ${savedCode === "GR" ? "selected" : ""}>GR</option>
      <option value="OR" ${savedCode === "OR" ? "selected" : ""}>OR</option>
      <option value="SP" ${savedCode === "SP" ? "selected" : ""}>SP</option>
      <option value="SM" ${savedCode === "SM" ? "selected" : ""}>SM</option>
      <option value="PN" ${savedCode === "PN" ? "selected" : ""}>PN</option>
      <option value="3D" ${savedCode === "3D" ? "selected" : ""}>3D</option>
      <option value="FB" ${savedCode === "FB" ? "selected" : ""}>FB</option>
    </select>
    <input type="text" class="order-num" placeholder="No (559)" value="${savedNum}">
    <select class="order-status">
      <option value="preview" ${savedStatus === "preview" ? "selected" : ""}>Preview</option>
      <option value="proses" ${savedStatus === "proses" ? "selected" : ""}>Proses</option>
      <option value="acc" ${savedStatus === "acc" ? "selected" : ""}>ACC</option>
      <option value="belum" ${savedStatus === "belum" ? "selected" : ""}>Belum</option>
    </select>
    <button class="del-btn" title="Hapus Baris">✕</button>
  `;

  div.querySelector(".del-btn").addEventListener("click", () => {
    div.remove();
    saveToLocalStorage();
    updateCustomScrollbar();
  });

  div.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", saveToLocalStorage);
    el.addEventListener("change", saveToLocalStorage);
  });

  container.appendChild(div);
  updateCustomScrollbar();
}

function saveToLocalStorage() {
  const blocks = document.querySelectorAll(".date-block");
  const allData = [];

  blocks.forEach(block => {
    const tgl = block.querySelector(".date-select").value;
    const orders = block.querySelectorAll(".order-row");
    const blockOrders = [];

    orders.forEach(order => {
      blockOrders.push({
        name: order.querySelector(".order-name").value,
        code: order.querySelector(".order-code").value,
        num: order.querySelector(".order-num").value,
        status: order.querySelector(".order-status").value
      });
    });

    allData.push({
      date: tgl,
      orders: blockOrders
    });
  });

  localStorage.setItem("laporan_desainer_data", JSON.stringify(allData));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem("laporan_desainer_data");
  if (!saved) return false;

  try {
    const allData = JSON.parse(saved);
    if (!allData || allData.length === 0) return false;

    formContainer.innerHTML = ""; 
    allData.forEach(block => {
      addDateBlock(block.date, block.orders);
    });
    return true;
  } catch (e) {
    console.error("Gagal memuat data tersimpan:", e);
    return false;
  }
}

async function generateLaporan() {
  let rawData = "";
  
  const blocks = document.querySelectorAll(".date-block");
  blocks.forEach(block => {
    const tgl = block.querySelector(".date-select").value;
    const orders = block.querySelectorAll(".order-row");
    
    let blockData = "";
    orders.forEach(order => {
      const name = order.querySelector(".order-name").value.trim();
      const code = order.querySelector(".order-code").value;
      const num = order.querySelector(".order-num").value.trim();
      const status = order.querySelector(".order-status").value;
      
      if (name && num) {
        blockData += `${name} ${code}-${num} : ${status}\n`;
      }
    });

    if (blockData) {
      rawData += `\n${tgl}\n${blockData}`;
    }
  });

  rawData = rawData.trim();

  if (!rawData) {
    reportOutput.textContent = "Data kosong. Silakan isi form di sebelah kiri dengan lengkap.";
    return;
  }

  generateBtn.textContent = "PROCESSING...";
  generateBtn.disabled = true;
  statusBadge.classList.add("hidden");
  reportOutput.textContent = "System compiling...";

  try {
    const hasil = await invoke("generate_laporan", { inputText: rawData });
    
    let inputNama = designerNameInput.value.trim().toUpperCase();
    if (!inputNama) inputNama = "DESAINER";

    let hasilAkhir = hasil.replace("=== LAPORAN ORDERAN DESAINER ===", `=== LAPORAN ORDERAN ${inputNama} ===`);
    
    reportOutput.textContent = hasilAkhir;
    statusBadge.classList.remove("hidden");
  } catch (error) {
    reportOutput.textContent = "SYSTEM ERROR:\n" + error;
  } finally {
    setTimeout(() => {
      generateBtn.textContent = "LAUNCH GENERATOR →";
      generateBtn.disabled = false;
      statusBadge.classList.add("hidden");
    }, 3000);
  }
}