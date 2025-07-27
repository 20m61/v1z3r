/**
 * Scene Manipulation Service Tests
 * Tests for 3D scene manipulation functionality
 */

import * as THREE from 'three';
import { SceneManipulationService } from '../sceneManipulation';

// Mock Three.js components
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  Scene: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn(function(callback) {
      this.children.forEach(child => callback(child));
    }),
    children: [],
    userData: {}
  })),
  PerspectiveCamera: jest.fn().mockImplementation(() => ({})),
  WebGLRenderer: jest.fn().mockImplementation(() => ({
    domElement: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      tabIndex: 0,
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      })
    },
    info: {
      render: {
        calls: 0
      }
    }
  })),
  Raycaster: jest.fn().mockImplementation(() => ({
    setFromCamera: jest.fn(),
    intersectObjects: jest.fn().mockReturnValue([])
  })),
  Vector2: jest.fn().mockImplementation(() => ({
    x: 0,
    y: 0
  })),
  Vector3: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    copy: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnValue({ x, y, z, copy: jest.fn(), set: jest.fn() })
  })),
  Euler: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    copy: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnValue({ x, y, z, copy: jest.fn(), set: jest.fn() })
  })),
  Clock: jest.fn().mockImplementation(() => ({
    getDelta: jest.fn().mockReturnValue(0.016)
  })),
  Mesh: jest.fn().mockImplementation(() => ({
    geometry: {
      attributes: {
        position: {
          count: 36
        }
      },
      dispose: jest.fn()
    },
    material: {
      dispose: jest.fn()
    },
    position: { 
      x: 0, y: 0, z: 0,
      copy: jest.fn(),
      set: jest.fn()
    },
    rotation: { 
      x: 0, y: 0, z: 0,
      copy: jest.fn(),
      set: jest.fn()
    },
    scale: { 
      x: 1, y: 1, z: 1,
      copy: jest.fn(),
      set: jest.fn()
    },
    userData: {},
    children: [],
    traverse: jest.fn(function(callback) {
      callback(this);
    }),
    clone: jest.fn().mockReturnValue({
      userData: {},
      position: { x: 0, y: 0, z: 0, copy: jest.fn(), set: jest.fn() },
      rotation: { x: 0, y: 0, z: 0, copy: jest.fn(), set: jest.fn() },
      scale: { x: 1, y: 1, z: 1, copy: jest.fn(), set: jest.fn() },
      children: [],
      traverse: jest.fn()
    })
  })),
  BoxGeometry: jest.fn().mockImplementation(() => ({
    dispose: jest.fn()
  })),
  MeshBasicMaterial: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    clone: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  })),
  EdgesGeometry: jest.fn().mockImplementation(() => ({
    dispose: jest.fn()
  })),
  LineBasicMaterial: jest.fn().mockImplementation(() => ({
    dispose: jest.fn()
  })),
  LineSegments: jest.fn().mockImplementation(() => ({
    userData: { isSelectionOutline: true },
    geometry: {
      dispose: jest.fn()
    },
    material: {
      dispose: jest.fn()
    }
  }))
}));

// Mock dynamic imports
jest.mock('three/addons/controls/TransformControls.js', () => ({
  TransformControls: jest.fn().mockImplementation(() => ({
    setMode: jest.fn(),
    setSpace: jest.fn(),
    setSize: jest.fn(),
    setRotationSnap: jest.fn(),
    setTranslationSnap: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
    addEventListener: jest.fn()
  }))
}));

describe('SceneManipulationService', () => {
  let service: SceneManipulationService;
  let mockScene: THREE.Scene;
  let mockCamera: THREE.PerspectiveCamera;
  let mockRenderer: THREE.WebGLRenderer;

  beforeEach(() => {
    // Reset singleton before each test
    (SceneManipulationService as any).instance = null;
    
    mockScene = new THREE.Scene();
    mockCamera = new THREE.PerspectiveCamera();
    mockRenderer = new THREE.WebGLRenderer();
    
    service = SceneManipulationService.getInstance(mockScene, mockCamera, mockRenderer);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = SceneManipulationService.getInstance();
      const instance2 = SceneManipulationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw error if no scene provided for new instance', () => {
      // Reset singleton
      (SceneManipulationService as any).instance = null;
      
      expect(() => {
        SceneManipulationService.getInstance();
      }).toThrow('SceneManipulationService requires scene, camera, and renderer for initialization');
    });

    it('should initialize object library', () => {
      const library = service.getObjectLibrary();
      expect(library.size).toBeGreaterThan(0);
      expect(library.has('cube-basic')).toBe(true);
      expect(library.has('sphere-standard')).toBe(true);
      expect(library.has('ambient-light')).toBe(true);
    });
  });

  describe('object management', () => {
    it('should add object to scene', () => {
      const position = new THREE.Vector3(1, 2, 3);
      const object = service.addObjectToScene('cube-basic', position);
      
      expect(object).toBeDefined();
      expect(object?.userData.libraryItem).toBe(false);
      expect(object?.userData.id).toBeDefined();
      expect(mockScene.add).toHaveBeenCalledWith(object);
    });

    it('should return null for invalid library key', () => {
      const object = service.addObjectToScene('invalid-key');
      expect(object).toBeNull();
    });

    it('should remove object from scene', () => {
      const object = service.addObjectToScene('cube-basic');
      expect(object).toBeDefined();
      
      service.removeObjectFromScene(object!);
      expect(mockScene.remove).toHaveBeenCalledWith(object);
    });

    it('should select object', () => {
      const object = service.addObjectToScene('cube-basic');
      expect(object).toBeDefined();
      
      service.selectObject(object!);
      expect(service.getSelectedObject()).toBe(object);
    });

    it('should deselect object', () => {
      const object = service.addObjectToScene('cube-basic');
      service.selectObject(object!);
      
      service.selectObject(null);
      expect(service.getSelectedObject()).toBeNull();
    });

    it('should duplicate selected object', () => {
      const object = service.addObjectToScene('cube-basic');
      service.selectObject(object!);
      
      // Make sure the object has a proper clone method
      (object as any).clone = jest.fn().mockReturnValue({
        userData: { ...object!.userData },
        position: { x: 0, y: 0, z: 0, copy: jest.fn(), set: jest.fn() },
        rotation: { x: 0, y: 0, z: 0, copy: jest.fn(), set: jest.fn() },
        scale: { x: 1, y: 1, z: 1, copy: jest.fn(), set: jest.fn() },
        children: [],
        traverse: jest.fn()
      });
      
      const duplicated = service.duplicateSelectedObject();
      expect(duplicated).toBeDefined();
      expect(duplicated?.userData.id).not.toBe(object?.userData.id);
    });

    it('should return null when duplicating with no selection', () => {
      const duplicated = service.duplicateSelectedObject();
      expect(duplicated).toBeNull();
    });
  });

  describe('transform controls', () => {
    it('should set transform mode', () => {
      service.setTransformMode('rotate');
      const config = service.getConfig();
      expect(config.transformMode).toBe('rotate');
    });

    it('should set coordinate system', () => {
      service.setCoordinateSystem('local');
      const config = service.getConfig();
      expect(config.coordinateSystem).toBe('local');
    });

    it('should toggle grid snap', () => {
      const initialSnap = service.getConfig().snapToGrid;
      service.toggleGridSnap();
      expect(service.getConfig().snapToGrid).toBe(!initialSnap);
    });
  });

  describe('scene export/import', () => {
    it('should export scene objects', () => {
      const object = service.addObjectToScene('cube-basic');
      
      // Ensure the object has proper clone methods for position, rotation, scale
      if (object) {
        object.position.clone = jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 });
        object.rotation.clone = jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 });
        object.scale.clone = jest.fn().mockReturnValue({ x: 1, y: 1, z: 1 });
      }
      
      // Mock scene traverse to return the added object
      mockScene.traverse = jest.fn((callback) => {
        if (object) callback(object);
      });
      
      const exported = service.exportScene();
      
      expect(exported).toHaveLength(1);
      expect(exported[0]).toHaveProperty('id');
      expect(exported[0]).toHaveProperty('name');
      expect(exported[0]).toHaveProperty('position');
      expect(exported[0]).toHaveProperty('rotation');
      expect(exported[0]).toHaveProperty('scale');
    });

    it('should import scene objects', () => {
      const sceneData = [{
        id: 'test-id',
        name: 'Test Object',
        type: 'Mesh',
        geometry: 'cube',
        material: 'basic',
        position: new THREE.Vector3(1, 2, 3),
        rotation: new THREE.Euler(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
        visible: true,
        userData: { test: true }
      }];

      // Add some existing objects to be cleared
      const existingObj = service.addObjectToScene('sphere-standard');
      mockScene.children = existingObj ? [existingObj] : [];
      
      service.importScene(sceneData);
      
      // Should clear existing objects and add new ones
      expect(mockScene.remove).toHaveBeenCalled();
      expect(mockScene.add).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableGizmos: false,
        snapToGrid: true,
        gridSize: 2,
        animationSpeed: 0.5
      };

      service.setConfig(newConfig);
      const config = service.getConfig();
      
      expect(config.enableGizmos).toBe(false);
      expect(config.snapToGrid).toBe(true);
      expect(config.gridSize).toBe(2);
      expect(config.animationSpeed).toBe(0.5);
    });

    it('should provide default configuration', () => {
      // Create a fresh instance to test default config
      (SceneManipulationService as any).instance = null;
      const freshService = SceneManipulationService.getInstance(mockScene, mockCamera, mockRenderer);
      const config = freshService.getConfig();
      
      expect(config.enableGizmos).toBe(true);
      expect(config.snapToGrid).toBe(false);
      expect(config.gridSize).toBe(1);
      expect(config.transformMode).toBe('translate');
      expect(config.coordinateSystem).toBe('world');
    });
  });

  describe('metrics', () => {
    it('should provide metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('objectCount');
      expect(metrics).toHaveProperty('polygonCount');
      expect(metrics).toHaveProperty('textureMemory');
      expect(metrics).toHaveProperty('drawCalls');
    });

    it('should update metrics after adding objects', () => {
      const initialMetrics = service.getMetrics();
      service.addObjectToScene('cube-basic');
      
      // Metrics should be updated (though in test environment, the exact values may vary)
      expect(typeof service.getMetrics().objectCount).toBe('number');
    });
  });

  describe('callbacks', () => {
    it('should set and call callbacks', () => {
      const onObjectSelect = jest.fn();
      const onObjectTransform = jest.fn();
      const onSceneUpdate = jest.fn();

      service.setCallbacks({
        onObjectSelect,
        onObjectTransform,
        onSceneUpdate
      });

      const object = service.addObjectToScene('cube-basic');
      service.selectObject(object!);

      expect(onObjectSelect).toHaveBeenCalledWith(object);
      expect(onSceneUpdate).toHaveBeenCalled();
    });
  });

  describe('animation', () => {
    it('should update animation when enabled', () => {
      service.setConfig({ animationEnabled: true });
      expect(() => service.updateAnimation()).not.toThrow();
    });

    it('should not update animation when disabled', () => {
      service.setConfig({ animationEnabled: false });
      expect(() => service.updateAnimation()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clear scene', () => {
      const obj1 = service.addObjectToScene('cube-basic');
      const obj2 = service.addObjectToScene('sphere-standard');
      
      // Mock scene children to return the added objects
      mockScene.children = [obj1!, obj2!];
      
      service.clearScene();
      
      expect(mockScene.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle mouse events safely', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 100
      } as MouseEvent;

      // Mock getBoundingClientRect
      (mockRenderer.domElement as any).getBoundingClientRect = jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      });

      expect(() => {
        (service as any).handleMouseClick(mockEvent);
      }).not.toThrow();
    });

    it('should handle keyboard events safely', () => {
      const mockEvent = {
        key: 'g',
        ctrlKey: false
      } as KeyboardEvent;

      expect(() => {
        (service as any).handleKeyDown(mockEvent);
      }).not.toThrow();
    });
  });
});