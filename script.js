/* === DOM Elements === */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* === App State === */
let allProducts = [];
let selectedProducts = [];
let messages = [];

/* === Constants === */
const WORKER_URL = "https://lorealchatbot.morgan-baker10.workers.dev"; // replace with your Cloudflare Worker URL

/* === Initial UI Message === */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* === Load Products === */
async function loadProducts() {
  try {
    const res = await fetch("products.json");
    const data = await res.json();
    allProducts = data.products;

    // Restore selections from localStorage (after products load)
    loadFromStorage();
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

/* === Display Filtered Products === */
function displayProducts(products) {
  productsContainer.innerHTML = "";

  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category
      </div>
    `;
    return;
  }

  products.forEach((p) => {
    const card = document.createElement("div");
    card.classList.add("product-card");
    card.dataset.id = p.id;

    if (selectedProducts.find((sp) => sp.id === p.id)) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>${p.brand}</p>
        <button class="more-info-btn">More Info</button>
      </div>
    `;

    // Clicking product toggles selection
    card.addEventListener("click", () => toggleProduct(p));

    // Clicking More Info opens modal
    card.querySelector(".more-info-btn").addEventListener("click", (e) => {
      e.stopPropagation(); // prevent toggling
      openModal(p);
    });

    productsContainer.appendChild(card);
  });
}

/* === Toggle Product Selection === */
function toggleProduct(product) {
  const isSelected = selectedProducts.find((p) => p.id === product.id);

  if (isSelected) {
    selectedProducts = selectedProducts.filter((p) => p.id !== product.id);
  } else {
    selectedProducts.push(product);
  }

  updateSelectedList();
  saveToStorage();

  const currentCat = categoryFilter.value;
  const filtered = allProducts.filter(
    (p) => p.category === currentCat || currentCat === ""
  );
  displayProducts(filtered);
}

/* === Update Selected Products List === */
function updateSelectedList() {
  selectedList.innerHTML = "";

  if (selectedProducts.length === 0) {
    selectedList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`;
    return;
  }

  selectedProducts.forEach((p) => {
    const item = document.createElement("div");
    item.classList.add("selected-item");
    item.innerHTML = `
      <span>${p.name}</span>
      <button class="remove-btn">Remove</button>
    `;
    item.querySelector(".remove-btn").addEventListener("click", () => {
      selectedProducts = selectedProducts.filter((x) => x.id !== p.id);
      updateSelectedList();
      saveToStorage();
      displayProducts(
        allProducts.filter(
          (prod) =>
            prod.category === categoryFilter.value ||
            categoryFilter.value === ""
        )
      );
    });
    selectedList.appendChild(item);
  });

  // Add "Clear All" button
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear All";
  clearBtn.classList.add("generate-btn");
  clearBtn.style.marginTop = "10px";
  clearBtn.addEventListener("click", clearAllSelections);
  selectedList.appendChild(clearBtn);
}

/* === Clear All Selections === */
function clearAllSelections() {
  selectedProducts = [];
  updateSelectedList();
  saveToStorage();
  const currentCat = categoryFilter.value;
  const filtered = allProducts.filter(
    (p) => p.category === currentCat || currentCat === ""
  );
  displayProducts(filtered);
}

/* === Save & Load from LocalStorage === */
function saveToStorage() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

function loadFromStorage() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    try {
      selectedProducts = JSON.parse(saved);
      updateSelectedList();
    } catch (e) {
      console.error("Error loading saved products:", e);
    }
  }
}

/* === Category + Search Filter === */
const searchInput = document.getElementById("searchInput");

async function filterProducts() {
  if (allProducts.length === 0) await loadProducts();

  const selectedCategory = categoryFilter.value;
  const searchTerm = searchInput.value.toLowerCase();

  let filtered = allProducts.filter((p) => {
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm) ||
      p.brand.toLowerCase().includes(searchTerm) ||
      (p.description && p.description.toLowerCase().includes(searchTerm));

    return matchesCategory && matchesSearch;
  });

  displayProducts(filtered);
}

categoryFilter.addEventListener("change", filterProducts);
searchInput.addEventListener("input", filterProducts);

/* === Generate Routine === */
generateBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    appendBotMessage(
      "Please select at least one product before generating a routine."
    );
    return;
  }

  appendUserMessage("Generate a skincare routine for my selected products.");
  appendBotMessage("Building your personalized routine...");

  const systemPrompt = `
    You are a L’Oréal skincare and beauty advisor. Using ONLY the selected products,
    build a practical, safe daily routine. Include AM/PM steps, frequency, and short
    reasoning. Avoid recommending outside products. Keep it concise and professional.
  `;

  messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify(selectedProducts) },
  ];

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
      }),
    });

    const result = await response.json();
    const reply =
      result?.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t generate a routine right now.";
    appendBotMessage(reply);
    messages.push({ role: "assistant", content: reply });
  } catch (error) {
    appendBotMessage(
      "Error connecting to the AI. Please check your Worker URL."
    );
    console.error(error);
  }
});

/* === Chat === */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendUserMessage(text);
  messages.push({ role: "user", content: text });
  appendBotMessage("Thinking...");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
      }),
    });

    const result = await response.json();
    const reply =
      result?.choices?.[0]?.message?.content ||
      "Sorry, I couldn’t find an answer.";
    appendBotMessage(reply);
    messages.push({ role: "assistant", content: reply });
    userInput.value = "";
  } catch (error) {
    appendBotMessage("Error connecting to AI. Check your Worker setup.");
  }
});

/* === Message Helpers === */
function appendUserMessage(text) {
  const msg = document.createElement("div");
  msg.classList.add("message", "user-msg");
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendBotMessage(text) {
  const msg = document.createElement("div");
  msg.classList.add("message", "bot-msg");
  msg.innerHTML = text.replace(/\n/g, "<br>");
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* === Product Description Modal === */
const modal = document.getElementById("productModal");
const modalTitle = document.getElementById("modalTitle");
const modalBrand = document.getElementById("modalBrand");
const modalDesc = document.getElementById("modalDesc");
const closeBtn = document.querySelector(".close-btn");

function openModal(product) {
  modalTitle.textContent = product.name;
  modalBrand.textContent = product.brand;
  modalDesc.textContent = product.description || "No description available.";
  modal.style.display = "flex";
}

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

/* === Initialize on Page Load === */
window.addEventListener("DOMContentLoaded", loadProducts);


/* === RTL Toggle === */
const rtlToggle = document.getElementById("rtlToggle");

rtlToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("rtl");
  const isRTL = document.documentElement.classList.contains("rtl");
  localStorage.setItem("rtlMode", isRTL ? "true" : "false");
});

// Keep saved mode on reload
window.addEventListener("DOMContentLoaded", () => {
  const savedRTL = localStorage.getItem("rtlMode");
  if (savedRTL === "true") {
    document.documentElement.classList.add("rtl");
  }
});
