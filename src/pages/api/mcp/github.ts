import { NextApiRequest, NextApiResponse } from 'next'

interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  url: string
  created_at: string
  updated_at: string
  language: string | null
  stargazers_count: number
  forks_count: number
}

interface GitHubApiResponse {
  repository?: GitHubRepository
  error?: string
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GitHubApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { owner, repo } = req.query

  if (!owner || !repo) {
    return res.status(400).json({ 
      error: 'Missing required parameters: owner and repo' 
    })
  }

  const githubToken = process.env.GITHUB_TOKEN

  if (!githubToken) {
    return res.status(500).json({ 
      error: 'GitHub token not configured' 
    })
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'v1z3r-mcp'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Repository not found' 
        })
      }
      
      if (response.status === 403) {
        return res.status(403).json({ 
          error: 'GitHub API rate limit exceeded or access denied' 
        })
      }

      return res.status(response.status).json({ 
        error: `GitHub API error: ${response.statusText}` 
      })
    }

    const repository: GitHubRepository = await response.json()

    return res.status(200).json({ repository })

  } catch (error) {
    console.error('GitHub MCP error:', error)
    return res.status(500).json({ 
      error: 'Internal server error while fetching repository data' 
    })
  }
}