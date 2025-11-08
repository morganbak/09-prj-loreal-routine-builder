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
const WORKER_URL = "https://your-worker.workers.dev/v1/chat"; // replace with your Cloudflare Worker URL

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
        No products found for this category.
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
      </div>
    `;

    card.addEventListener("click", () => toggleProduct(p));
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
    selectedList.innerHTML = `<p class="placeholder-message">No products selected yet.</p>`;
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
      displayProducts(allProducts.filter(prod => prod.category === categoryFilter.value || categoryFilter.value === ""));
    });
    selectedList.appendChild(item);
  });
}

/* === Category Filter === */
categoryFilter.addEventListener("change", async (e) => {
  if (allProducts.length === 0) await loadProducts();
  const selectedCategory = e.target.value;
  const filtered = allProducts.filter(
    (p) => p.category === selectedCategory
  );
  displayProducts(filtered);
});

/* === Generate Routine === */
generateBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    appendBotMessage("Please select at least one product before generating a routine.");
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
    appendBotMessage("Error connecting to the AI. Please check your Worker URL.");
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
