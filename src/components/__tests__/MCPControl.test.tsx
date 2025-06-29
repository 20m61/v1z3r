import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MCPControl from '../MCPControl'

// Mock fetch for API calls
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

beforeEach(() => {
  mockFetch.mockClear()
})

describe('MCPControl', () => {
  it('renders GitHub and Playwright controls', () => {
    render(<MCPControl />)
    
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Playwright')).toBeInTheDocument()
    
    // GitHub tab should be active by default
    expect(screen.getByPlaceholderText('Repository Owner')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Repository Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('File Path (optional)')).toBeInTheDocument()
    
    expect(screen.getByText('Fetch Content')).toBeInTheDocument()
    
    // Switch to Playwright tab
    fireEvent.click(screen.getByText('Playwright'))
    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('Fetch Page')).toBeInTheDocument()
  })

  it('disables GitHub fetch button when required fields are empty', () => {
    render(<MCPControl />)
    
    const fetchButton = screen.getByText('Fetch Content')
    expect(fetchButton).toBeDisabled()
    
    // Fill owner but not repo
    fireEvent.change(screen.getByPlaceholderText('Repository Owner'), { 
      target: { value: 'testowner' } 
    })
    expect(fetchButton).toBeDisabled()
    
    // Fill both owner and repo
    fireEvent.change(screen.getByPlaceholderText('Repository Name'), { 
      target: { value: 'testrepo' } 
    })
    expect(fetchButton).not.toBeDisabled()
  })

  it('disables Playwright fetch button when URL is empty', () => {
    render(<MCPControl />)
    
    // Switch to Playwright tab
    fireEvent.click(screen.getByText('Playwright'))
    
    const fetchButton = screen.getByText('Fetch Page')
    expect(fetchButton).toBeDisabled()
    
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { 
      target: { value: 'https://example.com' } 
    })
    expect(fetchButton).not.toBeDisabled()
  })

  it('calls GitHub API and displays result', async () => {
    const mockResponse = {
      content: 'test content',
      metadata: { owner: 'test', repo: 'repo', path: '', size: 100, sha: 'abc123', url: 'https://github.com/test/repo' }
    }
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    render(<MCPControl />)
    
    fireEvent.change(screen.getByPlaceholderText('Repository Owner'), { 
      target: { value: 'testowner' } 
    })
    fireEvent.change(screen.getByPlaceholderText('Repository Name'), { 
      target: { value: 'testrepo' } 
    })
    fireEvent.change(screen.getByPlaceholderText('File Path (optional)'), { 
      target: { value: 'README.md' } 
    })
    
    fireEvent.click(screen.getByText('Fetch Content'))
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/github?owner=testowner&repo=testrepo&path=README.md')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument()
    })
  })

  it('calls Playwright API and displays result', async () => {
    const mockResponse = 'HTML content'
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockResponse),
      headers: {
        get: () => 'text/html'
      }
    } as any)

    render(<MCPControl />)
    
    // Switch to Playwright tab
    fireEvent.click(screen.getByText('Playwright'))
    
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { 
      target: { value: 'https://example.com' } 
    })
    
    fireEvent.click(screen.getByText('Fetch Page'))
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/playwright?url=https%3A%2F%2Fexample.com')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<MCPControl />)
    
    fireEvent.change(screen.getByPlaceholderText('Repository Owner'), { 
      target: { value: 'testowner' } 
    })
    fireEvent.change(screen.getByPlaceholderText('Repository Name'), { 
      target: { value: 'testrepo' } 
    })
    
    fireEvent.click(screen.getByText('Fetch Content'))
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument()
    })
    
    // Check that error is displayed
    expect(screen.getByText('Error:')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('shows loading state during API calls', async () => {
    // Create a promise that we can control
    let resolvePromise: (value: any) => void
    const mockPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    
    mockFetch.mockReturnValueOnce(mockPromise as any)

    render(<MCPControl />)
    
    fireEvent.change(screen.getByPlaceholderText('Repository Owner'), { 
      target: { value: 'testowner' } 
    })
    fireEvent.change(screen.getByPlaceholderText('Repository Name'), { 
      target: { value: 'testrepo' } 
    })
    
    const fetchButton = screen.getByText('Fetch Content')
    fireEvent.click(fetchButton)
    
    // Button should show loading text and be disabled
    expect(screen.getByText('Fetching...')).toBeInTheDocument()
    expect(fetchButton).toBeDisabled()
    
    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ content: 'test' }),
    })
    
    await waitFor(() => {
      expect(screen.getByText('Fetch Content')).toBeInTheDocument()
      expect(fetchButton).not.toBeDisabled()
    })
  })
})