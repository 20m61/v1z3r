import { NextApiRequest, NextApiResponse } from 'next'
import githubHandler from '../pages/api/mcp/github'
import playwrightHandler from '../pages/api/mcp/playwright'

// Mock fetch for GitHub API tests
global.fetch = jest.fn()

describe('MCP Integration Tests', () => {
  let req: Partial<NextApiRequest>
  let res: Partial<NextApiResponse>

  beforeEach(() => {
    req = {
      method: 'GET',
      query: {}
    }
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res)
    } as any

    jest.clearAllMocks()
  })

  describe('GitHub MCP Server', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'mock-token'
    })

    afterEach(() => {
      delete process.env.GITHUB_TOKEN
    })

    it('should return repository data for valid request', async () => {
      const mockRepo = {
        id: 123,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        private: false,
        description: 'Test repository',
        url: 'https://github.com/owner/test-repo',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-12-01T00:00:00Z',
        language: 'TypeScript',
        stargazers_count: 42,
        forks_count: 7
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRepo)
      })

      req.query = { owner: 'testowner', repo: 'testrepo' }

      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ repository: mockRepo })
    })

    it('should handle missing parameters', async () => {
      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required parameters: owner and repo'
      })
    })

    it('should handle missing GitHub token', async () => {
      delete process.env.GITHUB_TOKEN
      req.query = { owner: 'testowner', repo: 'testrepo' }

      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'GitHub token not configured'
      })
    })

    it('should handle repository not found', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      req.query = { owner: 'testowner', repo: 'nonexistent' }

      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Repository not found'
      })
    })

    it('should handle API rate limit', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      req.query = { owner: 'testowner', repo: 'testrepo' }

      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'GitHub API rate limit exceeded or access denied'
      })
    })

    it('should handle method not allowed', async () => {
      req.method = 'POST'
      req.query = { owner: 'testowner', repo: 'testrepo' }

      await githubHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Method not allowed'
      })
    })
  })

  describe('Playwright MCP Server', () => {
    beforeEach(() => {
      req.method = 'POST'
      req.body = {}
    })

    it('should run tests successfully', async () => {
      req.body = { action: 'run-tests', testPattern: '*.spec.ts' }

      await playwrightHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        results: {
          passed: 12,
          failed: 0,
          skipped: 2,
          total: 14,
          duration: 15432
        },
        message: 'Playwright tests completed. Pattern: *.spec.ts'
      })
    })

    it('should perform health check', async () => {
      req.body = { action: 'health-check' }

      await playwrightHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Playwright MCP server is running'
      })
    })

    it('should handle missing action parameter', async () => {
      await playwrightHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Missing required parameter: action'
      })
    })

    it('should handle unknown action', async () => {
      req.body = { action: 'unknown-action' }

      await playwrightHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Unknown action: unknown-action'
      })
    })

    it('should handle method not allowed', async () => {
      req.method = 'GET'

      await playwrightHandler(req as NextApiRequest, res as NextApiResponse)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Method not allowed'
      })
    })
  })
})