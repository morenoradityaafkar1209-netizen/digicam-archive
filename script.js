// DIGICAM ARCHIVE v2 — album tujuan upload + pindahkan foto antar-album.
const STORAGE_KEY = "digicam-archive-v2";
const LEGACY_KEY = "digicam-archive-v1";
const DEFAULT_ALBUMS = ["Unsorted", "Everyday", "Friends", "Places"];

function loadState() {
  try {
    let saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Migrasi otomatis arsip dari versi sebelumnya.
    if (!saved) {
      const old = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (old && Array.isArray(old.photos) && Array.isArray(old.albums)) {
        saved = old;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      }
    }
    if (saved && Array.isArray(saved.photos) && Array.isArray(saved.albums)) {
      if (!saved.albums.includes("Unsorted")) saved.albums.unshift("Unsorted");
      saved.photos.forEach(p => { if (!saved.albums.includes(p.album)) p.album = "Unsorted"; });
      return saved;
    }
  } catch (error) { console.warn("Tidak dapat membaca arsip:", error); }
  return { albums: [...DEFAULT_ALBUMS], photos: [] };
}
let state = loadState();
let currentPhotoId = null;

const $ = id => document.getElementById(id);
const photoInput = $("photoInput"), gallery = $("gallery"), albumFilter = $("albumFilter");
const albumList = $("albumList"), searchInput = $("searchInput"), photoCount = $("photoCount");
const uploadAlbum = $("uploadAlbum"), albumDialog = $("albumDialog");
const photoDialog = $("photoDialog"), manageDialog = $("manageDialog");

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (error) {
    alert("Penyimpanan browser penuh. Coba upload foto lebih sedikit atau foto berukuran lebih kecil. Simpan foto asli di laptop sebagai backup.");
    return false;
  }
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function dateLabel(time) {
  return new Date(time).toLocaleDateString("id-ID", {day:"2-digit",month:"short",year:"numeric"});
}
function renderAlbumControls() {
  const previousFilter = albumFilter.value || "all";
  const previousUpload = uploadAlbum.value || "Unsorted";
  const optionHTML = state.albums.map(a => `<option value="${escapeHTML(a)}">${escapeHTML(a)}</option>`).join("");
  uploadAlbum.innerHTML = optionHTML;
  uploadAlbum.value = state.albums.includes(previousUpload) ? previousUpload : "Unsorted";

  albumFilter.innerHTML = `<option value="all">All albums</option>${optionHTML}`;
  albumFilter.value = previousFilter === "all" || state.albums.includes(previousFilter) ? previousFilter : "all";

  albumList.innerHTML =
    `<button class="album-chip ${previousFilter === "all" ? "active" : ""}" data-album="all">All photos <small>${state.photos.length}</small></button>` +
    state.albums.map(a => {
      const count = state.photos.filter(p => p.album === a).length;
      return `<button class="album-chip ${previousFilter === a ? "active" : ""}" data-album="${escapeHTML(a)}">${escapeHTML(a)} <small>${count}</small></button>`;
    }).join("");
}
function render() {
  renderAlbumControls();
  const selected = albumFilter.value || "all";
  const query = searchInput.value.trim().toLowerCase();
  const photos = state.photos.filter(p =>
    (selected === "all" || p.album === selected) && p.name.toLowerCase().includes(query)
  );
  photoCount.textContent = `(${photos.length})`;
  if (!photos.length) {
    gallery.innerHTML = `<div class="empty-state"><div class="empty-icon">▧</div><h3>${state.photos.length ? "No photos found." : "Your archive is waiting."}</h3><p>${state.photos.length ? "Coba kata pencarian atau album lain." : "Upload your first photos to start collecting memories."}</p></div>`;
    return;
  }
  gallery.innerHTML = photos.map(p => `
    <article class="photo-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Buka ${escapeHTML(p.name)}">
      <div class="photo-frame"><img src="${p.data}" alt="${escapeHTML(p.name)}" loading="lazy">
        <div class="photo-overlay"><button type="button" data-download="${p.id}">↓ DOWNLOAD</button></div>
      </div>
      <div class="photo-caption"><strong title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</strong><span>${dateLabel(p.added)}</span></div>
      <div class="photo-album">${escapeHTML(p.album)}</div>
    </article>`).join("");
}
function fileToDataURL(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

photoInput.addEventListener("change", async event => {
  const files = [...event.target.files].filter(f => f.type.startsWith("image/"));
  const destination = uploadAlbum.value || "Unsorted";
  if (!files.length) return;
  if (files.length > 0) {
    for (const file of files) {
      try {
        const data = await fileToDataURL(file);
        state.photos.unshift({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          name: file.name, data, album: destination, added: Date.now()
        });
      } catch (error) { alert(`Gagal membaca file ${file.name}`); }
    }
    saveState();
    albumFilter.value = destination;
    render();
  }
  event.target.value = "";
});

$("newAlbumBtn").addEventListener("click", () => {
  $("albumName").value = "";
  albumDialog.showModal();
});
$("closeAlbumDialog").addEventListener("click", () => albumDialog.close());
$("cancelAlbum").addEventListener("click", () => albumDialog.close());
$("albumForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("albumName").value.trim();
  if (!name) return;
  if (state.albums.some(a => a.toLowerCase() === name.toLowerCase())) {
    alert("Nama album tersebut sudah ada."); return;
  }
  state.albums.push(name);
  saveState();
  albumDialog.close();
  uploadAlbum.value = name; // Album baru otomatis dipilih untuk upload berikutnya.
  albumFilter.value = name;
  render();
});

$("manageAlbumsBtn").addEventListener("click", () => { renderManageAlbums(); manageDialog.showModal(); });
function renderManageAlbums() {
  $("manageAlbumList").innerHTML = state.albums.map(a => {
    const count = state.photos.filter(p => p.album === a).length;
    return `<div class="manage-row"><span>${escapeHTML(a)} <small>(${count})</small></span><button type="button" data-delete-album="${escapeHTML(a)}" ${a === "Unsorted" ? "disabled" : ""}>DELETE</button></div>`;
  }).join("");
}
$("manageAlbumList").addEventListener("click", event => {
  const name = event.target.dataset.deleteAlbum;
  if (!name || name === "Unsorted") return;
  if (!confirm(`Hapus album "${name}"? Foto akan dipindahkan ke Unsorted.`)) return;
  state.photos.forEach(p => { if (p.album === name) p.album = "Unsorted"; });
  state.albums = state.albums.filter(a => a !== name);
  saveState(); renderManageAlbums(); render();
});

albumList.addEventListener("click", event => {
  const button = event.target.closest("[data-album]");
  if (!button) return;
  albumFilter.value = button.dataset.album;
  render();
});
albumFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);

gallery.addEventListener("click", event => {
  const downloadButton = event.target.closest("[data-download]");
  if (downloadButton) {
    event.stopPropagation();
    const p = state.photos.find(x => x.id === downloadButton.dataset.download);
    if (p) downloadPhoto(p);
    return;
  }
  const card = event.target.closest("[data-id]");
  if (card) openPhoto(card.dataset.id);
});
gallery.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-id]")) {
    event.preventDefault(); openPhoto(event.target.dataset.id);
  }
});
function openPhoto(id) {
  const p = state.photos.find(x => x.id === id);
  if (!p) return;
  currentPhotoId = id;
  $("largePhoto").src = p.data;
  $("largeName").textContent = p.name;
  $("largeAlbum").textContent = `${p.album} · Added ${dateLabel(p.added)}`;
  $("movePhotoAlbum").innerHTML = state.albums.map(a => `<option value="${escapeHTML(a)}">${escapeHTML(a)}</option>`).join("");
  $("movePhotoAlbum").value = p.album;
  photoDialog.showModal();
}
$("movePhotoAlbum").addEventListener("change", () => {
  const p = state.photos.find(x => x.id === currentPhotoId);
  if (!p) return;
  p.album = $("movePhotoAlbum").value;
  saveState();
  $("largeAlbum").textContent = `${p.album} · Added ${dateLabel(p.added)}`;
  render();
});
function downloadPhoto(p) {
  const link = document.createElement("a");
  link.href = p.data; link.download = p.name || "digicam-photo.jpg";
  document.body.appendChild(link); link.click(); link.remove();
}
$("closePhoto").addEventListener("click", () => photoDialog.close());
$("downloadLarge").addEventListener("click", () => {
  const p = state.photos.find(x => x.id === currentPhotoId);
  if (p) downloadPhoto(p);
});
photoDialog.addEventListener("click", event => { if (event.target === photoDialog) photoDialog.close(); });

render();
