const API_KEY = "a99fbb7ca48213b465a76d4aacae8d8d";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";

// Elemen HTML
const sections = document.querySelector("#movieSections");
const statusText = document.querySelector("#status");
const searchInput = document.querySelector("#searchInput");
const searchForm = document.querySelector("#searchForm");
const releaseYear = document.querySelector("#releaseYear");
const genreFilters = document.querySelector("#genreFilters");
const searchResults = document.querySelector("#searchResults");
const searchMovieRow = document.querySelector("#searchMovieRow");
const loadMoreBtn = document.querySelector("#loadMoreBtn");
const sectionTitle = document.querySelector("#sectionTitle");
const modal = document.querySelector("#movieModal");
const modalContent = document.querySelector("#modalContent");
const favoritesNav = document.querySelector("#favoritesNav");

// Kategori film
const categories = [
  { id: "trending", title: "Trending Minggu Ini", url: "/trending/movie/week" },
  { id: "popular", title: "Film Populer", url: "/movie/popular" },
  { id: "action", title: "Film Action", url: "/discover/movie?with_genres=28" },
  { id: "comedy", title: "Film Komedi", url: "/discover/movie?with_genres=35" },
  { id: "horror", title: "Film Horror", url: "/discover/movie?with_genres=27" },
  { id: "romance", title: "Film Romance", url: "/discover/movie?with_genres=10749" },
  { id: "animation", title: "Film Animasi", url: "/discover/movie?with_genres=16" },
  { id: "science", title: "Film Sci-Fi", url: "/discover/movie?with_genres=878" },
  { id: "top_rated", title: "Rating Tertinggi", url: "/movie/top_rated" }
];

// Penyimpanan data
let favorites = loadFavorites();
const movieCache = new Map();

let searchPage = 1;
let searchQuery = "";
let searchYear = "";
let searchGenre = "";
let searchMode = false;
let favoritesMode = false;
let searchRequest = 0;
let homeRequest = 0;
let detailRequest = 0;
let trailerRequest = 0;

// Membaca favorit tersimpan
function loadFavorites() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("jflixFavorites") || "[]"
    );

    return Array.isArray(saved) ? saved.map(String) : [];
  } catch {
    return [];
  }
}

// Mengisi pilihan tahun
function setupYears() {
  if (!releaseYear) return;

  const currentYear = new Date().getFullYear();

  for (let year = currentYear; year >= 1900; year--) {
    if (releaseYear.querySelector(`option[value="${year}"]`)) {
      continue;
    }

    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    releaseYear.appendChild(option);
  }
}

// Animasi halaman
function animatePage(element) {
  if (!element) return;

  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "pageFade .45s ease both";
}

// Mengambil data TMDB
async function fetchMovies(endpoint) {
  if (!API_KEY) {
    throw new Error("API key TMDB belum diisi.");
  }

  const separator = endpoint.includes("?") ? "&" : "?";

  const url =
    `${BASE_URL}${endpoint}${separator}` +
    `api_key=${encodeURIComponent(API_KEY)}&language=id-ID`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status}`);
  }

  return response.json();
}

// Mengamankan teks HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Menyimpan data film
function rememberMovies(movies) {
  (movies || []).forEach(movie => {
    if (!movie?.id) return;

    const oldMovie = movieCache.get(String(movie.id)) || {};

    movieCache.set(String(movie.id), {
      ...oldMovie,
      ...movie
    });
  });
}

// Membuat kartu film
function createMovieCard(movie) {
  rememberMovies([movie]);

  const card = document.createElement("button");
  card.type = "button";
  card.className = "movie-card";

  card.setAttribute(
    "aria-label",
    `Detail ${movie.title || "film"}`
  );

  const poster = movie.poster_path
    ? IMAGE_URL + movie.poster_path
    : "";

  const year = (movie.release_date || "").slice(0, 4);

  card.innerHTML = `
    <img
      src="${escapeHTML(poster)}"
      alt="Poster ${escapeHTML(movie.title || "Film")}"
      loading="lazy"
    >

    <div class="movie-info">
      <h3>${escapeHTML(movie.title || "Tanpa judul")}</h3>

      <p>⭐ ${
        movie.vote_average
          ? Number(movie.vote_average).toFixed(1)
          : "Belum ada rating"
      }</p>

      ${year
        ? `<p class="movie-year">📅 ${escapeHTML(year)}</p>`
        : ""}
    </div>
  `;

  card.querySelector("img").addEventListener("error", event => {
    event.currentTarget.style.display = "none";
  });

  card.addEventListener("click", () => openMovie(movie.id));

  return card;
}

// Menampilkan kartu film
function renderMovies(container, movies) {
  if (!container) return;

  container.replaceChildren();

  if (!movies || movies.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "Film tidak ditemukan.";

    container.appendChild(message);
    return;
  }

  rememberMovies(movies);

  movies.forEach(movie => {
    container.appendChild(createMovieCard(movie));
  });
}

// Navigasi aktif
function setActiveNav(mode) {
  document.querySelectorAll(".navbar nav a").forEach(link => {
    link.classList.toggle(
      "active",
      mode === "home" && link.getAttribute("href") === "#home"
    );
  });

  favoritesNav?.classList.toggle("active", mode === "favorites");
}

// Memuat kategori Home
async function loadHomeSections() {
  const requestId = ++homeRequest;

  if (sections) sections.hidden = false;
  if (searchResults) searchResults.hidden = true;
  if (sectionTitle) sectionTitle.textContent = "Jelajahi Film";
  if (statusText) statusText.textContent = "Memuat film...";

  async function loadCategory(category) {
    const row = sections?.querySelector(
      `[data-category="${category.id}"] .movie-row`
    );

    if (!row) return true;

    try {
      const data = await fetchMovies(category.url);

      if (requestId !== homeRequest) return false;

      renderMovies(row, data.results || []);
      return true;
    } catch {
      if (requestId === homeRequest) {
        row.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
          "Film gagal dimuat. Periksa koneksi atau API key.";

        row.appendChild(message);
      }

      return false;
    }
  }

  const results = await Promise.all(
    categories.map(loadCategory)
  );

  if (requestId === homeRequest && statusText) {
    statusText.textContent = results.every(Boolean)
      ? ""
      : "Sebagian film gagal dimuat.";
  }
}

// Reset pilihan genre
function resetGenre() {
  searchGenre = "";

  genreFilters?.querySelectorAll(".genre-chip").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.genre === ""
    );
  });
}

// Kembali ke Home
function goHome() {
  searchRequest++;
  searchMode = false;
  favoritesMode = false;
  searchQuery = "";
  searchYear = "";
  searchPage = 1;

  if (searchInput) searchInput.value = "";
  if (releaseYear) releaseYear.value = "";

  resetGenre();
  setActiveNav("home");

  if (sections) sections.hidden = false;
  if (searchResults) searchResults.hidden = true;
  searchMovieRow?.replaceChildren();

  if (loadMoreBtn) loadMoreBtn.hidden = true;
  if (statusText) statusText.textContent = "";

  animatePage(sections);
  window.scrollTo({ top: 0, behavior: "smooth" });

  loadHomeSections();
}


// Membuat URL pencarian
function buildSearchEndpoint(query, year, genre, page) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  if (query) {
    params.set("query", query);

    if (year) {
      params.set("primary_release_year", year);
    }

    return `/search/movie?${params.toString()}`;
  }

  if (year) params.set("primary_release_year", year);
  if (genre) params.set("with_genres", genre);

  params.set("sort_by", "popularity.desc");
  params.set("include_adult", "false");

  return `/discover/movie?${params.toString()}`;
}

// Judul hasil pencarian
function updateSearchTitle(query, year, genre) {
  const selected = genreFilters?.querySelector(
    `[data-genre="${genre}"]`
  );

  const parts = [];

  if (query) parts.push(`"${query}"`);
  if (genre && selected) parts.push(selected.textContent.trim());
  if (year) parts.push(year);

  if (sectionTitle) {
    sectionTitle.textContent = parts.length
      ? `Hasil: ${parts.join(" • ")}`
      : "Jelajahi Film";
  }
}

// Pencarian film
async function searchMovies(query, year, genre, page = 1) {
  searchMode = true;
  favoritesMode = false;

  searchQuery = query;
  searchYear = year;
  searchGenre = genre;
  searchPage = page;

  homeRequest++;
  setActiveNav("search");

  if (sections) sections.hidden = true;
  if (searchResults) searchResults.hidden = false;

  updateSearchTitle(query, year, genre);

  if (page === 1) {
    searchMovieRow?.replaceChildren();

    if (loadMoreBtn) loadMoreBtn.hidden = true;
    if (statusText) statusText.textContent = "Mencari film...";

    animatePage(searchResults);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Memuat...";
  }

  const requestId = ++searchRequest;

  try {
    const endpoint = buildSearchEndpoint(
      query,
      year,
      genre,
      page
    );

    const data = await fetchMovies(endpoint);

    if (requestId !== searchRequest) return;

    let movies = data.results || [];

    if (query && genre) {
      movies = movies.filter(movie =>
        (movie.genre_ids || []).includes(Number(genre))
      );
    }

    if (year) {
      movies = movies.filter(movie =>
        (movie.release_date || "").startsWith(year)
      );
    }

    if (page === 1) {
      renderMovies(searchMovieRow, movies);
    } else {
      rememberMovies(movies);

      movies.forEach(movie => {
        searchMovieRow?.appendChild(createMovieCard(movie));
      });
    }

    if (statusText) {
      statusText.textContent = movies.length
        ? `Halaman ${page} dari ${data.total_pages || 1}`
        : "Film tidak ditemukan. Coba filter lain.";
    }

    if (loadMoreBtn) {
      loadMoreBtn.hidden =
        !movies.length || page >= (data.total_pages || 1);
    }
  } catch {
    if (requestId === searchRequest && statusText) {
      statusText.textContent =
        "Pencarian gagal. Periksa koneksi dan API key TMDB.";
    }
  } finally {
    if (requestId === searchRequest && loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Muat Lebih Banyak";
    }
  }
}

// Tombol filter genre
genreFilters?.addEventListener("click", event => {
  const button = event.target.closest(".genre-chip");
  if (!button) return;

  genreFilters.querySelectorAll(".genre-chip").forEach(chip => {
    chip.classList.toggle("active", chip === button);
  });

  searchGenre = button.dataset.genre || "";

  const query = searchInput?.value.trim() || "";
  const year = releaseYear?.value || "";

  if (query || year || searchGenre) {
    searchMovies(query, year, searchGenre, 1);
  } else {
    goHome();
  }
});

// Menampilkan film favorit
async function showFavorites() {
  searchRequest++;
  homeRequest++;

  searchMode = false;
  favoritesMode = true;

  setActiveNav("favorites");

  if (sections) sections.hidden = true;
  if (searchResults) searchResults.hidden = false;
  if (sectionTitle) sectionTitle.textContent = "Film Favorit ❤️";

  searchMovieRow?.replaceChildren();

  if (loadMoreBtn) loadMoreBtn.hidden = true;
  if (statusText) statusText.textContent = "Memuat favorit...";

  animatePage(searchResults);
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (!favorites.length) {
    if (statusText) {
      statusText.textContent = "Kamu belum punya film favorit.";
    }
    return;
  }

  const movies = await Promise.all(
    favorites.map(async id => {
      const cached = movieCache.get(id);

      if (cached?.title && cached.overview !== undefined) {
        return cached;
      }

      try {
        const movie = await fetchMovies(`/movie/${id}`);
        rememberMovies([movie]);
        return movie;
      } catch {
        return cached || null;
      }
    })
  );

  if (!favoritesMode) return;

  const validMovies = movies
    .filter(Boolean)
    .filter(movie => favorites.includes(String(movie.id)));

  renderMovies(searchMovieRow, validMovies);

  if (statusText) {
    statusText.textContent = validMovies.length
      ? ""
      : "Film favorit gagal dimuat. Periksa koneksi.";
  }
}

// Menambah atau menghapus favorit
function toggleFavorite(id) {
  const movieId = String(id);

  favorites = favorites.includes(movieId)
    ? favorites.filter(item => item !== movieId)
    : [...favorites, movieId];

  try {
    localStorage.setItem(
      "jflixFavorites",
      JSON.stringify(favorites)
    );
  } catch {
    if (statusText) {
      statusText.textContent =
        "Favorit tidak bisa disimpan di browser ini.";
    }
  }

  const button = modalContent?.querySelector("#favoriteButton");

  if (button) {
    button.textContent = favorites.includes(movieId)
      ? "❤️ Hapus Favorit"
      : "🤍 Tambah Favorit";
  }

  if (favoritesMode) showFavorites();
}


// Membuka detail film
async function openMovie(id) {
  const requestId = ++detailRequest;

  trailerRequest++;

  if (!modal || !modalContent) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  modalContent.innerHTML = `
    <button class="close-modal" type="button"
      aria-label="Tutup">✕</button>

    <div class="modal-info">
      <h2>Memuat detail film...</h2>
      <p>Mohon tunggu sebentar.</p>
    </div>
  `;

  modalContent.querySelector(".close-modal")
    .addEventListener("click", closeModal);

  try {
    const movie = await fetchMovies(`/movie/${id}`);

    if (requestId !== detailRequest) return;

    rememberMovies([movie]);

    const year = (movie.release_date || "").slice(0, 4);

    const rating = movie.vote_average
      ? Number(movie.vote_average).toFixed(1)
      : "Belum ada rating";

    const isFavorite = favorites.includes(String(id));

    modalContent.innerHTML = `
      <button class="close-modal" type="button"
        aria-label="Tutup">✕</button>

      ${
        movie.backdrop_path
          ? `<img class="modal-backdrop"
              src="${BACKDROP_URL + movie.backdrop_path}"
              alt="Gambar ${escapeHTML(movie.title)}">`
          : movie.poster_path
            ? `<img class="modal-backdrop"
                src="${IMAGE_URL + movie.poster_path}"
                alt="Poster ${escapeHTML(movie.title)}">`
            : ""
      }

      <div class="modal-info">
        <h2>${escapeHTML(movie.title || "Tanpa judul")}</h2>

        <p>⭐ ${rating} / 10</p>

        <p>📅 Tahun rilis:
          ${escapeHTML(year || "Belum tersedia")}
        </p>

        <p>🎭 Genre:
          ${escapeHTML(
            (movie.genres || [])
              .map(item => item.name)
              .join(", ") || "Belum tersedia"
          )}
        </p>

        <h3>Sinopsis</h3>

        <p>${escapeHTML(
          movie.overview || "Sinopsis belum tersedia."
        )}</p>

        <button id="favoriteButton" type="button">
          ${isFavorite
            ? "❤️ Hapus Favorit"
            : "🤍 Tambah Favorit"}
        </button>

        <button id="trailerButton" type="button">
          ▶ Tonton Trailer
        </button>

        <div id="trailerContainer"></div>
      </div>
    `;

    modalContent.querySelector(".close-modal")
      .addEventListener("click", closeModal);

    modalContent.querySelector("#favoriteButton")
      .addEventListener("click", () => toggleFavorite(id));

    modalContent.querySelector("#trailerButton")
      .addEventListener("click", () => loadTrailer(id));

  } catch {
    if (requestId !== detailRequest) return;

    modalContent.innerHTML = `
      <button class="close-modal" type="button"
        aria-label="Tutup">✕</button>

      <div class="modal-info">
        <h2>Detail film gagal dimuat</h2>
        <p>Periksa koneksi internet atau API key TMDB.</p>

        <button id="retryDetail" type="button">
          Coba Lagi
        </button>
      </div>
    `;

    modalContent.querySelector(".close-modal")
      .addEventListener("click", closeModal);

    modalContent.querySelector("#retryDetail")
      .addEventListener("click", () => openMovie(id));
  }
}

// Memuat trailer film
async function loadTrailer(id) {
  const container =
    modalContent?.querySelector("#trailerContainer");

  const button =
    modalContent?.querySelector("#trailerButton");

  if (!container || !button) return;

  const requestId = ++trailerRequest;

  button.disabled = true;
  container.replaceChildren();

  const message = document.createElement("p");
  message.textContent = "Mencari trailer film...";
  container.appendChild(message);

  try {
    const data = await fetchMovies(`/movie/${id}/videos`);

    if (
      requestId !== trailerRequest ||
      !modal ||
      modal.hidden ||
      !modalContent.contains(container)
    ) {
      return;
    }

    const videos = (data.results || [])
      .filter(video => video.site === "YouTube" && video.key);

    const priority = {
      Trailer: 1,
      Teaser: 2,
      Clip: 3,
      Featurette: 4
    };

    videos.sort((a, b) =>
      (priority[a.type] || 5) - (priority[b.type] || 5)
    );

    const video = videos[0];

    if (!video) {
      container.replaceChildren();

      const text = document.createElement("p");
      text.textContent = "Trailer belum tersedia.";

      const movie = movieCache.get(String(id));
      const link = document.createElement("a");

      link.href =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(
          (movie?.title || "film") + " official trailer"
        );

      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "🔎 Cari trailer di YouTube";

      container.append(text, link);
      return;
    }

    container.replaceChildren();

    const iframe = document.createElement("iframe");

    iframe.src =
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(video.key);

    iframe.title = video.name || "Trailer film";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";

    container.appendChild(iframe);

  } catch {
    if (requestId !== trailerRequest) return;

    container.replaceChildren();

    const text = document.createElement("p");
    text.textContent = "Trailer belum tersedia.";

    const movie = movieCache.get(String(id));
    const link = document.createElement("a");

    link.href =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(
        (movie?.title || "film") + " official trailer"
      );

    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "🔎 Cari trailer di YouTube";

    container.append(text, link);

  } finally {
    if (requestId === trailerRequest) {
      button.disabled = false;
    }
  }
}

// Menutup modal
function closeModal() {
  detailRequest++;
  trailerRequest++;

  if (modal) modal.hidden = true;
  modalContent?.replaceChildren();
  document.body.style.overflow = "";
}

// Form pencarian
searchForm?.addEventListener("submit", event => {
  event.preventDefault();

  const query = searchInput?.value.trim() || "";
  const year = releaseYear?.value || "";
  const genre = searchGenre;

  if (query || year || genre) {
    searchMovies(query, year, genre, 1);
  } else {
    goHome();
  }
});

// Tombol muat lebih banyak
loadMoreBtn?.addEventListener("click", () => {
  if (searchMode && !loadMoreBtn.disabled) {
    searchMovies(
      searchQuery,
      searchYear,
      searchGenre,
      searchPage + 1
    );
  }
});

// Tombol favorit
favoritesNav?.addEventListener("click", event => {
  event.preventDefault();
  showFavorites();
});

// Tombol Home dan logo footer
document.querySelectorAll(
  '.navbar a[href="#home"], .footer-logo'
).forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    closeModal();
    goHome();
  });
});

// Menutup modal jika area luar diklik
modal?.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

// Menutup modal dengan Escape
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal && !modal.hidden) {
    closeModal();
  }
});

// Menjalankan website
setupYears();
loadHomeSections();


// Menutup modal
function closeModal() {
  detailRequest++;
  trailerRequest++;

  if (modal) modal.hidden = true;
  modalContent?.replaceChildren();
  document.body.style.overflow = "";
}

// Form pencarian
searchForm?.addEventListener("submit", event => {
  event.preventDefault();

  const query = searchInput?.value.trim() || "";
  const year = releaseYear?.value || "";
  const genre = searchGenre;

  if (query || year || genre) {
    searchMovies(query, year, genre, 1);
  } else {
    goHome();
  }
});

// Tombol muat lebih banyak
loadMoreBtn?.addEventListener("click", () => {
  if (searchMode && !loadMoreBtn.disabled) {
    searchMovies(
      searchQuery,
      searchYear,
      searchGenre,
      searchPage + 1
    );
  }
});

// Tombol favorit
favoritesNav?.addEventListener("click", event => {
  event.preventDefault();
  showFavorites();
});

// Tombol Home dan logo footer
document.querySelectorAll(
  '.navbar a[href="#home"], .footer-logo'
).forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    closeModal();
    goHome();
  });
});

// Menutup modal saat area luar diklik
modal?.addEventListener("click", event => {
  if (event.target === modal) {
    closeModal();
  }
});

// Menutup modal dengan Escape
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal && !modal.hidden) {
    closeModal();
  }
});

// Menjalankan website
setupYears();
loadHomeSections();
