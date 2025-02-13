require('dotenv').config();
const { chromium } = require('playwright');
const { connectMongo } = require('./config');
const FormFillingData = require('./form_filling_data');
const { WebFiller } = require('./webfiller');
const { login } = require('./auth');

async function main() {
  try {
    // User login
    const email = "noah.consultant@outlook.com";
    const password = "Zxy690211!";
    const result = await login(email, password);
    const user = Array.isArray(result) ? result[0] : result;
    if (!user) {
      console.error("Login failed!");
      process.exit(1);
    }
    console.log("Login successful:", user.email);

    // Use existing MongoDB connection
    const db = await connectMongo();
    const formFillingData = await db.collection('formfillingdata')
      .find({ user_id: String(user._id) }).toArray();

    
    const form1 = formFillingData[0];
    const form1Data = new FormFillingData(form1);

    // Initialize WebFiller instance with form1Data
    const filler = new WebFiller(form1Data);
    filler.actions = form1Data.actions;

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await filler.fill(page);
    console.log("Form filled successfully");

    await browser.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error); 