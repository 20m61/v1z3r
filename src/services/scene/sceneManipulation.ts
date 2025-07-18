/**
 * 3D Scene Manipulation Service
 * Provides real-time 3D object manipulation and scene management
 */

import * as THREE from 'three';
import { errorHandler } from '@/utils/errorHandler';

export interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group';
  geometry: string;
  material: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  visible: boolean;
  userData: Record<string, any>;
}

export interface SceneManipulationConfig {
  enableGizmos: boolean;
  snapToGrid: boolean;
  gridSize: number;
  transformMode: 'translate' | 'rotate' | 'scale';
  coordinateSystem: 'world' | 'local';
  animationEnabled: boolean;
  animationSpeed: number;
}

export interface SceneMetrics {
  objectCount: number;
  polygonCount: number;
  textureMemory: number;
  drawCalls: number;
  fps: number;
}

export class SceneManipulationService {
  private static instance: SceneManipulationService | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private selectedObject: THREE.Object3D | null = null;
  private transformControls: any = null; // Will be loaded dynamically
  private objectLibrary: Map<string, THREE.Object3D> = new Map();
  private animationMixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  
  private config: SceneManipulationConfig = {
    enableGizmos: true,
    snapToGrid: false,
    gridSize: 1,
    transformMode: 'translate',
    coordinateSystem: 'world',
    animationEnabled: true,
    animationSpeed: 1.0,
  };

  private metrics: SceneMetrics = {
    objectCount: 0,
    polygonCount: 0,
    textureMemory: 0,
    drawCalls: 0,
    fps: 0,
  };

  private callbacks: {
    onObjectSelect?: (object: THREE.Object3D | null) => void;
    onObjectTransform?: (object: THREE.Object3D) => void;
    onSceneUpdate?: (scene: THREE.Scene) => void;
  } = {};

  private constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.initializeObjectLibrary();
    this.setupEventListeners();
    this.loadTransformControls();
  }

  static getInstance(scene?: THREE.Scene, camera?: THREE.PerspectiveCamera, renderer?: THREE.WebGLRenderer): SceneManipulationService {
    if (!SceneManipulationService.instance) {
      if (!scene || !camera || !renderer) {
        throw new Error('SceneManipulationService requires scene, camera, and renderer for initialization');
      }
      SceneManipulationService.instance = new SceneManipulationService(scene, camera, renderer);
    }
    return SceneManipulationService.instance;
  }

  /**
   * Initialize the 3D object library
   */
  private initializeObjectLibrary(): void {
    // Basic geometries
    const geometries = [
      { name: 'cube', geometry: new THREE.BoxGeometry(1, 1, 1) },
      { name: 'sphere', geometry: new THREE.SphereGeometry(0.5, 32, 32) },
      { name: 'cylinder', geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 32) },
      { name: 'cone', geometry: new THREE.ConeGeometry(0.5, 1, 32) },
      { name: 'torus', geometry: new THREE.TorusGeometry(0.5, 0.2, 16, 100) },
      { name: 'plane', geometry: new THREE.PlaneGeometry(1, 1) },
      { name: 'tetrahedron', geometry: new THREE.TetrahedronGeometry(0.5) },
      { name: 'octahedron', geometry: new THREE.OctahedronGeometry(0.5) },
      { name: 'dodecahedron', geometry: new THREE.DodecahedronGeometry(0.5) },
      { name: 'icosahedron', geometry: new THREE.IcosahedronGeometry(0.5) },
    ];

    // Basic materials
    const materials = [
      { name: 'basic', material: new THREE.MeshBasicMaterial({ color: 0x00ff00 }) },
      { name: 'lambert', material: new THREE.MeshLambertMaterial({ color: 0x00ff00 }) },
      { name: 'phong', material: new THREE.MeshPhongMaterial({ color: 0x00ff00 }) },
      { name: 'standard', material: new THREE.MeshStandardMaterial({ color: 0x00ff00 }) },
      { name: 'physical', material: new THREE.MeshPhysicalMaterial({ color: 0x00ff00 }) },
    ];

    // Create object library
    geometries.forEach(({ name: geoName, geometry }) => {
      materials.forEach(({ name: matName, material }) => {
        const mesh = new THREE.Mesh(geometry, material.clone());
        mesh.userData = { 
          libraryItem: true,
          geometryType: geoName,
          materialType: matName,
        };
        this.objectLibrary.set(`${geoName}-${matName}`, mesh);
      });
    });

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    ambientLight.userData = { libraryItem: true, type: 'ambient-light' };
    this.objectLibrary.set('ambient-light', ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.userData = { libraryItem: true, type: 'directional-light' };
    this.objectLibrary.set('directional-light', directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 5, 0);
    pointLight.userData = { libraryItem: true, type: 'point-light' };
    this.objectLibrary.set('point-light', pointLight);

    const spotLight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 6);
    spotLight.position.set(0, 5, 0);
    spotLight.userData = { libraryItem: true, type: 'spot-light' };
    this.objectLibrary.set('spot-light', spotLight);

    errorHandler.info(`Object library initialized with ${this.objectLibrary.size} items`);
  }

  /**
   * Load transform controls dynamically
   */
  private async loadTransformControls(): Promise<void> {
    try {
      const { TransformControls } = await import('three/examples/jsm/controls/TransformControls.js');
      
      this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
      this.transformControls.setMode(this.config.transformMode);
      this.transformControls.setSpace(this.config.coordinateSystem);
      this.transformControls.setSize(0.8);
      this.transformControls.setRotationSnap(Math.PI / 12);
      this.transformControls.setTranslationSnap(this.config.gridSize);
      
      // Event listeners
      this.transformControls.addEventListener('change', () => {
        if (this.selectedObject) {
          this.callbacks.onObjectTransform?.(this.selectedObject);
        }
      });

      this.transformControls.addEventListener('dragging-changed', (event: any) => {
        // Disable camera controls during transformation
        // This would typically be handled by orbit controls
      });

      this.scene.add(this.transformControls);
      errorHandler.info('Transform controls loaded');
    } catch (error) {
      errorHandler.error('Failed to load transform controls', error as Error);
    }
  }

  /**
   * Setup event listeners for mouse interaction
   */
  private setupEventListeners(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', (event) => {
      this.handleMouseClick(event);
    });

    canvas.addEventListener('mousemove', (event) => {
      this.handleMouseMove(event);
    });

    canvas.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    // Make canvas focusable for keyboard events
    canvas.tabIndex = 0;
  }

  /**
   * Handle mouse click for object selection
   */
  private handleMouseClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      this.selectObject(object);
    } else {
      this.selectObject(null);
    }
  }

  /**
   * Handle mouse move for hover effects
   */
  private handleMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.selectedObject) return;

    switch (event.key) {
      case 'g':
        this.setTransformMode('translate');
        break;
      case 'r':
        this.setTransformMode('rotate');
        break;
      case 's':
        this.setTransformMode('scale');
        break;
      case 'Delete':
        this.deleteSelectedObject();
        break;
      case 'd':
        if (event.ctrlKey) {
          this.duplicateSelectedObject();
        }
        break;
    }
  }

  /**
   * Select an object
   */
  selectObject(object: THREE.Object3D | null): void {
    if (this.selectedObject) {
      // Remove selection outline
      this.removeSelectionOutline(this.selectedObject);
    }

    this.selectedObject = object;

    if (object) {
      // Add selection outline
      this.addSelectionOutline(object);
      
      // Attach transform controls
      if (this.transformControls) {
        this.transformControls.attach(object);
      }
    } else {
      // Detach transform controls
      if (this.transformControls) {
        this.transformControls.detach();
      }
    }

    this.callbacks.onObjectSelect?.(object);
  }

  /**
   * Add selection outline to object
   */
  private addSelectionOutline(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh) {
      const edges = new THREE.EdgesGeometry(object.geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      wireframe.userData = { isSelectionOutline: true };
      object.add(wireframe);
    }
  }

  /**
   * Remove selection outline from object
   */
  private removeSelectionOutline(object: THREE.Object3D): void {
    const outlines = object.children.filter(child => 
      child.userData.isSelectionOutline
    );
    outlines.forEach(outline => {
      object.remove(outline);
      (outline as any).geometry?.dispose();
      ((outline as any).material as THREE.Material)?.dispose();
    });
  }

  /**
   * Add object to scene from library
   */
  addObjectToScene(libraryKey: string, position?: THREE.Vector3): THREE.Object3D | null {
    const templateObject = this.objectLibrary.get(libraryKey);
    if (!templateObject) {
      errorHandler.error(`Object not found in library: ${libraryKey}`);
      return null;
    }

    const newObject = templateObject.clone();
    newObject.userData = { 
      ...templateObject.userData,
      id: this.generateObjectId(),
      libraryItem: false,
    };

    if (position) {
      newObject.position.copy(position);
    }

    this.scene.add(newObject);
    this.updateMetrics();
    this.callbacks.onSceneUpdate?.(this.scene);

    errorHandler.info(`Added object to scene: ${libraryKey}`);
    return newObject;
  }

  /**
   * Remove object from scene
   */
  removeObjectFromScene(object: THREE.Object3D): void {
    if (object === this.selectedObject) {
      this.selectObject(null);
    }

    this.scene.remove(object);
    this.disposeObject(object);
    this.updateMetrics();
    this.callbacks.onSceneUpdate?.(this.scene);
  }

  /**
   * Delete selected object
   */
  deleteSelectedObject(): void {
    if (this.selectedObject) {
      this.removeObjectFromScene(this.selectedObject);
    }
  }

  /**
   * Duplicate selected object
   */
  duplicateSelectedObject(): THREE.Object3D | null {
    if (!this.selectedObject) return null;

    const duplicated = this.selectedObject.clone();
    duplicated.userData = {
      ...this.selectedObject.userData,
      id: this.generateObjectId(),
    };

    // Offset position slightly
    duplicated.position.x += 1;
    duplicated.position.z += 1;

    this.scene.add(duplicated);
    this.selectObject(duplicated);
    this.updateMetrics();
    this.callbacks.onSceneUpdate?.(this.scene);

    return duplicated;
  }

  /**
   * Set transform mode
   */
  setTransformMode(mode: SceneManipulationConfig['transformMode']): void {
    this.config.transformMode = mode;
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  /**
   * Set coordinate system
   */
  setCoordinateSystem(system: SceneManipulationConfig['coordinateSystem']): void {
    this.config.coordinateSystem = system;
    if (this.transformControls) {
      this.transformControls.setSpace(system);
    }
  }

  /**
   * Toggle grid snapping
   */
  toggleGridSnap(): void {
    this.config.snapToGrid = !this.config.snapToGrid;
    if (this.transformControls) {
      this.transformControls.setTranslationSnap(
        this.config.snapToGrid ? this.config.gridSize : null
      );
    }
  }

  /**
   * Update animation
   */
  updateAnimation(): void {
    if (!this.config.animationEnabled) return;

    const deltaTime = this.clock.getDelta();
    
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime * this.config.animationSpeed);
    }

    // Update object animations
    this.scene.traverse((object) => {
      if (object.userData.animated) {
        // Apply simple rotation animation
        object.rotation.y += deltaTime * 0.5;
      }
    });
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    let objectCount = 0;
    let polygonCount = 0;

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        objectCount++;
        if (object.geometry) {
          const positionAttribute = object.geometry.attributes.position;
          if (positionAttribute) {
            polygonCount += positionAttribute.count / 3;
          }
        }
      }
    });

    this.metrics.objectCount = objectCount;
    this.metrics.polygonCount = polygonCount;
    this.metrics.drawCalls = this.renderer.info.render.calls;
  }

  /**
   * Dispose object resources
   */
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }

  /**
   * Generate unique object ID
   */
  private generateObjectId(): string {
    return `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get object library
   */
  getObjectLibrary(): Map<string, THREE.Object3D> {
    return this.objectLibrary;
  }

  /**
   * Get selected object
   */
  getSelectedObject(): THREE.Object3D | null {
    return this.selectedObject;
  }

  /**
   * Get configuration
   */
  getConfig(): SceneManipulationConfig {
    return { ...this.config };
  }

  /**
   * Get metrics
   */
  getMetrics(): SceneMetrics {
    return { ...this.metrics };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<SceneManipulationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: Partial<typeof this.callbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clear scene
   */
  clearScene(): void {
    const objectsToRemove = this.scene.children.filter(child => 
      !child.userData.isHelper && 
      !child.userData.isTransformControls
    );
    
    objectsToRemove.forEach(object => {
      this.removeObjectFromScene(object);
    });
  }

  /**
   * Export scene data
   */
  exportScene(): SceneObject[] {
    const objects: SceneObject[] = [];
    
    this.scene.traverse((object) => {
      if (object.userData.libraryItem === false) {
        objects.push({
          id: object.userData.id,
          name: object.name || 'Unnamed Object',
          type: object.type as any,
          geometry: object.userData.geometryType || 'unknown',
          material: object.userData.materialType || 'unknown',
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
          visible: object.visible,
          userData: object.userData,
        });
      }
    });
    
    return objects;
  }

  /**
   * Import scene data
   */
  importScene(sceneData: SceneObject[]): void {
    this.clearScene();
    
    sceneData.forEach(objectData => {
      const libraryKey = `${objectData.geometry}-${objectData.material}`;
      const object = this.addObjectToScene(libraryKey);
      
      if (object) {
        object.name = objectData.name;
        object.position.copy(objectData.position);
        object.rotation.copy(objectData.rotation);
        object.scale.copy(objectData.scale);
        object.visible = objectData.visible;
        object.userData = { ...object.userData, ...objectData.userData };
      }
    });
  }
}

export default SceneManipulationService;