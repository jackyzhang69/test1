require('dotenv').config();
const express = require('express');
const path = require('path');

// Import shared services
const authService = require('../../shared/services/auth.service');
const formService = require('../../shared/services/form.service');
const formFillingService = require('../../shared/services/form-filling.service');
const databaseService = require('../../shared/services/database.service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
  console.log('Serving web-index.html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../client/web-index.html'));
});

// Serve specific static files for web version
app.get('/web-renderer.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../client/web-renderer.js'));
});

app.get('/styles.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, '../../styles.css'));
});

app.get('/assets/:filename', (req, res) => {
  res.sendFile(path.join(__dirname, '../../assets', req.params.filename));
});

// Prevent desktop files from being loaded
app.get('/renderer.js', (req, res) => {
  res.status(404).send('Desktop renderer not available in web version');
});

app.get('/index.html', (req, res) => {
  res.status(404).send('Desktop index not available in web version');
});

// API Routes using shared services

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }
    
    const user = await authService.login(email, password);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    res.json({ 
      success: true, 
      user: { _id: user._id, email: user.email } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Form data endpoints
app.post('/api/form-data', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }
    
    const formData = await formService.getFormDataByUserId(userId);
    
    res.json({ 
      success: true, 
      data: formData 
    });
  } catch (error) {
    console.error('Form data error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch form data' 
    });
  }
});

app.get('/api/form-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const formData = await formService.getFormDataById(id);
    
    if (!formData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form data not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: formData 
    });
  } catch (error) {
    console.error('Get form data error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch form data' 
    });
  }
});

app.delete('/api/form-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await formService.deleteFormData(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: 'Form data not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Form data deleted successfully' 
    });
  } catch (error) {
    console.error('Delete form data error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete form data' 
    });
  }
});

// Automation endpoints
app.post('/api/run-automation', async (req, res) => {
  try {
    const { formData, headless, timeout } = req.body;
    
    if (!formData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form data is required' 
      });
    }
    
    // Validate form data
    const validation = formFillingService.validateFormData(formData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form data',
        details: validation.errors 
      });
    }
    
    // Set up response for real-time updates
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    // Progress callback to send updates to client
    const progressCallback = (message) => {
      res.write(JSON.stringify(message) + '\n');
    };
    
    // Run automation with progress updates
    const result = await formFillingService.runFormFilling(formData, {
      headless: headless !== false,
      timeout: timeout || 30,
      progressCallback: progressCallback,
      logger: progressCallback
    });
    
    // Send final result
    res.write(JSON.stringify(result) + '\n');
    res.end();
    
  } catch (error) {
    console.error('Automation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    } else {
      res.write(JSON.stringify({ 
        success: false, 
        error: error.message 
      }) + '\n');
      res.end();
    }
  }
});

// System endpoints
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await databaseService.ping();
    const automationInfo = await formFillingService.getAutomationInfo();
    
    res.json({
      success: true,
      status: 'healthy',
      database: dbHealth ? 'connected' : 'disconnected',
      automation: automationInfo.available ? 'available' : 'unavailable',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/automation/test', async (req, res) => {
  try {
    const result = await formFillingService.runTestAutomation();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`FormBro Web Server running at http://localhost:${PORT}`);
  console.log('Open your browser and go to the URL above to use the web interface.');
  
  // Test database connection on startup
  try {
    await databaseService.connect();
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
});

module.exports = app;