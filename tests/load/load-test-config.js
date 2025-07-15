/**
 * Load Testing Configuration for v1z3r
 * Comprehensive performance and scalability testing
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('error_rate');
const webglInitTime = new Trend('webgl_init_time');
const effectSwitchTime = new Trend('effect_switch_time');
const websocketLatency = new Trend('websocket_latency');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  scenarios: {
    // Light load test - normal user behavior
    light_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 users
        { duration: '5m', target: 10 },   // Stay at 10 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'light_load' },
    },
    
    // Medium load test - peak usage
    medium_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '3m', target: 50 },   // Ramp up to 50 users
        { duration: '10m', target: 50 },  // Stay at 50 users
        { duration: '3m', target: 100 },  // Spike to 100 users
        { duration: '5m', target: 100 },  // Stay at spike
        { duration: '5m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '1m',
      tags: { scenario: 'medium_load' },
    },
    
    // Heavy load test - stress testing
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 100 },  // Ramp up to 100 users
        { duration: '10m', target: 200 }, // Increase to 200 users
        { duration: '5m', target: 300 },  // Spike to 300 users
        { duration: '10m', target: 300 }, // Stay at stress level
        { duration: '10m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '2m',
      tags: { scenario: 'stress_test' },
    },
    
    // Spike test - sudden traffic bursts
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 20 },   // Normal load
        { duration: '1m', target: 500 },  // Sudden spike
        { duration: '2m', target: 500 },  // Stay at spike
        { duration: '1m', target: 20 },   // Drop back
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'spike_test' },
    },
    
    // API-focused load test
    api_load: {
      executor: 'constant-vus',
      vus: 30,
      duration: '15m',
      tags: { scenario: 'api_load' },
    },
    
    // WebSocket connection test
    websocket_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      tags: { scenario: 'websocket_test' },
    },
  },
  
  thresholds: {
    // HTTP response time thresholds
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    
    // Custom metric thresholds
    error_rate: ['rate<0.01'], // Error rate under 1%
    webgl_init_time: ['p(95)<1000'], // WebGL init under 1s for 95%
    effect_switch_time: ['p(95)<100'], // Effect switching under 100ms
    websocket_latency: ['p(95)<200'], // WebSocket latency under 200ms
    api_response_time: ['p(95)<1000'], // API responses under 1s
  },
};

// Test data
const presetTypes = ['particle', 'wave', 'tunnel', 'mandala', 'fractal'];
const effectTypes = ['blur', 'glow', 'distortion', 'color', 'geometry'];

const testUsers = [
  { email: 'test1@example.com', password: 'TestPassword123!' },
  { email: 'test2@example.com', password: 'TestPassword123!' },
  { email: 'test3@example.com', password: 'TestPassword123!' },
];

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

/**
 * Setup function - runs once per VU before the main function
 */
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  
  // Verify application is responding
  const response = http.get(`${BASE_URL}/api/health`);
  check(response, {
    'Application is healthy': (r) => r.status === 200,
  });
  
  return { baseUrl: BASE_URL, wsUrl: WS_URL };
}

/**
 * Main test function - runs repeatedly for each VU
 */
export default function (data) {
  const scenario = __ENV.SCENARIO || 'mixed';
  
  switch (scenario) {
    case 'api_load':
      testApiEndpoints(data);
      break;
    case 'websocket_test':
      testWebSocketConnection(data);
      break;
    default:
      testUserJourney(data);
      break;
  }
  
  sleep(randomIntBetween(1, 3));
}

/**
 * Test typical user journey
 */
function testUserJourney(data) {
  const user = randomItem(testUsers);
  
  // 1. Visit homepage
  const homeResponse = http.get(`${data.baseUrl}/`);
  check(homeResponse, {
    'Homepage loads': (r) => r.status === 200,
    'Homepage load time OK': (r) => r.timings.duration < 3000,
  });
  
  if (homeResponse.status !== 200) {
    errorRate.add(1);
    return;
  }
  
  sleep(randomIntBetween(1, 3));
  
  // 2. Login
  const loginResponse = authenticateUser(data.baseUrl, user);
  if (!loginResponse) {
    errorRate.add(1);
    return;
  }
  
  const authToken = loginResponse.json('token');
  const headers = { 'Authorization': `Bearer ${authToken}` };
  
  sleep(randomIntBetween(1, 2));
  
  // 3. Load VJ application
  const appResponse = http.get(`${data.baseUrl}/vj-app`, { headers });
  check(appResponse, {
    'VJ app loads': (r) => r.status === 200,
    'VJ app load time OK': (r) => r.timings.duration < 5000,
  });
  
  sleep(randomIntBetween(2, 4));
  
  // 4. Load presets
  testPresetOperations(data.baseUrl, headers);
  
  // 5. Test effect switching
  testEffectSwitching(data.baseUrl, headers);
  
  // 6. Test real-time features
  if (Math.random() < 0.3) { // 30% of users test WebSocket
    testWebSocketFeatures(data.wsUrl, authToken);
  }
  
  sleep(randomIntBetween(1, 2));
}

/**
 * Authenticate user and return response
 */
function authenticateUser(baseUrl, user) {
  const loginPayload = {
    email: user.email,
    password: user.password,
  };
  
  const response = http.post(`${baseUrl}/api/auth/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const loginSuccess = check(response, {
    'Login successful': (r) => r.status === 200,
    'Login response time OK': (r) => r.timings.duration < 2000,
  });
  
  if (loginSuccess) {
    return response;
  }
  
  return null;
}

/**
 * Test preset operations
 */
function testPresetOperations(baseUrl, headers) {
  // Get presets
  const getPresetsResponse = http.get(`${baseUrl}/api/presets`, { headers });
  const getPresetsSuccess = check(getPresetsResponse, {
    'Get presets successful': (r) => r.status === 200,
    'Get presets response time OK': (r) => r.timings.duration < 1000,
  });
  
  apiResponseTime.add(getPresetsResponse.timings.duration);
  
  if (!getPresetsSuccess) {
    errorRate.add(1);
    return;
  }
  
  sleep(1);
  
  // Create new preset (10% chance)
  if (Math.random() < 0.1) {
    const newPreset = {
      name: `Test Preset ${Date.now()}`,
      type: randomItem(presetTypes),
      config: {
        speed: randomIntBetween(1, 10),
        intensity: Math.random(),
        color: `#${Math.random().toString(16).substr(-6)}`,
      },
    };
    
    const createResponse = http.post(`${baseUrl}/api/presets`, JSON.stringify(newPreset), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    
    check(createResponse, {
      'Create preset successful': (r) => r.status === 201,
      'Create preset response time OK': (r) => r.timings.duration < 2000,
    });
    
    apiResponseTime.add(createResponse.timings.duration);
  }
}

/**
 * Test effect switching performance
 */
function testEffectSwitching(baseUrl, headers) {
  const effectType = randomItem(effectTypes);
  const startTime = Date.now();
  
  const response = http.post(`${baseUrl}/api/effects/switch`, JSON.stringify({
    effectType: effectType,
    parameters: {
      intensity: Math.random(),
      speed: randomIntBetween(1, 10),
    },
  }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  
  const switchTime = Date.now() - startTime;
  effectSwitchTime.add(switchTime);
  
  check(response, {
    'Effect switch successful': (r) => r.status === 200,
    'Effect switch time OK': (r) => switchTime < 500,
  });
  
  if (response.status !== 200) {
    errorRate.add(1);
  }
}

/**
 * Test WebSocket connection and real-time features
 */
function testWebSocketFeatures(wsUrl, token) {
  const url = `${wsUrl}/api/websocket?token=${token}`;
  
  const response = ws.connect(url, function (socket) {
    socket.on('open', function open() {
      console.log('WebSocket connected');
      
      // Test ping/pong
      const pingTime = Date.now();
      socket.send(JSON.stringify({ type: 'ping' }));
      
      socket.on('message', function message(data) {
        const msg = JSON.parse(data);
        
        if (msg.type === 'pong') {
          const latency = Date.now() - pingTime;
          websocketLatency.add(latency);
        }
      });
      
      // Send some test messages
      for (let i = 0; i < 3; i++) {
        socket.send(JSON.stringify({
          type: 'sync',
          data: {
            effect: randomItem(effectTypes),
            timestamp: Date.now(),
          },
        }));
        
        sleep(1);
      }
    });
    
    socket.on('error', function error(e) {
      console.log('WebSocket error:', e);
      errorRate.add(1);
    });
    
    sleep(5); // Keep connection open for 5 seconds
  });
  
  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });
}

/**
 * Test API endpoints performance
 */
function testApiEndpoints(data) {
  const endpoints = [
    '/api/health',
    '/api/presets',
    '/api/effects',
    '/api/user/profile',
  ];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${data.baseUrl}${endpoint}`);
    
    check(response, {
      [`${endpoint} responds`]: (r) => r.status < 400,
      [`${endpoint} response time OK`]: (r) => r.timings.duration < 2000,
    });
    
    apiResponseTime.add(response.timings.duration);
    
    if (response.status >= 400) {
      errorRate.add(1);
    }
    
    sleep(0.5);
  });
}

/**
 * Test WebSocket connections specifically
 */
function testWebSocketConnection(data) {
  const url = `${data.wsUrl}/api/websocket`;
  
  const response = ws.connect(url, function (socket) {
    socket.on('open', function open() {
      // Send periodic messages to simulate real usage
      for (let i = 0; i < 10; i++) {
        socket.send(JSON.stringify({
          type: 'test',
          message: `Test message ${i}`,
          timestamp: Date.now(),
        }));
        
        sleep(randomIntBetween(1, 3));
      }
    });
    
    socket.on('error', function error(e) {
      console.log('WebSocket error:', e);
      errorRate.add(1);
    });
    
    sleep(30); // Keep connection open for 30 seconds
  });
  
  check(response, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });
}

/**
 * Teardown function - runs once after all iterations complete
 */
export function teardown(data) {
  console.log('Load test completed');
  
  // Output final metrics summary
  console.log(`Error rate: ${errorRate.rate * 100}%`);
  console.log(`Average API response time: ${apiResponseTime.avg}ms`);
  console.log(`Average WebSocket latency: ${websocketLatency.avg}ms`);
  console.log(`Average effect switch time: ${effectSwitchTime.avg}ms`);
}