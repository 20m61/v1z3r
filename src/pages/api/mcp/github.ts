import { NextApiRequest, NextApiResponse } from 'next';
import { Octokit } from '@octokit/rest';

interface GitHubApiResponse {
  content?: string;
  error?: string;
  metadata?: {
    owner: string;
    repo: string;
    path: string;
    size: number;
    sha: string;
    url: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GitHubApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { owner, repo, path } = req.query;

  // Validate required parameters
  if (!owner || !repo) {
    return res.status(400).json({ 
      error: 'Missing required parameters: owner and repo are required' 
    });
  }

  if (typeof owner !== 'string' || typeof repo !== 'string') {
    return res.status(400).json({ 
      error: 'Invalid parameter types: owner and repo must be strings' 
    });
  }

  // Get GitHub token from environment
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(500).json({ 
      error: 'GitHub token not configured. Please set GITHUB_TOKEN environment variable.' 
    });
  }

  try {
    const octokit = new Octokit({
      auth: githubToken,
    });

    // If no path specified, get repository info
    if (!path) {
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      return res.status(200).json({
        content: JSON.stringify({
          name: repoData.name,
          description: repoData.description,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          language: repoData.language,
          updated_at: repoData.updated_at,
          html_url: repoData.html_url,
        }, null, 2),
        metadata: {
          owner,
          repo,
          path: '',
          size: 0,
          sha: '',
          url: repoData.html_url,
        },
      });
    }

    // Get file content
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path as string,
    });

    // Handle directory listing
    if (Array.isArray(fileData)) {
      const dirListing = fileData.map(item => ({
        name: item.name,
        type: item.type,
        size: item.size,
        path: item.path,
        url: item.html_url,
      }));

      return res.status(200).json({
        content: JSON.stringify(dirListing, null, 2),
        metadata: {
          owner,
          repo,
          path: path as string,
          size: dirListing.length,
          sha: '',
          url: `https://github.com/${owner}/${repo}/tree/main/${path}`,
        },
      });
    }

    // Handle file content
    if (fileData.type === 'file' && 'content' in fileData) {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      
      return res.status(200).json({
        content,
        metadata: {
          owner,
          repo,
          path: path as string,
          size: fileData.size || 0,
          sha: fileData.sha,
          url: fileData.html_url || '',
        },
      });
    }

    return res.status(400).json({ 
      error: 'Unsupported content type or invalid path' 
    });

  } catch (error: any) {
    console.error('GitHub API Error:', error);

    // Handle specific GitHub API errors
    if (error.status === 404) {
      return res.status(404).json({ 
        error: `Repository or path not found: ${owner}/${repo}${path ? `/${path}` : ''}` 
      });
    }
    
    if (error.status === 401) {
      return res.status(401).json({ 
        error: 'GitHub authentication failed. Please check your GitHub token.' 
      });
    }

    if (error.status === 403) {
      return res.status(403).json({ 
        error: 'GitHub API rate limit exceeded or insufficient permissions.' 
      });
    }

    return res.status(500).json({ 
      error: `GitHub API error: ${error.message || 'Unknown error'}` 
    });
  }
}