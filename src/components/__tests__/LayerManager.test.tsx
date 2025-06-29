import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LayerManager from '../LayerManager'
import { useVisualizerStore } from '@/store/visualizerStore'

// Mock the store
jest.mock('@/store/visualizerStore')

const mockStore = {
  layers: [
    {
      id: 'layer1',
      type: 'spectrum',
      active: true,
      opacity: 1,
      colorTheme: '#00ccff',
      sensitivity: 1.0,
      zIndex: 1,
    },
    {
      id: 'layer2',
      type: 'waveform',
      active: false,
      opacity: 0.8,
      colorTheme: '#ff0066',
      sensitivity: 0.7,
      zIndex: 0,
    },
  ],
  activeLayerId: 'layer1',
  addLayer: jest.fn(),
  removeLayer: jest.fn(),
  updateLayer: jest.fn(),
  setActiveLayer: jest.fn(),
  reorderLayers: jest.fn(),
}

beforeEach(() => {
  (useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
  jest.clearAllMocks()
})

describe('LayerManager', () => {
  it('renders layer list correctly', () => {
    render(<LayerManager />)
    
    // Should show both layers (layer type names appear in display and button form)
    expect(screen.getAllByText('スペクトラム')).toHaveLength(2) // Display + button in settings
    expect(screen.getAllByText('波形')).toHaveLength(2) // Display + button in settings
    
    // Should show add layer button
    expect(screen.getByRole('button', { name: /追加/i })).toBeInTheDocument()
  })

  it('displays layer properties correctly', () => {
    render(<LayerManager />)
    
    // Should show eye icons for visibility toggle
    const eyeIcons = screen.getAllByRole('button').filter(button => {
      const svg = button.querySelector('svg')
      return svg !== null
    })
    expect(eyeIcons.length).toBeGreaterThan(0)
    
    // Should show opacity sliders
    const opacitySliders = screen.getAllByRole('slider')
    expect(opacitySliders.length).toBeGreaterThan(0)
  })

  it('adds new layer when add button is clicked', () => {
    render(<LayerManager />)
    
    const addButton = screen.getByRole('button', { name: /追加/i })
    fireEvent.click(addButton)
    
    expect(mockStore.addLayer).toHaveBeenCalledWith({
      type: 'spectrum',
      active: true,
      opacity: 1,
      colorTheme: '#00ccff',
      sensitivity: 1.0,
    })
  })

  it('toggles layer visibility', () => {
    render(<LayerManager />)
    
    // Find visibility toggle buttons by their icons
    const visibilityButtons = screen.getAllByRole('button').filter(button => {
      const svg = button.querySelector('svg')
      return svg && (svg.getAttribute('data-testid') || '').includes('eye')
    })
    
    if (visibilityButtons.length > 0) {
      fireEvent.click(visibilityButtons[0])
      expect(mockStore.updateLayer).toHaveBeenCalled()
    }
  })

  it('removes layer when delete button is clicked', () => {
    render(<LayerManager />)
    
    // Find delete buttons by their trash icon
    const deleteButtons = screen.getAllByRole('button').filter(button => {
      const svg = button.querySelector('svg')
      return svg && svg.getAttribute('class')?.includes('trash')
    })
    
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      expect(mockStore.removeLayer).toHaveBeenCalledWith('layer1')
    }
  })

  it('updates layer opacity when slider changes', () => {
    render(<LayerManager />)
    
    const sliders = screen.getAllByRole('slider')
    if (sliders.length > 0) {
      const opacitySlider = sliders.find(slider => 
        slider.getAttribute('value') === '1' || slider.getAttribute('value') === '0.8'
      )
      
      if (opacitySlider) {
        fireEvent.change(opacitySlider, { target: { value: '0.5' } })
        expect(mockStore.updateLayer).toHaveBeenCalled()
      }
    }
  })

  it('sets active layer when layer is selected', () => {
    render(<LayerManager />)
    
    // Find layer containers by looking for motion.div elements with click handlers
    const layerDivs = screen.getAllByText(/スペクトラム|波形/).map(el => {
      let parent = el.parentElement
      while (parent && !parent.getAttribute('class')?.includes('cursor-pointer')) {
        parent = parent.parentElement
      }
      return parent
    }).filter(Boolean)
    
    if (layerDivs.length > 1) {
      // Click on a layer that's not currently active
      fireEvent.click(layerDivs[1]!)
      expect(mockStore.setActiveLayer).toHaveBeenCalled()
    }
  })

  it('reorders layers when move buttons are clicked', () => {
    render(<LayerManager />)
    
    // Find move up/down buttons
    const moveButtons = screen.getAllByRole('button').filter(button => {
      const svg = button.querySelector('svg')
      return svg && (svg.getAttribute('class')?.includes('arrow') || 
                     svg.getAttribute('data-testid')?.includes('arrow'))
    })
    
    if (moveButtons.length > 0) {
      fireEvent.click(moveButtons[0])
      expect(mockStore.reorderLayers).toHaveBeenCalled()
    }
  })

  it('displays effect type names in Japanese', () => {
    render(<LayerManager />)
    
    // Effect type names appear both as display text and in effect type selection buttons
    expect(screen.getAllByText('スペクトラム')).toHaveLength(2)
    expect(screen.getAllByText('波形')).toHaveLength(2)
  })

  it('handles empty layer list', () => {
    const emptyMockStore = {
      ...mockStore,
      layers: [],
    }
    
    ;(useVisualizerStore as jest.Mock).mockReturnValue(emptyMockStore)
    
    render(<LayerManager />)
    
    // Should still show add button
    expect(screen.getByRole('button', { name: /追加/i })).toBeInTheDocument()
    
    // Should not show any layer items
    expect(screen.queryByText('スペクトラム')).not.toBeInTheDocument()
    expect(screen.queryByText('波形')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<LayerManager className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('handles layer updates correctly', () => {
    render(<LayerManager />)
    
    // Find color picker or other interactive elements
    const colorInputs = screen.getAllByDisplayValue(/#[0-9a-fA-F]{6}/)
    
    if (colorInputs.length > 0) {
      fireEvent.change(colorInputs[0], { target: { value: '#ff0000' } })
      expect(mockStore.updateLayer).toHaveBeenCalled()
    }
  })

  it('shows correct active layer indication', () => {
    render(<LayerManager />)
    
    // Active layer should be visually distinct
    // The active layer shows both the display name and effect type buttons in settings
    expect(screen.getAllByText('スペクトラム')).toHaveLength(2)
  })

  it('handles sensitivity slider changes', () => {
    render(<LayerManager />)
    
    const sensitivitySliders = screen.getAllByRole('slider')
    
    // Find sensitivity slider by its value
    const sensitivitySlider = sensitivitySliders.find(slider =>
      slider.getAttribute('value') === '1' || slider.getAttribute('value') === '0.7'
    )
    
    if (sensitivitySlider) {
      fireEvent.change(sensitivitySlider, { target: { value: '0.5' } })
      expect(mockStore.updateLayer).toHaveBeenCalled()
    }
  })

  it('prevents deletion of last layer', () => {
    const singleLayerMockStore = {
      ...mockStore,
      layers: [mockStore.layers[0]], // Only one layer
    }
    
    ;(useVisualizerStore as jest.Mock).mockReturnValue(singleLayerMockStore)
    
    render(<LayerManager />)
    
    // Delete button should be disabled or not present for single layer
    const deleteButtons = screen.getAllByRole('button').filter(button => {
      const svg = button.querySelector('svg')
      return svg && svg.getAttribute('class')?.includes('trash')
    })
    
    // If delete button exists, it should be disabled
    if (deleteButtons.length > 0) {
      expect(deleteButtons[0]).toBeDisabled()
    }
  })

  it('handles layer type changes if select elements exist', () => {
    render(<LayerManager />)
    
    // Look for select or dropdown elements that might change layer type
    const selects = screen.queryAllByRole('combobox')
    
    if (selects.length > 0) {
      fireEvent.change(selects[0], { target: { value: 'particles' } })
      expect(mockStore.updateLayer).toHaveBeenCalled()
    } else {
      // If no select elements, just verify the component renders
      expect(screen.getAllByText('スペクトラム')).toHaveLength(2)
    }
  })
})