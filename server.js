const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URL || 'mongodb://localhost:21017/vcc_db';

// ---------------- MongoDB Connection ----------------
mongoose.connect(MONGO_URI)
  .then(() => console.log('🚀 Connected securely to MongoDB'))
  .catch(err => console.error('MongoDB database connection error:', err.message));

// ---------------- Database Schemas ----------------
const ApiKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const ApiKey = mongoose.model('ApiKey', ApiKeySchema);

const VirtualCardSchema = new mongoose.Schema({
  cardholder: { type: String, required: true },
  cardNumber: { type: String, required: true },
  expiry: { type: String, required: true },
  cvc: { type: String, required: true },
  brand: { type: String, required: true },
  country: { type: String, default: 'United States' },
  createdAt: { type: Date, default: Date.now }
});
const VirtualCard = mongoose.model('VirtualCard', VirtualCardSchema);

// ---------------- Helper Functions using Crypto ----------------
const generateRandomDigits = (length) => {
  let result = '';
  while (result.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 250) {
      result += (byte % 10).toString();
    }
  }
  return result;
};

const generateVccDetails = (brandType) => {
  const isVisa = brandType.toLowerCase() === 'visa';
  const prefix = isVisa ? '4111' : '5211'; 
  const remainingLength = 16 - prefix.length;
  
  const rawDigits = prefix + generateRandomDigits(remainingLength);
  const formattedCardNumber = rawDigits.match(/.{1,4}/g).join(' ');
  const cvv = generateRandomDigits(3);

  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 3);
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const year = String(futureDate.getFullYear()).slice(-2);
  const expiryDate = `${month}/${year}`;

  return { formattedCardNumber, cvv, expiryDate };
};

// ---------------- Middleware ----------------
const authenticateKey = async (req, res, next) => {
  const userKey = req.headers['x-api-key'];
  if (!userKey) {
    return res.status(401).json({ error: "Missing API Key inside x-api-key header." });
  }
  
  const keyExists = await ApiKey.findOne({ key: userKey });
  if (!keyExists) {
    return res.status(403).json({ error: "Unauthorized. Invalid API key." });
  }
  next();
};

// ---------------- API Routes ----------------

// 1. Generate an API Key
app.post('/api/generate-key', async (req, res) => {
  try {
    const rawKey = `vcc_${crypto.randomBytes(24).toString('hex')}`;
    const newKey = new ApiKey({ key: rawKey });
    await newKey.save();

    res.status(201).json({
      success: true,
      apiKey: rawKey,
      message: "API key registered. Pass it inside the 'x-api-key' header."
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate key", details: error.message });
  }
});

// 2. Create Virtual Card (Returns Visual HTML)
app.post('/api/create-card', authenticateKey, async (req, res) => {
  try {
    const { cardholder, brand } = req.body;
    if (!cardholder) {
      return res.status(400).json({ error: "Missing required parameter: cardholder name." });
    }

    const selectedBrand = brand || 'Visa';
    const { formattedCardNumber, cvv, expiryDate } = generateVccDetails(selectedBrand);

    const newCard = new VirtualCard({
      cardholder: cardholder.toUpperCase(),
      cardNumber: formattedCardNumber,
      expiry: expiryDate,
      cvc: cvv,
      brand: selectedBrand,
      country: 'United States'
    });
    await newCard.save();

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #0b0f19; font-family: sans-serif; margin: 0; }
            .card-wrapper { width: 380px; height: 230px; background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%); border-radius: 16px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #fff; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(255,255,255,0.1); position: relative; box-sizing: border-box; }
            .chip-container { display: flex; justify-content: space-between; align-items: center; }
            .emv-chip { width: 45px; height: 32px; background: linear-gradient(135deg, #fef08a, #ca8a04); border-radius: 6px; }
            .card-brand { font-size: 1.4rem; font-weight: bold; font-style: italic; color: #f8fafc; }
            .card-number { font-size: 1.45rem; letter-spacing: 3px; font-family: monospace; color: #f1f5f9; margin: 18px 0; text-shadow: 1px 1px 2px #000; }
            .meta-layout { display: flex; justify-content: space-between; align-items: flex-end; }
            .meta-heading { font-size: 0.6rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 2px; }
            .meta-data { font-size: 0.85rem; letter-spacing: 1px; color: #e2e8f0; font-weight: 500; }
            .flag-badge { font-size: 0.65rem; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; color: #cbd5e1;}
        </style>
    </head>
    <body>
        <div class="card-wrapper">
            <div class="chip-container">
                <div class="emv-chip"></div>
                <div class="card-brand">${newCard.brand}</div>
            </div>
            <div class="card-number">${newCard.cardNumber}</div>
            <div class="meta-layout">
                <div>
                    <div class="meta-heading">Cardholder Name</div>
                    <div class="meta-data">${newCard.cardholder}</div>
                    <div class="flag-badge">🇺🇸 ${newCard.country}</div>
                </div>
                <div style="display: flex; gap: 20px;">
                    <div>
                        <div class="meta-heading">Expires</div>
                        <div class="meta-data">${newCard.expiry}</div>
                    </div>
                    <div>
                        <div class="meta-heading">CVC</div>
                        <div class="meta-data">${newCard.cvc}</div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ error: "VCC creation failed", details: error.message });
  }
});

// 3. GET Route: Fetch all generated virtual cards (Returns pure JSON array)
app.get('/api/cards', authenticateKey, async (req, res) => {
  try {
    const cards = await VirtualCard.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: cards.length, cards });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cards", details: error.message });
  }
});

// NEW 3b. GET Route: Retrieve a single virtual card document using a dynamic ID route param
app.get('/api/cards/retrieve/:id', authenticateKey, async (req, res) => {
  try {
    const cardId = req.params.id;
    
    // Check if the provided ID is a valid 24-character hexadecimal ObjectId
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ error: "Invalid ID syntax template structure provided." });
    }

    const card = await VirtualCard.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: "Card profile document not found with the requested ID." });
    }

    res.status(200).json({ success: true, card });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve card data parameters", details: error.message });
  }
});

// 4. DELETE Route: Delete a specific card using its MongoDB ID string parameter
app.delete('/api/cards/:id', authenticateKey, async (req, res) => {
  try {
    const cardId = req.params.id;
    const deletedCard = await VirtualCard.findByIdAndDelete(cardId);
    
    if (!deletedCard) {
      return res.status(404).json({ error: "Card not found with the provided ID." });
    }
    
    res.status(200).json({ success: true, message: "Virtual card successfully deleted from database." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete card", details: error.message });
  }
});

app.listen(PORT, () => console.log('🚀 Automated VCC Engine online on port \${PORT}'));
