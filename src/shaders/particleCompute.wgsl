// WebGPU Compute Shader for Particle System
// High-performance particle simulation for v1z3r

struct Particle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  color: vec4<f32>,
  life: f32,
  size: f32,
  audioInfluence: f32,
  _padding: f32,
}

struct SimulationParams {
  deltaTime: f32,
  time: f32,
  audioLevel: f32,
  audioFrequency: f32,
  gravity: vec3<f32>,
  windForce: vec3<f32>,
  attractorPosition: vec3<f32>,
  attractorStrength: f32,
  turbulence: f32,
  damping: f32,
  particleCount: u32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimulationParams;
@group(0) @binding(2) var<storage, read> audioData: array<f32, 512>;

// Noise function for turbulence
fn noise3D(p: vec3<f32>) -> f32 {
  let s = vec3<f32>(7.0, 157.0, 113.0);
  let ip = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  var result = 0.0;
  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 2; j++) {
      for (var k = 0; k < 2; k++) {
        let offset = vec3<f32>(f32(i), f32(j), f32(k));
        let h = dot(ip + offset, s);
        let n = fract(sin(h) * 43758.5453);
        let w = f - offset;
        result += n * (1.0 - abs(w.x)) * (1.0 - abs(w.y)) * (1.0 - abs(w.z));
      }
    }
  }
  
  return result;
}

// Audio-reactive force calculation
fn calculateAudioForce(position: vec3<f32>, audioInfluence: f32) -> vec3<f32> {
  let audioIndex = u32(abs(position.x + position.y + position.z) * 100.0) % 512u;
  let audioValue = audioData[audioIndex];
  
  let force = vec3<f32>(
    sin(params.time * 2.0 + position.x) * audioValue,
    cos(params.time * 1.5 + position.y) * audioValue,
    sin(params.time * 3.0 + position.z) * audioValue
  ) * audioInfluence * params.audioLevel;
  
  return force;
}

// Attractor force calculation
fn calculateAttractorForce(position: vec3<f32>) -> vec3<f32> {
  let toAttractor = params.attractorPosition - position;
  let distance = length(toAttractor);
  
  if (distance < 0.1) {
    return vec3<f32>(0.0);
  }
  
  let force = normalize(toAttractor) * params.attractorStrength / (distance * distance);
  return force;
}

// Main compute function
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= params.particleCount) {
    return;
  }
  
  var particle = particles[index];
  
  // Apply forces
  var acceleration = vec3<f32>(0.0);
  
  // Gravity
  acceleration += params.gravity;
  
  // Wind with turbulence
  let turbulence = vec3<f32>(
    noise3D(particle.position * 0.1 + params.time * 0.5),
    noise3D(particle.position * 0.1 + params.time * 0.3 + 100.0),
    noise3D(particle.position * 0.1 + params.time * 0.7 + 200.0)
  ) * params.turbulence;
  
  acceleration += params.windForce + turbulence;
  
  // Audio-reactive forces
  acceleration += calculateAudioForce(particle.position, particle.audioInfluence);
  
  // Attractor force
  acceleration += calculateAttractorForce(particle.position);
  
  // Update velocity with damping
  particle.velocity += acceleration * params.deltaTime;
  particle.velocity *= (1.0 - params.damping * params.deltaTime);
  
  // Update position
  particle.position += particle.velocity * params.deltaTime;
  
  // Update life
  particle.life -= params.deltaTime;
  
  // Update size based on audio
  let avgAudio = (params.audioLevel + params.audioFrequency) * 0.5;
  let targetSize = 2.0 + avgAudio * 3.0;
  let lerpFactor = params.deltaTime * 2.0;
  particle.size = particle.size + lerpFactor * (targetSize - particle.size);
  
  // Update color based on velocity and audio
  let speed = length(particle.velocity);
  let hue = (speed * 0.1 + params.time * 0.1) % 1.0;
  particle.color = vec4<f32>(
    sin(hue * 6.28318) * 0.5 + 0.5,
    sin((hue + 0.33) * 6.28318) * 0.5 + 0.5,
    sin((hue + 0.67) * 6.28318) * 0.5 + 0.5,
    particle.life
  );
  
  // Respawn dead particles
  if (particle.life <= 0.0) {
    // Reset particle with random position
    let random = fract(sin(f32(index) * 12.9898 + params.time) * 43758.5453);
    let theta = random * 6.28318;
    let phi = acos(2.0 * fract(random * 2.0) - 1.0);
    let radius = 10.0 + random * 20.0;
    
    particle.position = vec3<f32>(
      radius * sin(phi) * cos(theta),
      radius * sin(phi) * sin(theta),
      radius * cos(phi)
    );
    
    particle.velocity = vec3<f32>(0.0);
    particle.life = 2.0 + random * 3.0;
    particle.size = 1.0 + random * 2.0;
    particle.audioInfluence = 0.5 + random * 0.5;
  }
  
  // Boundary conditions
  let boundary = 50.0;
  if (abs(particle.position.x) > boundary) {
    particle.position.x = sign(particle.position.x) * boundary;
    particle.velocity.x *= -0.5;
  }
  if (abs(particle.position.y) > boundary) {
    particle.position.y = sign(particle.position.y) * boundary;
    particle.velocity.y *= -0.5;
  }
  if (abs(particle.position.z) > boundary) {
    particle.position.z = sign(particle.position.z) * boundary;
    particle.velocity.z *= -0.5;
  }
  
  // Write back
  particles[index] = particle;
}